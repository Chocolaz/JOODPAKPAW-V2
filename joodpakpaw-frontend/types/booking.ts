export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'successful'
  | 'rejected'

/**
 * Standard Booking domain error codes per JoodPakPaw API Contract specification
 */
export type BookingErrorCode =
  | 'B-4001'
  | 'B-4002'
  | 'B-4003'
  | 'B-4004'
  | 'A-3007'
  | 'T-2007'
  | 'DB-1002'

export interface ApiResponse<T = unknown> {
  code?: string | number
  message?: string
  data?: T
  booking?: T
  [key: string]: unknown
}

export interface BookingDetail {
  propertyId: number
  checkInDate: string
  checkOutDate: string
  petProfileIds: number[]
  petCount: number
  selectedRooms: { [key: string]: number }
  roomNames: { [key: string]: string }
  guestNote?: string | null
  totalPrice?: number
  finalPrice?: number
  amount?: number
}

export interface RoomCategoryBooked {
  id: number
  name: string
  roomsBooked: number
}

export interface PropertyBooked {
  id: number
  title: string
  roomCategories: RoomCategoryBooked[]
}

export interface Booking {
  id: number
  checkInDate: string
  checkOutDate: string
  numberOfPets: number
  totalPrice: number
  bookingStatus: BookingStatus
  rating?: number | null
  guestNote?: string | null
  paymentSlipUrl?: string | null
  hostReply?: string | null
  hostRepliedAt?: string | null
  cancelledBy?: 'guest' | 'host' | 'system' | string | null
  cancellationReason?: string | null
  paymentDeadlineAt?: string | null
  paymentDeadline?: string | null
  checkInCutoffAt?: string | null
  canCompleteAt?: string | null
  autoCompleteAt?: string | null
  reviewDeadlineAt?: string | null
  reviewDeadline?: string | null
  confirmedAt?: string | null
  successedAt?: string | null
  property: PropertyBooked
  createdAt: string
  updatedAt?: string
}

export interface BookingsResponse {
  code?: string | number
  message?: string
  data?: {
    bookings: Booking[]
  } | Booking[]
  bookings: Booking[]
}

export interface BookingsPaginatedResponse {
  totalRows: number
  totalPages: number
  data: Booking[]
  limit: number
  page: number
}

export interface Guest {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export interface BookingOrderProperty {
  id: number
  title: string
  address: string
  district?: string
  province?: string
}

export interface BookingOrderRoomCategory {
  id: number
  name: string
}

export interface BookingOrder {
  id: number
  checkInDate: string
  checkOutDate: string
  roomsBooked: number
  pricePerRoom: number
  totalPrice: number
  propertyId: number
  property: BookingOrderProperty
  roomCategoryId: number
  roomCategory: BookingOrderRoomCategory
}

export interface BookingPetProfile {
  id: number
  name: string
  image: string | null
  petTypeName?: string
  breedName?: string
  sex?: string
  weight?: number | null
}

export interface FullBookingDetail {
  id: number
  checkInDate: string
  checkOutDate: string
  numberOfPets: number
  totalPrice: number
  bookingStatus: BookingStatus
  rating?: number | null
  guestNote?: string | null
  paymentSlipUrl?: string | null
  hostReply?: string | null
  hostRepliedAt?: string | null
  cancelledBy?: 'guest' | 'host' | 'system' | string | null
  cancellationReason?: string | null
  paymentDeadlineAt?: string | null
  paymentDeadline?: string | null
  checkInCutoffAt?: string | null
  canCompleteAt?: string | null
  autoCompleteAt?: string | null
  reviewDeadlineAt?: string | null
  reviewDeadline?: string | null
  comment?: string | null
  successedAt?: string | null
  confirmedAt?: string | null
  guestId: number
  guest: Guest
  bookingOrders: BookingOrder[]
  petProfiles?: BookingPetProfile[]
  property?: PropertyBooked
  createdAt: string
  updatedAt: string
}

export interface HostGuest {
  userId: number
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface HostBookingPetProfile {
  id: number
  name: string
  sex: string
  birthDate: string
  contactName: string
  contactPhone: string
  note?: string
  breedName: string
  petTypeName: string
  petEnergy?: {
    id: number
    rating: number
    description: string
  }
  petSizeName: string
}

export interface HostBookingDetail {
  id: number
  checkInDate: string
  checkOutDate: string
  numberOfPets: number
  totalPrice: number
  bookingStatus: BookingStatus
  rating?: number | null
  guestNote?: string | null
  paymentSlipUrl?: string | null
  hostReply?: string | null
  hostRepliedAt?: string | null
  cancelledBy?: 'guest' | 'host' | 'system' | string | null
  cancellationReason?: string | null
  paymentDeadlineAt?: string | null
  paymentDeadline?: string | null
  checkInCutoffAt?: string | null
  canCompleteAt?: string | null
  autoCompleteAt?: string | null
  reviewDeadlineAt?: string | null
  reviewDeadline?: string | null
  comment?: string | null
  successedAt?: string | null
  confirmedAt?: string | null
  guest: HostGuest
  bookingOrders: BookingOrder[]
  petProfiles?: HostBookingPetProfile[]
  createdAt: string
  updatedAt: string
}
