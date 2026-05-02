// controllers/user.controller.ts
import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { UserService } from "../services/user.service";
import MissingParameterException from "../exceptions/MissingParameterException";

// GET /users/me
export const getMe: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const user = await UserService.getMe(req.user!._id);
        console.log("Fetched user:", user);
        ok_handler(res, "User fetched", { user });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// PATCH /users/me
export const updateMe: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            name,
            email,
            profilePicture,
            emergencyContacts,
        } = req.body;

        // build update object — only include fields that were sent
        const updates: Record<string, any> = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (profilePicture !== undefined) updates.profilePicture = profilePicture;
        if (emergencyContacts !== undefined) updates.emergencyContacts = emergencyContacts;

        if (Object.keys(updates).length === 0) {
            throw new MissingParameterException("No fields provided to update");
        }

        const user = await UserService.updateMe(req.user!._id, updates);
        ok_handler(res, "Profile updated", { user });
    } catch (error) {
        error_handler(error, req, res);
    }
};

// POST /users/me/onboard
export const onboard: RequestHandler = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, email, emergencyContacts } = req.body;
        if (!name?.trim()) throw new MissingParameterException("Name is required");

        const user = await UserService.completeOnboarding(req.user!._id, {
            name,
            email,
            emergencyContacts,
        });

        ok_handler(res, "Onboarding complete", { user });
    } catch (error) {
        error_handler(error, req, res);
    }
};