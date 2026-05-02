import { Schema, model, Types } from "mongoose";

export type SafetyCheckStatus = "active" | "confirmed" | "triggered" | "cancelled";

export interface ISafetyCheck {
    userId: Types.ObjectId;
    activity: string;
    intervalMinutes: number;
    contactIds: string[];
    status: SafetyCheckStatus;
    nextCheckAt: Date;
    expiresAt: Date;
    startLocation?: { latitude: number; longitude: number };
    lastLocation?: { latitude: number; longitude: number };
}

const SafetyCheckSchema = new Schema<ISafetyCheck>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    activity: { type: String, required: true },
    intervalMinutes: { type: Number, required: true },
    contactIds: { type: [String], default: [] },
    status: { type: String, enum: ["active", "confirmed", "triggered", "cancelled"], default: "active" },
    nextCheckAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    startLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
    lastLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
}, { timestamps: true });

export const SafetyCheck = model<ISafetyCheck>("SafetyCheck", SafetyCheckSchema);