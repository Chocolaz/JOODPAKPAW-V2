import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  deleteAllNotifications,
  deleteNotification,
} from '../controllers/notification.controller';

export const notificationRouter = Router();

// All notification endpoints require authenticated user
notificationRouter.use(authenticateToken);

notificationRouter.get('/', getNotifications);
notificationRouter.patch('/read-all', markAllAsRead);
notificationRouter.patch('/:id/read', markAsRead);
notificationRouter.delete('/', deleteAllNotifications);
notificationRouter.delete('/:id', deleteNotification);
