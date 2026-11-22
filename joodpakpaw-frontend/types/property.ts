import { Facility } from './api'
import { Pet } from './pet'

export interface PropertyImage {
  id: number
  fileName: string
  filePath: string
  fileContentType: string
  fileExtensionName: string
  fileSize: number
}

export interface RoomCategories {
  id: number
  name: string
  totalRoom: number
  numberOfPets: number
  basePrice: number
  propertyId: number
  isAvailable: boolean
  isCapacityInsufficient: boolean
  isBooked: boolean
  availability: {
    roomsNeeded: number
    availableRooms: number
    totalPrice: number
    dates: {
      date: string
      availableRooms: number
      priceAdjustment: number
      finalPrice: number
    }[]
  }
  petSizeCategory?: {
    id: number
    name: string
    code: number
    min: number
    max: number
  }
  property?: {
    id: number
    title: string
    address: string
  }
  pets: {
    id: number
    name: string
  }[]
  facilities?: {
    id: number
    name: string
  }[]
  images?: {
    id: number
    fileName: string
    filePath: string
    fileContentType: string
    fileExtensionName: string
    fileSize: number
  }[]
}

export interface PropertyType {
  id: number
  name: string
}

export interface ReviewImage {
  id: number
  fileName: string
  filePath: string
  fileContentType: string
  fileExtensionName: string
  fileSize: number
}

export interface PropertyReview {
  bookingId: number
  firstName: string
  lastName: string
  avatar?: string | null
  comment: string
  rating: number
  hostReply?: string | null
  hostRepliedAt?: string | null
  reviewImages?: ReviewImage[]
}

export interface PropertyHost {
  id: number
  firstName: string
  lastName: string
  avatar: string
  hostAvgRating?: number
  isVerifiedHost?: boolean
}

export type MatchTier = 'all_pets' | 'partial_pets' | 'cold_start' | 'similar'

export interface ScoreBreakdown {
  sContent: number
  sCompat: number
  sQuality: number
  sPopularity: number
  sGeo?: number | null
  distanceKm?: number | null
}

export interface RecommendationMeta {
  source: 'ml_service' | 'in_process_fallback'
  strategy: string
  snapshotAgeSeconds?: number
  latencyMs?: number
  totalCandidates?: number
}

export interface MlSampleUserPet {
  id: number
  name: string
  species: string
  weight: number | null
  sizeName: string | null
  energyRating: number | null
}

export interface MlSampleUser {
  id: number
  email: string
  firstName: string
  lastName: string
  roles: string[]
  behaviorCount: number
  pets: MlSampleUserPet[]
}

export interface MlSampleProperty {
  id: number
  title: string
  province: string
  avgRating: number
}

export interface MlStatusResponse {
  mlServiceUrl: string
  timeoutMs: number
  mlServiceReachable: boolean
  status: 'live' | 'fallback'
  mlHealth: {
    status: string
    service: string
    catalogSize: number
    snapshotAgeSeconds: number
    dbConnected: boolean
  } | null
  fallbackReady: boolean
  catalogSize: number
  snapshotAgeSeconds: number
  totalUsers?: number
  totalActiveProperties?: number
  sampleUsers?: MlSampleUser[]
  sampleProperties?: MlSampleProperty[]
}

export interface MlRefreshResponse {
  refreshed: boolean
  mlServiceRefreshed: boolean
  catalogSize: number
  snapshotAgeSeconds: number
}

export interface Property {
  id: number
  title: string
  description: string
  address?: string
  province: string
  district: string
  country: string
  latitude: number | string
  longitude: number | string
  zipcode: string
  isActive: boolean
  isBannedByAdmin?: boolean
  isBannedBeforeAccountBan?: boolean
  unbanRequestCount?: number
  hasPendingUnbanRequest?: boolean
  suspensionReason?: string | null
  lastAppealNote?: string | null
  isFavorite: boolean
  avgRating: number
  hostId: number
  hostAvgRating?: number
  propertyTypeId: number
  images: PropertyImage[]
  roomCategories?: RoomCategories | RoomCategories[]
  createdAt: string
  publishedAt?: string
  updatedAt: string
  reviewCount?: number
  reviews?: PropertyReview[]
  propertyType?: PropertyType
  facilities?: Facility[]
  totalRoomCategories?: number
  pets?: Pet[]
  host?: PropertyHost
  chatRoomId?: number | null
  matchReasons?: string[]
  recommendationScore?: number
  matchTier?: MatchTier
  scoreBreakdown?: ScoreBreakdown
  stayNights?: number
  stayTotalPrice?: number
}

export interface PaginationInfo {
  page: number
  limit: number
  totalRows: number
  totalPages: number
}

export interface PropertiesResponse {
  code?: string | number
  message?: string
  totalRows: number
  totalPages: number
  data: Property[]
  pagination?: PaginationInfo
  meta?: RecommendationMeta
  limit: number
  page: number
  orderBy?: string
  sort?: string
}

export interface HostPropertiesResponse {
  code?: string | number
  message?: string
  data?: {
    properties: Property[]
  } | Property[]
  properties: Property[]
  meta?: RecommendationMeta
}

export interface RoomCategoriesResponse {
  code?: string | number
  message?: string
  data?: {
    roomCategories: RoomCategories[]
  } | RoomCategories[]
  roomCategories: RoomCategories[]
}

export interface RoomCategoryCalendarItem {
  id?: number | null
  date: string
  totalRooms: number
  bookedRooms: number
  unavailableRooms: number
  availableRooms: number
  priceAdjustment: number
  basePrice: number
  effectivePrice: number
}

export interface RoomCategoryCalendarsResponse {
  code?: string | number
  message?: string
  calendars: RoomCategoryCalendarItem[]
  data?: {
    calendars: RoomCategoryCalendarItem[]
  }
}

export interface PropertyDetailResponse {
  code?: string | number
  message?: string
  data?: {
    property: Property
  } | Property
  property: Property
}

