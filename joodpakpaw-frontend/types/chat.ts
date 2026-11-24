export interface ChatUser {
  id: number
  firstName: string
  lastName: string
  visibleName?: string | null
  avatar: string
  isHost?: boolean
  isVerifiedHost?: boolean
}

export interface ChatMessage {
  id: number
  content: string
  readAt: string | null
  createdAt: string
  sender: ChatUser
  attachments: (string | { url?: string; path?: string; filePath?: string; file?: string })[]
}

export interface ChatRoom {
  id: number
  lastMessageAt: string
  lastMessage?: {
    id: number
    content: string
    readAt: string | null
    senderId: number
  } | null
  otherUser: ChatUser
  activeBooking?: {
    id: number
    bookingStatus: string
    checkInDate: string
    checkOutDate: string
    propertyId: number
    propertyTitle: string
  } | null
  contextProperty?: {
    id: number
    title: string
    thumbnail?: string | null
  } | null
}

export interface ChatRoomsResponse {
  chatRooms: ChatRoom[]
}

export interface ChatRoomDetail {
  id: number
  lastMessageAt: string
  otherUser: ChatUser
  messages: ChatMessage[]
  activeBooking?: {
    id: number
    bookingStatus: string
    checkInDate: string
    checkOutDate: string
    propertyId: number
    propertyTitle: string
  } | null
  contextProperty?: {
    id: number
    title: string
    thumbnail?: string | null
  } | null
}
