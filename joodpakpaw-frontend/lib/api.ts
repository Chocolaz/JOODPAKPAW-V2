// lib/api.ts
import request from './apiClient'
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
export const signIn = (
  credentials: SignInCredentials
): Promise<SignInResponse> => {
  return request<SignInResponse>({
    endpoint: 'api/v1/auth/sign-in',
    method: 'POST',
    body: credentials,
    errorContext: 'Sign-in',
  })
}

export const signUp = (credentials: SignUpCredentials) => {
  return request({
    endpoint: 'api/v1/auth/sign-up',
    method: 'POST',
    body: credentials,
    errorContext: 'Sign-up',
  })
}

export const verifyOtp = (
  credentials: VerifyOtpCredentials
): Promise<SignInResponse> => {
  return request<SignInResponse>({
    endpoint: 'api/v1/auth/verify-otp',
    method: 'POST',
    body: credentials,
    errorContext: 'OTP Verification',
  })
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
export const getProfile = (): Promise<ProfileResponse> => {
  return request<ProfileResponse>({
    endpoint: 'api/v1/auth/profile',
    method: 'GET',
    requiresAuth: true,
    silentAuth: true,
    errorContext: 'Get Profile',
    cache: 'no-store',
  })
}

export const updateUserProfile = (userId: string, formData: FormData) => {
  return request({
    endpoint: `api/v1/users/${userId}`,
    method: 'PUT',
    body: formData,
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

export const createPetProfile = (formData: FormData) => {
  return request({
    endpoint: 'api/v1/profiles/pet-profiles',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Pet Profile',
  })
}

export const updatePetProfile = (id: string, formData: FormData) => {
  return request({
    endpoint: `api/v1/profiles/pet-profiles/${id}`,
    method: 'PUT',
    body: formData,
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
export const getProperties = (
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

  return request<PropertiesResponse>({
    endpoint: `api/v1/properties?${params.toString()}`,
    method: 'GET',
    errorContext: 'Get Properties',
    sendAuthIfAvailable: true,
  })
}

export const getPropertyById = (
  propertyId: string
): Promise<{ property: Property }> => {
  return request<{ property: Property }>({
    endpoint: `api/v1/properties/${propertyId}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Property By Id',
  })
}

export const getHostProfile = (hostId: string): Promise<HostProfileResponse> => {
  return request<HostProfileResponse>({
    endpoint: `api/v1/properties/hosts/${hostId}/profile`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Host Profile',
  })
}

// --- Verification ---
export const getVerificationStatus = (): Promise<VerificationResponse> =>
  request<VerificationResponse>({
    endpoint: 'api/v1/user-verifications/me',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Verification Status',
  })

export const submitVerification = (idPhoto: File, selfieWithId: File): Promise<void> => {
  const formData = new FormData()
  formData.append('idPhoto', idPhoto)
  formData.append('selfieWithId', selfieWithId)
  return request<void>({
    endpoint: 'api/v1/user-verifications',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Verification',
  })
}

export const getHostReviews = (
  hostId: string,
  page = 1,
  limit = 10
): Promise<HostReviewsResponse> => {
  return request<HostReviewsResponse>({
    endpoint: `api/v1/properties/hosts/${hostId}/reviews?page=${page}&limit=${limit}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Host Reviews',
  })
}

export const getRecommendedProperties = (page = 1, limit = 20): Promise<PropertiesResponse> => {
  return request<PropertiesResponse>({
    endpoint: `api/v1/properties/recommend?page=${page}&limit=${limit}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Recommended Properties',
  })
}

export const getPropertyRecommendations = (propertyId: string | number, limit = 12): Promise<HostPropertiesResponse> => {
  return request<HostPropertiesResponse>({
    endpoint: `api/v1/properties/recommend/property/${propertyId}?limit=${limit}`,
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Property Recommendations',
  })
}

export const trackPropertyView = (propertyId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/user-behaviors/view-property/${propertyId}`,
    method: 'POST',
    requiresAuth: true,
    errorContext: 'Track Property View',
  })
}

export const getHostProperties = (): Promise<HostPropertiesResponse> => {
  return request<HostPropertiesResponse>({
    endpoint: 'api/v1/hosts/properties/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Properties',
  })
}

export const getHostPropertyById = (
  propertyId: string
): Promise<{ property: Property }> => {
  return request<{ property: Property }>({
    endpoint: `api/v1/hosts/properties/${propertyId}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Host Property By Id',
  })
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

export const getFacilities = (): Promise<FacilitiesResponse> => {
  return request<FacilitiesResponse>({
    endpoint: 'api/v1/hosts/facilities/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Facilities',
  })
}

export const getPetTypes = (): Promise<PetsResponse> => {
  return request<PetsResponse>({
    endpoint: 'api/v1/pets/all',
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Pet Types',
  })
}

export const getPetBreeds = (petTypeId: number): Promise<PetBreedsResponse> => {
  return request<PetBreedsResponse>({
    endpoint: `api/v1/pets/${petTypeId}/pet-breeds/all`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Pet Breeds',
  })
}

export const getPetSizeCategories = (): Promise<PetSizeCategoriesResponse> => {
  return request<PetSizeCategoriesResponse>({
    endpoint: 'api/v1/pet-size-categories/all',
    method: 'GET',
    sendAuthIfAvailable: true,
    errorContext: 'Get Pet Size Categories',
  })
}

// --- Chat Functions ---
export const createChatRoom = (
  participantId: number,
  content?: string,
  images?: File[]
): Promise<ChatRoom> => {
  const formData = new FormData()
  formData.append('participantId', String(participantId))
  if (content) formData.append('content', content)
  if (images) images.forEach((img) => formData.append('images', img))
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

export const sendChatMessage = (
  roomId: number,
  content: string,
  images?: File[]
): Promise<ChatMessage> => {
  if (images && images.length > 0) {
    const formData = new FormData()
    if (content) formData.append('content', content)
    images.forEach((img) => formData.append('images', img))
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

export const createProperty = (data: PropertyFormData) => {
  const formData = new FormData()

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'images') {
      ;(value as File[]).forEach((file: File) => {
        formData.append('images', file)
      })
    } else if (key === 'facilities') {
      formData.append('facilities', JSON.stringify(value))
    } else if (value !== null) {
      formData.append(key, String(value))
    }
  })

  return request<CreatePropertyResponse>({
    endpoint: 'api/v1/hosts/properties',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Property',
  })
}

export const updateProperty = (propertyId: string, data: FormData) => {
  return request({
    endpoint: `api/v1/hosts/properties/${propertyId}`,
    method: 'PUT',
    body: data,
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

export const createRoomCategory = (
  propertyId: number,
  data: RoomCategoryFormData
) => {
  const formData = new FormData()

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'pets' || key === 'facilities') {
      formData.append(key, JSON.stringify(value))
    } else if (key === 'images') {
      (value as File[]).forEach((file) => formData.append('images', file))
    } else {
      formData.append(key, String(value))
    }
  })

  return request({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories`,
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Create Room Category',
  })
}

export const updateRoomCategory = (
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
  formData.append('petSizeCategories', String(data.petSizeCategoryId))
  data.newImages.forEach((file) => formData.append('images', file))
  formData.append('deleteImageIds', JSON.stringify(data.deleteImageIds))

  return request({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories/${roomId}`,
    method: 'PUT',
    body: formData,
    requiresAuth: true,
    errorContext: 'Update Room Category',
  })
}

export const getRoomCategories = (
  propertyId: number
): Promise<RoomCategoriesResponse> => {
  return request<RoomCategoriesResponse>({
    endpoint: `api/v1/hosts/properties/${propertyId}/room-categories/all`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Room Categories',
  })
}

export const searchRoomCategories = (
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
  return request<RoomCategoriesResponse>({
    endpoint: `api/v1/properties/${propertyId}/room-categories/search?${params.toString()}`,
    method: 'GET',
    errorContext: 'Search Room Categories',
  })
}

// --- Booking Functions ---
export const createBooking = (data: BookingRequestBody): Promise<Booking> => {
  return request<Booking>({
    endpoint: 'api/v1/bookings',
    method: 'POST',
    body: data,
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

export const confirmPayment = (bookingId: number): Promise<void> => {
  return request<void>({
    endpoint: `api/v1/bookings/${bookingId}/confirm-payment`,
    method: 'PATCH',
    requiresAuth: true,
    errorContext: 'Confirm Payment',
  })
}

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
export const submitReview = (
  bookingId: string,
  data: { rating: number; comment: string; images?: File[] }
): Promise<void> => {
  const formData = new FormData()
  formData.append('rating', String(data.rating))
  formData.append('comment', data.comment)
  if (data.images) data.images.forEach((img) => formData.append('images', img))
  return request<void>({
    endpoint: `api/v1/bookings/${bookingId}/review`,
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Review',
  })
}

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
export const getReportCategories = (type: string): Promise<ReportCategoriesResponse> => {
  return request({
    endpoint: `api/v1/report-categories?type=${type}`,
    method: 'GET',
    requiresAuth: true,
    errorContext: 'Get Report Categories',
  })
}

export const submitPropertyReport = (
  propertyId: number,
  reportCategoryId: number,
  description: string,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('propertyId', String(propertyId))
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (images) images.forEach((img) => formData.append('images', img))
  return request<void>({
    endpoint: 'api/v1/reports/property',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Property Report',
  })
}

export const submitReviewReport = (
  bookingId: number,
  reportCategoryId: number,
  description: string,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('bookingId', String(bookingId))
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (images) images.forEach((img) => formData.append('images', img))
  return request<void>({
    endpoint: 'api/v1/reports/review',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Review Report',
  })
}

export const submitUnbanPropertyRequest = (
  reportCategoryId: number,
  description: string,
  propertyId?: number,
  images?: File[]
): Promise<void> => {
  const formData = new FormData()
  formData.append('reportCategoryId', String(reportCategoryId))
  formData.append('description', description)
  if (propertyId) formData.append('propertyId', String(propertyId))
  if (images) images.forEach((img) => formData.append('images', img))
  return request<void>({
    endpoint: 'api/v1/reports/unban-property',
    method: 'POST',
    body: formData,
    requiresAuth: true,
    errorContext: 'Submit Unban Property Request',
  })
}

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

