// lib/api.ts
import request from './apiClient'
export { signOut } from './authApi'
import {
  compressFormDataImages,
  compressImagesToWebP,
  compressImageToWebP,
} from './imageCompression'
import {
  BookingRequestBody,
  CreatePropertyResponse,
  FacilitiesResponse,
  ForgotPasswordCredentials,
  HostPropertiesResponse,
  PetProfile,
  PetProfilesResponse,
  PetSizeCategoriesResponse,
  PetsResponse,
  ProfileResponse,
  Property,
  PropertyFormData,
  ResetPasswordCredentials,
  RoomCategoryFormData,
  RoomCategoriesResponse,
  RoomCategories,
  SignInCredentials,
  SignInResponse,
  SignUpCredentials,
  VerifyOtpCredentials,
  Booking,
  BookingsResponse,
  BookingsPaginatedResponse,
  FullBookingDetail, // Added FullBookingDetail
  HostBookingDetail,
  NotificationsResponse,
  FavoriteFoldersResponse, // Added FavoriteFoldersResponse
  PetBreedsResponse,
} from '@/types'
import { FavoriteFolderDetail } from '@/types/favorite'
import type { PropertiesResponse } from '@/types/property'
import type { HostProfileResponse, HostReviewsResponse } from '@/types/hostProfile'
import type { AdminReportsResponse, AdminReportDetail, ReportAction } from '@/types/adminReport'
import type { ReportCategoriesResponse } from '@/types/report'
import type { VerificationData, VerificationResponse } from '@/types/verification'
import type {
  ChatUser,
  ChatMessage,
  ChatRoom,
  ChatRoomsResponse,
  ChatRoomDetail,
} from '@/types/chat'
import type {
  AdminVerificationSummary,
  AdminVerificationDetail,
  AdminVerificationsResponse,
} from '@/types/adminVerification'
import type { AdminActionLogsResponse } from '@/types/adminActionLog'

// --- Auth Functions ---
export const signIn = async (
  credentials: SignInCredentials
): Promise<SignInResponse> => {
  const res = await request<SignInResponse>({
    endpoint: 'api/v1/auth/sign-in',
    method: 'POST',
    body: credentials,
    errorContext: 'Sign-in',
  })
  return {
    ...res,
    accessToken: res.data?.accessToken || res.accessToken,
    refreshToken: res.data?.refreshToken || res.refreshToken,
    expiresIn: res.data?.expiresIn || res.expiresIn,
    tokenType: res.data?.tokenType || res.tokenType,
    user: res.data?.user || res.user,
  }
}

export const signUp = (credentials: SignUpCredentials) => {
  const payload = {
    ...credentials,
    firstName: credentials.firstName || credentials.firstname,
    lastName: credentials.lastName || credentials.lastname,
    firstname: credentials.firstname || credentials.firstName,
    lastname: credentials.lastname || credentials.lastName,
  }
  return request({
    endpoint: 'api/v1/auth/sign-up',
    method: 'POST',
    body: payload,
    errorContext: 'Sign-up',
  })
}

export const verifyOtp = async (
  credentials: VerifyOtpCredentials
): Promise<SignInResponse> => {
  const res = await request<SignInResponse>({
    endpoint: 'api/v1/auth/verify-otp',
    method: 'POST',
    body: credentials,
    errorContext: 'OTP Verification',
  })
  return {
    ...res,
    accessToken: res.data?.accessToken || res.accessToken,
    refreshToken: res.data?.refreshToken || res.refreshToken,
    expiresIn: res.data?.expiresIn || res.expiresIn,
    tokenType: res.data?.tokenType || res.tokenType,
    user: res.data?.user || res.user,
  }
}

export const resendOtp = (credentials: { email: string }) => {
  return request({
    endpoint: 'api/v1/auth/resend-otp',
    method: 'POST',
    body: credentials,
    errorContext: 'Resend OTP',
  })
}

export const forgotPassword = (credentials: ForgotPasswordCredentials) => {
  return request({
    endpoint: 'api/v1/auth/forgot-password',
    method: 'POST',
    body: credentials,
    errorContext: 'Forgot Password',
  })
}

export const resetPassword = (credentials: ResetPasswordCredentials) => {
  return request({
    endpoint: 'api/v1/auth/reset-password',
    method: 'POST',
    body: credentials,
    errorContext: 'Reset Password',
  })
}

