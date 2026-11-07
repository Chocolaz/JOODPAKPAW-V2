import { Router } from 'express';
import {
  createBooking,
  getBookingsPaginated,
  getBookingById,
  confirmBookingPayment,
  cancelBooking,
  submitBookingReview,
} from '../controllers/booking.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';

export const bookingRouter = Router();

// Bookings CRUD & lifecycle under /api/v1/bookings
bookingRouter.post('/', authenticateToken, createBooking);
bookingRouter.get('/paginate', authenticateToken, getBookingsPaginated);
bookingRouter.get('/:bookingId', authenticateToken, getBookingById);
bookingRouter.patch(
  '/:bookingId/confirm-payment',
  authenticateToken,
  uploadMiddleware.any(),
  confirmBookingPayment
);
bookingRouter.patch('/:bookingId/cancel', authenticateToken, cancelBooking);
bookingRouter.post(
  '/:bookingId/review',
  authenticateToken,
  uploadMiddleware.array('images', 5),
  submitBookingReview
);
