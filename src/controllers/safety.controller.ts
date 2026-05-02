import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { SafetyService } from "../services/safety.service";
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