// --- User Functions ---
export const getProfile = async (): Promise<ProfileResponse> => {
  const res = await request<any>({
    endpoint: 'api/v1/auth/profile',
    method: 'GET',
    requiresAuth: true,
    silentAuth: true,
    errorContext: 'Get Profile',
    cache: 'no-store',
  })
  return {
    code: res?.code ?? 'S-0000',
    message: res?.message ?? 'Success',
    data: res?.data || res,
  }
}

export const updateUserProfile = async (userId: string, formData: FormData) => {
  const compressedFormData = await compressFormDataImages(formData)
  return request({
    endpoint: `api/v1/users/${userId}`,
    method: 'PUT',
    body: compressedFormData,
    requiresAuth: true,
    errorContext: 'Update Profile',
  })
}

export const getAllPetProfiles = (): Promise<PetProfilesResponse> => {
  return request<PetProfilesResponse>({
    endpoint: 'api/v1/profiles/pet-profiles/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get All Pet Profiles',
  })
}

export const getPetProfileById = (id: string): Promise<PetProfile> => {
  return request<PetProfile>({
    endpoint: `api/v1/profiles/pet-profiles/${id}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Pet Profile By Id',
  })
}

export const createPetProfile = async (formData: FormData) => {
  const compressedFormData = await compressFormDataImages(formData)
  return request({
    endpoint: 'api/v1/profiles/pet-profiles',
    method: 'POST',
    body: compressedFormData,
    requiresAuth: true,
    errorContext: 'Create Pet Profile',
  })
}

export const updatePetProfile = async (id: string, formData: FormData) => {
  const compressedFormData = await compressFormDataImages(formData)
  return request({
    endpoint: `api/v1/profiles/pet-profiles/${id}`,
    method: 'PUT',
    body: compressedFormData,
    requiresAuth: true,
    errorContext: 'Update Pet Profile',
  })
}

export const deletePetProfile = (id: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/profiles/pet-profiles/${id}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Pet Profile',
  })
}

// --- Property Functions ---
export const getProperties = async (
  page: number,
  limit: number,
  options?: {
    minRating?: number
    sortBy?: string
    days?: number
    search?: string
    petTypes?: string
    maxPrice?: string | number
  }
): Promise<PropertiesResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (options?.minRating != null) params.append('minRating', String(options.minRating))
  if (options?.sortBy) params.append('sortBy', options.sortBy)
  if (options?.days != null) params.append('days', String(options.days))
  if (options?.search) params.append('search', options.search)
  if (options?.petTypes) params.append('petTypes', options.petTypes)
  if (options?.maxPrice != null && options.maxPrice !== '') params.append('maxPrice', String(options.maxPrice))

  const res = await request<any>({
    endpoint: `api/v1/properties?${params.toString()}`,
    method: 'GET',
    errorContext: 'Get Properties',
    sendAuthIfAvailable: true,
  })

  const propertiesList: Property[] = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.data?.properties)
    ? res.data.properties
    : Array.isArray(res?.properties)
    ? res.properties
    : []

  const pagination = res?.pagination || {
    page: res?.page || page,
    limit: res?.limit || limit,
    totalRows: res?.totalRows ?? propertiesList.length,
    totalPages: res?.totalPages ?? (propertiesList.length > 0 ? 1 : 0),
  }

  return {
    ...res,
    data: propertiesList,
    pagination,
    totalRows: pagination.totalRows,
    totalPages: pagination.totalPages,
    limit: pagination.limit,
    page: pagination.page,
  }
}

export interface FeaturedSectionsData {
  topRated: Property[]
  topRatedTotal: number
  bestValue: Property[]
  bestValueTotal: number
  newListings: Property[]
  newListingsTotal: number
  trending: Property[]
  trendingTotal: number
  dogFriendly: Property[]
  dogFriendlyTotal: number
  catFriendly: Property[]
  catFriendlyTotal: number
  allProperties: Property[]
  allPropertiesTotal: number
  allPropertiesTotalPages: number
}

export const getFeaturedSections = async (): Promise<FeaturedSectionsData> => {
  const res = (await request<FeaturedSectionsData>({
    endpoint: 'api/v1/properties/featured-sections',
    method: 'GET',
    errorContext: 'Get Featured Sections',
    sendAuthIfAvailable: true,
  })) as unknown as { data: FeaturedSectionsData }
  return res.data
}

export const getPropertyById = async (
  propertyId: string
): Promise<{ property: Property; data?: { property: Property } }> => {
  const res = await request<any>({
    endpoint: `api/v1/properties/${propertyId}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Property By Id',
  })
  const property: Property =
    res?.data?.property || res?.data || res?.property
  return {
    ...res,
    property,
    data: res?.data ?? { property },
  }
}

