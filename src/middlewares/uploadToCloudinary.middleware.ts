import { NextFunction, Request, Response } from "express";
import cloudinary from "../configs/cloudinary.config";


export const uploadToCloudinary = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.files || !(req.files instanceof Array) || req.files.length === 0) {
        req.cloudinaryUrls = [];
        return next();
    }

    try {

        const uploadPromises = req.files.map((file, index) => {
            return new Promise<string>((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: 'besafe_uploads',
                        format: 'png',
                        public_id: `upload_${Date.now()}_${index}`,
                    },
                    (error, cloudinaryResult) => {
                        if (error) reject(error);
                        else resolve(cloudinaryResult?.secure_url || '');
                    }
                ).end(file.buffer);
            });
        });

        req.cloudinaryUrls = await Promise.all(uploadPromises);
        next();
    } catch (error) {
        res.status(500).json({ message: "Error uploading images", error });
    }
};
