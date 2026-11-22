export interface Role {
  id: number
  name: string
}

export interface User {
  email: string
  firstName: string
  id: number
  lastName: string
  visibleName?: string | null
  role: Role[]
  avatar?: string
  phone?: string
  isVerifiedHost?: boolean
}

export interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  visibleName?: string | null
  avatar: string
  phone: string
  isBecomeToHost: boolean
  isVerifiedHost?: boolean
  isBannedAllProperties?: boolean
  unbanAllPropertiesRequestCount?: number
  hasPendingUnbanAllPropertiesRequest?: boolean
  suspensionReason?: string | null
  lastAppealNote?: string | null
  role: Role[]
}
