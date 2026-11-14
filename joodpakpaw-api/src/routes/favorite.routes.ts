import { Router } from 'express';
import {
  getFavoriteFolders,
  getFavoriteFolderById,
  createOrAddFavorite,
  renameFavoriteFolder,
  deleteFavoriteFolder,
  deleteFavoriteProperty,
} from '../controllers/favorite.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const favoriteFolderRouter = Router();
export const favoritePropertyRouter = Router();

// Favorite Folders routes under /api/v1/favorite-folders
favoriteFolderRouter.get('/all', authenticateToken, getFavoriteFolders);
favoriteFolderRouter.get('/:folderId', authenticateToken, getFavoriteFolderById);
favoriteFolderRouter.post('/', authenticateToken, createOrAddFavorite);
favoriteFolderRouter.put('/:folderId', authenticateToken, renameFavoriteFolder);
favoriteFolderRouter.delete('/:folderId', authenticateToken, deleteFavoriteFolder);

// Favorite Properties routes under /api/v1/favorite-properties
favoritePropertyRouter.delete('/:propertyId', authenticateToken, deleteFavoriteProperty);
