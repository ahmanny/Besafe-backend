import { Router } from "express";
import { saveToken, removeToken } from "../controllers/notification.controller";

export const notifications = Router();

notifications.patch("/token", saveToken);
notifications.delete("/token", removeToken);