export const getHostProfile = async (hostId: string): Promise<HostProfileResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/properties/hosts/${hostId}/profile`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Host Profile',
  })
  const host: import('@/types').HostProfile =
    res?.data?.host || res?.data || res?.host
  return {
    ...res,
    host,
    data: res?.data ?? { host },
  }
}

// --- Verification ---
export const getVerificationStatus = (): Promise<VerificationResponse> =>
  request<VerificationResponse>({
    endpoint: 'api/v1/user-verifications/me',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Verification Status',
  })

export const submitVerification = async (
  idPhoto: File,
  selfieWithId: File
): Promise<void> => {
  const [compressedIdPhoto, compressedSelfie] = await Promise.all([
    compressImageToWebP(idPhoto),
    compressImageToWebP(selfieWithId),
  ])
  const formData = new FormData()
  formData.append('idPhoto', compressedIdPhoto)
  formData.append('selfieWithId', compressedSelfie)
  return request<void>({
    endpoint: 'api/v1/user-verifications',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Verification',
  })
}

export const getHostReviews = async (
  hostId: string,
  page = 1,
  limit = 10
): Promise<HostReviewsResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/properties/hosts/${hostId}/reviews?page=${page}&limit=${limit}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Host Reviews',
  })
  const reviewsList: import('@/types').HostReview[] = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.data?.reviews)
    ? res.data.reviews
    : Array.isArray(res?.reviews)
    ? res.reviews
    : []

  const pagination = res?.pagination || {
    page,
    limit,
    totalRows: res?.totalRows ?? reviewsList.length,
    totalPages: res?.totalPages ?? (reviewsList.length > 0 ? 1 : 0),
  }

  return {
    ...res,
    data: reviewsList,
    reviews: reviewsList,
    pagination,
    totalRows: pagination.totalRows,
    totalPages: pagination.totalPages,
  }
}

export const getRecommendedProperties = async (page = 1, limit = 20): Promise<PropertiesResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/properties/recommend?page=${page}&limit=${limit}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Recommended Properties',
  })
  const propertiesList: Property[] = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.data?.properties)
    ? res.data.properties
    : Array.isArray(res?.properties)
    ? res.properties
    : []

  const pagination = res?.pagination || {
    page,
    limit,
    totalRows: res?.totalRows ?? propertiesList.length,
    totalPages: res?.totalPages ?? (propertiesList.length > 0 ? 1 : 0),
  }

  return {
    ...res,
    data: propertiesList,
    pagination,
    totalRows: pagination.totalRows,
    totalPages: pagination.totalPages,
    limit: pagination.limit,
    page: pagination.page,
  }
}

export const getPropertyRecommendations = async (
  propertyId: string | number,
  limit = 12
): Promise<HostPropertiesResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/properties/recommend/property/${propertyId}?limit=${limit}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Property Recommendations',
  })
  const properties: Property[] = Array.isArray(res?.data?.properties)
    ? res.data.properties
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.properties)
    ? res.properties
    : []
  return {
    ...res,
    properties,
    data: res?.data ?? { properties },
  }
}

export const trackPropertyView = (propertyId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/user-behaviors/view-property/${propertyId}`,
    method: 'POST',
    requiresAuth: true,
    errorContext: 'Track Property View',
  })
}

export const getHostProperties = async (): Promise<HostPropertiesResponse> => {
  const res = await request<any>({
    endpoint: 'api/v1/hosts/properties/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Properties',
  })
  const properties: Property[] = Array.isArray(res?.data?.properties)
    ? res.data.properties
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.properties)
    ? res.properties
    : []
  return {
    ...res,
    properties,
    data: res?.data ?? { properties },
  }
}

