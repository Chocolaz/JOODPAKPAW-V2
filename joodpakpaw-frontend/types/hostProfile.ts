import { Property, ReviewImage } from './property'

export interface HostProfile {
  id: number
  firstName: string
  lastName: string
  avatar: string | null
  createdAt: string
  avgRating: number
  reviewCount: number
  totalProperties: number
  properties: Property[]
  isVerifiedHost?: boolean
  chatRoomId?: number | null
}

export interface HostProfileResponse {
  code?: string | number
  message?: string
  data?: {
    host: HostProfile
  } | HostProfile
  host: HostProfile
}

export interface HostReviewGuest {
  id: number
  firstName: string
  lastName: string
  avatar: string
}

export interface HostReview {
  id: number
  rating: number
  comment: string
  propertyName: string
  reviewedAt: string
  guestProfile: HostReviewGuest
  reviewImages?: ReviewImage[]
}

export interface HostReviewsResponse {
  code?: string | number
  message?: string
  totalRows: number
  totalPages: number
  data: HostReview[]
  reviews?: HostReview[]
  pagination?: {
    page: number
    limit: number
    totalRows: number
    totalPages: number
  }
}
