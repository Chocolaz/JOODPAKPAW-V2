import { Router } from 'express';
import { trackPropertyView } from '../controllers/recommendation.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const userBehaviorRouter = Router();

userBehaviorRouter.post(
  '/view-property/:propertyId',
  authenticateToken,
  trackPropertyView
);
