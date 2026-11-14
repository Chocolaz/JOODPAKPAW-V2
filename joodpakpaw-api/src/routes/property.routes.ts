import { Router } from 'express';
import {
  getProperties,
  getPropertyById,
  getHostProfile,
  getHostReviews,
  searchPropertyRoomCategories,
  getFeaturedSections,
} from '../controllers/property.controller';
import { optionalAuthenticateToken } from '../middlewares/auth.middleware';

export const propertyRouter = Router();

// Public property discovery & search
propertyRouter.get('/', optionalAuthenticateToken, getProperties);

// Featured sections for home page (MUST precede /:propertyId)
propertyRouter.get(
  '/featured-sections',
  optionalAuthenticateToken,
  getFeaturedSections
);

// Specific host sub-routes MUST precede /:propertyId
propertyRouter.get(
  '/hosts/:hostId/profile',
  optionalAuthenticateToken,
  getHostProfile
);
propertyRouter.get(
  '/hosts/:hostId/reviews',
  optionalAuthenticateToken,
  getHostReviews
);

// Room category availability search by date range
propertyRouter.get(
  '/:propertyId/room-categories/search',
  optionalAuthenticateToken,
  searchPropertyRoomCategories
);

// Single property detail
propertyRouter.get('/:propertyId', optionalAuthenticateToken, getPropertyById);