export const getHostPropertyById = async (
  propertyId: string
): Promise<{ property: Property; data?: { property: Property } }> => {
  const res = await request<any>({
    endpoint: `api/v1/hosts/properties/${propertyId}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Property By Id',
  })
  const property: Property =
    res?.data?.property || res?.data || res?.property
  return {
    ...res,
    property,
    data: res?.data ?? { property },
  }
}

export const updateHostPropertyIsActive = async (
  propertyId: string,
  isActive: boolean
): Promise<void> => {
  await request({
    endpoint: `api/v1/hosts/properties/${propertyId}/is-active`,
    method: 'PATCH',
    body: { isActive },
    requiresAuth: true,
    errorContext: 'Update Property Active Status',
  })
}

export const getFacilities = async (): Promise<FacilitiesResponse> => {
  const res = await request<any>({
    endpoint: 'api/v1/hosts/facilities/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Facilities',
  })
  const facilities = res?.data?.facilities ?? res?.facilities ?? []
  return {
    ...res,
    facilities,
    data: res?.data ?? { facilities },
  }
}
export const getAllFacilities = getFacilities

export const getPetTypes = async (): Promise<PetsResponse> => {
  const res = await request<any>({
    endpoint: 'api/v1/pets/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Pet Types',
  })
  const pets = res?.data?.pets ?? res?.pets ?? []
  return {
    ...res,
    pets,
    data: res?.data ?? { pets },
  }
}
export const getAllPets = getPetTypes

export const getPetBreeds = async (petTypeId: number): Promise<PetBreedsResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/pets/${petTypeId}/pet-breeds/all`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Pet Breeds',
  })
  const petBreeds = res?.data?.petBreeds ?? res?.petBreeds ?? []
  return {
    ...res,
    petBreeds,
    data: res?.data ?? { petBreeds },
  }
}
export const getPetBreedsByTypeId = getPetBreeds

export const getPetSizeCategories = async (): Promise<PetSizeCategoriesResponse> => {
  const res = await request<any>({
    endpoint: 'api/v1/pet-size-categories/all',
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Pet Size Categories',
  })
  const petSizeCategories =
    res?.data?.petSizeCategories ?? res?.petSizeCategories ?? []
  return {
    ...res,
    petSizeCategories,
    data: res?.data ?? { petSizeCategories },
  }
}
export const getAllPetSizeCategories = getPetSizeCategories

// --- Chat Functions ---
export const createChatRoom = async (
  participantId: number,
  content?: string,
  images?: File[]
): Promise<ChatRoom> => {
  const formData = new FormData()
  formData.append('participantId', String(participantId))
  if (content) formData.append('content', content)
  if (images && images.length > 0) {
    const compressedImages = await compressImagesToWebP(images)
    compressedImages.forEach((img) => formData.append('images', img))
  }
  return request<ChatRoom>({
    endpoint: 'api/v1/chat-rooms',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Chat Room',
  })
}

export const getChatRooms = (): Promise<ChatRoomsResponse> => {
  return request<ChatRoomsResponse>({
    endpoint: 'api/v1/chat-rooms',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Chat Rooms',
  })
}

export const getChatRoomById = (id: number): Promise<ChatRoomDetail> => {
  return request<ChatRoomDetail>({
    endpoint: `api/v1/chat-rooms/${id}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Chat Room',
  })
}

export const sendChatMessage = async (
  roomId: number,
  content: string,
  images?: File[]
): Promise<ChatMessage> => {
  if (images && images.length > 0) {
    const compressedImages = await compressImagesToWebP(images)
    const formData = new FormData()
    if (content) formData.append('content', content)
    compressedImages.forEach((img) => formData.append('images', img))
    return request<ChatMessage>({
      endpoint: `api/v1/chat-rooms/${roomId}/messages`,
      method: 'POST',
      body: formData,
      requiresAuth: true,
      errorContext: 'Send Message',
    })
  }
  return request<ChatMessage>({
    endpoint: `api/v1/chat-rooms/${roomId}/messages`,
    method: 'POST',
    body: { content },
    requiresAuth: true,
    errorContext: 'Send Message',
  })
}

export const markChatMessagesAsRead = (roomId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/chat-rooms/${roomId}/messages/read`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Mark Messages Read',
  })
}

export const deleteChatRoom = (roomId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/chat-rooms/${roomId}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Chat Room',
  })
}

export const deleteRoomCategory = (
  propertyId: number,
  roomCategoryId: number
): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories/${roomCategoryId}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Room Category',
  })
}

