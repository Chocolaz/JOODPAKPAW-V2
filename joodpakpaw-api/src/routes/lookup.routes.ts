import { Router } from 'express';
import {
  getAllFacilities,
  getAllPets,
  getPetBreedsByTypeId,
  getAllPetSizeCategories,
  getReportCategories,
} from '../controllers/lookup.controller';
import { optionalAuthenticateToken } from '../middlewares/auth.middleware';

export const lookupRouter = Router();

lookupRouter.get('/hosts/facilities/all', optionalAuthenticateToken, getAllFacilities);
lookupRouter.get('/pets/all', optionalAuthenticateToken, getAllPets);
lookupRouter.get(
  '/pets/:petTypeId/pet-breeds/all',
  optionalAuthenticateToken,
  getPetBreedsByTypeId
);
lookupRouter.get(
  '/pet-size-categories/all',
  optionalAuthenticateToken,
  getAllPetSizeCategories
);
lookupRouter.get(
  '/report-categories',
  optionalAuthenticateToken,
  getReportCategories
);
