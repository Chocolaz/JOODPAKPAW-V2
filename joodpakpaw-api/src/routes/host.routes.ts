import { Router } from 'express';
import {
  getHostProperties,
  getHostPropertyById,
  createHostProperty,
  updateHostProperty,
  deleteHostProperty,
  updateHostPropertyIsActive,
  getHostRoomCategories,
  createHostRoomCategory,
  updateHostRoomCategory,
  deleteHostRoomCategory,
  getRoomCategoryCalendars,
  updateRoomCategoryCalendars,
} from '../controllers/hostProperty.controller';
import {
  getHostBookingsAll,
  getHostBookingsPaginated,
  getHostBookingById,
  getHostPropertyBookingsPaginated,
  completeHostBooking,
} from '../controllers/booking.controller';
import { getAllFacilities } from '../controllers/lookup.controller';
import {
  authenticateToken,
  optionalAuthenticateToken,
} from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';

export const hostRouter = Router();

// Master lookup under /api/v1/hosts/facilities/all
hostRouter.get('/facilities/all', optionalAuthenticateToken, getAllFacilities);

// Host bookings routes (MUST precede generic /:propertyId or :bookingId where applicable)
hostRouter.get('/bookings/all', authenticateToken, getHostBookingsAll);
hostRouter.get('/bookings/paginate', authenticateToken, getHostBookingsPaginated);
hostRouter.get('/bookings/:bookingId', authenticateToken, getHostBookingById);
hostRouter.patch('/bookings/:bookingId/success', authenticateToken, completeHostBooking);

// Host properties CRUD
hostRouter.get('/properties/all', authenticateToken, getHostProperties);
hostRouter.post(
  '/properties',
  authenticateToken,
  uploadMiddleware.any(),
  createHostProperty
);

// Specific property bookings pagination (must precede /properties/:propertyId)
hostRouter.get(
  '/properties/:propertyId/bookings/paginate',
  authenticateToken,
  getHostPropertyBookingsPaginated
);

// Room categories CRUD under a host property
hostRouter.get(
  '/properties/:propertyId/room-categories/:roomId/calendars',
  authenticateToken,
  getRoomCategoryCalendars
);
hostRouter.patch(
  '/properties/:propertyId/room-categories/:roomId/calendars',
  authenticateToken,
  updateRoomCategoryCalendars
);
hostRouter.get(
  '/properties/:propertyId/room-categories/all',
  authenticateToken,
  getHostRoomCategories
);
hostRouter.post(
  '/properties/:propertyId/room-categories',
  authenticateToken,
  uploadMiddleware.any(),
  createHostRoomCategory
);
hostRouter.put(
  '/properties/:propertyId/room-categories/:roomId',
  authenticateToken,
  uploadMiddleware.any(),
  updateHostRoomCategory
);
hostRouter.delete(
  '/properties/:propertyId/room-categories/:roomCategoryId',
  authenticateToken,
  deleteHostRoomCategory
);

// Property active status toggle
hostRouter.patch(
  '/properties/:propertyId/is-active',
  authenticateToken,
  updateHostPropertyIsActive
);

// Single host property detail, update, and delete
hostRouter.get(
  '/properties/:propertyId',
  authenticateToken,
  getHostPropertyById
);
hostRouter.put(
  '/properties/:propertyId',
  authenticateToken,
  uploadMiddleware.any(),
  updateHostProperty
);
hostRouter.delete(
  '/properties/:propertyId',
  authenticateToken,
  deleteHostProperty
);
