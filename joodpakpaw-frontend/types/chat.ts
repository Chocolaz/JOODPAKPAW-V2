export interface ChatUser {
  id: number
  firstName: string
  lastName: string
  avatar: string
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
  lastMessage: {
    id: number
    content: string
    readAt: string | null
    senderId: number
  }
  otherUser: ChatUser
}

export interface ChatRoomsResponse {
  chatRooms: ChatRoom[]
}

export interface ChatRoomDetail {
  id: number
  lastMessageAt: string
  otherUser: ChatUser
  messages: ChatMessage[]
}
