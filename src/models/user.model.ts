import mongoose, { Schema, model } from 'mongoose';

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
}

export interface IEmergencyContact {
    _id?: string;
    name: string;
    phone: string;
    email?: string;
    relationship: string;
}

export interface IUser {
    phone: string;
    name?: string;
    email?: string;              // optional
    isEmailVerified: boolean;    // tracks email verification
    profilePicture?: string;
    role: UserRole;
    isOnboarded: boolean;
    isActive: boolean;
    emergencyContacts: IEmergencyContact[];
    lastSeenAt?: Date;
    pushTokens: string[];
}

const EmergencyContactSchema = new Schema<IEmergencyContact>({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    relationship: { type: String, required: true },
}, { _id: true }); // enable _id for subdocuments

const UserSchema = new Schema<IUser>({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,   // ← allows multiple docs with no email (null/undefined)
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    profilePicture: {
        type: String,
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.USER,
    },
    isOnboarded: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    emergencyContacts: {
        type: [EmergencyContactSchema],
        default: [],
    },
    lastSeenAt: {
        type: Date,
    },
    pushTokens: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true,
});

export const User = model<IUser>('User', UserSchema);

// ── helpers ───────────────────────────────────────────────────────────────────
export const getUserByPhone = (phone: string) => User.findOne({ phone });
export const getUserByEmail = (email: string) => User.findOne({ email });
export const getUserById = (id: string) => User.findById(id).lean();
export const createUser = (phone: string) => new User({ phone }).save();
export const updateUserById = (id: string, values: Partial<IUser>) =>
    User.findByIdAndUpdate(id, values, { new: true });