export const createProperty = async (data: PropertyFormData): Promise<CreatePropertyResponse> => {
  const formData = new FormData()

  for (const [key, value] of Object.entries(data)) {
    if (key === 'images') {
      const compressedImages = await compressImagesToWebP((value as File[]) || [])
      compressedImages.forEach((file: File) => {
        formData.append('images', file)
      })
    } else if (key === 'facilities') {
      formData.append('facilities', JSON.stringify(value))
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value))
    }
  }

  const res = await request<any>({
    endpoint: 'api/v1/hosts/properties',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Property',
  })

  const propertyId = res?.data?.id ?? res?.id ?? 0

  return {
    ...res,
    id: propertyId,
    data: {
      ...res?.data,
      id: propertyId,
    },
  }
}

export const updateProperty = async (propertyId: string, data: FormData) => {
  const compressedFormData = await compressFormDataImages(data)
  return request({
    endpoint: `api/v1/hosts/properties/${propertyId}`,
    method: 'PUT',
    body: compressedFormData,
    requiresAuth: true,
    errorContext: 'Update Property',
  })
}

export const deleteProperty = (propertyId: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/hosts/properties/${propertyId}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Property',
  })
}

export const createRoomCategory = async (
  propertyId: number,
  data: RoomCategoryFormData
) => {
  const formData = new FormData()

  for (const [key, value] of Object.entries(data)) {
    if (key === 'pets' || key === 'facilities') {
      formData.append(key, JSON.stringify(value))
    } else if (key === 'images') {
      const compressedImages = await compressImagesToWebP((value as File[]) || [])
      compressedImages.forEach((file) => formData.append('images', file))
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value))
      if (key === 'petSizeCategoryId') {
        formData.append('petSizeCategories', String(value))
      }
    }
  }

  const res = await request<any>({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories`,
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Room Category',
  })

  const roomCategory = res?.data?.roomCategory || res?.data || res?.roomCategory
  return {
    ...res,
    roomCategory,
    data: res?.data ?? { roomCategory },
  }
}

export const updateRoomCategory = async (
  propertyId: number,
  roomId: number,
  data: import('@/types').EditRoomCategoryFormData
) => {
  const formData = new FormData()
  formData.append('name', data.name)
  formData.append('totalRoom', String(data.totalRoom))
  formData.append('numberOfPets', String(data.numberOfPets))
  formData.append('basePrice', String(data.basePrice))
  formData.append('pets', JSON.stringify(data.pets))
  formData.append('facilities', JSON.stringify(data.facilities))
  formData.append('petSizeCategoryId', String(data.petSizeCategoryId))
  formData.append('petSizeCategories', String(data.petSizeCategoryId))
  const compressedNewImages = await compressImagesToWebP(data.newImages || [])
  compressedNewImages.forEach((file) => formData.append('images', file))
  formData.append('deleteImageIds', JSON.stringify(data.deleteImageIds))

  return request({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories/${roomId}`,
    method: 'PUT',
    body: formData,
    requiresAuth: true,
    errorContext: 'Update Room Category',
  })
}

export const getRoomCategories = async (
  propertyId: number
): Promise<RoomCategoriesResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories/all`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Room Categories',
  })
  const roomCategories: RoomCategories[] = Array.isArray(res?.data?.roomCategories)
    ? res.data.roomCategories
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.roomCategories)
    ? res.roomCategories
    : []
  return {
    ...res,
    roomCategories,
    data: res?.data ?? { roomCategories },
  }
}
export const getHostRoomCategories = getRoomCategories

export const searchRoomCategories = async (
  propertyId: number,
  checkInDate: string,
  checkOutDate: string,
  numberOfPets: number,
  petSizeId?: number
): Promise<RoomCategoriesResponse> => {
  const params = new URLSearchParams({
    checkInDate,
    checkOutDate,
    numberOfPets: String(numberOfPets),
  })
  if (petSizeId !== undefined) {
    params.append('petSizeId', String(petSizeId))
  }
  const res = await request<any>({
    endpoint: `api/v1/properties/${propertyId}/room-categories/search?${params.toString()}`,
    method: 'GET',
    errorContext: 'Search Room Categories',
  })
  const roomCategories: RoomCategories[] = Array.isArray(res?.data?.roomCategories)
    ? res.data.roomCategories
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.roomCategories)
    ? res.roomCategories
    : []
  return {
    ...res,
    roomCategories,
    data: res?.data ?? { roomCategories },
  }
}

// --- Booking Functions ---
export const createBooking = (data: BookingRequestBody): Promise<Booking> => {
  const payload = { ...data } as any
  if (payload.petProfileIds && !payload.PetProfileIDs) {
    payload.PetProfileIDs = payload.petProfileIds
  } else if (payload.PetProfileIDs && !payload.petProfileIds) {
    payload.petProfileIds = payload.PetProfileIDs
  }
  return request<Booking>({
    endpoint: 'api/v1/bookings',
    method: 'POST',
    body: payload,
    requiresAuth: true,
    errorContext: 'Create Booking',
  })
}

export const getBookings = (
  page = 1,
  limit = 10
): Promise<BookingsPaginatedResponse> => {
  return request<BookingsPaginatedResponse>({
    endpoint: `api/v1/bookings/paginate?page=${page}&limit=${limit}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Bookings',
    cache: 'no-store',
  })
}

