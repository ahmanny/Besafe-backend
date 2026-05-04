import { Router } from "express";
import { analyzeText, sendSos } from "../controllers/safety.controller";
import { cancelSafetyCheck, confirmSafetyCheck, extendSafetyCheck, getActiveSafetyCheck, startSafetyCheck, stopSafetyCheck, updateCheckLocation } from "../controllers/safety-check.controller";
import { UserMiddleware } from "../middlewares";

export const safety = Router();

const userMiddleware = new UserMiddleware();

safety.post("/analyze", analyzeText);
safety.post("/sos", userMiddleware.requireOnboarded.bind(userMiddleware), sendSos);
safety.post("/check-in/start", startSafetyCheck);
safety.post("/check-in/confirm", confirmSafetyCheck);
safety.post("/check-in/cancel", cancelSafetyCheck);
safety.get("/check-in/active", getActiveSafetyCheck);
safety.post("/check-in/extend", extendSafetyCheck);
safety.patch("/check-in/location", updateCheckLocation);
safety.post("/check-in/stop", stopSafetyCheck);