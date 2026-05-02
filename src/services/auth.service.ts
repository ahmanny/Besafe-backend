import InvalidAccessCredentialsExceptions from "../exceptions/InvalidAccessCredentialsException";
import { createUser, getUserById, User } from "../models/user.model";
import { generateTokens, getTokenInfo } from "../utils";
import { RefreshToken } from "../models/refresh-token.model";
import ResourceNotFoundException from "../exceptions/ResourceNotFoundException";
import { OtpSession } from "../models/otp.model";
import { BLOCK_DURATION_HOURS, MAX_COOLDOWN_SECONDS, MAX_SEND_PER_HOUR, MAX_VERIFY_ATTEMPTS, OTP_EXPIRY_MINUTES, RESEND_COOLDOWN_BASE } from "../configs/otpPolicy";
import Exception from "../exceptions/Exception";
import TooManyAttemptsException from "../exceptions/TooManyAttemptsException";
import { generateNumericOtp, hashOtp } from "../utils/otp.utils";
import MissingParameterException from "../exceptions/MissingParameterException";


class AuthServiceClass {
    constructor() {
        // super()
    }

    /**
* Sends OTP to a phone number.
*/
    public async sendOtpFunction(payload: { phone: string }) {
        const { phone } = payload;
        if (!phone) throw new MissingParameterException("Phone number is required");

        const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

        const now = new Date();
        let session = await OtpSession.findOne({ phone: payload.phone });

        // BLOCK CHECK
        if (session?.blockedUntil && session.blockedUntil > now) {
            throw new TooManyAttemptsException("Too many attempts. Try again later.");
        }

        if (!session) {
            // First OTP ever for this number
            session = new OtpSession({
                phone: payload.phone,
                sendCount: 1,
                firstSentAt: now,
                lastSentAt: now,
                verifyAttempts: 0,
                blockedUntil: null,
            });
        } else {
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            // RESET rolling window if first send > 1 hour ago
            if (!session.firstSentAt || session.firstSentAt < oneHourAgo) {
                session.sendCount = 1;
                session.firstSentAt = now;
            } else {
                // Progressive cooldown logic
                const cooldownSeconds = Math.min(RESEND_COOLDOWN_BASE * session.sendCount, MAX_COOLDOWN_SECONDS);
                const diffSeconds = (now.getTime() - session.lastSentAt.getTime()) / 1000;

                if (diffSeconds < cooldownSeconds) {
                    const waitTime = Math.ceil(cooldownSeconds - diffSeconds);
                    throw new TooManyAttemptsException(`Please wait ${formatTime(waitTime)} seconds before requesting another code`);
                }
                // Check max sends
                if (session.sendCount >= MAX_SEND_PER_HOUR) {
                    session.blockedUntil = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
                    await session.save();
                    throw new TooManyAttemptsException("Too many attempts. Try again later.");
                }

                session.sendCount += 1;
            }

            session.lastSentAt = now;
        }

        // GENERATE OTP
        // const otp = generateNumericOtp();
        const otp = "2026"; // TODO: replace with generateNumericOtp() before production
        session.otpHash = hashOtp(otp);
        session.expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
        session.verifyAttempts = 0;  // reset verify attempts

        // SEND OTP
        const message = `Your BeSafe code is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        console.log(message)
        // await sendOtpSms(payload.phone, message);

        await session.save();

        const cooldown = Math.min(RESEND_COOLDOWN_BASE * session.sendCount, MAX_COOLDOWN_SECONDS);
        return { message: "OTP sent successfully", cooldown };
    }

    // resend otp function
    public async resendOtp(payload: { phone: string }) {
        if (!payload.phone) throw new Exception("Phone number is required");
        const phone = payload.phone
        const now = new Date();
        const session = await OtpSession.findOne({ phone });
        if (!session) throw new Exception("No OTP session found, please request a new code");

        if (session.blockedUntil && session.blockedUntil > now) {
            throw new TooManyAttemptsException("Too many attempts. Try again later.");
        }

        const cooldownSeconds = Math.min(RESEND_COOLDOWN_BASE * session.sendCount, MAX_COOLDOWN_SECONDS);
        const diffSeconds = (now.getTime() - session.lastSentAt.getTime()) / 1000;
        if (diffSeconds < cooldownSeconds) {
            const waitTime = Math.ceil(cooldownSeconds - diffSeconds);
            throw new TooManyAttemptsException(`Please wait ${waitTime} seconds before requesting another code`);
        }

        if (session.sendCount >= MAX_SEND_PER_HOUR) {
            session.blockedUntil = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
            await session.save();
            throw new TooManyAttemptsException("Too many attempts. Try again later.");
        }

        session.sendCount += 1;
        session.lastSentAt = now;
        session.verifyAttempts = 0;

        // const otp = generateNumericOtp();
        const otp = "2026"; // TODO: replace with generateNumericOtp() before production
        session.otpHash = hashOtp(otp);
        session.expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await session.save();

        const message = `Your BeSafe code is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
        console.log(message)

        // await sendOtpSms(phone, message);
        const cooldown = Math.min(RESEND_COOLDOWN_BASE * session.sendCount, MAX_COOLDOWN_SECONDS);

        return { message: "OTP resent successfully", cooldown };
    }

