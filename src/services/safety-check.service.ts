import { SafetyCheck } from "../models/safety-check.model";
import { User } from "../models/user.model";
import ResourceNotFoundException from "../exceptions/ResourceNotFoundException";
import { NotificationService } from "./notification.service";

type StartPayload = {
    userId: string;
    activity: string;
    intervalMinutes: number;
    contactIds: string[];
    startLocation?: { latitude: number; longitude: number };
};

class SafetyCheckServiceClass {
    private secondsUntil(date: Date): number {
        return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    }

    // start a new safety check for the user, cancelling any existing active check
    public async start(payload: StartPayload) {
        const { userId, activity, intervalMinutes, contactIds, startLocation } = payload;

        // cancel any existing active check for this user
        await SafetyCheck.updateMany(
            { userId, status: { $in: ["active", "triggered"] } },
            { status: "cancelled" }
        );

        const now = new Date();
        const nextCheckAt = new Date(now.getTime() + intervalMinutes * 60 * 1000);
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h max

        const check = await SafetyCheck.create({
            userId,
            activity,
            intervalMinutes,
            contactIds,
            nextCheckAt,
            expiresAt,
            startLocation,
            lastLocation: startLocation,
        });

        await NotificationService.sendToUser(
            userId,
            "SAFETY_CHECK_STARTED",
            {
                activity,
                checkId: check._id.toString(),
                minutesLeft: intervalMinutes,
                secondsLeft: this.secondsUntil(nextCheckAt),
            }
        );
        // using expo-server-sdk or node-cron
        console.log(`[SafetyCheck] started for user=${userId}, next check at ${nextCheckAt}`);

        return check;
    }

    // extend the next check time by additional minutes
    public async extend(userId: string, additionalMinutes: number) {
        const check = await SafetyCheck.findOne({ userId, status: "active" });
        if (!check) throw new ResourceNotFoundException("No active safety check found");
        check.nextCheckAt = new Date(check.nextCheckAt.getTime() + additionalMinutes * 60 * 1000);
        await check.save();
        return check;
    }

    // update the last known location for the active safety check
    public async updateLocation(userId: string, location: { latitude: number; longitude: number }) {

        return SafetyCheck.findOneAndUpdate(
            { userId, status: "active" },
            { lastLocation: location },
            { new: true }
        );
    }

    // stop the active safety check, optionally providing the end location
    public async stop(userId: string, endLocation?: { latitude: number; longitude: number }) {
        const check = await SafetyCheck.findOne({ userId, status: { $in: ["active", "triggered"] } });
        if (!check) throw new ResourceNotFoundException("No active safety check");

        check.status = "cancelled";
        if (endLocation) check.lastLocation = endLocation;
        await check.save();

        await NotificationService.sendToUser(userId, "SAFETY_CHECK_ENDED", {
            reason: "stopped",
            checkId: check._id.toString(),
        });

        return check;
    }

    // confirm the user is safe and end the active alert/check
    public async confirm(userId: string) {
        const check = await SafetyCheck.findOne({ userId, status: { $in: ["active", "triggered"] } });
        if (!check) throw new ResourceNotFoundException("No active safety check found");

        const wasTriggered = check.status === "triggered";

        check.status = "confirmed";
        await check.save();

        await NotificationService.sendToUser(userId, "SAFETY_CHECK_ENDED", {
            reason: "confirmed",
            checkId: check._id.toString(),
        });

        if (wasTriggered) {
            await NotificationService.sendToEmergencyContacts(
                userId,
                "SOS_RESOLVED",
                {},
                check.contactIds
            );
        }

        return check;
    }

    // cancel any active safety check for the user
    public async cancel(userId: string) {
        const result = await SafetyCheck.updateMany(
            { userId, status: "active" },
            { status: "cancelled" }
        );
        return { cancelled: result.modifiedCount };
    }

    // get the active safety check for the user, if any
    public async getActive(userId: string) {
        return SafetyCheck.findOne({ userId, status: "active" });
    }

    public async formatContactSummary(userId: string, contactIds: string[]) {
        const user = await User.findById(userId).select("emergencyContacts");
        if (!user) return "Your emergency contacts are being notified";

        const selectedContacts = user.emergencyContacts.filter((contact) =>
            contact._id && contactIds.includes(contact._id.toString())
        );
        const contacts = selectedContacts.length > 0 ? selectedContacts : user.emergencyContacts;
        const names = contacts.map((contact) => contact.name).filter(Boolean);

        if (names.length === 0) return "Your emergency contacts are being notified";
        if (names.length === 1) return `${names[0]} is being notified`;
        if (names.length === 2) return `${names[0]} and ${names[1]} are being notified`;
        return `${names[0]}, ${names[1]} and ${names.length - 2} others are being notified`;
    }
}

export const SafetyCheckService = new SafetyCheckServiceClass();
