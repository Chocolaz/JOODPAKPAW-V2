import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import {
  uploadMultipleImagesAsWebp,
  deleteObjectFromS3,
} from '../services/storage.service';
import { emitToUser } from '../services/socket.service';

export interface ChatUserDto {
  id: number;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isHost: boolean;
  isVerifiedHost: boolean;
}

export interface ChatMessageDto {
  id: number;
  content: string;
  readAt: string | null;
  createdAt: string;
  sender: {
    id: number;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
  attachments: string[];
}

export interface ActiveBookingDto {
  id: number;
  bookingStatus: string;
  checkInDate: string;
  checkOutDate: string;
  propertyId: number;
  propertyTitle: string;
}

export interface ContextPropertyDto {
  id: number;
  title: string;
  thumbnail: string | null;
}

export interface ChatRoomSummaryDto {
  id: number;
  lastMessageAt: string;
  lastMessage: {
    id: number;
    content: string;
    readAt: string | null;
    senderId: number;
  } | null;
  otherUser: ChatUserDto;
  activeBooking: ActiveBookingDto | null;
  contextProperty: ContextPropertyDto | null;
}

export interface ChatRoomDetailDto {
  id: number;
  lastMessageAt: string;
  otherUser: ChatUserDto;
  activeBooking: ActiveBookingDto | null;
  contextProperty: ContextPropertyDto | null;
  messages: ChatMessageDto[];
}

function extractUploadedFiles(req: Request): Express.Multer.File[] {
  const uploadedFiles: Express.Multer.File[] = [];
  if (Array.isArray(req.files)) {
    uploadedFiles.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    for (const key of Object.keys(req.files)) {
      const arr = (req.files as Record<string, Express.Multer.File[]>)[key];
      if (Array.isArray(arr)) uploadedFiles.push(...arr);
    }
  } else if (req.file) {
    uploadedFiles.push(req.file);
  }
  return uploadedFiles;
}

function formatChatUserDto(user: any): ChatUserDto {
  if (!user) {
    return {
      id: 0,
      firstName: 'Deleted',
      lastName: 'User',
      avatar: null,
      isHost: false,
      isVerifiedHost: false,
    };
  }

  const isHost = Boolean(
    user.isBecomeToHost ||
    user.isVerifiedHost ||
    (Array.isArray(user.hostedProperties) && user.hostedProperties.length > 0) ||
    user.userRoles?.some((ur: any) => ur.role?.name?.toLowerCase() === 'host')
  );

  return {
    id: user.id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    avatar: user.avatar ?? user.profileImage ?? null,
    isHost,
    isVerifiedHost: Boolean(user.isVerifiedHost),
  };
}

function formatChatMessageDto(msg: any): ChatMessageDto {
  return {
    id: msg.id,
    content: msg.content ?? '',
    readAt: msg.readAt ? new Date(msg.readAt).toISOString() : null,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
    sender: {
      id: msg.sender?.id ?? msg.senderId,
      firstName: msg.sender?.firstName ?? '',
      lastName: msg.sender?.lastName ?? '',
      avatar: msg.sender?.avatar ?? msg.sender?.profileImage ?? null,
    },
    attachments: (msg.attachments || []).map((a: any) => (typeof a === 'string' ? a : a.filePath)),
  };
}

async function findActiveBookingBetween(
  userAId: number,
  userBId: number
): Promise<ActiveBookingDto | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const booking = await prisma.booking.findFirst({
      where: {
        deletedAt: null,
        OR: [
          {
            guestId: userAId,
            property: { hostId: userBId },
          },
          {
            guestId: userBId,
            property: { hostId: userAId },
          },
        ],
        AND: [
          {
            OR: [
              { bookingStatus: { in: ['pending', 'confirmed', 'waiting', 'checked_in'] } },
              {
                bookingStatus: { in: ['completed', 'successful', 'success'] },
                checkOutDate: { gte: sevenDaysAgo },
              },
            ],
          },
        ],
      },
      include: {
        property: {
          select: { id: true, title: true },
        },
      },
      orderBy: [
        { checkInDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (!booking) return null;

    const checkInDateStr =
      booking.checkInDate instanceof Date
        ? booking.checkInDate.toISOString().slice(0, 10)
        : String(booking.checkInDate || '').slice(0, 10);
    const checkOutDateStr =
      booking.checkOutDate instanceof Date
        ? booking.checkOutDate.toISOString().slice(0, 10)
        : String(booking.checkOutDate || '').slice(0, 10);

    return {
      id: booking.id,
      bookingStatus: booking.bookingStatus,
      checkInDate: checkInDateStr,
      checkOutDate: checkOutDateStr,
      propertyId: booking.propertyId,
      propertyTitle: booking.property?.title ?? '',
    };
  } catch (err) {
    console.warn('[ChatController] Could not resolve active booking:', err);
    return null;
  }
}

async function resolveContextProperty(
  propertyId?: number | null,
  activeBooking?: ActiveBookingDto | null
): Promise<ContextPropertyDto | null> {
  const targetId = propertyId || activeBooking?.propertyId;
  if (!targetId) return null;

  try {
    const prop = await prisma.property.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        title: true,
        images: {
          where: { deletedAt: null },
          take: 1,
          orderBy: { id: 'asc' },
          select: { filePath: true },
        },
      },
    });

    if (!prop) return null;

    return {
      id: prop.id,
      title: prop.title,
      thumbnail: prop.images && prop.images[0] ? prop.images[0].filePath : null,
    };
  } catch (err) {
    console.warn('[ChatController] Could not resolve context property:', err);
    return null;
  }
}

