import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { SafetyService } from "../services/safety.service";
import { SosService } from "../services/sos.service";
import MissingParameterException from "../exceptions/MissingParameterException";

// POST /safety/analyze
export const analyzeText: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { text } = req.body;
        if (!text?.trim())
            throw new MissingParameterException("Text is required");

        const result = await SafetyService.analyzeText(
            text,
            req.user!._id
        );

        ok_handler(res, "Analysis complete", result);
    } catch (error) {
        error_handler(error, req, res);
    }
};

// POST /safety/sos
export const sendSos: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { message, location } = req.body ?? {};
        const result = await SosService.sendSos(req.user!._id.toString(), {
            message: typeof message === "string" ? message : undefined,
            location:
                location &&
                typeof location === "object" &&
                typeof location.latitude === "number" &&
                typeof location.longitude === "number"
                    ? {
                          latitude: location.latitude,
                          longitude: location.longitude,
                      }
                    : undefined,
        });

        ok_handler(res, "SOS dispatched", result);
    } catch (error) {
        error_handler(error, req, res);
    }
};