export const getBookingById = (
  bookingId: string
): Promise<FullBookingDetail> => {
  return request<FullBookingDetail>({
    endpoint: `api/v1/bookings/${bookingId}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Booking By Id',
  })
}

export const confirmPayment = async (
  bookingId: number,
  slipImage?: File
): Promise<void> => {
  if (slipImage) {
    const compressedSlip = await compressImageToWebP(slipImage)
    const formData = new FormData()
    formData.append('slip', compressedSlip)
    return request<void>({
      endpoint: `api/v1/bookings/${bookingId}/confirm-payment`,
      method: 'PATCH',
      body: formData,
      requiresAuth: true,
      errorContext: 'Confirm Payment',
    })
  }
  return request<void>({
    endpoint: `api/v1/bookings/${bookingId}/confirm-payment`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Confirm Payment',
  })
}

export const confirmBookingPayment = confirmPayment

export const cancelBooking = (bookingId: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/bookings/${bookingId}/cancel`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Cancel Booking',
  })
}

export const getHostBookings = (): Promise<BookingsResponse> => {
  return request<BookingsResponse>({
    endpoint: `api/v1/hosts/bookings/all`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Bookings',
    cache: 'no-store',
  })
}

export const getHostBookingsPaginated = (page = 1, limit = 20): Promise<BookingsPaginatedResponse> => {
  return request<BookingsPaginatedResponse>({
    endpoint: `api/v1/hosts/bookings/paginate?page=${page}&limit=${limit}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Bookings',
    cache: 'no-store',
  })
}

export const completeBooking = (bookingId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/hosts/bookings/${bookingId}/success`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Complete Booking',
  })
}

export const getHostBookingById = (
  bookingId: string
): Promise<HostBookingDetail> => {
  return request<HostBookingDetail>({
    endpoint: `api/v1/hosts/bookings/${bookingId}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Booking By Id',
  })
}

export const getHostPropertyBookings = (
  propertyId: string,
  page = 1,
  limit = 10
): Promise<BookingsPaginatedResponse> => {
  return request<BookingsPaginatedResponse>({
    endpoint: `api/v1/hosts/properties/${propertyId}/bookings/paginate?page=${page}&limit=${limit}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Property Bookings',
    cache: 'no-store',
  })
}

// --- Favorite Functions ---
export const getFavoriteFolders = (): Promise<FavoriteFoldersResponse> => {
  return request<FavoriteFoldersResponse>({
    endpoint: 'api/v1/favorite-folders/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Favorite Folders',
  })
}

