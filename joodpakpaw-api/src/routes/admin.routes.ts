import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminReports,
  getAdminReportById,
  handleReportAction,
  getAdminActionLogs,
} from '../controllers/admin.controller';
import {
  getAdminVerifications,
  getAdminVerificationById,
  approveVerification,
  rejectVerification,
} from '../controllers/verification.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

export const adminRouter = Router();

// Enforce admin role on all admin routes (401 A-3005 if not authenticated, 403 A-3007 if not admin)
adminRouter.use(authenticateToken, requireRoles('admin'));

// Admin Dashboard
adminRouter.get('/dashboard', getAdminDashboard);

// Admin Reports Management
adminRouter.get('/reports/paginate', getAdminReports);
adminRouter.get('/reports/:id', getAdminReportById);
adminRouter.patch('/reports/:id/action', handleReportAction);

// Admin Action Logs
adminRouter.get('/action-logs/paginate', getAdminActionLogs);

// Admin User Verifications (KYC)
adminRouter.get('/user-verifications/paginate', getAdminVerifications);
adminRouter.get('/user-verifications/:id', getAdminVerificationById);
adminRouter.patch('/user-verifications/:id/approve', approveVerification);
adminRouter.patch('/user-verifications/:id/reject', rejectVerification);
