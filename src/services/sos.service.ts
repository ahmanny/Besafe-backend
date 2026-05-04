import BadRequestException from "../exceptions/BadRequestException";
import InternalServerErrorException from "../exceptions/InternalServerErrorException";
import { IEmergencyContact, IUser, User } from "../models/user.model";
import { NotificationService } from "./notification.service";
import { EmailService } from "./email.service";
import { isSmsConfigured, sendSms } from "./sms.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SosRequestPayload = {
    message?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
};

export type SosDeliveryFailure = {
    channel: "email" | "sms";
    target: string;
    reason: string;
};

export type SosResult = {
    emailsSent: number;
    smsSent: number;
    pushDispatched: boolean;
    failures: SosDeliveryFailure[];
};

function isValidEmail(value: string | undefined): boolean {
    const v = value?.trim();
    if (!v) return false;
    return EMAIL_RE.test(v);
}

/** Prefer E.164; normalize common digit-only international input. */
function normalizePhoneE164(phone: string): string | null {
    const raw = phone.trim().replace(/[\s-]/g, "");
    if (!raw) return null;
    if (raw.startsWith("+")) {
        const digits = "+" + raw.slice(1).replace(/\D/g, "");
        return digits.length > 8 ? digits : null;
    }
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length < 8) return null;
    return `+${digitsOnly}`;
}

function buildSosBody(userName: string, payload: SosRequestPayload): string {
    const lines: string[] = [
        `BeSafe SOS alert`,
        `${userName || "A BeSafe user"} may need immediate help.`,
    ];
    if (payload.message?.trim()) {
        lines.push(`Note: ${payload.message.trim()}`);
    }
    if (
        payload.location &&
        Number.isFinite(payload.location.latitude) &&
        Number.isFinite(payload.location.longitude)
    ) {
        lines.push(
            `Last reported location: ${payload.location.latitude.toFixed(5)}, ${payload.location.longitude.toFixed(5)} (maps: https://maps.google.com/?q=${payload.location.latitude},${payload.location.longitude})`
        );
    }
    lines.push(`Time (server): ${new Date().toISOString()}`);
    return lines.join("\n");
}

function buildSosHtml(userName: string, payload: SosRequestPayload): string {
    const safeName = userName || "A BeSafe user";
    const note = payload.message?.trim()
        ? `<p><strong>Note:</strong> ${escapeHtml(payload.message.trim())}</p>`
        : "";
    let map = "";
    if (
        payload.location &&
        Number.isFinite(payload.location.latitude) &&
        Number.isFinite(payload.location.longitude)
    ) {
        const { latitude, longitude } = payload.location;
        const url = `https://maps.google.com/?q=${latitude},${longitude}`;
        map = `<p><strong>Last reported location:</strong> ${latitude.toFixed(5)}, ${longitude.toFixed(5)}<br/><a href="${url}">Open in Google Maps</a></p>`;
    }
    return `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
  <h2 style="color:#b91c1c">Emergency SOS — BeSafe</h2>
  <p><strong>${escapeHtml(safeName)}</strong> has triggered an SOS and may need immediate help.</p>
  ${note}
  ${map}
  <p style="color:#64748b;font-size:12px">Sent at ${new Date().toISOString()}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

class SosServiceClass {
    public async sendSos(userId: string, payload: SosRequestPayload): Promise<SosResult> {
        const user = await User.findById(userId).lean<IUser | null>();
        if (!user) {
            throw new BadRequestException("User not found");
        }
        if (!user.emergencyContacts?.length) {
            throw new BadRequestException(
                "No emergency contacts on file. Add contacts before sending SOS."
            );
        }

        const userDisplayName = user.name?.trim() || "BeSafe user";
        const textBody = buildSosBody(userDisplayName, payload);
        const failures: SosDeliveryFailure[] = [];
        let emailsSent = 0;
        let smsSent = 0;

        for (const contact of user.emergencyContacts as IEmergencyContact[]) {
            await this.deliverToContact(
                contact,
                userDisplayName,
                textBody,
                payload,
                failures,
                () => {
                    emailsSent += 1;
                },
                () => {
                    smsSent += 1;
                }
            );
        }

        let pushDispatched = false;
        try {
            await NotificationService.sendToEmergencyContacts(userId, "SOS_ALERT", {
                name: userDisplayName,
            });
            pushDispatched = true;
        } catch (e) {
            console.warn("[SOS] Push to emergency contacts failed:", e);
        }

        const anyChannelOk =
            emailsSent > 0 || smsSent > 0 || pushDispatched;

        if (!anyChannelOk) {
            const detail = failures.length
                ? failures
                      .map((f) => `${f.channel} (${f.target}): ${f.reason}`)
                      .join("; ")
                : "No SOS messages could be delivered.";
            throw new InternalServerErrorException(detail);
        }

        return {
            emailsSent,
            smsSent,
            pushDispatched,
            failures,
        };
    }

    private async deliverToContact(
        contact: IEmergencyContact,
        userDisplayName: string,
        textBody: string,
        payload: SosRequestPayload,
        failures: SosDeliveryFailure[],
        onEmail: () => void,
        onSms: () => void
    ): Promise<void> {
        const hasEmail = isValidEmail(contact.email);
        const phoneE164 = contact.phone ? normalizePhoneE164(contact.phone) : null;
        const hasPhone = Boolean(phoneE164);

        if (hasEmail && hasPhone) {
            await this.tryEmail(contact, userDisplayName, textBody, payload, failures, onEmail);
            await this.trySms(phoneE164!, contact, textBody, failures, onSms);
            return;
        }

        if (hasEmail && !hasPhone) {
            await this.tryEmail(contact, userDisplayName, textBody, payload, failures, onEmail);
            return;
        }

        if (!hasEmail && hasPhone) {
            await this.trySms(phoneE164!, contact, textBody, failures, onSms);
            return;
        }

        failures.push({
            channel: "email",
            target: contact.name || "contact",
            reason: "No valid email or phone",
        });
    }

    private async tryEmail(
        contact: IEmergencyContact,
        userDisplayName: string,
        textBody: string,
        payload: SosRequestPayload,
        failures: SosDeliveryFailure[],
        onEmail: () => void
    ): Promise<void> {
        const to = contact.email!.trim();
        try {
            await EmailService.sendSosEmergencyEmail({
                toEmail: to,
                toName: contact.name,
                subject: `🚨 SOS — ${userDisplayName} needs help`,
                textBody,
                htmlBody: buildSosHtml(userDisplayName, payload),
            });
            onEmail();
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            failures.push({ channel: "email", target: to, reason });
            console.error("[SOS] Email failed:", to, err);
        }
    }

    private async trySms(
        phoneE164: string,
        contact: IEmergencyContact,
        textBody: string,
        failures: SosDeliveryFailure[],
        onSms: () => void
    ): Promise<void> {
        if (!isSmsConfigured()) {
            failures.push({
                channel: "sms",
                target: phoneE164,
                reason: "SMS not configured (Twilio env vars)",
            });
            return;
        }
        try {
            await sendSms(phoneE164, textBody);
            onSms();
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            failures.push({ channel: "sms", target: phoneE164, reason });
            console.error("[SOS] SMS failed:", phoneE164, err);
        }
    }
}

export const SosService = new SosServiceClass();