/**
 * POST /api/v1/chat-rooms
 * Creates or retrieves a 1-on-1 chat room with pair normalization and self-chat guard.
 * Optionally sends an initial message with WebP attachment support.
 */
export async function createChatRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const rawParticipantId = req.body.participantId || req.body.participant_id;
    const participantId = parseInt(String(rawParticipantId), 10);

    if (isNaN(participantId) || participantId <= 0) {
      throw new AppError('Validation failed: participantId is required', 400, 'T-2007');
    }

    if (participantId === currentUserId) {
      throw new AppError('Cannot create a chat room with yourself.', 400, 'T-2007');
    }

    // Verify participant existence and ban status
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      include: {
        userRoles: { include: { role: true } },
        hostedProperties: { select: { id: true }, take: 1 },
      },
    });

    if (!participant || participant.deletedAt !== null) {
      throw new AppError('Participant not found or deactivated', 404, 'DB-1002');
    }

    if (participant.bannedAt !== null) {
      throw new AppError('Participant user account has been banned', 403, 'A-3002');
    }

    // Pair Normalization: strictly p1 < p2
    const p1 = Math.min(currentUserId, participantId);
    const p2 = Math.max(currentUserId, participantId);

    // Look for existing room
    let room = await prisma.chatRoom.findFirst({
      where: {
        OR: [
          { participant1Id: p1, participant2Id: p2 },
          { participant1Id: p2, participant2Id: p1 },
        ],
      },
      include: {
        participant1: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        participant2: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            attachments: true,
            sender: true,
          },
        },
      },
    });

    let isCreated = false;
    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          participant1Id: p1,
          participant2Id: p2,
          lastMessageAt: new Date(),
        },
        include: {
          participant1: {
            include: {
              userRoles: { include: { role: true } },
              hostedProperties: { select: { id: true }, take: 1 },
            },
          },
          participant2: {
            include: {
              userRoles: { include: { role: true } },
              hostedProperties: { select: { id: true }, take: 1 },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              attachments: true,
              sender: true,
            },
          },
        },
      });
      isCreated = true;
    }

    // Handle initial message and attachments
    const rawContent = req.body.content ? String(req.body.content).trim() : '';
    const files = extractUploadedFiles(req);

    if (rawContent.length > 1000) {
      throw new AppError('Message content cannot exceed 1000 characters', 400, 'T-2007');
    }
    if (files.length > 5) {
      throw new AppError('Cannot upload more than 5 images per message', 400, 'T-2007');
    }

    let sentMessageDto: ChatMessageDto | null = null;
    if (rawContent.length > 0 || files.length > 0) {
      const attachmentUrls = files.length > 0 ? await uploadMultipleImagesAsWebp(files, 'chat') : [];

      const newMsg = await prisma.$transaction(async (tx) => {
        const msg = await tx.chatMessage.create({
          data: {
            roomId: room.id,
            senderId: currentUserId,
            content: rawContent,
            attachments: {
              create: attachmentUrls.map((url, idx) => ({
                filePath: url,
                fileName: files[idx]?.originalname ?? `image_${idx}.webp`,
                fileContentType: 'image/webp',
                fileSize: files[idx]?.size ?? null,
              })),
            },
          },
          include: {
            sender: true,
            attachments: true,
          },
        });

        await tx.chatRoom.update({
          where: { id: room.id },
          data: {
            lastMessageAt: msg.createdAt,
            lastMessageId: msg.id,
          },
        });

        return msg;
      });

      sentMessageDto = formatChatMessageDto(newMsg);
      room.lastMessageAt = newMsg.createdAt;
      room.messages = [newMsg];

      // Emit new_message to both participants
      emitToUser(p1, 'new_message', { roomId: room.id, message: sentMessageDto });
      emitToUser(p2, 'new_message', { roomId: room.id, message: sentMessageDto });
    }

    // Context metadata
    const rawPropertyId = req.body.propertyId || req.body.property_id;
    const propertyId = rawPropertyId ? parseInt(String(rawPropertyId), 10) : null;
    const activeBooking = await findActiveBookingBetween(currentUserId, participantId);
    const contextProperty = await resolveContextProperty(propertyId, activeBooking);

    // If new room was created, emit new_chat_room with perspective-swapped otherUser
    if (isCreated) {
      const creatorUserRecord = currentUserId === room.participant1Id ? room.participant1 : room.participant2;
      const otherForCreator = formatChatUserDto(participant);
      const otherForParticipant = formatChatUserDto(creatorUserRecord);

      const lastMessageSummary = sentMessageDto
        ? {
            id: sentMessageDto.id,
            content: sentMessageDto.content,
            readAt: sentMessageDto.readAt,
            senderId: currentUserId,
          }
        : null;

      const summaryForCreator: ChatRoomSummaryDto = {
        id: room.id,
        lastMessageAt: room.lastMessageAt ? new Date(room.lastMessageAt).toISOString() : new Date().toISOString(),
        lastMessage: lastMessageSummary,
        otherUser: otherForCreator,
        activeBooking,
        contextProperty,
      };

      const summaryForParticipant: ChatRoomSummaryDto = {
        id: room.id,
        lastMessageAt: room.lastMessageAt ? new Date(room.lastMessageAt).toISOString() : new Date().toISOString(),
        lastMessage: lastMessageSummary,
        otherUser: otherForParticipant,
        activeBooking,
        contextProperty,
      };

      emitToUser(currentUserId, 'new_chat_room', summaryForCreator);
      emitToUser(participantId, 'new_chat_room', summaryForParticipant);
    }

    const lastMsg = room.messages && room.messages[0];
    const summaryDto: ChatRoomSummaryDto = {
      id: room.id,
      lastMessageAt: room.lastMessageAt ? new Date(room.lastMessageAt).toISOString() : new Date().toISOString(),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            readAt: lastMsg.readAt ? new Date(lastMsg.readAt).toISOString() : null,
            senderId: lastMsg.senderId,
          }
        : null,
      otherUser: formatChatUserDto(participant),
      activeBooking,
      contextProperty,
    };

    res.status(isCreated ? 201 : 200).json({
      code: 'S-0000',
      message: isCreated ? 'Chat room created successfully' : 'Chat room ready',
      data: {
        chatRoom: summaryDto,
      },
      chatRoom: summaryDto, // Backward-compatibility alias
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/chat-rooms
 * Lists all chat rooms for the authenticated user with otherUser, lastMessage, and booking context.
 */
export async function getChatRooms(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;

    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { participant1Id: currentUserId },
          { participant2Id: currentUserId },
        ],
      },
      include: {
        participant1: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        participant2: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            attachments: true,
            sender: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    const chatRooms: ChatRoomSummaryDto[] = await Promise.all(
      (rooms || []).map(async (r) => {
        const otherUserRecord = r.participant1Id === currentUserId ? r.participant2 : r.participant1;
        const otherUser = formatChatUserDto(otherUserRecord);
        const lastMsg = r.messages && r.messages[0];

        const activeBooking = await findActiveBookingBetween(currentUserId, otherUserRecord?.id ?? 0);
        const contextProperty = await resolveContextProperty(null, activeBooking);

        return {
          id: r.id,
          lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toISOString() : new Date().toISOString(),
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content,
                readAt: lastMsg.readAt ? new Date(lastMsg.readAt).toISOString() : null,
                senderId: lastMsg.senderId,
              }
            : null,
          otherUser,
          activeBooking,
          contextProperty,
        };
      })
    );

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        chatRooms,
      },
      chatRooms, // Backward-compatibility alias
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/chat-rooms/:id
 * Retrieves full room details and message history with participant IDOR authorization guard.
 */
