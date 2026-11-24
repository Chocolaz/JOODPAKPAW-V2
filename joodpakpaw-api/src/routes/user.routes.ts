import { Router } from 'express';
import { changePassword, updateUserProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';
import { attachNumericParamGuards } from '../middlewares/validateParams.middleware';

export const userRouter = Router();
attachNumericParamGuards(userRouter, ['userId'], { allowMe: ['userId'] });

// Context-aware routes for current user ('me')
userRouter.patch('/me/change-password', authenticateToken, changePassword);
userRouter.put(
  '/me',
  authenticateToken,
  uploadMiddleware.any(),
  updateUserProfile
);

// Standard parameterized routes
userRouter.put(
  '/:userId',
  authenticateToken,
  uploadMiddleware.any(),
  updateUserProfile
);
userRouter.patch('/:userId/change-password', authenticateToken, changePassword);
