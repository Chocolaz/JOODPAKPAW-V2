import { Router } from 'express';
import {
  submitPropertyReport,
  submitReviewReport,
  submitUnbanAppeal,
  getMyReports,
  getMyReportById,
} from '../controllers/report.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';
import { attachNumericParamGuards } from '../middlewares/validateParams.middleware';

export const reportRouter = Router();

reportRouter.use(authenticateToken);
attachNumericParamGuards(reportRouter, ['id']);

reportRouter.post('/property', uploadMiddleware.any(), submitPropertyReport);
reportRouter.post('/review', uploadMiddleware.any(), submitReviewReport);
reportRouter.post('/unban-property', uploadMiddleware.any(), submitUnbanAppeal);
reportRouter.get('/me/paginate', getMyReports);
reportRouter.get('/me/:id', getMyReportById);
