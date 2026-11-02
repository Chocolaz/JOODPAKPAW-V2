export interface ActionLogActor {
  id: number
  firstName: string
  lastName: string
  avatar: string
  roles: string[]
}

export interface AdminActionLog {
  id: number
  modelName: string
  recordId: string
  action: string
  messages: string
  actor: ActionLogActor
  target: ActionLogActor
  createdAt: string
}

export interface AdminActionLogsResponse {
  totalRows: number
  totalPages: number
  data: AdminActionLog[]
  limit: number
  page: number
  orderBy: string
  sort: string
}
