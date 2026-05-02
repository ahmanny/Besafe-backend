import Expo, {
    ExpoPushMessage,
    ExpoPushTicket,
} from "expo-server-sdk";
import { User } from "../models/user.model";

const expo = new Expo();

// ── notification types ────────────────────────────────────────────────────────
export type NotificationType =
    | "SAFETY_CHECK_STARTED"
    | "SAFETY_CHECK_TICK"
    | "SAFETY_CHECK_DUE"
    | "SAFETY_CHECK_DUE_TICK"
    | "SAFETY_CHECK_OVERDUE"
    | "SAFETY_CHECK_ENDED"
    | "SOS_ALERT"
    | "SOS_RESOLVED"
    | "CONTACT_ADDED";

type PushPayload = {
    type: NotificationType;
    data?: Record<string, unknown>;
};

type TemplateResult = {
    title: string;
    body: string;
    sound?: "default" | null;
    priority?: "default" | "normal" | "high";
    channelId?: string;
};

function asNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatMmSs(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ── templates 
const TEMPLATES: Record<
    NotificationType,
    (data?: Record<string, unknown>) => TemplateResult
> = {
    SAFETY_CHECK_STARTED: (data) => ({
        title: "Safety check active",
        body: `${data?.activity ?? "Safety check"} · check-in in ${formatMmSs(asNumber(data?.secondsLeft, 0))}`,
        sound: null,
        priority: "normal",
        channelId: "safety-check-ongoing",
    }),
    SAFETY_CHECK_TICK: (data) => ({
        title: "Safety check active",
        body: `${data?.activity ?? "Safety check"} · check-in in ${formatMmSs(asNumber(data?.secondsLeft, 0))}`,
        sound: null,
        priority: "normal",
        channelId: "safety-check-ongoing",
    }),
    SAFETY_CHECK_DUE: (data) => ({
        title: "Are you safe?",
        body: `Contacts notified in ${formatMmSs(asNumber(data?.secondsLeft, 120))} if no response`,
        sound: "default",
        priority: "high",
        channelId: "default",
    }),
    SAFETY_CHECK_DUE_TICK: (data) => ({
        title: "Are you safe?",
        body: `Contacts notified in ${formatMmSs(asNumber(data?.secondsLeft, 120))} if no response`,
        sound: null,
        priority: "normal",
        channelId: "safety-check-ongoing",
    }),
    SAFETY_CHECK_OVERDUE: (data) => ({
        title: "Alerting your emergency contacts",
        body: String(data?.contactsSummary ?? "Your emergency contacts are being notified"),
        sound: "default",
        priority: "high",
        channelId: "default",
    }),
    SAFETY_CHECK_ENDED: (data) => ({
        title: "Safety check ended",
        body: data?.reason === "confirmed"
            ? "You confirmed you're safe. Timer reset."
            : "Safety check stopped.",
        sound: null,
        priority: "normal",
        channelId: "safety-check-ongoing",
    }),
    SOS_ALERT: (data) => ({
        title: "🚨 Emergency Alert",
        body: `${data?.name ?? "Someone"} has triggered an SOS. They may need help.`,
    }),
    SOS_RESOLVED: (data) => ({
        title: "✅ All Clear",
        body: `${data?.name ?? "Your contact"} has confirmed they are safe.`,
    }),
    CONTACT_ADDED: (data) => ({
        title: "👤 Added as Emergency Contact",
        body: `${data?.name ?? "Someone"} added you as their BeSafe emergency contact.`,
    }),
};
// ── main service ──────────────────────────────────────────────────────────────
class NotificationServiceClass {

    // ── send to a specific user by userId ─────────────────────────────────────
    public async sendToUser(
        userId: string,
        type: NotificationType,
        data?: Record<string, unknown>
    ): Promise<void> {
        const user = await User.findById(userId).select("pushTokens name");
        if (!user || user.pushTokens.length === 0) return;

        await this.dispatch(user.pushTokens, type, data);
    }

    // ── send to multiple users ────────────────────────────────────────────────
    public async sendToUsers(
        userIds: string[],
        type: NotificationType,
        data?: Record<string, unknown>
    ): Promise<void> {
        const users = await User.find({
            _id: { $in: userIds },
            pushTokens: { $exists: true, $not: { $size: 0 } },
        }).select("pushTokens");

        const allTokens = users.flatMap((u) => u.pushTokens);
        if (allTokens.length === 0) return;

        await this.dispatch(allTokens, type, data);
    }

    // ── send to a user's emergency contacts ───────────────────────────────────
    public async sendToEmergencyContacts(
        userId: string,
        type: NotificationType,
        data?: Record<string, unknown>,
        contactIds?: string[]
    ): Promise<void> {
        // get the user's contact phone numbers
        const user = await User.findById(userId)
            .select("emergencyContacts name");

        if (!user || user.emergencyContacts.length === 0) return;

        const targetContacts = contactIds && contactIds.length > 0
            ? user.emergencyContacts.filter((contact) => contact._id && contactIds.includes(contact._id.toString()))
            : user.emergencyContacts;

        const phones = targetContacts
            .map((c) => c.phone)
            .filter(Boolean);

        if (phones.length === 0) return;

        // find registered BeSafe users matching those phone numbers
        const contacts = await User.find({
            phone: { $in: phones },
            pushTokens: { $exists: true, $not: { $size: 0 } },
        }).select("pushTokens");

        const tokens = contacts.flatMap((c) => c.pushTokens);
        if (tokens.length === 0) return;

        await this.dispatch(tokens, type, {
            ...data,
            name: user.name,
            count: phones.length,
        });
    }

    // ── save / remove token ───────────────────────────────────────────────────
    public async saveToken(userId: string, token: string): Promise<void> {
        if (!Expo.isExpoPushToken(token)) {
            throw new Error(`Invalid Expo push token: ${token}`);
        }

        await User.findByIdAndUpdate(userId, {
            $addToSet: { pushTokens: token },
        });
    }

    public async removeToken(userId: string, token: string): Promise<void> {
        await User.findByIdAndUpdate(userId, {
            $pull: { pushTokens: token },
        });
    }

    // ── internal dispatch ─────────────────────────────────────────────────────
    private async dispatch(
        tokens: string[],
        type: NotificationType,
        data?: Record<string, unknown>
    ): Promise<void> {
        const template = TEMPLATES[type](data);

        const validTokens = tokens.filter((t) => {
            const valid = Expo.isExpoPushToken(t);
            if (!valid) console.warn(`[Push] Invalid token skipped: ${t}`);
            return valid;
        });

        if (validTokens.length === 0) return;

        const messages: ExpoPushMessage[] = validTokens.map((token) => ({
            to: token,
            title: template.title,
            body: template.body,
            data: { type, ...data },
            sound: template.sound === undefined ? "default" : template.sound,
            priority: template.priority ?? "high",
            interruptionLevel: "time-sensitive" as const,
            channelId: template.channelId ?? "default",
        }));

        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                const tickets = await expo.sendPushNotificationsAsync(chunk);
                await this.handleTickets(tickets, chunk);
            } catch (err) {
                console.error("[Push] Fatal chunk error:", err);
            }
        }
    }

    // ── clean up dead tokens ──────────────────────────────────────────────────
    private async handleTickets(
        tickets: ExpoPushTicket[],
        chunk: ExpoPushMessage[]
    ): Promise<void> {
        const deadTokens: string[] = [];

        tickets.forEach((ticket, i) => {
            if (ticket.status === "error") {
                console.warn("[Push] Ticket error:", ticket.message);
                if (ticket.details?.error === "DeviceNotRegistered") {
                    deadTokens.push(chunk[i].to as string);
                }
            }
        });

        if (deadTokens.length > 0) {
            console.log("[Push] Removing dead tokens:", deadTokens);
            await User.updateMany(
                { pushTokens: { $in: deadTokens } },
                { $pull: { pushTokens: { $in: deadTokens } } }
            );
        }
    }
}

export const NotificationService = new NotificationServiceClass();
