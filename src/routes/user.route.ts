// routes/user.route.ts
import { Router } from 'express';
import { getMe, updateMe, onboard, updateSettings } from "../controllers/user.controller";
import { UserMiddleware } from '../middlewares';
import { upload } from '../middlewares/upload.middleware';

export const user = Router();

const userMiddleware = new UserMiddleware();

user.post("/me/onboard", onboard);

// ── onboarding required 
user.get("/me", userMiddleware.requireOnboarded.bind(userMiddleware), getMe);
user.patch(
    "/me",
    userMiddleware.requireOnboarded.bind(userMiddleware),
    upload.single("profilePicture"),
    updateMe
);

user.patch("/me/settings", userMiddleware.requireOnboarded.bind(userMiddleware), updateSettings);
