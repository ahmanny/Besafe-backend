import cron from "node-cron";
import { SafetyCheck } from "../models/safety-check.model";
import { NotificationService } from "../services/notification.service";
import { SafetyCheckService } from "../services/safety-check.service";

const GRACE_PERIOD_MINUTES = 2; // 2 min after overdue before notifying contacts
const GRACE_PERIOD_SECONDS = GRACE_PERIOD_MINUTES * 60;

function secondsUntil(date: Date, now: Date): number {
    return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

function secondsSince(date: Date, now: Date): number {
    return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
}

export function startSafetyCheckJob() {
    // ── runs every minute 
    cron.schedule("* * * * *", async () => {
        const now = new Date();

        // send sticky State 1 tick to active checks that are not due yet
        const activeChecks = await SafetyCheck.find({
            status: "active",
            nextCheckAt: { $gt: now },
        });

        for (const check of activeChecks) {
            const secondsLeft = secondsUntil(check.nextCheckAt, now);
            const minutesLeft = Math.max(0, Math.ceil(secondsLeft / 60));

            // send tick notification to update the persistent notification
            await NotificationService.sendToUser(
                check.userId.toString(),
                "SAFETY_CHECK_TICK",
                {
                    minutesLeft,
                    secondsLeft,
                    activity: check.activity,
                    checkId: check._id.toString(),
                }
            );
        }

        // find checks overdue past grace period - notify contacts 
        const overdueChecks = await SafetyCheck.find({
            status: "active",
            nextCheckAt: {
                $lt: new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60 * 1000),
            },
        });

        for (const check of overdueChecks) {
            console.log(`[SafetyCheck Job] OVERDUE — triggering SOS for user: ${check.userId}`);

            // mark as triggered so we don't fire again
            check.status = "triggered";
            await check.save();

            const contactsSummary = await SafetyCheckService.formatContactSummary(
                check.userId.toString(),
                check.contactIds
            );

            // notify the user their contacts are being alerted
            await NotificationService.sendToUser(
                check.userId.toString(),
                "SAFETY_CHECK_OVERDUE",
                {
                    contactsSummary,
                    contactCount: check.contactIds.length,
                    checkId: check._id.toString(),
                }
            );

            // notify the emergency contacts
            await NotificationService.sendToEmergencyContacts(
                check.userId.toString(),
                "SOS_ALERT",
                {},
                check.contactIds
            );
        }
    });

    // ── runs every 30 seconds for State 2 countdown updates
    cron.schedule("*/30 * * * * *", async () => {
        const now = new Date();

        const dueChecks = await SafetyCheck.find({
            status: "active",
            nextCheckAt: {
                $lte: now,
                $gte: new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60 * 1000),
            },
        });

        for (const check of dueChecks) {
            const elapsedSeconds = secondsSince(check.nextCheckAt, now);
            const secondsLeft = Math.max(0, GRACE_PERIOD_SECONDS - elapsedSeconds);
            const minutesLeft = Math.max(0, Math.ceil(secondsLeft / 60));
            const type = elapsedSeconds < 30 ? "SAFETY_CHECK_DUE" : "SAFETY_CHECK_DUE_TICK";

            console.log(`[SafetyCheck Job] Check due for user: ${check.userId}, secondsLeft=${secondsLeft}`);
            await NotificationService.sendToUser(
                check.userId.toString(),
                type,
                {
                    minutesLeft,
                    secondsLeft,
                    checkId: check._id.toString(),
                }
            );
        }
    });

    console.log("[SafetyCheck Job] Scheduler started — running every minute and every 30 seconds");
}
