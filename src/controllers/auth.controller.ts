import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { AuthService } from "../services/auth.service";
import MissingParameterException from "../exceptions/MissingParameterException";


// ── send otp 
export const sendOtp: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const data = await AuthService.sendOtpFunction(req.body);
        ok_handler(res, "OTP sent successfully", data);
    } catch (error) {
        error_handler(error, req, res);
    }
};

// ── verify otp 
export const verifyOtp: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { tokens, isNewUser, isOnboarded, user } =
            await AuthService.verifyOtp(req.body);

        ok_handler(res, "OTP verified successfully", {
            tokens,
            isNewUser,
            isOnboarded,
            user,
        });
    } catch (error) {
        error_handler(error, req, res);
    }
};


// ── resend otp 
export const resendOtp: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const data = await AuthService.resendOtp(req.body);
        ok_handler(res, "OTP resent successfully", data);
    } catch (error) {
        error_handler(error, req, res);
    }
};

// ── get otp cooldown 
// GET /auth/otp-cooldown?phone=+2348012345678
export const getOtpCooldown: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const phone = req.query.phone as string;
        if (!phone) throw new MissingParameterException("Phone number is required");

        const data = await AuthService.getCooldown({ phone });
        ok_handler(res, "Cooldown fetched", data);
    } catch (error) {
        error_handler(error, req, res);
    }
};


// ── refresh session 
export const refreshSession: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token)
            throw new MissingParameterException("Refresh token is required");

        const data = await AuthService.refreshUserSession(refresh_token);
        ok_handler(res, "Session refreshed", data);
    } catch (error) {
        error_handler(error, req, res);
    }
};


// ── logout 
export const logout: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token)
            throw new MissingParameterException("Refresh token is required");

        await AuthService.logout(refresh_token);
        ok_handler(res, "Logged out successfully");
    } catch (error) {
        error_handler(error, req, res);
    }
};