export const getFavoriteFolderById = async (
  folderId: string
): Promise<FavoriteFolderDetail> => {
  // Define local types for the raw API response to avoid conflicts
  interface ApiFavoriteProperty {
    id: number
    title: string
    province: string
    firstImage: string
  }

  interface ApiFavoriteFolderDetail {
    id: number
    name: string
    propertyCount: number
    createdAt: string
    properties: ApiFavoriteProperty[]
  }

  const response = await request<ApiFavoriteFolderDetail>({
    endpoint: `api/v1/favorite-folders/${folderId}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Favorite Folder By Id',
  })

  // Transform the simplified properties into full Property objects
  const transformedProperties: Property[] = response.properties.map(
    (favProperty) => ({
      id: favProperty.id,
      title: favProperty.title,
      province: favProperty.province,
      images: favProperty.firstImage
        ? [
            {
              id: 0,
              filePath: favProperty.firstImage,
              fileName: '',
              fileContentType: '',
              fileExtensionName: '',
              fileSize: 0,
            },
          ]
        : [],
      // Add default values for other required fields
      description: '',
      district: '',
      country: '',
      latitude: '0',
      longitude: '0',
      zipcode: '',
      isActive: true,
      isFavorite: true, // Favorites are always favorited
      avgRating: 0,
      hostId: 0,
      propertyTypeId: 0,
      createdAt: '',
      updatedAt: '',
    })
  )

  const firstPropertyImage =
    transformedProperties.length > 0 &&
    transformedProperties[0].images.length > 0
      ? transformedProperties[0].images[0].filePath
      : ''

  return {
    ...response,
    firstPropertyImage,
    properties: transformedProperties,
  }
}

export const addFavorite = (data: {
  propertyId: number
  folderId?: number
  folderName?: string
}): Promise<void> => {
  return request<void>({
    endpoint: 'api/v1/favorite-folders',
    method: 'POST',
    body: data,
    requiresAuth: true,
    errorContext: 'Add Favorite',
  })
}

export const createFavoriteFolder = (name: string): Promise<void> => {
  return request<void>({
    endpoint: 'api/v1/favorite-folders',
    method: 'POST',
    body: { folderName: name },
    requiresAuth: true,
    errorContext: 'Create Favorite Folder',
  })
}

export const deleteFavoriteFolder = (folderId: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/favorite-folders/${folderId}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Favorite Folder',
  })
}

export const renameFavoriteFolder = (
  folderId: string,
  name: string
): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/favorite-folders/${folderId}`,
    method: 'PUT',
    body: { name },
    requiresAuth: true,
    errorContext: 'Rename Favorite Folder',
  })
}

export const deleteFavoriteProperty = (propertyId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/favorite-properties/${propertyId}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Favorite Property',
  })
}

// --- Review Functions ---
export const submitReview = async (
  bookingId: string,
  data: { rating: number; comment: string; images?: File[] }
): Promise<void> => {
  const formData = new FormData()
  formData.append('rating', String(data.rating))
  formData.append('comment', data.comment)
  if (data.images && data.images.length > 0) {
    const compressedImages = await compressImagesToWebP(data.images)
    compressedImages.forEach((img) => formData.append('images', img))
  }
  return request<void>({
    endpoint: `api/v1/bookings/${bookingId}/review`,
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Review',
  })
}

export const submitBookingReview = submitReview

// --- Notification Functions ---
export const getNotifications = (): Promise<NotificationsResponse> => {
  return request<NotificationsResponse>({
    endpoint: 'api/v1/notifications',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Notifications',
  })
}

export const deleteAllNotifications = (): Promise<void> => {
  return request<void>({
    endpoint: 'api/v1/notifications',
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete All Notifications',
  })
}

export const deleteNotificationById = (id: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/notifications/${id}`,
    method: 'DELETE',
    requiresAuth: true,
    errorContext: 'Delete Notification',
  })
}

export const moveFavorite = async (data: {
  propertyId: number
  folderId?: number
  folderName?: string
}): Promise<void> => {
  await deleteFavoriteProperty(data.propertyId)
  await addFavorite(data)
}

// --- Report Functions ---
export const getReportCategories = async (type: string): Promise<ReportCategoriesResponse> => {
  const res = await request<any>({
    endpoint: `api/v1/report-categories?type=${type}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Report Categories',
  })
  const reportCategories: import('@/types').ReportCategory[] =
    res?.data?.reportCategories ?? res?.reportCategories ?? []
  return {
    ...res,
    reportCategories,
    data: res?.data ?? { reportCategories },
  }
}

export const submitPropertyReport = async (
  propertyId: number,
  reportCategoryId: number,
  description: string,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('propertyId', String(propertyId))
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (images && images.length > 0) {
    const compressedImages = await compressImagesToWebP(images)
    compressedImages.forEach((img) => formData.append('images', img))
  }
  return request<void>({
    endpoint: 'api/v1/reports/property',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Property Report',
  })
}

export const reportProperty = submitPropertyReport

export const submitReviewReport = async (
  bookingId: number,
  reportCategoryId: number,
  description: string,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('bookingId', String(bookingId))
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (images && images.length > 0) {
    const compressedImages = await compressImagesToWebP(images)
    compressedImages.forEach((img) => formData.append('images', img))
  }
  return request<void>({
    endpoint: 'api/v1/reports/review',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Review Report',
  })
}

