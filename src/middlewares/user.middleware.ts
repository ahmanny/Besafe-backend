// middlewares/user.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { getTokenInfo } from '../utils';
import { error_handler } from '../utils/response_handler';
import AuthenticationTokenException from '../exceptions/AuthenticationTokenException';
import UnauthorizedAccessException from '../exceptions/UnauthorizedAccessException';
import ForbiddenAccessException from '../exceptions/ForbiddenAccessException';

export class UserMiddleware {
    constructor() { }

    async validateToken(req: Request, res: Response, next: NextFunction) {
        try {
            const token = await getTokenInfo({ req });
            if (token?.is_valid_token && token.user) {
                req.user = token.user;
            }
            if (!token?.is_valid_token) {
                throw new AuthenticationTokenException("Invalid or Expired authentication token");
            }
            next();
        } catch (error) {
            error_handler(error, req, res);
        }
    }

    // ── onboarding guard 
    async requireOnboarded(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                throw new UnauthorizedAccessException("Not authenticated");
            }
            if (!req.user.isOnboarded) {
                throw new ForbiddenAccessException("Please complete onboarding first");
            }
            next();
        } catch (error) {
            error_handler(error, req, res);
        }
    }

    hasAnyRole(roles: string[]) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const user = req?.user;
            try {
                if (!user) throw new UnauthorizedAccessException('Unauthorized user');
                const has_role = roles.includes(user.role);
                if (has_role) {
                    return next();
                } else {
                    throw new ForbiddenAccessException('Not authorized to access this resource');
                }
            } catch (error) {
                error_handler(error, req, res);
            }
        };
    }

    hasRole(role: string) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const user = req?.user;
            const has_role = Array.isArray(user?.role)
                ? user.role.includes(role)
                : user?.role === role;
            return has_role ? next() : res.status(403).send({ error: 'Access Denied' });
        };
    }
}