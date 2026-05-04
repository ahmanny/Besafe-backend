import mailjetClient from "../configs/mailjet.config";
import { getUserByEmail } from "../models/user.model";
import Exception from "../exceptions/Exception";
import jwt from 'jsonwebtoken';
import { SendResetPasswordLinkEmailPayload } from "../types/email.types";
import { getVerificationEmailContent } from "../utils/email.utils";







type SosEmergencyEmailPayload = {
    toEmail: string;
    toName: string;
    subject: string;
    textBody: string;
    htmlBody: string;
};

class EmailServiceClass {
    constructor() {
        // super()
    }

    public async sendSosEmergencyEmail(payload: SosEmergencyEmailPayload): Promise<void> {
        const fromEmail = process.env.EMAIL_FROM;
        if (!fromEmail) {
            throw new Exception("Email delivery is not configured (EMAIL_FROM)");
        }

        try {
            await mailjetClient.post("send", { version: "v3.1" }).request({
                Messages: [
                    {
                        From: {
                            Email: fromEmail,
                            Name: "BeSafe",
                        },
                        To: [
                            {
                                Email: payload.toEmail,
                                Name: payload.toName,
                            },
                        ],
                        Subject: payload.subject,
                        TextPart: payload.textBody,
                        HTMLPart: payload.htmlBody,
                    },
                ],
            });
        } catch (error) {
            console.error("[Email] SOS send failed:", error);
            throw new Exception("Could not send SOS email");
        }
    }

    public async sendUserResetPasswordEmail(payload: SendResetPasswordLinkEmailPayload) {

        const secret = process.env.JWT_SECRET as string
        const resetToken = jwt.sign({ id: payload.id }, secret, { expiresIn: "1d" })


        const content = await getVerificationEmailContent({
            token: resetToken,
            email: payload.email,
            name: payload.name,
        })

        try {
            await mailjetClient

                .post("send", { version: "v3.1" })
                .request({
                    Messages: [
                        {
                            From: {
                                Email: process.env.EMAIL_FROM,
                                Name: "Pulse"
                            },
                            To: [
                                {
                                    Email: payload.email,
                                    Name: payload.name
                                }
                            ],
                            Subject: "Reset Password",
                            HTMLPart: content
                        }
                    ]
                });
            return 'reset password link was sent succesfully';

        } catch (error) {
            console.log(error);
            throw new Exception("Could not send reset password link")
        }



    }




}



export const EmailService = new EmailServiceClass();