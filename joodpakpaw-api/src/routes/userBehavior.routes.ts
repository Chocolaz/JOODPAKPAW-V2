import { Router } from 'express';
import { trackPropertyView } from '../controllers/recommendation.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { attachNumericParamGuards } from '../middlewares/validateParams.middleware';

export const userBehaviorRouter = Router();
attachNumericParamGuards(userBehaviorRouter, ['propertyId']);

userBehaviorRouter.post(
  '/view-property/:propertyId',
  authenticateToken,
  trackPropertyView
);
