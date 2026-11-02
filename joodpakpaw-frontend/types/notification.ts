export interface ServerNotification {
  id: number
  title: string
  message: string
  category: string
  type: string
  isRead: boolean
  referenceTable: string | null
  referenceId: number | null
  roleName: string | null
  actionName: string | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: ServerNotification[]
}

export interface AppNotification {
  id: string
  type: string
  category: string
  title: string
  message: string
  isRead: boolean
  receivedAt: string // ISO string
  referenceId?: number
  referenceTable?: string
  roleName?: string
  actionName?: string
}
