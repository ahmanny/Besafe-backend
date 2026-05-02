import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { NotificationService } from "../services/notification.service";
import MissingParameterException from "../exceptions/MissingParameterException";

// PATCH /notifications/token
export const saveToken: RequestHandler = async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) throw new MissingParameterException("Push token is required");

        await NotificationService.saveToken(req.user!._id, pushToken);
        ok_handler(res, "Push token saved", {});
    } catch (error) {
        error_handler(error, req, res);
    }
};

// DELETE /notifications/token
export const removeToken: RequestHandler = async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) throw new MissingParameterException("Push token is required");

        await NotificationService.removeToken(req.user!._id, pushToken);
        ok_handler(res, "Push token removed", {});
    } catch (error) {
        error_handler(error, req, res);
    }
};