export const reportReview = submitReviewReport

export const submitUnbanPropertyRequest = async (
  reportCategoryId: number,
  description: string,
  propertyId?: number,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (propertyId) formData.append('propertyId', String(propertyId))
  if (images && images.length > 0) {
    const compressedImages = await compressImagesToWebP(images)
    compressedImages.forEach((img) => formData.append('images', img))
  }
  return request<void>({
    endpoint: 'api/v1/reports/unban-property',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Unban Property Request',
  })
}

export const requestUnbanProperty = submitUnbanPropertyRequest

// --- Admin: Dashboard ---
export interface AdminDashboardData {
  pendingReports: { total: number; thisMonth: number }
  totalUsers: { total: number; thisMonth: number }
  activeProperties: { total: number; thisMonth: number }
  pendingVerifications: { total: number; thisMonth: number }
  bannedHosts: { total: number; thisMonth: number }
}

export const getAdminDashboard = (): Promise<AdminDashboardData> =>
  request({ endpoint: 'api/v1/admin/dashboard', method: 'GET', requiresAuth: true, errorContext: 'Admin Dashboard' })

// --- Reporter: Report Functions ---
export const getMyReports = (params?: {
  page?: number
  limit?: number
}): Promise<import('@/types/report').ReporterReportsResponse> => {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  return request({
    endpoint: `api/v1/reports/me/paginate?${query}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get My Reports',
  })
}

export const getMyReportById = (id: number): Promise<import('@/types/report').ReporterReportDetail> => {
  return request({
    endpoint: `api/v1/reports/me/${id}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Report Detail',
  })
}

// --- Admin: Report Functions ---
export const getAdminReports = (params?: {
  type?: string
  status?: string
  page?: number
  limit?: number
}): Promise<AdminReportsResponse> => {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  return request<AdminReportsResponse>({
    endpoint: `api/v1/admin/reports/paginate?${query}`,
    requiresAuth: true,
    errorContext: 'Admin Reports',
  })
}

export const getAdminReportById = (id: number): Promise<AdminReportDetail> => {
  return request<AdminReportDetail>({
    endpoint: `api/v1/admin/reports/${id}`,
    requiresAuth: true,
    errorContext: 'Admin Report Detail',
  })
}

export const takeReportAction = (
  id: number,
  action: ReportAction,
  adminNote?: string
): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/admin/reports/${id}/action`,
    method: 'PATCH',
    body: { action, ...(adminNote ? { adminNote } : {}) },
    requiresAuth: true,
    errorContext: 'Take Report Action',
  })
}

// --- Admin: Verification Functions ---
export const getAdminVerifications = (params?: {
  status?: string
  page?: number
  limit?: number
  orderBy?: string
  sort?: 'asc' | 'desc'
}): Promise<AdminVerificationsResponse> => {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.orderBy) query.set('orderBy', params.orderBy)
  if (params?.sort) query.set('sort', params.sort)
  return request<AdminVerificationsResponse>({
    endpoint: `api/v1/admin/user-verifications/paginate?${query}`,
    requiresAuth: true,
    errorContext: 'Admin Verifications',
  })
}

export const getAdminActionLogs = (params?: {
  page?: number
  limit?: number
  action?: string
}): Promise<AdminActionLogsResponse> => {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.action) query.set('action', params.action)
  return request<AdminActionLogsResponse>({
    endpoint: `api/v1/admin/action-logs/paginate?${query}`,
    requiresAuth: true,
    errorContext: 'Admin Action Logs',
  })
}

export const getAdminVerificationById = (
  id: number
): Promise<{ code: string; message: string; verification: AdminVerificationDetail }> => {
  return request({
    endpoint: `api/v1/admin/user-verifications/${id}`,
    requiresAuth: true,
    errorContext: 'Admin Verification Detail',
  })
}

export const approveVerification = (id: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/admin/user-verifications/${id}/approve`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Approve Verification',
  })
}

export const rejectVerification = (id: number, rejectDescription: string): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/admin/user-verifications/${id}/reject`,
    method: 'PATCH',
    body: { rejectDescription },
    requiresAuth: true,
    errorContext: 'Reject Verification',
  })
}
