import { Router } from 'express';
import {
    sendOtp,
    verifyOtp,
    resendOtp,
    getOtpCooldown,
    refreshSession,
    logout,
} from "../controllers/auth.controller";

export const auth = Router();
// const userMiddleware = new UserMiddleware();


auth.post("/send-otp", sendOtp);
auth.post("/verify-otp", verifyOtp);
auth.post("/resend-otp", resendOtp);
auth.get("/otp-cooldown", getOtpCooldown);  // GET with ?phone= query
auth.post("/refresh", refreshSession);
auth.post("/logout", logout);