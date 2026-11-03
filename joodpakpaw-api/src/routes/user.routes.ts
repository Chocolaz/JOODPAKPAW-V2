import { Router } from 'express';
import { changePassword, updateUserProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';

export const userRouter = Router();

userRouter.put(
  '/:userId',
  authenticateToken,
  uploadMiddleware.any(),
  updateUserProfile
);

userRouter.patch('/:userId/change-password', authenticateToken, changePassword);
