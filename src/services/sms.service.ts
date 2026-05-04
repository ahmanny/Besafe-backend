import axios from "axios";

/**
 * SMS via Twilio REST API (axios only — no twilio SDK).
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (E.164 sender).
 */
export function isSmsConfigured(): boolean {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    return Boolean(sid && token && from);
}

export async function sendSms(toE164: string, body: string): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID as string;
    const token = process.env.TWILIO_AUTH_TOKEN as string;
    const from = process.env.TWILIO_PHONE_NUMBER as string;

    if (!sid || !token || !from) {
        throw new Error("SMS is not configured (Twilio env vars missing)");
    }

    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ From: from, To: toE164, Body: body });

    await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        params.toString(),
        {
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );
}
