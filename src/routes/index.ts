import { Router, Request, Response } from 'express';
import { user } from './user.route';
import { auth } from './auth.routes';
import { UserMiddleware } from '../middlewares';
import { admin } from './admin.routes';
import { safety } from './safety.routes';
import { notifications } from './notification.routes';

const routes = Router();
const userMiddleware = new UserMiddleware();

// Home route
routes.get('/', (req: Request, res: Response) => {
    res.send('Welcome to BeSafe!');
});

// API routes
// authentication not required
routes.use('/auth', auth);

// authentication required
routes.use(userMiddleware.validateToken)
routes.use('/user', user);
routes.use("/safety", safety);
routes.use('/admin', admin);
routes.use("/notifications", notifications);



export default routes;
