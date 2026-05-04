import { getUserByEmail, getUserById, updateUserById } from "../models/user.model";
import ResourceNotFoundException from "../exceptions/ResourceNotFoundException";
import { IEmergencyContact } from "../models/user.model";
import Exception from "../exceptions/Exception";
import ConflictException from "../exceptions/ConflictException";


export type UpdateProfilePayload = {
    name?: string;
    email?: string | null;
    profilePicture?: string | null;
    emergencyContacts?: IEmergencyContact[];
};

export type OnboardingPayload = {
    name: string;
    email?: string;
    emergencyContacts: IEmergencyContact[];
};




class UserServiceClass {
    constructor() {
        // super()
    }

    // GET /users/me
    public async getMe(userId: string) {
        const user = await getUserById(userId);
        if (!user) throw new ResourceNotFoundException("User not found");
        return user;
    }

    // PATCH /users/me
    public async updateMe(userId: string, payload: UpdateProfilePayload) {
        const $set: Record<string, unknown> = {};
        const $unset: Record<string, ""> = {};

        if (payload.name !== undefined) {
            const name = payload.name.trim();
            if (!name) throw new Exception("Name is required");
            $set.name = name;
        }

        if (payload.email !== undefined) {
            const email = payload.email?.trim().toLowerCase();
            if (email) {
                const existing = await getUserByEmail(email).lean();
                if (existing && existing._id.toString() !== userId) {
                    throw new ConflictException("Email is already in use");
                }
                $set.email = email;
            } else {
                $unset.email = "";
                $set.isEmailVerified = false;
            }
        }

        if (payload.profilePicture !== undefined) {
            if (payload.profilePicture) {
                $set.profilePicture = payload.profilePicture;
            } else {
                $unset.profilePicture = "";
            }
        }

        if (payload.emergencyContacts) {
            for (const contact of payload.emergencyContacts) {
                if (!contact.name?.trim()) {
                    throw new Exception("Each contact must have a name");
                }
                if (!contact.relationship?.trim()) {
                    throw new Exception("Each contact must have a relationship");
                }
                if (!contact.phone?.trim() && !contact.email?.trim()) {
                    throw new Exception(
                        `Contact "${contact.name}" must have a phone number or email`
                    );
                }
            }
            $set.emergencyContacts = payload.emergencyContacts;
        }

        const update: Record<string, unknown> = {};
        if (Object.keys($set).length > 0) update.$set = $set;
        if (Object.keys($unset).length > 0) update.$unset = $unset;

        const user = await updateUserById(userId, update);
        if (!user) throw new ResourceNotFoundException("User not found");
        return user;
    }


    // POST /users/me/onboard
    public async completeOnboarding(userId: string, payload: OnboardingPayload) {
        const { name, email, emergencyContacts } = payload;

        const user = await updateUserById(userId, {
            name: name.trim(),
            email: email?.trim() || undefined,
            emergencyContacts: emergencyContacts ?? [],
            isOnboarded: true,
        });

        if (!user) throw new ResourceNotFoundException("User not found");
        return user;
    }
}



export const UserService = new UserServiceClass();




























