import { getUserById, updateUserById } from "../models/user.model";
import ResourceNotFoundException from "../exceptions/ResourceNotFoundException";
import { IEmergencyContact } from "../models/user.model";
import Exception from "../exceptions/Exception";


export type UpdateProfilePayload = {
    name?: string;
    email?: string;
    profilePicture?: string;
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
        }

        const user = await updateUserById(userId, payload);
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




























