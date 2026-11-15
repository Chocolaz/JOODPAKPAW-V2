import { Router } from 'express';
import {
  getMyVerification,
  submitVerification,
  getAdminVerifications,
  getAdminVerificationById,
  approveVerification,
  rejectVerification,
} from '../controllers/verification.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';

export const verificationRouter = Router();

// User-facing verification endpoints
verificationRouter.get('/me', authenticateToken, getMyVerification);
verificationRouter.post('/', authenticateToken, uploadMiddleware.any(), submitVerification);

// Admin-facing verification router (to be mounted under /admin/user-verifications or directly)
export const adminVerificationRouter = Router();
adminVerificationRouter.use(authenticateToken, requireRoles('admin'));

adminVerificationRouter.get('/paginate', getAdminVerifications);
adminVerificationRouter.get('/:id', getAdminVerificationById);
adminVerificationRouter.patch('/:id/approve', approveVerification);
adminVerificationRouter.patch('/:id/reject', rejectVerification);
