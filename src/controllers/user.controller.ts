// controllers/user.controller.ts
import { Request, RequestHandler, Response } from "express";
import { error_handler, ok_handler } from "../utils/response_handler";
import { UserService } from "../services/user.service";
import MissingParameterException from "../exceptions/MissingParameterException";
import cloudinary from "../configs/cloudinary.config";
import { User } from "../models/user.model";
import ResourceNotFoundException from "../exceptions/ResourceNotFoundException";

const uploadProfilePicture = (file: Express.Multer.File): Promise<string> =>
    new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: "besafe/profile_pictures",
                format: "jpg",
                public_id: `profile_${Date.now()}`,
                resource_type: "image",
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result?.secure_url || "");
            }
        ).end(file.buffer);
    });

const parseEmergencyContacts = (value: unknown) => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        throw new MissingParameterException("Invalid emergencyContacts payload");
    }
};

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
        const { name, email } = req.body;
        const emergencyContacts = parseEmergencyContacts(req.body.emergencyContacts);
        const profilePicture = req.file
            ? await uploadProfilePicture(req.file)
            : req.body.profilePicture;

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

// PATCH /users/me/settings
export const updateSettings: RequestHandler = async (req, res) => {
    try {
        const { autoCallEmergency, liveLocationSharing } = req.body;

        const updates: Record<string, any> = {};
        if (autoCallEmergency !== undefined) updates["settings.autoCallEmergency"] = autoCallEmergency;
        if (liveLocationSharing !== undefined) updates["settings.liveLocationSharing"] = liveLocationSharing;

        const user = await User.findByIdAndUpdate(
            req.user!._id,
            { $set: updates },
            { new: true }
        );

        if (!user) throw new ResourceNotFoundException("User not found");
        ok_handler(res, "Settings updated", { user });
    } catch (error) {
        error_handler(error, req, res);
    }
};