export async function getChatRoomDetail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const roomId = parseInt(req.params.id, 10);

    if (isNaN(roomId) || roomId <= 0) {
      throw new AppError('Invalid chat room ID', 400, 'T-2007');
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        participant1: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        participant2: {
          include: {
            userRoles: { include: { role: true } },
            hostedProperties: { select: { id: true }, take: 1 },
          },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            sender: true,
            attachments: true,
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Chat room not found', 404, 'DB-1002');
    }

    // Participant IDOR guard
    if (room.participant1Id !== currentUserId && room.participant2Id !== currentUserId) {
      throw new AppError('Access forbidden. You are not a participant in this chat room.', 403, 'A-3007');
    }

    const otherUserRecord = room.participant1Id === currentUserId ? room.participant2 : room.participant1;
    const otherUser = formatChatUserDto(otherUserRecord);

    const activeBooking = await findActiveBookingBetween(currentUserId, otherUserRecord?.id ?? 0);
    const contextProperty = await resolveContextProperty(null, activeBooking);
    const messages = (room.messages || []).map(formatChatMessageDto);

    const detailDto: ChatRoomDetailDto = {
      id: room.id,
      lastMessageAt: room.lastMessageAt ? new Date(room.lastMessageAt).toISOString() : new Date().toISOString(),
      otherUser,
      activeBooking,
      contextProperty,
      messages,
    };

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        chatRoom: detailDto,
      },
      chatRoom: detailDto, // Backward-compatibility alias
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/chat-rooms/:roomId/messages
 * Sends a message with optional WebP attachments and emits real-time event.
 */
