import { TUser } from "../../types";






declare global {
    namespace Express {
        interface Request {
            user?: TUser;
            cloudinaryUrls?: string[];
        }
    }
}
export { }
