import { JwtPayload } from 'jsonwebtoken';


export type TUser = {
    _id: string;
    phone: string;
    name?: string;
    email?: string;
    profilePicture?: string;
    role: string;
    isOnboarded: boolean;
    isActive: boolean;
    emergencyContacts: any[];
    lastSeenAt?: Date;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
};

export type TPayload = string | JwtPayload | null | undefined;


export interface AddNewUserPayloadInterface {
    email: string
    name: string
    role: string
}