export async function sendChatMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const roomId = parseInt(req.params.roomId, 10);

    if (isNaN(roomId) || roomId <= 0) {
      throw new AppError('Invalid chat room ID', 400, 'T-2007');
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new AppError('Chat room not found', 404, 'DB-1002');
    }

    // Participant IDOR guard
    if (room.participant1Id !== currentUserId && room.participant2Id !== currentUserId) {
      throw new AppError('Access forbidden. You are not a participant in this chat room.', 403, 'A-3007');
    }

    const rawContent = req.body.content ? String(req.body.content).trim() : '';
    const files = extractUploadedFiles(req);

    if (rawContent.length === 0 && files.length === 0) {
      throw new AppError('Message must contain text content or at least one image attachment.', 400, 'T-2007');
    }
    if (rawContent.length > 1000) {
      throw new AppError('Message content cannot exceed 1000 characters', 400, 'T-2007');
    }
    if (files.length > 5) {
      throw new AppError('Cannot upload more than 5 images per message', 400, 'T-2007');
    }

    const attachmentUrls = files.length > 0 ? await uploadMultipleImagesAsWebp(files, 'chat') : [];

    const createdMsg = await prisma.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          roomId: room.id,
          senderId: currentUserId,
          content: rawContent,
          attachments: {
            create: attachmentUrls.map((url, idx) => ({
              filePath: url,
              fileName: files[idx]?.originalname ?? `image_${idx}.webp`,
              fileContentType: 'image/webp',
              fileSize: files[idx]?.size ?? null,
            })),
          },
        },
        include: {
          sender: true,
          attachments: true,
        },
      });

      await tx.chatRoom.update({
        where: { id: room.id },
        data: {
          lastMessageAt: msg.createdAt,
          lastMessageId: msg.id,
        },
      });

      return msg;
    });

    const messageDto = formatChatMessageDto(createdMsg);

    // Emit new_message to both participants
    emitToUser(room.participant1Id, 'new_message', { roomId: room.id, message: messageDto });
    emitToUser(room.participant2Id, 'new_message', { roomId: room.id, message: messageDto });

    res.status(201).json({
      code: 'S-0000',
      message: 'Message sent',
      data: {
        message: messageDto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/chat-rooms/:roomId/messages/read
 * Marks incoming messages in the room as read and emits messages_read event.
 */
export async function markMessagesAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const roomId = parseInt(req.params.roomId, 10);

    if (isNaN(roomId) || roomId <= 0) {
      throw new AppError('Invalid chat room ID', 400, 'T-2007');
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new AppError('Chat room not found', 404, 'DB-1002');
    }

    // Participant IDOR guard
    if (room.participant1Id !== currentUserId && room.participant2Id !== currentUserId) {
      throw new AppError('Access forbidden. You are not a participant in this chat room.', 403, 'A-3007');
    }

    const now = new Date();
    const updateResult = await prisma.chatMessage.updateMany({
      where: {
        roomId: room.id,
        senderId: { not: currentUserId },
        readAt: null,
        isDeleted: false,
      },
      data: {
        readAt: now,
      },
    });

    const readPayload = {
      roomId: room.id,
      chatRoomId: room.id,
      readerId: currentUserId,
      readAt: now.toISOString(),
    };

    emitToUser(room.participant1Id, 'messages_read', readPayload);
    emitToUser(room.participant2Id, 'messages_read', readPayload);

    res.status(200).json({
      code: 'S-0000',
      message: 'Messages marked as read',
      data: {
        roomId: room.id,
        readAt: now.toISOString(),
        updatedCount: updateResult.count,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/chat-rooms/:roomId
 * Deletes a chat room with S3 Garbage Collection of all message attachment objects.
 */
export async function deleteChatRoom(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const roomId = parseInt(req.params.roomId, 10);

    if (isNaN(roomId) || roomId <= 0) {
      throw new AppError('Invalid chat room ID', 400, 'T-2007');
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new AppError('Chat room not found', 404, 'DB-1002');
    }

    // Participant IDOR guard
    if (room.participant1Id !== currentUserId && room.participant2Id !== currentUserId) {
      throw new AppError('Access forbidden. You are not a participant in this chat room.', 403, 'A-3007');
    }

    // S3 Garbage Collection: retrieve all attachments BEFORE cascade deletion
    const attachments = await prisma.chatMessageAttachment.findMany({
      where: {
        message: { roomId: room.id },
      },
      select: { filePath: true },
    });

    if (Array.isArray(attachments) && attachments.length > 0) {
      await Promise.allSettled(
        attachments.map((a) => deleteObjectFromS3(a.filePath))
      );
    }

    // Cascade deletes messages and attachments in database
    await prisma.chatRoom.delete({
      where: { id: room.id },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Chat room deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