    // verify otp function
    public async verifyOtp(payload: { phone: string, otp: string, }) {
        const { phone, otp } = payload;
        if (!phone || !otp) throw new Exception("Phone and OTP are required");


        const now = new Date();
        const session = await OtpSession.findOne({ phone });
        if (!session) throw new Exception("No OTP session found, please request a code");

        if (session.blockedUntil && session.blockedUntil > now) {
            throw new TooManyAttemptsException("Too many attempts. Try again later.");
        }

        if (session.expiresAt < now) throw new Exception("OTP expired.");

        if (session.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
            session.blockedUntil = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
            await session.save();
            throw new TooManyAttemptsException("Too many failed attempts. Try again later.");
        }

        if (hashOtp(otp) !== session.otpHash) {
            session.verifyAttempts += 1;
            await session.save();
            throw new Exception(`Invalid OTP. ${MAX_VERIFY_ATTEMPTS - session.verifyAttempts} attempts remaining.`);
        }

        let user = await User.findOne({ phone });
        const isNewUser = !user;

        if (!user) {
            user = await createUser(phone);
        } else {
            // update last seen for returning users
            user.lastSeenAt = now;
            await user.save();
        }

        const tokens = await generateTokens(user);
        await session.deleteOne();

        return {
            tokens,
            isNewUser,
            isOnboarded: user.isOnboarded,  // false → onboarding, true → home
            user: {
                id: user._id,
                phone: user.phone,
                name: user.name,
            },
        };

    }


    // fetch  remaining cooldown
    public async getCooldown(payload: { phone: string }) {
        const phone = payload.phone
        const session = await OtpSession.findOne({ phone });
        if (!session) return { cooldown: 0 };
        const now = new Date();
        const cooldownSeconds = Math.min(RESEND_COOLDOWN_BASE * session.sendCount, MAX_COOLDOWN_SECONDS);
        const diffSeconds = (now.getTime() - session.lastSentAt.getTime()) / 1000;
        return { cooldown: Math.max(0, Math.ceil(cooldownSeconds - diffSeconds)) };
    }

    // refresh user's session
    public async refreshUserSession(refresh_token: string) {
        const token = await getTokenInfo({
            token: refresh_token,
            token_type: "refresh"
        });
        // debug — remove after fix
        console.log("token result:", JSON.stringify(token, null, 2));
        if (!token) {
            throw new InvalidAccessCredentialsExceptions("Session token is invallid")
        }

        console.log("is_valid_token:", token.is_valid_token);
        console.log("user:", token.user);

        const { user } = token

        if (!user) {
            throw new InvalidAccessCredentialsExceptions("Session token is invallid")
        }
        const tokenInDb = await RefreshToken.findOne({ refresh_token: refresh_token, user_id: user?._id });
        if (!tokenInDb) {
            throw new ResourceNotFoundException("invalid session token try login in again")
        }
        const userDb = await getUserById(user?._id)
        if (!userDb) {
            throw new ResourceNotFoundException("User not found")
        }
        await RefreshToken.deleteOne({ refresh_token })

        const tokens = await generateTokens(userDb)

        return {
            tokens
        }

    }

    public async logout(refresh_token: string) {
        const tokenInDb = await RefreshToken.findOne({ refresh_token })
        if (!tokenInDb) {
            return { message: "success" }
        }
        // delete the token from the db
        await RefreshToken.deleteOne({ refresh_token })
        return { message: "success" };
    }


}
export const AuthService = new AuthServiceClass();



