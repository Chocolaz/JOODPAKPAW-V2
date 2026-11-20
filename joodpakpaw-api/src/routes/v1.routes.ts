import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { lookupRouter } from './lookup.routes';
import { propertyRouter } from './property.routes';
import { hostRouter } from './host.routes';
import { petProfileRouter } from './petProfile.routes';
import { bookingRouter } from './booking.routes';
import { favoriteFolderRouter, favoritePropertyRouter } from './favorite.routes';
import { chatRouter } from './chat.routes';
import { notificationRouter } from './notification.routes';
import { verificationRouter } from './verification.routes';
import { reportRouter } from './report.routes';
import { adminRouter } from './admin.routes';
import { userBehaviorRouter } from './userBehavior.routes';

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
      petProfiles: '/api/v1/profiles/pet-profiles',
      properties: '/api/v1/properties',
      hosts: '/api/v1/hosts',
      pets: '/api/v1/pets/all',
      petSizeCategories: '/api/v1/pet-size-categories/all',
      facilities: '/api/v1/hosts/facilities/all',
      reportCategories: '/api/v1/report-categories',
      bookings: '/api/v1/bookings',
      favoriteFolders: '/api/v1/favorite-folders',
      favoriteProperties: '/api/v1/favorite-properties',
      chat: '/api/v1/chat-rooms',
      notifications: '/api/v1/notifications',
      verifications: '/api/v1/user-verifications',
      reports: '/api/v1/reports',
      admin: '/api/v1/admin',
      recommendations: '/api/v1/properties/recommend',
      userBehaviors: '/api/v1/user-behaviors',
    },
  });
});

v1Router.use('/auth', authRouter);
v1Router.use('/users', userRouter);
v1Router.use('/profiles/pet-profiles', petProfileRouter);
v1Router.use('/hosts', hostRouter);
v1Router.use('/', lookupRouter);
v1Router.use('/properties', propertyRouter);
v1Router.use('/bookings', bookingRouter);
v1Router.use('/favorite-folders', favoriteFolderRouter);
v1Router.use('/favorite-properties', favoritePropertyRouter);
v1Router.use('/notifications', notificationRouter);
v1Router.use('/chat-rooms', chatRouter);
v1Router.use('/user-verifications', verificationRouter);
v1Router.use('/reports', reportRouter);
v1Router.use('/admin', adminRouter);
v1Router.use('/user-behaviors', userBehaviorRouter);
