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
}

export interface PropertiesResponse {
  totalRows: number
  totalPages: number
  data: Property[]
  limit: number
  page: number
  orderBy: string
  sort: string
}

export interface HostPropertiesResponse {
  properties: Property[]
}

export interface RoomCategoriesResponse {
  roomCategories: RoomCategories[]
}
