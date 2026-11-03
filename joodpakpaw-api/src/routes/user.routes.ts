import { Router } from 'express';
import { changePassword } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const userRouter = Router();

userRouter.patch('/:userId/change-password', authenticateToken, changePassword);
