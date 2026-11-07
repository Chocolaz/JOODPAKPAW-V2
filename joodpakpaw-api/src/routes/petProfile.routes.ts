import { Router } from 'express';
import {
  getAllPetProfiles,
  getPetProfileById,
  createPetProfile,
  updatePetProfile,
  deletePetProfile,
} from '../controllers/petProfile.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';

export const petProfileRouter = Router();

// Pet profiles CRUD under /api/v1/profiles/pet-profiles
petProfileRouter.get('/all', authenticateToken, getAllPetProfiles);
petProfileRouter.get('/:id', authenticateToken, getPetProfileById);
petProfileRouter.post('/', authenticateToken, uploadMiddleware.any(), createPetProfile);
petProfileRouter.put('/:id', authenticateToken, uploadMiddleware.any(), updatePetProfile);
petProfileRouter.delete('/:id', authenticateToken, deletePetProfile);
