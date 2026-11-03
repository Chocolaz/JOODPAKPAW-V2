import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { lookupRouter } from './lookup.routes';
import { propertyRouter } from './property.routes';

export const v1Router = Router();

v1Router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'JoodPakPaw V2 REST API is operational',
    version: 'v1',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      properties: '/api/v1/properties',
      pets: '/api/v1/pets/all',
      petSizeCategories: '/api/v1/pet-size-categories/all',
      facilities: '/api/v1/hosts/facilities/all',
      reportCategories: '/api/v1/report-categories',
      bookings: '/api/v1/bookings',
      chat: '/api/v1/chat-rooms',
      notifications: '/api/v1/notifications',
      recommendations: '/api/v1/properties/recommend',
    },
  });
});

v1Router.use('/auth', authRouter);
v1Router.use('/users', userRouter);
v1Router.use('/', lookupRouter);
v1Router.use('/properties', propertyRouter);
