export interface Role {
  id: number
  name: string
}

export interface User {
  email: string
  firstName: string
  id: number
  lastName: string
  role: Role[]
  avatar?: string
  isVerifiedHost?: boolean
}

export interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  avatar: string
  phone: string
  isBecomeToHost: boolean
  isVerifiedHost?: boolean
  isBannedAllProperties?: boolean
  unbanAllPropertiesRequestCount?: number
  hasPendingUnbanAllPropertiesRequest?: boolean
  role: Role[]
}
