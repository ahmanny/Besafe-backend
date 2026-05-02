import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { SafetyCheckService } from "../services/safety-check.service";
import MissingParameterException from "../exceptions/MissingParameterException";

// POST /safety/check-in/start
export const startSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const { activity, intervalMinutes, contactIds } = req.body;

        if (!activity) throw new MissingParameterException("Activity is required");
        if (!intervalMinutes) throw new MissingParameterException("Interval is required");

        const check = await SafetyCheckService.start({
            userId: req.user!._id,
            activity,
            intervalMinutes: Number(intervalMinutes),
            contactIds: contactIds ?? [],
        });

        ok_handler(res, "Safety check started", { check });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// POST /safety/check-in/confirm
export const confirmSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const check = await SafetyCheckService.confirm(req.user!._id);
        ok_handler(res, "Safety check confirmed", { check });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// POST /safety/check-in/cancel
export const cancelSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const result = await SafetyCheckService.cancel(req.user!._id);
        ok_handler(res, "Safety check cancelled", result);
    } catch (error) {
        error_handler(error, req, res);
    }
};

// GET /safety/check-in/active
export const getActiveSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const check = await SafetyCheckService.getActive(req.user!._id);
        ok_handler(res, "Active safety check", { check });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// POST /safety/check-in/extend
export const extendSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const { additionalMinutes } = req.body;
        if (!additionalMinutes) throw new MissingParameterException("Additional minutes are required");
        const check = await SafetyCheckService.extend(req.user!._id, Number(additionalMinutes));
        ok_handler(res, "Safety check extended", { check });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// PATCH /safety/check-in/location
export const updateCheckLocation: RequestHandler = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (!latitude || !longitude) throw new MissingParameterException("Location required");
        const check = await SafetyCheckService.updateLocation(req.user!._id, { latitude, longitude });
        ok_handler(res, "Location updated", { check });
    } catch (error) { error_handler(error, req, res); }
};

// POST /safety/check-in/stop
export const stopSafetyCheck: RequestHandler = async (req, res) => {
    try {
        const { endLocation } = req.body;
        const check = await SafetyCheckService.stop(req.user!._id, endLocation);
        ok_handler(res, "Safety check stopped", { check });
    } catch (error) { error_handler(error, req, res); }
};
