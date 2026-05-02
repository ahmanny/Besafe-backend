// routes/user.route.ts
import { Router } from 'express';
import { getMe, updateMe, onboard } from "../controllers/user.controller";
import { UserMiddleware } from '../middlewares';

export const user = Router();

const userMiddleware = new UserMiddleware();

// ── no onboarding required ────────────────────────────────────────────────────
// validateToken already applied globally in routes/index.ts
user.post("/me/onboard", onboard);

// ── onboarding required ───────────────────────────────────────────────────────
user.get("/me", userMiddleware.requireOnboarded.bind(userMiddleware), getMe);
user.patch("/me", userMiddleware.requireOnboarded.bind(userMiddleware), updateMe);