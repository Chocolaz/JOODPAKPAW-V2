export interface BookingDetail {
  propertyId: number
  checkInDate: string
  checkOutDate: string
  petProfileIds: number[]
  petCount: number
  selectedRooms: { [key: string]: number }
  roomNames: { [key: string]: string }
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
  bookingStatus: string
  rating?: number | null
  property: PropertyBooked
  createdAt: string
}

export interface BookingsResponse {
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
}

export interface FullBookingDetail {
  id: number
  checkInDate: string
  checkOutDate: string
  numberOfPets: number
  totalPrice: number
  bookingStatus: string
  rating?: number | null
  comment?: string | null
  successedAt?: string | null
  confirmedAt?: string | null
  guestId: number
  guest: Guest
  bookingOrders: BookingOrder[]
  petProfiles?: BookingPetProfile[]
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
  bookingStatus: string
  rating?: number | null
  comment?: string | null
  successedAt?: string | null
  confirmedAt: string
  guest: HostGuest
  bookingOrders: BookingOrder[]
  petProfiles?: HostBookingPetProfile[]
  createdAt: string
  updatedAt: string
}
