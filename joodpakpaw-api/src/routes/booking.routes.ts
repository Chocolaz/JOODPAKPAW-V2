import { Router } from 'express';
import {
  createBooking,
  getBookingsPaginated,
  getBookingById,
} from '../controllers/booking.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const bookingRouter = Router();

// Bookings CRUD & lifecycle under /api/v1/bookings
bookingRouter.post('/', authenticateToken, createBooking);
bookingRouter.get('/paginate', authenticateToken, getBookingsPaginated);
bookingRouter.get('/:bookingId', authenticateToken, getBookingById);
