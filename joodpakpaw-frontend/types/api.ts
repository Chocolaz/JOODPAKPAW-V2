import { UserProfile } from './user'

export interface ProfileResponse {
  code: number
  data: UserProfile
  message: string
}

export interface Facility {
  id: number
  name: string
  category: {
    id: number
    name: string
  }
}

export interface FacilitiesResponse {
  facilities: Facility[]
}

export interface PropertyFormData {
  propertyId?: number
  propertyTypeId: number | null
  latitude: string
  longitude: string
  country: string
  province: string
  district: string
  geocodedProvince: string
  geocodedDistrict: string
  address: string
  zipcode: string
  title: string
  description: string
  facilities: number[]
  images: File[]
}

export interface CreatePropertyResponse {
  data: {
    id: number
  }
}

export interface RoomCategoryFormData {
  name: string
  totalRoom: number
  numberOfPets: number
  basePrice: number
  pets: number[]
  facilities: number[]
  petSizeCategoryId: number
  images: File[]
}

export interface EditRoomCategoryFormData {
  name: string
  totalRoom: number
  numberOfPets: number
  basePrice: number
  pets: number[]
  facilities: number[]
  petSizeCategoryId: number
  newImages: File[]
  deleteImageIds: number[]
}

export interface BookingOrderItem {
  roomCategoryId: number
  checkInDate: string
  checkOutDate: string
  roomsBooked: number
}

export type BookingRequestBody =
  | { PetProfileIDs: number[]; bookingOrders: BookingOrderItem[] }
  | { numberOfPets: number; bookingOrders: BookingOrderItem[] }

export interface BookingResponse {
  message: string
}
