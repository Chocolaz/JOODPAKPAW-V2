import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { uploadMiddleware } from '../services/storage.service';
import {
  createChatRoom,
  getChatRooms,
  getChatRoomDetail,
  sendChatMessage,
  markMessagesAsRead,
  deleteChatRoom,
} from '../controllers/chat.controller';

export const chatRouter = Router();

// All chat routes require user authentication
chatRouter.use(authenticateToken);

chatRouter.post('/', uploadMiddleware.any(), createChatRoom);
chatRouter.get('/', getChatRooms);
chatRouter.get('/:id', getChatRoomDetail);
chatRouter.post('/:roomId/messages', uploadMiddleware.any(), sendChatMessage);
chatRouter.patch('/:roomId/messages/read', markMessagesAsRead);
chatRouter.delete('/:roomId', deleteChatRoom);
