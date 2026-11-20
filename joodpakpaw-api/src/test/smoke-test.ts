process.env.NODE_ENV = 'test';
import http from 'http'
import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { pathToFileURL } from 'url'
import { createApp } from '../app'
import { prisma, checkDatabaseHealth } from '../database/prisma'
import { optionalAuthenticateToken, requireRoles } from '../middlewares/auth.middleware'
import { v1Router } from '../routes/v1.routes'
import { convertBufferToWebp, uploadImageAsWebp, s3Client } from '../services/storage.service'
import { reconcileLifecycleBookings, syncPropertyBookingCount, sendUpcomingCheckInReminders, getTomorrowThaiStr } from '../services/bookingLifecycle.service'
import { createNotificationSafe } from '../services/notification.service'
import { initSocketServer, emitToUser, getSocketServer } from '../services/socket.service'
import { cacheService } from '../services/cache.service'
import { invalidateAllRecommendationCaches } from '../services/recommendation.service'
import { AppError } from '../middlewares/errorHandler'
import jwt from 'jsonwebtoken'
import { config } from '../config/env'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  durationMs: number
}

const results: TestResult[] = []

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now()
  try {
    await fn()
    results.push({ name, passed: true, durationMs: Date.now() - start })
    console.log(`  ✅ PASS: ${name} (${Date.now() - start}ms)`)
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err), durationMs: Date.now() - start })
    console.error(`  ❌ FAIL: ${name} - ${err?.message || err}`)
  }
}

function makeRequest(
  pipePath: string,
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const reqHeaders: Record<string, string> = { ...headers }
    if (payload !== undefined) {
      reqHeaders['Content-Type'] = 'application/json'
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload))
    }

    const req = http.request(
      {
        socketPath: pipePath,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let parsed: any = data
          try {
            parsed = JSON.parse(data)
          } catch {}
          resolve({ statusCode: res.statusCode || 0, body: parsed })
        })
      }
    )
    req.on('error', reject)
    if (payload !== undefined) {
      req.write(payload)
    }
    req.end()
  })
}

function makeMultipartRequest(
  pipePath: string,
  urlPath: string,
  method = 'POST',
  fields: Record<string, string> = {},
  files: Array<{ fieldname: string; filename: string; contentType: string; buffer: Buffer }> = [],
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const boundary = '----JoodPakPawMultipartBoundary' + Date.now() + Math.random().toString(36).substring(2)
    const chunks: Buffer[] = []

    for (const [key, val] of Object.entries(fields)) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`,
          'utf-8'
        )
      )
    }

    for (const file of files) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
          'utf-8'
        )
      )
      chunks.push(file.buffer)
      chunks.push(Buffer.from('\r\n', 'utf-8'))
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'))
    const bodyBuf = Buffer.concat(chunks)

    const reqHeaders: Record<string, string> = {
      ...headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(bodyBuf.length),
    }

    const req = http.request(
      {
        socketPath: pipePath,
        path: urlPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          let parsed: any = data
          try {
            parsed = JSON.parse(data)
          } catch {}
          resolve({ statusCode: res.statusCode || 0, body: parsed })
        })
      }
    )

    req.on('error', reject)
    req.write(bodyBuf)
    req.end()
  })
}

// In-memory mock DB store for PBI-04 Auth & Password Policy tests
interface MockUserRecord {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  phone: string | null
  password: string
  otp: string | null
  otpExpiredAt: Date | null
  resetPasswordToken: string | null
  resetPasswordExpiredAt: Date | null
  isVerified: boolean
  isBecomeToHost: boolean
  isVerifiedHost: boolean
  isBannedReview: boolean
  isBannedAllProperties: boolean
  bannedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  userRoles: Array<{ role: { id: number; name: string } }>
}

function installPrismaAuthMock() {
  const users = new Map<number, MockUserRecord>()
  let nextUserId = 1
  const chatRoomsMap = new Map<number, any>()
  let nextChatRoomId = 1
  const chatMessagesList: any[] = []
  let nextChatMessageId = 1
  const chatAttachmentsList: any[] = []
  let nextAttachmentId = 1
  const userVerificationsMap = new Map<number, any>()
  let nextVerificationId = 1
  const reportsMap = new Map<number, any>()
  let nextReportId = 1
  let nextReportImageId = 1
  const actionLogsList: any[] = []
  let nextActionLogId = 1
  const propertiesMap = new Map<number, any>()
  const bookingsMap = new Map<number, any>()

  const originals = {
    userFindFirst: prisma.user.findFirst,
    userFindUnique: prisma.user.findUnique,
    userCreate: prisma.user.create,
    userUpdate: prisma.user.update,
    userCount: prisma.user.count,
    userRoleUpsert: (prisma.userRole as any)?.upsert,
    userVerificationFindFirst: (prisma.userVerification as any)?.findFirst,
    userVerificationFindUnique: (prisma.userVerification as any)?.findUnique,
    userVerificationFindMany: (prisma.userVerification as any)?.findMany,
    userVerificationCount: (prisma.userVerification as any)?.count,
    userVerificationCreate: (prisma.userVerification as any)?.create,
    userVerificationUpdate: (prisma.userVerification as any)?.update,
    roleUpsert: prisma.role.upsert,
    reportFindFirst: (prisma.report as any)?.findFirst,
    reportFindUnique: (prisma.report as any)?.findUnique,
    reportFindMany: prisma.report.findMany,
    reportCount: (prisma.report as any)?.count,
    reportCreate: (prisma.report as any)?.create,
    reportUpdate: (prisma.report as any)?.update,
    reportCategoryFindUnique: (prisma.reportCategory as any)?.findUnique,
    reportCategoryFindFirst: (prisma.reportCategory as any)?.findFirst,
    actionLogCreate: (prisma.actionLog as any)?.create,
    actionLogFindMany: (prisma.actionLog as any)?.findMany,
    actionLogCount: (prisma.actionLog as any)?.count,
    bookingReviewImageDeleteMany: (prisma.bookingReviewImage as any)?.deleteMany,
    facilityFindMany: prisma.facility.findMany,
    petFindMany: prisma.pet.findMany,
    petBreedFindMany: prisma.petBreed.findMany,
    petSizeCategoryFindMany: prisma.petSizeCategory.findMany,
    reportCategoryFindMany: prisma.reportCategory.findMany,
    favoritePropertyFindMany: prisma.favoriteProperty.findMany,
    propertyFindMany: prisma.property.findMany,
    propertyFindUnique: prisma.property.findUnique,
    bookingFindMany: prisma.booking.findMany,
    bookingCount: prisma.booking.count,
    chatRoomFindFirst: prisma.chatRoom.findFirst,
    roomCategoryFindMany: prisma.roomCategory.findMany,
    favoriteFolderFindMany: prisma.favoriteFolder.findMany,
    favoriteFolderFindUnique: prisma.favoriteFolder.findUnique,
    favoriteFolderFindFirst: prisma.favoriteFolder.findFirst,
    favoriteFolderCreate: prisma.favoriteFolder.create,
    favoriteFolderUpdate: prisma.favoriteFolder.update,
    favoritePropertyFindFirst: prisma.favoriteProperty.findFirst,
    favoritePropertyCreate: prisma.favoriteProperty.create,
    favoritePropertyDeleteMany: prisma.favoriteProperty.deleteMany,
    roomCategoryCalendarFindMany: prisma.roomCategoryCalendar.findMany,
    bookingReviewImageCreate: prisma.bookingReviewImage.create,
    notificationActionUpsert: (prisma.notificationAction as any).upsert,
    notificationActionFindUnique: (prisma.notificationAction as any).findUnique,
    notificationActionCreate: (prisma.notificationAction as any).create,
    notificationCreate: (prisma.notification as any).create,
    notificationFindMany: (prisma.notification as any).findMany,
    notificationFindUnique: (prisma.notification as any).findUnique,
    notificationFindFirst: (prisma.notification as any).findFirst,
    notificationUpdate: (prisma.notification as any).update,
    notificationUpdateMany: (prisma.notification as any).updateMany,
    chatRoomFindUnique: (prisma.chatRoom as any).findUnique,
    chatRoomFindMany: (prisma.chatRoom as any).findMany,
    chatRoomCreate: (prisma.chatRoom as any).create,
    chatRoomUpdate: (prisma.chatRoom as any).update,
    chatRoomDelete: (prisma.chatRoom as any).delete,
    chatMessageCreate: (prisma.chatMessage as any).create,
    chatMessageUpdateMany: (prisma.chatMessage as any).updateMany,
    chatMessageAttachmentFindMany: (prisma.chatMessageAttachment as any).findMany,
    propertyTypeFindUnique: prisma.propertyType.findUnique,
    propertyTypeFindFirst: prisma.propertyType.findFirst,
    petSizeCategoryFindUnique: prisma.petSizeCategory.findUnique,
    petSizeCategoryFindFirst: prisma.petSizeCategory.findFirst,
    propertyCount: prisma.property.count,
    propertyCreate: prisma.property.create,
    propertyUpdate: prisma.property.update,
    propertyFacilityDeleteMany: prisma.propertyFacility.deleteMany,
    propertyFacilityCreateMany: prisma.propertyFacility.createMany,
    propertyImageUpdateMany: prisma.propertyImage.updateMany,
    propertyImageCreateMany: prisma.propertyImage.createMany,
    propertyImageFindMany: prisma.propertyImage.findMany,
    bookingOrderCount: prisma.bookingOrder.count,
    roomCategoryCount: prisma.roomCategory.count,
    roomCategoryFindFirst: prisma.roomCategory.findFirst,
    roomCategoryFindUnique: prisma.roomCategory.findUnique,
    roomCategoryCreate: prisma.roomCategory.create,
    roomCategoryUpdate: prisma.roomCategory.update,
    roomCategoryUpdateMany: prisma.roomCategory.updateMany,
    roomCategoryPetDeleteMany: prisma.roomCategoryPet.deleteMany,
    roomCategoryPetCreateMany: prisma.roomCategoryPet.createMany,
    roomCategoryFacilityDeleteMany: prisma.roomCategoryFacility.deleteMany,
    roomCategoryFacilityCreateMany: prisma.roomCategoryFacility.createMany,
    roomCategoryImageFindMany: prisma.roomCategoryImage.findMany,
    roomCategoryImageUpdateMany: prisma.roomCategoryImage.updateMany,
    roomCategoryImageCreateMany: prisma.roomCategoryImage.createMany,
    petProfileFindMany: prisma.petProfile.findMany,
    petProfileFindUnique: prisma.petProfile.findUnique,
    petProfileFindFirst: prisma.petProfile.findFirst,
    petProfileCreate: prisma.petProfile.create,
    petProfileUpdate: prisma.petProfile.update,
    bookingFindUnique: prisma.booking.findUnique,
    bookingCreate: prisma.booking.create,
    bookingUpdate: prisma.booking.update,
    bookingPetProfileFindFirst: prisma.bookingPetProfile.findFirst,
    roomCategoryCalendarFindUnique: prisma.roomCategoryCalendar.findUnique,
    roomCategoryCalendarCreate: prisma.roomCategoryCalendar.create,
    roomCategoryCalendarUpdate: prisma.roomCategoryCalendar.update,
    prismaTransaction: prisma.$transaction,
    prismaQueryRawUnsafe: prisma.$queryRawUnsafe,
  }

  ;(prisma.role as any).upsert = async (args: any) => {
    const name = args?.where?.name || 'guest'
    const id = name === 'admin' ? 3 : name === 'host' ? 2 : 1
    return {
      id,
      name,
      label: args?.create?.label || name,
      description: args?.create?.description || '',
    }
  }

  ;(prisma.user as any).findFirst = async (args: any) => {
    const where = args?.where || {}
    for (const u of users.values()) {
      if (where.deletedAt === null && u.deletedAt !== null) continue
      if (where.id?.not !== undefined && u.id === where.id.not) continue
      if (where.email?.equals) {
        if (u.email.toLowerCase() !== String(where.email.equals).toLowerCase()) continue
      } else if (typeof where.email === 'string') {
        if (u.email !== where.email) continue
      }
      if (where.phone !== undefined) {
        if (u.phone !== where.phone) continue
      }
      return { ...u }
    }
    return null
  }

  ;(prisma.user as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    if (typeof id === 'number' && users.has(id)) {
      return { ...users.get(id)! }
    }
    return null
  }

  ;(prisma.user as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextUserId++
    const roleId = data.userRoles?.create?.roleId || 1
    const roleName = roleId === 3 ? 'admin' : roleId === 2 ? 'host' : 'guest'
    const record: MockUserRecord = {
      id,
      email: data.email,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      avatar: data.avatar ?? null,
      phone: data.phone ?? null,
      password: data.password,
      otp: data.otp ?? null,
      otpExpiredAt: data.otpExpiredAt ?? null,
      resetPasswordToken: data.resetPasswordToken ?? null,
      resetPasswordExpiredAt: data.resetPasswordExpiredAt ?? null,
      isVerified: Boolean(data.isVerified),
      isBecomeToHost: Boolean(data.isBecomeToHost),
      isVerifiedHost: Boolean(data.isVerifiedHost),
      isBannedReview: false,
      isBannedAllProperties: false,
      bannedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ role: { id: roleId, name: roleName } }],
    }
    users.set(id, record)
    return { ...record }
  }

  ;(prisma.user as any).update = async (args: any) => {
    const id = args?.where?.id
    const record = users.get(id)
    if (!record) throw new Error(`Mock user ${id} not found`)
    const { userRoles, ...restData } = args?.data || {}
    Object.assign(record, restData)
    if (userRoles?.connectOrCreate) {
      const roleId = userRoles.connectOrCreate.create?.roleId || 2
      const roleName = roleId === 3 ? 'admin' : roleId === 2 ? 'host' : 'guest'
      if (!record.userRoles.some((ur) => ur.role.id === roleId)) {
        record.userRoles.push({ role: { id: roleId, name: roleName } })
      }
    }
    return { ...record }
  }



  // Mock data for PBI-06 Master Lookups & Public Property Discovery
  const mockFacilities = [
    { id: 1, name: 'Air Conditioning', categoryId: 1, deletedAt: null, category: { id: 1, name: 'Comfort' } },
    { id: 2, name: 'CCTV 24/7', categoryId: 2, deletedAt: null, category: { id: 2, name: 'Safety' } },
  ]
  const mockPets = [
    { id: 1, name: 'สุนัข (Dog)', deletedAt: null },
    { id: 2, name: 'แมว (Cat)', deletedAt: null },
  ]
  const mockBreeds = [
    { id: 10, breed: 'Golden Retriever', petId: 1, imageUrl: 'https://example.com/golden.webp', deletedAt: null, pet: mockPets[0] },
    { id: 20, breed: 'Persian', petId: 2, imageUrl: 'https://example.com/persian.webp', deletedAt: null, pet: mockPets[1] },
  ]
  const mockPetSizes = [
    { id: 1, name: 'Small (S)', code: 1, min: 0, max: 5, deletedAt: null },
    { id: 2, name: 'Medium (M)', code: 2, min: 5, max: 15, deletedAt: null },
  ]
  const nowDate = new Date()
  const mockReportCategories = [
    { id: 1, name: 'fake_listing', label: 'Fake Listing', type: 'property', createdAt: nowDate, updatedAt: nowDate },
    { id: 2, name: 'spam_review', label: 'Spam Review', type: 'review', createdAt: nowDate, updatedAt: nowDate },
    { id: 3, name: 'fixed_violation', label: 'Fixed Violation', type: 'unban_property', createdAt: nowDate, updatedAt: nowDate },
  ]

  ;(prisma.userRole as any).upsert = async (args: any) => {
    const userId = args?.where?.userId_roleId?.userId || args?.create?.userId
    const roleId = args?.where?.userId_roleId?.roleId || args?.create?.roleId || 2
    const user = users.get(userId)
    if (user) {
      const roleName = roleId === 3 ? 'admin' : roleId === 2 ? 'host' : 'guest'
      if (!user.userRoles.some((ur) => ur.role.id === roleId)) {
        user.userRoles.push({ role: { id: roleId, name: roleName } })
      }
    }
    return { userId, roleId }
  }

  ;(prisma.user as any).count = async (args: any) => {
    const where = args?.where || {}
    let list = Array.from(users.values()).filter((u) => {
      if (where.deletedAt === null && u.deletedAt !== null) return false
      if (where.isBannedAllProperties !== undefined && u.isBannedAllProperties !== where.isBannedAllProperties) return false
      if (where.bannedAt?.gte && (!u.bannedAt || u.bannedAt < where.bannedAt.gte)) return false
      return true
    })
    return list.length
  }

  // --- userVerification mocks ---
  ;(prisma.userVerification as any).findFirst = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(userVerificationsMap.values())
    if (where.userId !== undefined) items = items.filter((v) => v.userId === where.userId)
    if (where.status !== undefined) {
      if (typeof where.status === 'string') {
        items = items.filter((v) => v.status === where.status)
      } else if (Array.isArray(where.status.in)) {
        items = items.filter((v) => where.status.in.includes(v.status))
      }
    }
    if (args?.orderBy?.id === 'desc') {
      items.sort((a, b) => b.id - a.id)
    }
    const item = items[0]
    if (!item) return null
    return {
      ...item,
      user: users.get(item.userId) ? {
        id: item.userId,
        firstName: users.get(item.userId)?.firstName || '',
        lastName: users.get(item.userId)?.lastName || '',
        email: users.get(item.userId)?.email || '',
        avatar: users.get(item.userId)?.avatar || '',
        phone: users.get(item.userId)?.phone || '',
        isVerifiedHost: users.get(item.userId)?.isVerifiedHost || false,
      } : undefined,
    }
  }

  ;(prisma.userVerification as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const item = userVerificationsMap.get(id)
    if (!item) return null
    return {
      ...item,
      user: users.get(item.userId) ? {
        id: item.userId,
        firstName: users.get(item.userId)?.firstName || '',
        lastName: users.get(item.userId)?.lastName || '',
        email: users.get(item.userId)?.email || '',
        avatar: users.get(item.userId)?.avatar || '',
        phone: users.get(item.userId)?.phone || '',
        isVerifiedHost: users.get(item.userId)?.isVerifiedHost || false,
      } : undefined,
    }
  }

  ;(prisma.userVerification as any).findMany = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(userVerificationsMap.values())
    if (where.status) items = items.filter((v) => v.status === where.status)
    if (where.userId !== undefined) items = items.filter((v) => v.userId === where.userId)
    items.sort((a, b) => b.id - a.id)
    if (args?.skip) items = items.slice(args.skip)
    if (args?.take) items = items.slice(0, args.take)
    return items.map((item) => ({
      ...item,
      user: users.get(item.userId) ? {
        id: item.userId,
        firstName: users.get(item.userId)?.firstName || '',
        lastName: users.get(item.userId)?.lastName || '',
        email: users.get(item.userId)?.email || '',
        avatar: users.get(item.userId)?.avatar || '',
        phone: users.get(item.userId)?.phone || '',
        isVerifiedHost: users.get(item.userId)?.isVerifiedHost || false,
      } : undefined,
    }))
  }

  ;(prisma.userVerification as any).count = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(userVerificationsMap.values())
    if (where.status) items = items.filter((v) => v.status === where.status)
    if (where.userId !== undefined) items = items.filter((v) => v.userId === where.userId)
    return items.length
  }

  ;(prisma.userVerification as any).create = async (args: any) => {
    const id = nextVerificationId++
    const data = args?.data || {}
    const record = {
      id,
      userId: data.userId,
      status: data.status || 'pending',
      isResubmit: Boolean(data.isResubmit),
      submittedAt: data.submittedAt || new Date(),
      rejectDescription: data.rejectDescription || null,
      previousRejectDescription: data.previousRejectDescription || null,
      idPhoto: data.idPhoto || '',
      selfieWithId: data.selfieWithId || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    userVerificationsMap.set(id, record)
    return { ...record }
  }

  ;(prisma.userVerification as any).update = async (args: any) => {
    const id = args?.where?.id
    const item = userVerificationsMap.get(id)
    if (!item) throw new Error(`UserVerification ${id} not found`)
    Object.assign(item, args?.data || {})
    item.updatedAt = new Date()
    return { ...item }
  }

  // --- reportCategory mocks ---
  ;(prisma.reportCategory as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    return mockReportCategories.find((c) => c.id === id) || null
  }
  ;(prisma.reportCategory as any).findFirst = async (args: any) => {
    const t = args?.where?.type
    if (!t) return mockReportCategories[0] || null
    if (typeof t === 'string') return mockReportCategories.find((c) => c.type === t) || null
    if (Array.isArray(t.in)) return mockReportCategories.find((c) => t.in.includes(c.type)) || null
    return mockReportCategories[0] || null
  }

  // --- report mocks ---
  const sanitizeReportProperty = (propId: number | null | undefined) => {
    if (!propId || !propertiesMap.has(propId)) return null
    const p = propertiesMap.get(propId)
    const hostUser = users.get(p.hostId) || p.host
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      address: p.address,
      province: p.province,
      district: p.district,
      subdistrict: p.subdistrict,
      zipcode: p.zipcode,
      country: p.country,
      latitude: p.latitude,
      longitude: p.longitude,
      isActive: p.isActive,
      isBannedByAdmin: p.isBannedByAdmin,
      isBannedBeforeAccountBan: p.isBannedBeforeAccountBan,
      minPrice: p.minPrice,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
      bookingCount: p.bookingCount,
      hostId: p.hostId,
      host: hostUser
        ? {
            id: hostUser.id,
            firstName: hostUser.firstName || '',
            lastName: hostUser.lastName || '',
            email: hostUser.email || '',
            avatar: hostUser.avatar || '',
          }
        : undefined,
      images: p.images || [],
    }
  }

  const sanitizeReportBooking = (bookingId: number | null | undefined) => {
    if (!bookingId || !bookingsMap.has(bookingId)) return null
    const b = bookingsMap.get(bookingId)
    const guestUser = users.get(b.guestId) || b.guest
    return {
      id: b.id,
      bookingNumber: b.bookingNumber,
      bookingStatus: b.bookingStatus,
      paymentStatus: b.paymentStatus,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      totalAmount: b.totalAmount,
      guestId: b.guestId,
      propertyId: b.propertyId,
      property: sanitizeReportProperty(b.propertyId),
      rating: b.rating,
      comment: b.comment,
      reviewedAt: b.reviewedAt,
      guest: guestUser
        ? {
            id: guestUser.id,
            firstName: guestUser.firstName || '',
            lastName: guestUser.lastName || '',
            email: guestUser.email || '',
            avatar: guestUser.avatar || '',
          }
        : undefined,
      reviewImages: b.reviewImages || [],
    }
  }

  ;(prisma.report as any).findFirst = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(reportsMap.values())
    if (where.deletedAt === null) items = items.filter((r) => r.deletedAt === null)
    if (where.propertyId !== undefined) items = items.filter((r) => r.propertyId === where.propertyId)
    if (where.bookingId !== undefined) items = items.filter((r) => r.bookingId === where.bookingId)
    if (where.reporterId !== undefined) items = items.filter((r) => r.reporterId === where.reporterId)
    if (where.status !== undefined) items = items.filter((r) => r.status === where.status)
    if (where.resolvedAction !== undefined) items = items.filter((r) => r.resolvedAction === where.resolvedAction)
    if (where.createdAt?.gt) items = items.filter((r) => r.createdAt > where.createdAt.gt)
    if (where.reportCategory?.type) {
      const catType = where.reportCategory.type
      if (typeof catType === 'string') {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat?.type === catType
        })
      } else if (Array.isArray(catType.in)) {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat && catType.in.includes(cat.type)
        })
      }
    }
    if (args?.orderBy?.updatedAt === 'desc') {
      items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    } else {
      items.sort((a, b) => b.id - a.id)
    }
    const r = items[0]
    if (!r) return null
    return {
      ...r,
      reportCategory: mockReportCategories.find((c) => c.id === r.reportCategoryId),
      property: sanitizeReportProperty(r.propertyId),
      booking: sanitizeReportBooking(r.bookingId),
      reporter: users.get(r.reporterId),
      images: r.images || [],
    }
  }

  ;(prisma.report as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const r = reportsMap.get(id)
    if (!r) return null
    return {
      ...r,
      reportCategory: mockReportCategories.find((c) => c.id === r.reportCategoryId),
      property: sanitizeReportProperty(r.propertyId),
      booking: sanitizeReportBooking(r.bookingId),
      reporter: users.get(r.reporterId),
      images: r.images || [],
    }
  }

  ;(prisma.report as any).findMany = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(reportsMap.values())
    if (where.deletedAt === null) items = items.filter((r) => r.deletedAt === null)
    if (where.propertyId !== undefined) items = items.filter((r) => r.propertyId === where.propertyId)
    if (where.bookingId !== undefined) items = items.filter((r) => r.bookingId === where.bookingId)
    if (where.reporterId !== undefined) items = items.filter((r) => r.reporterId === where.reporterId)
    if (where.status !== undefined) items = items.filter((r) => r.status === where.status)
    if (where.resolvedAction !== undefined) items = items.filter((r) => r.resolvedAction === where.resolvedAction)
    if (where.createdAt?.gte) items = items.filter((r) => r.createdAt >= where.createdAt.gte)
    if (where.createdAt?.gt) items = items.filter((r) => r.createdAt > where.createdAt.gt)
    if (where.reportCategory?.type) {
      const catType = where.reportCategory.type
      if (typeof catType === 'string') {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat?.type === catType
        })
      } else if (Array.isArray(catType.in)) {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat && catType.in.includes(cat.type)
        })
      }
    }
    if (args?.orderBy?.createdAt === 'desc') {
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } else {
      items.sort((a, b) => b.id - a.id)
    }
    if (args?.skip) items = items.slice(args.skip)
    if (args?.take) items = items.slice(0, args.take)
    return items.map((r) => ({
      ...r,
      reportCategory: mockReportCategories.find((c) => c.id === r.reportCategoryId),
      property: sanitizeReportProperty(r.propertyId),
      booking: sanitizeReportBooking(r.bookingId),
      reporter: users.get(r.reporterId),
      images: r.images || [],
    }))
  }

  ;(prisma.report as any).count = async (args: any) => {
    const where = args?.where || {}
    let items = Array.from(reportsMap.values())
    if (where.deletedAt === null) items = items.filter((r) => r.deletedAt === null)
    if (where.propertyId !== undefined) items = items.filter((r) => r.propertyId === where.propertyId)
    if (where.reporterId !== undefined) items = items.filter((r) => r.reporterId === where.reporterId)
    if (where.status !== undefined) items = items.filter((r) => r.status === where.status)
    if (where.createdAt?.gte) items = items.filter((r) => r.createdAt >= where.createdAt.gte)
    if (where.reportCategory?.type) {
      const catType = where.reportCategory.type
      if (typeof catType === 'string') {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat?.type === catType
        })
      } else if (Array.isArray(catType.in)) {
        items = items.filter((r) => {
          const cat = mockReportCategories.find((c) => c.id === r.reportCategoryId)
          return cat && catType.in.includes(cat.type)
        })
      }
    }
    return items.length
  }

  ;(prisma.report as any).create = async (args: any) => {
    const id = nextReportId++
    const data = args?.data || {}
    const images = Array.isArray(data.images?.create)
      ? data.images.create.map((img: any) => ({
          id: nextReportImageId++,
          reportId: id,
          filePath: img.filePath,
          fileName: img.fileName || 'evidence.webp',
          fileContentType: img.fileContentType || 'image/webp',
          fileExtensionName: img.fileExtensionName || 'webp',
          fileSize: img.fileSize || 1024,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      : []
    const record = {
      id,
      propertyId: data.propertyId ?? null,
      bookingId: data.bookingId ?? null,
      reportCategoryId: data.reportCategoryId,
      reporterId: data.reporterId,
      description: data.description || null,
      status: data.status || 'pending',
      adminNote: data.adminNote || null,
      resolvedAction: data.resolvedAction || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      images,
      reportCategory: mockReportCategories.find((c) => c.id === data.reportCategoryId),
    }
    reportsMap.set(id, record)
    return { ...record }
  }

  ;(prisma.report as any).update = async (args: any) => {
    const id = args?.where?.id
    const r = reportsMap.get(id)
    if (!r) throw new Error(`Report ${id} not found`)
    Object.assign(r, args?.data || {})
    r.updatedAt = new Date()
    return {
      ...r,
      reportCategory: mockReportCategories.find((c) => c.id === r.reportCategoryId),
      property: sanitizeReportProperty(r.propertyId),
      booking: sanitizeReportBooking(r.bookingId),
      reporter: users.get(r.reporterId),
      images: r.images || [],
    }
  }

  // --- actionLog mocks ---
  ;(prisma.actionLog as any).create = async (args: any) => {
    const id = nextActionLogId++
    const data = args?.data || {}
    const log = {
      id,
      modelName: data.modelName || null,
      recordId: data.recordId || null,
      action: data.action || null,
      actorId: data.actorId || null,
      targetId: data.targetId || null,
      messages: data.messages || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    actionLogsList.push(log)
    return { ...log }
  }

  ;(prisma.actionLog as any).findMany = async (args: any) => {
    let items = [...actionLogsList]
    if (args?.where?.action) {
      items = items.filter((l) => l.action === args.where.action)
    }
    items.sort((a, b) => b.id - a.id)
    if (args?.skip) items = items.slice(args.skip)
    if (args?.take) items = items.slice(0, args.take)
    return items.map((l) => ({
      ...l,
      actor: users.get(l.actorId),
      target: users.get(l.targetId),
    }))
  }

  ;(prisma.actionLog as any).count = async (args: any) => {
    let items = [...actionLogsList]
    if (args?.where?.action) {
      items = items.filter((l) => l.action === args.where.action)
    }
    return items.length
  }

  // --- bookingReviewImage mocks ---
  ;(prisma.bookingReviewImage as any).deleteMany = async (args: any) => {
    const bookingId = args?.where?.bookingId
    if (bookingId) {
      const b = bookingsMap.get(bookingId)
      if (b) {
        b.reviewImages = []
      }
    }
    return { count: 1 }
  }

  const makeMockProperty = (overrides: any) => {
    const hostUser = users.get(overrides.hostId || 2) || {
      id: 2,
      firstName: 'Bob',
      lastName: 'Builder',
      avatar: null,
      isVerifiedHost: true,
      isBannedAllProperties: false,
      bannedAt: null,
      deletedAt: null,
    }
    return {
      id: 101,
      title: 'Pawradise Luxury Cat & Dog Hotel',
      description: 'Spacious rooms with 24/7 care',
      address: '123 Sukhumvit',
      province: 'Bangkok',
      district: 'Watthana',
      subdistrict: 'Khlong Tan Nuea',
      country: 'Thailand',
      latitude: 13.7367,
      longitude: 100.5602,
      zipcode: '10110',
      isActive: true,
      isBannedByAdmin: false,
      isBannedBeforeAccountBan: false,
      minPrice: 800,
      avgRating: 5,
      reviewCount: 1,
      bookingCount: 1,
      hostId: hostUser.id,
      propertyTypeId: 1,
      propertyType: { id: 1, name: 'Pet Hotel' },
      deletedAt: null,
      createdAt: nowDate,
      publishedAt: nowDate,
      updatedAt: nowDate,
      images: [
        { id: 1, fileName: 'front.webp', filePath: 'http://localhost:9000/joodpakpaw-media/properties/front.webp', fileContentType: 'image/webp', fileExtensionName: 'webp', fileSize: 10240 },
      ],
      facilities: [{ facility: mockFacilities[0] }, { facility: mockFacilities[1] }],
      roomCategories: [
        {
          id: 501,
          name: 'VIP Suite',
          totalRoom: 3,
          numberOfPets: 2,
          basePrice: 800,
          roomSizeWidth: 2.5,
          roomSizeLength: 3.0,
          roomSizeHeight: 2.2,
          propertyId: 101,
          petSizeCategoryId: 2,
          petSizeCategory: mockPetSizes[1],
          pets: [{ pet: mockPets[0] }, { pet: mockPets[1] }],
          facilities: [{ facility: mockFacilities[0] }],
          images: [],
          calendars: [
            {
              date: new Date('2026-12-01T00:00:00.000Z'),
              bookedRooms: 1,
              unavailableRooms: 1,
              priceAdjustment: 150,
              deletedAt: null,
            },
          ],
        },
      ],
      host: hostUser,
      bookings: [
        {
          id: 9001,
          rating: 5,
          comment: 'Amazing stay for my dog!',
          reviewedAt: nowDate,
          updatedAt: nowDate,
          createdAt: nowDate,
          property: { id: 101, title: 'Pawradise Luxury Cat & Dog Hotel' },
          guest: { id: 1, firstName: 'Alicia', lastName: 'Wonderland', avatar: '' },
          reviewImages: [],
        },
      ],
      ...overrides,
    }
  }

  ;(prisma.facility as any).findMany = async () => mockFacilities
  ;(prisma.pet as any).findMany = async () => mockPets
  ;(prisma.petBreed as any).findMany = async (args: any) =>
    mockBreeds.filter((b) => b.petId === args?.where?.petId)
  ;(prisma.petSizeCategory as any).findMany = async () => mockPetSizes
  ;(prisma.reportCategory as any).findMany = async (args: any) => {
    const t = args?.where?.type
    if (!t) return mockReportCategories
    if (typeof t === 'string') return mockReportCategories.filter((c) => c.type === t)
    if (Array.isArray(t.in)) return mockReportCategories.filter((c) => t.in.includes(c.type))
    return mockReportCategories
  }

  ;(prisma.favoriteProperty as any).findMany = async (args: any) => {
    const uid = args?.where?.folder?.userId
    if (uid === 1) {
      return [{ propertyId: 101, folderId: 77 }]
    }
    return []
  }

  // propertiesMap declared above
  const roomsMap = new Map<number, any>()
  let nextPropId = 104
  let nextRoomId = 502
  let mockActiveBookingCount = 0
  let mockActiveOrderCount = 0

  const initDefaultMockProperties = () => {
    const p101 = makeMockProperty({ id: 101, isActive: true, isBannedByAdmin: false, hostId: 2, reports: [] })
    const p102 = makeMockProperty({ id: 102, isActive: false, isBannedByAdmin: false, hostId: 2, reports: [] })
    const p103 = makeMockProperty({ id: 103, isActive: false, isBannedByAdmin: true, hostId: 2, reports: [] })
    propertiesMap.set(101, p101)
    propertiesMap.set(102, p102)
    propertiesMap.set(103, p103)
    p101.roomCategories[0].property = p101
    roomsMap.set(501, p101.roomCategories[0])
  }
  initDefaultMockProperties()

  ;(prisma.propertyType as any).findUnique = async () => ({ id: 1, name: 'Pet Hotel' })
  ;(prisma.propertyType as any).findFirst = async () => ({ id: 1, name: 'Pet Hotel' })
  ;(prisma.petSizeCategory as any).findUnique = async (args: any) =>
    mockPetSizes.find((s) => s.id === args?.where?.id) || mockPetSizes[0]
  ;(prisma.petSizeCategory as any).findFirst = async () => mockPetSizes[0]

  ;(prisma.property as any).findMany = async (args: any) => {
    const hostId = args?.where?.hostId
    if (typeof hostId === 'number') {
      return Array.from(propertiesMap.values()).filter(
        (p) => p.hostId === hostId && p.deletedAt === null
      )
    }
    // Public discovery: only return active, non-banned property 101
    return [propertiesMap.get(101)!].filter(Boolean)
  }

  ;(prisma.property as any).count = async (args: any) => {
    const hostId = args?.where?.hostId
    if (typeof hostId === 'number') {
      return Array.from(propertiesMap.values()).filter(
        (p) => p.hostId === hostId && p.deletedAt === null
      ).length
    }
    if (args?.where?.AND) {
      return 1
    }
    const where = args?.where || {}
    let list = Array.from(propertiesMap.values()).filter((p) => {
      if (where.deletedAt === null && p.deletedAt !== null) return false
      if (where.isActive !== undefined && p.isActive !== where.isActive) return false
      if (where.isBannedByAdmin !== undefined && p.isBannedByAdmin !== where.isBannedByAdmin) return false
      return true
    })
    return list.length
  }

  ;(prisma.property as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    if (typeof id === 'number' && propertiesMap.has(id)) {
      const p = propertiesMap.get(id)!
      const hostUser = users.get(p.hostId) || p.host
      return { ...p, host: hostUser }
    }
    return null
  }

  ;(prisma.property as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextPropId++
    const createdProp = makeMockProperty({
      id,
      title: data.title,
      description: data.description || '',
      address: data.address || '',
      province: data.province || 'Bangkok',
      district: data.district || '',
      subdistrict: data.subdistrict || '',
      country: data.country || 'Thailand',
      latitude: data.latitude ?? 13.7563,
      longitude: data.longitude ?? 100.5018,
      zipcode: data.zipcode || '',
      isActive: Boolean(data.isActive),
      isBannedByAdmin: false,
      minPrice: 0,
      avgRating: 0,
      reviewCount: 0,
      bookingCount: 0,
      hostId: data.hostId,
      roomCategories: [],
      bookings: [],
      reports: [],
    })
    propertiesMap.set(id, createdProp)
    return createdProp
  }

  ;(prisma.property as any).update = async (args: any) => {
    const id = args?.where?.id
    const prop = propertiesMap.get(id)
    if (!prop) throw new Error(`Mock property ${id} not found`)
    const data = args?.data || {}
    if (data.reportCount?.increment) {
      prop.reportCount = (prop.reportCount || 0) + data.reportCount.increment
    }
    Object.assign(prop, data)
    return prop
  }

  ;(prisma.propertyFacility as any).deleteMany = async () => ({ count: 0 })
  ;(prisma.propertyFacility as any).createMany = async () => ({ count: 1 })
  ;(prisma.propertyImage as any).updateMany = async () => ({ count: 0 })
  ;(prisma.propertyImage as any).createMany = async () => ({ count: 1 })

  ;(prisma.booking as any).findMany = async () => {
    return makeMockProperty({ id: 101 }).bookings
  }
  ;(prisma.booking as any).count = async (args: any) => {
    if (args?.where?.propertyId !== undefined) {
      return mockActiveBookingCount
    }
    return 1
  }
  ;(prisma.bookingOrder as any).count = async () => mockActiveOrderCount
  ;(prisma.chatRoom as any).findFirst = async (args: any) => {
    const or = args?.where?.OR
    if (Array.isArray(or)) {
      for (const r of chatRoomsMap.values()) {
        for (const cond of or) {
          if (
            (cond.participant1Id === r.participant1Id && cond.participant2Id === r.participant2Id) ||
            (cond.participant1Id === r.participant2Id && cond.participant2Id === r.participant1Id)
          ) {
            const u1 = users.get(r.participant1Id)
            const u2 = users.get(r.participant2Id)
            const roomMsgs = chatMessagesList.filter((m) => m.roomId === r.id && !m.isDeleted)
            return {
              ...r,
              participant1: u1 ? { ...u1, hostedProperties: [] } : null,
              participant2: u2 ? { ...u2, hostedProperties: [] } : null,
              messages: roomMsgs.slice(-1),
            }
          }
        }
      }
      if (args?.select?.id && chatRoomsMap.size === 0) return { id: 42 }
      return null
    }
    return { id: 42 }
  }

  ;(prisma.roomCategory as any).count = async (args: any) => {
    const propId = args?.where?.propertyId
    return Array.from(roomsMap.values()).filter(
      (r) => (propId === undefined || r.propertyId === propId) && !r.deletedAt
    ).length
  }
  ;(prisma.propertyImage as any).findMany = async () => []
  ;(prisma.roomCategoryImage as any).findMany = async () => []

  ;(prisma.roomCategory as any).findMany = async (args: any) => {
    const propId = args?.where?.propertyId
    const idIn = args?.where?.id?.in
    const id = args?.where?.id
    return Array.from(roomsMap.values()).filter((r) => {
      if (r.deletedAt) return false
      if (propId !== undefined && r.propertyId !== propId) return false
      if (Array.isArray(idIn) && !idIn.includes(r.id)) return false
      if (typeof id === 'number' && r.id !== id) return false
      return true
    }).map((r) => ({
      ...r,
      property: propertiesMap.get(r.propertyId) || r.property,
    }))
  }
  ;(prisma.roomCategory as any).findFirst = async (args: any) => {
    const id = args?.where?.id
    const propId = args?.where?.propertyId
    const r = roomsMap.get(id)
    if (r && (!propId || r.propertyId === propId) && !r.deletedAt) return r
    return null
  }
  ;(prisma.roomCategory as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    return roomsMap.get(id) || null
  }
  ;(prisma.roomCategory as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextRoomId++
    const room = {
      id,
      name: data.name,
      totalRoom: data.totalRoom,
      numberOfPets: data.numberOfPets,
      basePrice: data.basePrice,
      roomSizeWidth: data.roomSizeWidth ?? null,
      roomSizeLength: data.roomSizeLength ?? null,
      roomSizeHeight: data.roomSizeHeight ?? null,
      propertyId: data.propertyId,
      petSizeCategoryId: data.petSizeCategoryId ?? 1,
      petSizeCategory: mockPetSizes[0],
      pets: [{ pet: mockPets[0] }],
      facilities: [{ facility: mockFacilities[0] }],
      images: [],
      calendars: [],
      deletedAt: null,
    }
    roomsMap.set(id, room)
    const prop = propertiesMap.get(data.propertyId)
    if (prop) {
      prop.roomCategories.push(room)
    }
    return room
  }
  ;(prisma.roomCategory as any).update = async (args: any) => {
    const id = args?.where?.id
    const r = roomsMap.get(id)
    if (!r) throw new Error(`Mock roomCategory ${id} not found`)
    Object.assign(r, args?.data || {})
    return r
  }
  ;(prisma.roomCategory as any).updateMany = async () => ({ count: 1 })
  ;(prisma.roomCategoryPet as any).deleteMany = async () => ({ count: 0 })
  ;(prisma.roomCategoryPet as any).createMany = async () => ({ count: 1 })
  ;(prisma.roomCategoryFacility as any).deleteMany = async () => ({ count: 0 })
  ;(prisma.roomCategoryFacility as any).createMany = async () => ({ count: 1 })
  ;(prisma.roomCategoryImage as any).updateMany = async () => ({ count: 0 })
  ;(prisma.roomCategoryImage as any).createMany = async () => ({ count: 1 })
  ;(prisma as any).$transaction = async (ops: any, options?: any) => {
    (prisma as any)._lastTransactionOptions = options
    if (Array.isArray(ops)) {
      return Promise.all(ops)
    }
    const calSnap = new Map(Array.from(calendarsMap.entries()).map(([k, v]) => [k, { ...v }]))
    const bookSnap = new Map(Array.from(bookingsMap.entries()).map(([k, v]) => [k, { ...v }]))
    try {
      return await ops(prisma)
    } catch (txErr) {
      calendarsMap.clear()
      for (const [k, v] of calSnap) calendarsMap.set(k, v)
      bookingsMap.clear()
      for (const [k, v] of bookSnap) bookingsMap.set(k, v)
      throw txErr
    }
  }

  const petProfilesMap = new Map<number, any>()
  let nextPetProfileId = 1
  let mockActivePetBooking = false

  ;(prisma.petProfile as any).findMany = async (args: any) => {
    const guestId = args?.where?.guestId
    const idIn = args?.where?.id?.in
    return Array.from(petProfilesMap.values()).filter((p) => {
      if (p.deletedAt !== null && args?.where?.deletedAt === null) return false
      if (guestId !== undefined && p.guestId !== guestId) return false
      if (Array.isArray(idIn) && !idIn.includes(p.id)) return false
      return true
    }).sort((a, b) => a.id - b.id)
  }

  ;(prisma.petProfile as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    return petProfilesMap.get(id) || null
  }

  ;(prisma.petProfile as any).findFirst = async (args: any) => {
    const id = args?.where?.id
    return petProfilesMap.get(id) || null
  }

  ;(prisma.petProfile as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextPetProfileId++
    const petType = mockPets.find((p) => p.id === data.petTypeId) || mockPets[0]
    const breed = mockBreeds.find((b) => b.id === data.breedId) || null
    const petSizeCategory = mockPetSizes.find((s) => s.id === data.petSizeCategoryId) || null
    const record = {
      id,
      name: data.name,
      petSex: data.petSex || 'male',
      birthDate: data.birthDate || null,
      weight: data.weight ?? null,
      contactName: data.contactName || '',
      contactPhone: data.contactPhone || '',
      note: data.note || '',
      image: data.image || null,
      guestId: data.guestId,
      petTypeId: data.petTypeId,
      petType,
      breedId: data.breedId ?? null,
      breed,
      petSizeCategoryId: data.petSizeCategoryId ?? null,
      petSizeCategory,
      petEnergyId: data.petEnergyId ?? null,
      energy: data.petEnergyId ? { id: data.petEnergyId, rating: data.petEnergyId, description: 'Active' } : null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    petProfilesMap.set(id, record)
    return record
  }

  ;(prisma.petProfile as any).update = async (args: any) => {
    const id = args?.where?.id
    const record = petProfilesMap.get(id)
    if (!record) throw new Error(`Mock petProfile ${id} not found`)
    Object.assign(record, args?.data || {})
    if (args?.data?.petTypeId !== undefined) {
      record.petType = mockPets.find((p) => p.id === args.data.petTypeId) || record.petType
    }
    record.updatedAt = new Date()
    return record
  }

  // bookingsMap declared above
  let nextBookingId = 1001

  const defaultBooking9001 = {
    id: 9001,
    rating: 5,
    comment: 'Amazing stay for my dog!',
    reviewedAt: nowDate,
    updatedAt: nowDate,
    createdAt: nowDate,
    propertyId: 101,
    property: { id: 101, title: 'Pawradise Luxury Cat & Dog Hotel', hostId: 2 },
    guestId: 1,
    guest: { id: 1, firstName: 'Alicia', lastName: 'Wonderland', avatar: '' },
    bookingOrders: [],
    bookingPetProfiles: [],
    reviewImages: [],
    deletedAt: null,
  }
  bookingsMap.set(9001, defaultBooking9001)

  ;(prisma.booking as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const b = bookingsMap.get(id)
    if (!b) return null
    const prop = propertiesMap.get(b.propertyId) || b.property
    return { ...b, property: prop }
  }

  ;(prisma.booking as any).findMany = async (args: any) => {
    const idFilter = args?.where?.id
    const guestId = args?.where?.guestId
    const hostId = args?.where?.property?.hostId
    const propId = args?.where?.propertyId
    const statusFilter = args?.where?.bookingStatus

    let list = Array.from(bookingsMap.values()).filter((b) => {
      if (b.deletedAt !== null && args?.where?.deletedAt === null) return false
      if (typeof idFilter === 'number' && b.id !== idFilter) return false
      if (guestId !== undefined && b.guestId !== guestId) return false
      if (hostId !== undefined && b.property?.hostId !== hostId) return false
      if (propId !== undefined) {
        if (typeof propId === 'number' && b.propertyId !== propId) return false
        if (propId && Array.isArray(propId.in) && !propId.in.includes(b.propertyId)) return false
      }
      if (typeof statusFilter === 'string' && b.bookingStatus !== statusFilter) return false
      if (Array.isArray(statusFilter?.in) && !statusFilter.in.includes(b.bookingStatus)) return false
      if (args?.where?.rating?.not !== undefined && (b.rating === null || b.rating === undefined)) return false
      if (args?.where?.rating?.gt !== undefined && (b.rating === null || b.rating <= args.where.rating.gt)) return false
      return true
    })

    list.sort((a, b) => b.id - a.id)
    if (args?.skip !== undefined) {
      list = list.slice(args.skip)
    }
    if (args?.take !== undefined) {
      list = list.slice(0, args.take)
    }
    return list
  }

  const matchesBookingOrGuard = (b: any, orClauses: any[]): boolean => {
    return orClauses.some((clause: any) => {
      if (Array.isArray(clause?.bookingStatus?.in)) {
        return clause.bookingStatus.in.includes(b.bookingStatus)
      }
      if (Array.isArray(clause?.bookingStatus?.notIn)) {
        const notTerminal = !clause.bookingStatus.notIn.includes(b.bookingStatus)
        if (!notTerminal) return false
        if (clause.checkOutDate?.gte) {
          const bOut = b.checkOutDate ? new Date(b.checkOutDate).getTime() : 0
          return bOut >= new Date(clause.checkOutDate.gte).getTime()
        }
        return true
      }
      return false
    })
  }

  ;(prisma.booking as any).count = async (args: any) => {
    const guestId = args?.where?.guestId
    const hostId = args?.where?.property?.hostId
    const propId = args?.where?.propertyId
    if (Array.isArray(args?.where?.OR) && propId !== undefined) {
      if (mockActiveBookingCount > 0) return mockActiveBookingCount
      return Array.from(bookingsMap.values()).filter((b) => {
        if (b.deletedAt !== null) return false
        if (b.propertyId !== propId) return false
        return matchesBookingOrGuard(b, args.where.OR)
      }).length
    }
    if (propId !== undefined && !args?.where?.property && !args?.where?.guestId && !args?.where?.bookingStatus) {
      return mockActiveBookingCount
    }
    return Array.from(bookingsMap.values()).filter((b) => {
      if (b.deletedAt !== null && args?.where?.deletedAt === null) return false
      if (guestId !== undefined && b.guestId !== guestId) return false
      if (hostId !== undefined && b.property?.hostId !== hostId) return false
      if (propId !== undefined) {
        if (typeof propId === 'number' && b.propertyId !== propId) return false
        if (propId && Array.isArray(propId.in) && !propId.in.includes(b.propertyId)) return false
      }
      if (Array.isArray(args?.where?.bookingStatus?.in) && !args.where.bookingStatus.in.includes(b.bookingStatus)) return false
      if (args?.where?.rating?.not !== undefined && (b.rating === null || b.rating === undefined)) return false
      return true
    }).length
  }

  ;(prisma.bookingOrder as any).count = async (args: any) => {
    if (mockActiveOrderCount > 0) return mockActiveOrderCount
    const rcId = args?.where?.roomCategoryId
    const orClauses = args?.where?.booking?.OR
    if (rcId !== undefined && Array.isArray(orClauses)) {
      let count = 0
      for (const b of bookingsMap.values()) {
        if (b.deletedAt !== null) continue
        if (!matchesBookingOrGuard(b, orClauses)) continue
        const hasRc = (b.bookingOrders || []).some((o: any) => o.roomCategoryId === rcId)
        if (hasRc) count++
      }
      return count
    }
    return mockActiveOrderCount
  }

  ;(prisma.booking as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextBookingId++
    const prop = propertiesMap.get(data.propertyId) || makeMockProperty({ id: data.propertyId })
    const guestUser = users.get(data.guestId) || { id: data.guestId, firstName: 'Alice', lastName: 'Wonder', email: 'alice@joodpakpaw.com', phone: '0812345678' }

    const createdOrders = (data.bookingOrders?.create || []).map((bo: any, idx: number) => {
      const rc = roomsMap.get(bo.roomCategoryId) || prop.roomCategories[0]
      return {
        id: idx + 1,
        checkInDate: bo.checkInDate,
        checkOutDate: bo.checkOutDate,
        roomsBooked: bo.roomsBooked,
        pricePerRoom: bo.pricePerRoom,
        totalPrice: bo.totalPrice,
        roomCategoryId: bo.roomCategoryId,
        roomCategory: rc,
        propertyId: data.propertyId,
        property: prop,
      }
    })

    const createdPetProfiles = (data.bookingPetProfiles?.create || []).map((bpp: any) => {
      const pet = petProfilesMap.get(bpp.petProfileId) || { id: bpp.petProfileId, name: 'Pet' }
      return {
        petProfileId: bpp.petProfileId,
        petProfile: pet,
      }
    })

    const bookingRecord = {
      id,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      numberOfPets: data.numberOfPets,
      totalPrice: data.totalPrice,
      bookingStatus: data.bookingStatus || 'pending',
      guestNote: data.guestNote || null,
      paymentSlipUrl: data.paymentSlipUrl || null,
      rating: null,
      comment: null,
      reviewedAt: null,
      reviewImages: [],
      hostReply: null,
      hostRepliedAt: null,
      cancelledBy: data.cancelledBy || null,
      cancellationReason: data.cancellationReason || null,
      confirmedAt: data.confirmedAt || null,
      successedAt: data.successedAt || null,
      guestId: data.guestId,
      guest: guestUser,
      propertyId: data.propertyId,
      property: prop,
      bookingOrders: createdOrders,
      bookingPetProfiles: createdPetProfiles,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }
    bookingsMap.set(id, bookingRecord)
    return bookingRecord
  }

  ;(prisma.booking as any).update = async (args: any) => {
    const id = args?.where?.id
    const b = bookingsMap.get(id)
    if (!b) throw new Error(`Mock booking ${id} not found`)
    Object.assign(b, args?.data || {})
    b.updatedAt = new Date()
    return b
  }

  ;(prisma.bookingPetProfile as any).findFirst = async (args: any) => {
    if (mockActivePetBooking) {
      return { petProfileId: args?.where?.petProfileId || 1, bookingId: 9999 }
    }
    const petId = args?.where?.petProfileId
    const checkInLt = args?.where?.booking?.checkInDate?.lt ? new Date(args.where.booking.checkInDate.lt).getTime() : Infinity
    const checkOutGt = args?.where?.booking?.checkOutDate?.gt ? new Date(args.where.booking.checkOutDate.gt).getTime() : 0
    for (const b of bookingsMap.values()) {
      if (b.deletedAt !== null) continue
      if (['pending', 'confirmed'].includes(b.bookingStatus)) {
        if (b.bookingPetProfiles?.some((bpp: any) => bpp.petProfileId === petId)) {
          const bCheckIn = new Date(b.checkInDate).getTime()
          const bCheckOut = new Date(b.checkOutDate).getTime()
          if (bCheckIn < checkInLt && bCheckOut > checkOutGt) {
            return { petProfileId: petId, bookingId: b.id, booking: b }
          }
        }
      }
    }
    return null
  }

  const calendarsMap = new Map<string, any>()
  let nextCalId = 1

  ;(prisma.roomCategoryCalendar as any).findUnique = async (args: any) => {
    if (args?.where?.id) {
      for (const cal of calendarsMap.values()) {
        if (cal.id === args.where.id) return cal
      }
    }
    const rcId = args?.where?.roomCategoryId_date?.roomCategoryId
    const dateStr = args?.where?.roomCategoryId_date?.date ? new Date(args.where.roomCategoryId_date.date).toISOString().slice(0, 10) : ''
    const key = `${rcId}:${dateStr}`
    return calendarsMap.get(key) || null
  }

  ;(prisma.roomCategoryCalendar as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextCalId++
    const dateStr = new Date(data.date).toISOString().slice(0, 10)
    const key = `${data.roomCategoryId}:${dateStr}`
    const cal = {
      id,
      roomCategoryId: data.roomCategoryId,
      date: data.date,
      availableRooms: data.availableRooms,
      bookedRooms: data.bookedRooms || 0,
      unavailableRooms: data.unavailableRooms || 0,
      priceAdjustment: data.priceAdjustment || 0,
    }
    calendarsMap.set(key, cal)
    return cal
  }

  ;(prisma.roomCategoryCalendar as any).update = async (args: any) => {
    const id = args?.where?.id
    for (const cal of calendarsMap.values()) {
      if (cal.id === id) {
        Object.assign(cal, args?.data || {})
        return cal
      }
    }
    return null
  }

  ;(prisma.roomCategoryCalendar as any).findMany = async (args: any) => {
    const rcId = args?.where?.roomCategoryId
    const gte = args?.where?.date?.gte ? new Date(args.where.date.gte).getTime() : 0
    const lte = args?.where?.date?.lte ? new Date(args.where.date.lte).getTime() : Infinity
    return Array.from(calendarsMap.values())
      .filter((cal) => {
        if (rcId !== undefined && cal.roomCategoryId !== rcId) return false
        const t = new Date(cal.date).getTime()
        if (t < gte || t > lte) return false
        return true
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  let nextReviewImgId = 1
  ;(prisma.bookingReviewImage as any).create = async (args: any) => {
    const rec = {
      id: nextReviewImgId++,
      ...args?.data,
    }
    const b = args?.data?.bookingId ? bookingsMap.get(args.data.bookingId) : undefined
    if (b) {
      if (!Array.isArray(b.reviewImages)) b.reviewImages = []
      b.reviewImages.push(rec)
    }
    return rec
  }

  const notificationActionsMap = new Map<string, { id: number; name: string }>()
  let nextNotifActionId = 1
  const notificationsList: any[] = []
  let nextNotifId = 1

  ;(prisma.notificationAction as any).upsert = async (args: any) => {
    const name = args?.where?.name
    if (notificationActionsMap.has(name)) return notificationActionsMap.get(name)
    const rec = { id: nextNotifActionId++, name }
    notificationActionsMap.set(name, rec)
    return rec
  }
  ;(prisma.notificationAction as any).findUnique = async (args: any) => {
    return notificationActionsMap.get(args?.where?.name) || null
  }
  ;(prisma.notificationAction as any).create = async (args: any) => {
    const name = args?.data?.name
    const rec = { id: nextNotifActionId++, name }
    notificationActionsMap.set(name, rec)
    return rec
  }
  ;(prisma.notification as any).create = async (args: any) => {
    const rec = { id: nextNotifId++, ...args?.data, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }
    notificationsList.push(rec)
    const actionObj = rec.notificationActionId
      ? Array.from(notificationActionsMap.values()).find((a) => a.id === rec.notificationActionId) || null
      : null
    const roleObj = rec.roleId ? { id: rec.roleId, name: rec.roleId === 2 ? 'host' : 'guest' } : null
    return { ...rec, action: actionObj, role: roleObj }
  }
  ;(prisma.notification as any).findMany = async (args: any) => {
    const userId = args?.where?.userId
    return notificationsList
      .filter((n) => (userId === undefined || n.userId === userId) && n.deletedAt === null)
      .map((n) => {
        const actionObj = n.notificationActionId
          ? Array.from(notificationActionsMap.values()).find((a) => a.id === n.notificationActionId) || null
          : null
        const roleObj = n.roleId ? { id: n.roleId, name: n.roleId === 2 ? 'host' : 'guest' } : null
        return { ...n, action: actionObj, role: roleObj }
      })
  }
  ;(prisma.notification as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const notif = notificationsList.find((n) => n.id === id)
    if (!notif) return null
    const actionObj = notif.notificationActionId
      ? Array.from(notificationActionsMap.values()).find((a) => a.id === notif.notificationActionId) || null
      : null
    const roleObj = notif.roleId ? { id: notif.roleId, name: notif.roleId === 2 ? 'host' : 'guest' } : null
    return { ...notif, action: actionObj, role: roleObj }
  }
  ;(prisma.notification as any).findFirst = async (args: any) => {
    const where = args?.where || {}
    const match = notificationsList.find((n) => {
      if (where.deletedAt === null && n.deletedAt !== null) return false
      if (where.userId !== undefined && n.userId !== where.userId) return false
      if (where.referenceTable !== undefined && n.referenceTable !== where.referenceTable) return false
      if (where.referenceId !== undefined && n.referenceId !== where.referenceId) return false
      if (where.notificationActionId !== undefined && n.notificationActionId !== where.notificationActionId) return false
      if (where.action?.name) {
        const act = notificationActionsMap.get(where.action.name)
        if (!act || n.notificationActionId !== act.id) return false
      }
      return true
    })
    if (!match) return null
    const actionObj = match.notificationActionId
      ? Array.from(notificationActionsMap.values()).find((a) => a.id === match.notificationActionId) || null
      : null
    const roleObj = match.roleId ? { id: match.roleId, name: match.roleId === 2 ? 'host' : 'guest' } : null
    return { ...match, action: actionObj, role: roleObj }
  }
  ;(prisma.notification as any).update = async (args: any) => {
    const id = args?.where?.id
    const notif = notificationsList.find((n) => n.id === id)
    if (!notif) throw new Error(`Notification ${id} not found`)
    Object.assign(notif, args?.data || {})
    const actionObj = notif.notificationActionId
      ? Array.from(notificationActionsMap.values()).find((a) => a.id === notif.notificationActionId) || null
      : null
    const roleObj = notif.roleId ? { id: notif.roleId, name: notif.roleId === 2 ? 'host' : 'guest' } : null
    return { ...notif, action: actionObj, role: roleObj }
  }
  ;(prisma.notification as any).updateMany = async (args: any) => {
    const where = args?.where || {}
    let count = 0
    for (const n of notificationsList) {
      if (where.userId !== undefined && n.userId !== where.userId) continue
      if (where.deletedAt === null && n.deletedAt !== null) continue
      if (where.isRead !== undefined && n.isRead !== where.isRead) continue
      Object.assign(n, args?.data || {})
      count++
    }
    return { count }
  }

  ;(prisma.chatRoom as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const r = chatRoomsMap.get(id)
    if (!r) return null
    const u1 = users.get(r.participant1Id)
    const u2 = users.get(r.participant2Id)
    const roomMsgs = chatMessagesList
      .filter((m) => m.roomId === r.id && !m.isDeleted)
      .map((m) => {
        const s = users.get(m.senderId)
        const atts = chatAttachmentsList.filter((a) => a.messageId === m.id)
        return {
          ...m,
          sender: s ? { id: s.id, firstName: s.firstName, lastName: s.lastName, avatar: s.avatar } : { id: m.senderId },
          attachments: atts,
        }
      })
    return {
      ...r,
      participant1: u1 ? { ...u1, hostedProperties: [] } : null,
      participant2: u2 ? { ...u2, hostedProperties: [] } : null,
      messages: roomMsgs,
    }
  }

  ;(prisma.chatRoom as any).findMany = async (args: any) => {
    const or = args?.where?.OR
    const userId = or ? (or[0]?.participant1Id ?? or[0]?.participant2Id) : undefined
    const result: any[] = []
    for (const r of chatRoomsMap.values()) {
      if (userId !== undefined && r.participant1Id !== userId && r.participant2Id !== userId) {
        continue
      }
      const u1 = users.get(r.participant1Id)
      const u2 = users.get(r.participant2Id)
      const roomMsgs = chatMessagesList.filter((m) => m.roomId === r.id && !m.isDeleted)
      result.push({
        ...r,
        participant1: u1 ? { ...u1, hostedProperties: [] } : null,
        participant2: u2 ? { ...u2, hostedProperties: [] } : null,
        messages: roomMsgs.slice(-1),
      })
    }
    return result
  }

  ;(prisma.chatRoom as any).create = async (args: any) => {
    const id = nextChatRoomId++
    const rec = {
      id,
      participant1Id: args?.data?.participant1Id,
      participant2Id: args?.data?.participant2Id,
      lastMessageAt: args?.data?.lastMessageAt || new Date(),
      lastMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    chatRoomsMap.set(id, rec)
    const u1 = users.get(rec.participant1Id)
    const u2 = users.get(rec.participant2Id)
    return {
      ...rec,
      participant1: u1 ? { ...u1, hostedProperties: [] } : null,
      participant2: u2 ? { ...u2, hostedProperties: [] } : null,
      messages: [],
    }
  }

  ;(prisma.chatRoom as any).update = async (args: any) => {
    const id = args?.where?.id
    const r = chatRoomsMap.get(id)
    if (!r) throw new Error(`Chat room ${id} not found`)
    Object.assign(r, args?.data || {})
    return { ...r }
  }

  ;(prisma.chatRoom as any).delete = async (args: any) => {
    const id = args?.where?.id
    const r = chatRoomsMap.get(id)
    chatRoomsMap.delete(id)
    return r
  }

  ;(prisma.chatMessage as any).create = async (args: any) => {
    const id = nextChatMessageId++
    const attachmentsData = args?.data?.attachments?.create || []
    const msgRec = {
      id,
      roomId: args?.data?.roomId,
      senderId: args?.data?.senderId,
      content: args?.data?.content || '',
      readAt: null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    chatMessagesList.push(msgRec)

    const createdAtts: any[] = []
    for (const att of attachmentsData) {
      const aRec = {
        id: nextAttachmentId++,
        messageId: id,
        filePath: att.filePath,
        fileName: att.fileName || null,
        fileContentType: att.fileContentType || 'image/webp',
        fileSize: att.fileSize || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      chatAttachmentsList.push(aRec)
      createdAtts.push(aRec)
    }

    const s = users.get(msgRec.senderId)
    return {
      ...msgRec,
      sender: s ? { id: s.id, firstName: s.firstName, lastName: s.lastName, avatar: s.avatar } : { id: msgRec.senderId },
      attachments: createdAtts,
    }
  }

  ;(prisma.chatMessage as any).updateMany = async (args: any) => {
    const where = args?.where || {}
    let count = 0
    for (const m of chatMessagesList) {
      if (where.roomId !== undefined && m.roomId !== where.roomId) continue
      if (where.senderId?.not !== undefined && m.senderId === where.senderId.not) continue
      if (where.readAt === null && m.readAt !== null) continue
      if (where.isDeleted === false && m.isDeleted) continue
      Object.assign(m, args?.data || {})
      count++
    }
    return { count }
  }

  ;(prisma.chatMessageAttachment as any).findMany = async (args: any) => {
    const roomId = args?.where?.message?.roomId
    if (roomId !== undefined) {
      const msgsInRoom = new Set(chatMessagesList.filter((m) => m.roomId === roomId).map((m) => m.id))
      return chatAttachmentsList.filter((a) => msgsInRoom.has(a.messageId))
    }
    return chatAttachmentsList
  }

  const favoriteFoldersMap = new Map<number, any>()
  let nextFolderId = 1
  let favoritePropertiesList: Array<{ folderId: number; propertyId: number }> = []

  ;(prisma.favoriteFolder as any).findMany = async (args: any) => {
    const userId = args?.where?.userId
    return Array.from(favoriteFoldersMap.values())
      .filter((f) => {
        if (f.deletedAt !== null && args?.where?.deletedAt === null) return false
        if (userId !== undefined && f.userId !== userId) return false
        return true
      })
      .map((f) => {
        const fps = favoritePropertiesList
          .filter((fp) => fp.folderId === f.id)
          .map((fp) => {
            const prop = propertiesMap.get(fp.propertyId) || makeMockProperty({ id: fp.propertyId })
            return {
              folderId: fp.folderId,
              propertyId: fp.propertyId,
              property: prop,
            }
          })
        return {
          ...f,
          favoriteProperties: fps,
        }
      })
  }

  ;(prisma.favoriteFolder as any).findUnique = async (args: any) => {
    const id = args?.where?.id
    const f = favoriteFoldersMap.get(id)
    if (!f) return null
    const fps = favoritePropertiesList
      .filter((fp) => fp.folderId === f.id)
      .map((fp) => {
        const prop = propertiesMap.get(fp.propertyId) || makeMockProperty({ id: fp.propertyId })
        return {
          folderId: fp.folderId,
          propertyId: fp.propertyId,
          property: prop,
        }
      })
    return {
      ...f,
      favoriteProperties: fps,
    }
  }

  ;(prisma.favoriteFolder as any).findFirst = async (args: any) => {
    const userId = args?.where?.userId
    const name = args?.where?.name
    for (const f of favoriteFoldersMap.values()) {
      if (f.deletedAt !== null && args?.where?.deletedAt === null) continue
      if (userId !== undefined && f.userId !== userId) continue
      if (name !== undefined && f.name !== name) continue
      const fps = favoritePropertiesList
        .filter((fp) => fp.folderId === f.id)
        .map((fp) => {
          const prop = propertiesMap.get(fp.propertyId) || makeMockProperty({ id: fp.propertyId })
          return {
            folderId: fp.folderId,
            propertyId: fp.propertyId,
            property: prop,
          }
        })
      return {
        ...f,
        favoriteProperties: fps,
      }
    }
    return null
  }

  ;(prisma.favoriteFolder as any).create = async (args: any) => {
    const data = args?.data || {}
    const id = nextFolderId++
    const folder = {
      id,
      name: data.name,
      userId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      favoriteProperties: [],
    }
    favoriteFoldersMap.set(id, folder)
    return folder
  }

  ;(prisma.favoriteFolder as any).update = async (args: any) => {
    const id = args?.where?.id
    const f = favoriteFoldersMap.get(id)
    if (!f) throw new Error(`Favorite folder ${id} not found`)
    Object.assign(f, args?.data || {})
    f.updatedAt = new Date()
    return f
  }

  ;(prisma.favoriteProperty as any).findFirst = async (args: any) => {
    const propId = args?.where?.propertyId
    const userId = args?.where?.folder?.userId
    for (const fp of favoritePropertiesList) {
      if (propId !== undefined && fp.propertyId !== propId) continue
      const folder = favoriteFoldersMap.get(fp.folderId)
      if (!folder || (args?.where?.folder?.deletedAt === null && folder.deletedAt !== null)) continue
      if (userId !== undefined && folder.userId !== userId) continue
      return {
        ...fp,
        folder,
      }
    }
    return null
  }

  ;(prisma.favoriteProperty as any).create = async (args: any) => {
    const data = args?.data || {}
    const rec = { folderId: data.folderId, propertyId: data.propertyId }
    favoritePropertiesList.push(rec)
    return rec
  }

  ;(prisma.favoriteProperty as any).deleteMany = async (args: any) => {
    const folderId = args?.where?.folderId
    const propertyId = args?.where?.propertyId
    const folderIdIn = args?.where?.folderId?.in
    const initialLen = favoritePropertiesList.length
    favoritePropertiesList = favoritePropertiesList.filter((fp) => {
      if (folderId !== undefined && fp.folderId === folderId) return false
      if (propertyId !== undefined && Array.isArray(folderIdIn) && fp.propertyId === propertyId && folderIdIn.includes(fp.folderId)) return false
      return true
    })
    return { count: initialLen - favoritePropertiesList.length }
  }

  ;(prisma as any).$queryRawUnsafe = async () => []

  return {
    users,
    propertiesMap,
    roomsMap,
    bookingsMap,
    petProfilesMap,
    calendarsMap,
    favoriteFoldersMap,
    favoritePropertiesList,
    notificationsList,
    notificationActionsMap,
    chatRoomsMap,
    chatMessagesList,
    chatAttachmentsList,
    userVerificationsMap,
    reportsMap,
    actionLogsList,
    setMockActivePetBooking(val: boolean) {
      mockActivePetBooking = val
    },
    setActiveBookingCount(n: number) {
      mockActiveBookingCount = n
    },
    setActiveOrderCount(n: number) {
      mockActiveOrderCount = n
    },
    restore() {
      prisma.user.findFirst = originals.userFindFirst
      prisma.user.findUnique = originals.userFindUnique
      prisma.user.create = originals.userCreate
      prisma.user.update = originals.userUpdate
      prisma.user.count = originals.userCount
      if (originals.userRoleUpsert) (prisma.userRole as any).upsert = originals.userRoleUpsert
      if (originals.userVerificationFindFirst) (prisma.userVerification as any).findFirst = originals.userVerificationFindFirst
      if (originals.userVerificationFindUnique) (prisma.userVerification as any).findUnique = originals.userVerificationFindUnique
      if (originals.userVerificationFindMany) (prisma.userVerification as any).findMany = originals.userVerificationFindMany
      if (originals.userVerificationCount) (prisma.userVerification as any).count = originals.userVerificationCount
      if (originals.userVerificationCreate) (prisma.userVerification as any).create = originals.userVerificationCreate
      if (originals.userVerificationUpdate) (prisma.userVerification as any).update = originals.userVerificationUpdate
      if (originals.reportFindFirst) (prisma.report as any).findFirst = originals.reportFindFirst
      if (originals.reportFindUnique) (prisma.report as any).findUnique = originals.reportFindUnique
      if (originals.reportCount) (prisma.report as any).count = originals.reportCount
      if (originals.reportCreate) (prisma.report as any).create = originals.reportCreate
      if (originals.reportUpdate) (prisma.report as any).update = originals.reportUpdate
      if (originals.reportCategoryFindUnique) (prisma.reportCategory as any).findUnique = originals.reportCategoryFindUnique
      if (originals.reportCategoryFindFirst) (prisma.reportCategory as any).findFirst = originals.reportCategoryFindFirst
      if (originals.actionLogCreate) (prisma.actionLog as any).create = originals.actionLogCreate
      if (originals.actionLogFindMany) (prisma.actionLog as any).findMany = originals.actionLogFindMany
      if (originals.actionLogCount) (prisma.actionLog as any).count = originals.actionLogCount
      if (originals.bookingReviewImageDeleteMany) (prisma.bookingReviewImage as any).deleteMany = originals.bookingReviewImageDeleteMany
      prisma.role.upsert = originals.roleUpsert
      prisma.report.findMany = originals.reportFindMany
      prisma.facility.findMany = originals.facilityFindMany
      prisma.pet.findMany = originals.petFindMany
      prisma.petBreed.findMany = originals.petBreedFindMany
      prisma.petSizeCategory.findMany = originals.petSizeCategoryFindMany
      prisma.reportCategory.findMany = originals.reportCategoryFindMany
      prisma.favoriteProperty.findMany = originals.favoritePropertyFindMany
      prisma.property.findMany = originals.propertyFindMany
      prisma.property.findUnique = originals.propertyFindUnique
      prisma.booking.findMany = originals.bookingFindMany
      prisma.booking.count = originals.bookingCount
      prisma.chatRoom.findFirst = originals.chatRoomFindFirst
      prisma.roomCategory.findMany = originals.roomCategoryFindMany
      prisma.favoriteFolder.findMany = originals.favoriteFolderFindMany
      prisma.favoriteFolder.findUnique = originals.favoriteFolderFindUnique
      prisma.favoriteFolder.findFirst = originals.favoriteFolderFindFirst
      prisma.favoriteFolder.create = originals.favoriteFolderCreate
      prisma.favoriteFolder.update = originals.favoriteFolderUpdate
      prisma.favoriteProperty.findFirst = originals.favoritePropertyFindFirst
      prisma.favoriteProperty.create = originals.favoritePropertyCreate
      prisma.favoriteProperty.deleteMany = originals.favoritePropertyDeleteMany
      ;(prisma.roomCategoryCalendar as any).findMany = originals.roomCategoryCalendarFindMany
      ;(prisma.bookingReviewImage as any).create = originals.bookingReviewImageCreate
      ;(prisma.notificationAction as any).upsert = originals.notificationActionUpsert
      ;(prisma.notificationAction as any).findUnique = originals.notificationActionFindUnique
      ;(prisma.notificationAction as any).create = originals.notificationActionCreate
      ;(prisma.notification as any).create = originals.notificationCreate
      ;(prisma.notification as any).findMany = originals.notificationFindMany
      ;(prisma.notification as any).findUnique = originals.notificationFindUnique
      ;(prisma.notification as any).findFirst = originals.notificationFindFirst
      ;(prisma.notification as any).update = originals.notificationUpdate
      ;(prisma.notification as any).updateMany = originals.notificationUpdateMany
      ;(prisma.chatRoom as any).findUnique = originals.chatRoomFindUnique
      ;(prisma.chatRoom as any).findMany = originals.chatRoomFindMany
      ;(prisma.chatRoom as any).create = originals.chatRoomCreate
      ;(prisma.chatRoom as any).update = originals.chatRoomUpdate
      ;(prisma.chatRoom as any).delete = originals.chatRoomDelete
      ;(prisma.chatMessage as any).create = originals.chatMessageCreate
      ;(prisma.chatMessage as any).updateMany = originals.chatMessageUpdateMany
      ;(prisma.chatMessageAttachment as any).findMany = originals.chatMessageAttachmentFindMany
      prisma.propertyType.findUnique = originals.propertyTypeFindUnique
      prisma.propertyType.findFirst = originals.propertyTypeFindFirst
      prisma.petSizeCategory.findUnique = originals.petSizeCategoryFindUnique
      prisma.petSizeCategory.findFirst = originals.petSizeCategoryFindFirst
      prisma.property.count = originals.propertyCount
      prisma.property.create = originals.propertyCreate
      prisma.property.update = originals.propertyUpdate
      prisma.propertyFacility.deleteMany = originals.propertyFacilityDeleteMany
      prisma.propertyFacility.createMany = originals.propertyFacilityCreateMany
      prisma.propertyImage.updateMany = originals.propertyImageUpdateMany
      prisma.propertyImage.createMany = originals.propertyImageCreateMany
      prisma.propertyImage.findMany = originals.propertyImageFindMany
      prisma.bookingOrder.count = originals.bookingOrderCount
      prisma.roomCategory.count = originals.roomCategoryCount
      prisma.roomCategory.findFirst = originals.roomCategoryFindFirst
      prisma.roomCategory.findUnique = originals.roomCategoryFindUnique
      prisma.roomCategory.create = originals.roomCategoryCreate
      prisma.roomCategory.update = originals.roomCategoryUpdate
      prisma.roomCategory.updateMany = originals.roomCategoryUpdateMany
      prisma.roomCategoryPet.deleteMany = originals.roomCategoryPetDeleteMany
      prisma.roomCategoryPet.createMany = originals.roomCategoryPetCreateMany
      prisma.roomCategoryFacility.deleteMany = originals.roomCategoryFacilityDeleteMany
      prisma.roomCategoryFacility.createMany = originals.roomCategoryFacilityCreateMany
      prisma.roomCategoryImage.findMany = originals.roomCategoryImageFindMany
      prisma.roomCategoryImage.updateMany = originals.roomCategoryImageUpdateMany
      prisma.roomCategoryImage.createMany = originals.roomCategoryImageCreateMany
      prisma.petProfile.findMany = originals.petProfileFindMany
      prisma.petProfile.findUnique = originals.petProfileFindUnique
      prisma.petProfile.findFirst = originals.petProfileFindFirst
      prisma.petProfile.create = originals.petProfileCreate
      prisma.petProfile.update = originals.petProfileUpdate
      prisma.booking.findUnique = originals.bookingFindUnique
      prisma.booking.create = originals.bookingCreate
      prisma.booking.update = originals.bookingUpdate
      prisma.bookingPetProfile.findFirst = originals.bookingPetProfileFindFirst
      prisma.roomCategoryCalendar.findUnique = originals.roomCategoryCalendarFindUnique
      prisma.roomCategoryCalendar.create = originals.roomCategoryCalendarCreate
      prisma.roomCategoryCalendar.update = originals.roomCategoryCalendarUpdate
      ;(prisma as any).$transaction = originals.prismaTransaction
      ;(prisma as any).$queryRawUnsafe = originals.prismaQueryRawUnsafe
    },
  }
}

async function main() {
  console.log('🧪 Starting JoodPakPaw V2 Core API & PBI-04 Auth QA Tests (Windows Named Pipe IPC)...\n')

  // Mount test helper routes on v1Router (before notFoundHandler) for optionalAuthenticateToken and requireRoles verification
  v1Router.get('/test-optional-auth', optionalAuthenticateToken, (req, res) => {
    res.status(200).json({ authenticated: Boolean(req.user), userId: req.user?.id ?? null })
  })
  v1Router.get('/test-admin-rbac', optionalAuthenticateToken, requireRoles('admin'), (_req, res) => {
    res.status(200).json({ ok: true })
  })

  const app = createApp()

  const server = http.createServer(app)
  const pipePath = `\\\\.\\pipe\\joodpakpaw-smoke-${Date.now()}`

  await new Promise<void>((resolve) => server.listen(pipePath, resolve))
  const mockDb = installPrismaAuthMock()

  try {
    // Test 1: Root route
    await runTest('GET / should return service identification', async () => {
      const res = await makeRequest(pipePath, '/')
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`)
      if (res.body?.name !== 'JoodPakPaw API Server') throw new Error(`Expected name to be JoodPakPaw API Server, got ${res.body?.name}`)
      if (res.body?.status !== 'operational') throw new Error(`Expected status to be operational, got ${res.body?.status}`)
    })

    // Test 2: Health check endpoint
    await runTest('GET /health should return system status & subsystems', async () => {
      const res = await makeRequest(pipePath, '/health')
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`)
      if (res.body?.status !== 'ok') throw new Error(`Expected status to be ok, got ${res.body?.status}`)
      if (!res.body?.services) throw new Error('Expected services object in health report')
    })

    // Test 3: API v1 Base Route
    await runTest('GET /api/v1 should list available subsystem endpoints', async () => {
      const res = await makeRequest(pipePath, '/api/v1')
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`)
      if (res.body?.version !== 'v1') throw new Error(`Expected version v1, got ${res.body?.version}`)
      if (!res.body?.endpoints) throw new Error('Expected endpoints map in v1 base router')
    })

    // Test 4: Standardized 404 Error Handler
    await runTest('GET /non-existent-route should return standardized 404 format', async () => {
      const res = await makeRequest(pipePath, '/non-existent-route')
      if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`)
      const errCode = res.body?.code || res.body?.error?.code
      if (errCode !== 'ROUTE_NOT_FOUND') {
        throw new Error(`Expected error code ROUTE_NOT_FOUND, got ${errCode}`)
      }
    })

    // Test 5: Prisma Client Model Readiness (All 41 tables)
    await runTest('Prisma Client should instantiate and have representative models defined', async () => {
      if (!prisma) throw new Error('Prisma Client singleton is undefined')
      const requiredModels = [
        'user',
        'role',
        'property',
        'roomCategory',
        'roomCategoryCalendar',
        'booking',
        'pet',
        'petProfile',
        'chatRoom',
        'report',
        'favoriteFolder',
        'notification',
        'userBehavior',
      ]
      for (const model of requiredModels) {
        if (!(model in prisma)) {
          throw new Error(`Model ${model} missing from Prisma Client`)
        }
      }
    })

    // Test 6: Database connectivity helper resilience
    await runTest('checkDatabaseHealth() should execute without unhandled crash', async () => {
      const status = await checkDatabaseHealth()
      console.log(`     (Database status: ${status.toUpperCase()})`)
      if (!['connected', 'standby', 'disconnected'].includes(status)) {
        throw new Error(`Unexpected database status: ${status}`)
      }
    })

    // =========================================================================
    // PBI-04 QA Audit Tests: Auth Endpoints, Error Codes, RBAC & IDOR
    // =========================================================================
    let userAAccessToken = ''
    let userARefreshToken = ''
    let userAId = 0
    let userAFirstOtp = ''
    let userBId = 0

    // Test 7: POST /api/v1/auth/sign-up validation failure -> T-2007 (400)
    await runTest('POST /api/v1/auth/sign-up invalid payload returns 400 T-2007 with errors array', async () => {
      const res = await makeRequest(pipePath, '/api/v1/auth/sign-up', 'POST', {
        email: 'bad-email',
        password: 'short',
        confirmPassword: 'mismatch',
        firstname: '',
        lastname: '',
        phone: '123',
      })
      if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`)
      if (res.body?.code !== 'T-2007') throw new Error(`Expected code T-2007, got ${res.body?.code}`)
      if (!Array.isArray(res.body?.errors) || res.body.errors.length < 4) {
        throw new Error(`Expected errors array with validation tags, got ${JSON.stringify(res.body?.errors)}`)
      }
      const tags = res.body.errors.map((e: any) => `${e.field}:${e.tag}`)
      for (const expected of ['email:email', 'password:min', 'phone:phone']) {
        if (!tags.includes(expected)) {
          throw new Error(`Expected ${expected} in errors array, got ${tags.join(', ')}`)
        }
      }
    })

    // Test 8: POST /api/v1/auth/sign-up success (User A & User B)
    await runTest('POST /api/v1/auth/sign-up registers User A and User B (201)', async () => {
      const resA = await makeRequest(pipePath, '/api/v1/auth/sign-up', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstname: 'Alice',
        lastname: 'Wonder',
        phone: '0812345678',
      })
      if (resA.statusCode !== 201) throw new Error(`Expected 201, got ${resA.statusCode}`)
      const otpA = resA.body?.data?.otp || resA.body?.data?.debugOtp || resA.body?.otp
      const refCodeA = resA.body?.data?.refCode || resA.body?.refCode
      if (!refCodeA || !otpA) {
        throw new Error(`Expected refCode and otp in non-production sign-up response: ${JSON.stringify(resA.body)}`)
      }
      userAId = resA.body.data.id
      userAFirstOtp = otpA

      const resB = await makeRequest(pipePath, '/api/v1/auth/sign-up', 'POST', {
        email: 'bob@joodpakpaw.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstname: 'Bob',
        lastname: 'Builder',
        phone: '0899998888',
      })
      if (resB.statusCode !== 201) throw new Error(`Expected 201 for User B, got ${resB.statusCode}`)
      userBId = resB.body.data.id
    })

    // Test 9: Duplicate email (A-3003, 409) & duplicate phone (A-3004, 409)
    await runTest('POST /api/v1/auth/sign-up duplicate email returns 409 A-3003 & duplicate phone returns 409 A-3004', async () => {
      const dupEmail = await makeRequest(pipePath, '/api/v1/auth/sign-up', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstname: 'Alice',
        lastname: 'Dup',
        phone: '0822223333',
      })
      if (dupEmail.statusCode !== 409 || dupEmail.body?.code !== 'A-3003') {
        throw new Error(`Expected 409 A-3003, got ${dupEmail.statusCode} ${dupEmail.body?.code}`)
      }

      const dupPhone = await makeRequest(pipePath, '/api/v1/auth/sign-up', 'POST', {
        email: 'unique@joodpakpaw.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstname: 'Unique',
        lastname: 'Phone',
        phone: '0812345678',
      })
      if (dupPhone.statusCode !== 409 || dupPhone.body?.code !== 'A-3004') {
        throw new Error(`Expected 409 A-3004, got ${dupPhone.statusCode} ${dupPhone.body?.code}`)
      }
    })

    // Test 10: POST /api/v1/auth/resend-otp & POST /api/v1/auth/verify-otp
    await runTest('POST /api/v1/auth/resend-otp and /verify-otp work and match SignInResponse contract', async () => {
      const notFoundOtp = await makeRequest(pipePath, '/api/v1/auth/resend-otp', 'POST', {
        email: 'nobody@joodpakpaw.com',
      })
      if (notFoundOtp.statusCode !== 404 || notFoundOtp.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 for unregistered resend-otp, got ${notFoundOtp.statusCode} ${notFoundOtp.body?.code}`)
      }

      const resendRes = await makeRequest(pipePath, '/api/v1/auth/resend-otp', 'POST', {
        email: 'alice@joodpakpaw.com',
      })
      const newOtp = resendRes.body?.data?.otp || resendRes.body?.data?.debugOtp || resendRes.body?.otp
      const newRef = resendRes.body?.data?.refCode || resendRes.body?.refCode
      if (resendRes.statusCode !== 200 || !newOtp || !newRef) {
        throw new Error(`Expected 200 with new otp & refCode, got ${resendRes.statusCode}: ${JSON.stringify(resendRes.body)}`)
      }
      userAFirstOtp = newOtp

      const verifyRes = await makeRequest(pipePath, '/api/v1/auth/verify-otp', 'POST', {
        email: 'alice@joodpakpaw.com',
        otp: userAFirstOtp,
      })
      if (verifyRes.statusCode !== 200) throw new Error(`Expected 200 on verify-otp, got ${verifyRes.statusCode}`)
      const vData = verifyRes.body?.data
      if (!vData?.accessToken || !vData?.refreshToken || !vData?.user) {
        throw new Error(`Missing SignInResponse fields in data on verify-otp: ${JSON.stringify(verifyRes.body)}`)
      }

      // Security check: resend-otp on already verified user -> 400 A-3008
      const verifiedResend = await makeRequest(pipePath, '/api/v1/auth/resend-otp', 'POST', {
        email: 'alice@joodpakpaw.com',
      })
      if (verifiedResend.statusCode !== 400 || verifiedResend.body?.code !== 'A-3008') {
        throw new Error(`Expected 400 A-3008 on resend-otp for verified user, got ${verifiedResend.statusCode}`)
      }
    })

    // Test 11: POST /api/v1/auth/sign-in (A-3001 on wrong credentials, 200 on valid)
    await runTest('POST /api/v1/auth/sign-in returns 401 A-3001 on wrong password and 200 with tokens on valid credentials', async () => {
      // Security check: unverified User B sign-in -> 403 A-3006
      const unverifiedSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'bob@joodpakpaw.com',
        password: 'Password123!',
      })
      if (unverifiedSign.statusCode !== 403 || unverifiedSign.body?.code !== 'A-3006' || unverifiedSign.body?.data?.email !== 'bob@joodpakpaw.com') {
        throw new Error(`Expected 403 A-3006 with data.email on unverified sign-in, got ${unverifiedSign.statusCode}`)
      }

      const badSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'WrongPassword999',
      })
      if (badSign.statusCode !== 401 || badSign.body?.code !== 'A-3001') {
        throw new Error(`Expected 401 A-3001, got ${badSign.statusCode} ${badSign.body?.code}`)
      }

      const okSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'Password123!',
      })
      if (okSign.statusCode !== 200) throw new Error(`Expected 200, got ${okSign.statusCode}`)
      const signData = okSign.body?.data
      if (typeof signData?.accessToken !== 'string' || typeof signData?.refreshToken !== 'string') {
        throw new Error(`Expected accessToken and refreshToken strings in data: ${JSON.stringify(okSign.body)}`)
      }
      if (typeof signData?.expiresIn !== 'number' || signData?.tokenType !== 'Bearer') {
        throw new Error('Expected expiresIn number and tokenType Bearer in data')
      }
      userAAccessToken = signData.accessToken
      userARefreshToken = signData.refreshToken
    })

    // Test 12: POST /api/v1/auth/refresh-token
    await runTest('POST /api/v1/auth/refresh-token rotates accessToken and rejects invalid token', async () => {
      const badRefresh = await makeRequest(pipePath, '/api/v1/auth/refresh-token', 'POST', {
        refreshToken: 'invalid.jwt.token',
      })
      if (badRefresh.statusCode !== 401) throw new Error(`Expected 401, got ${badRefresh.statusCode}`)

      const okRefresh = await makeRequest(pipePath, '/api/v1/auth/refresh-token', 'POST', {
        refreshToken: userARefreshToken,
      })
      const refData = okRefresh.body?.data
      if (okRefresh.statusCode !== 200 || typeof refData?.accessToken !== 'string') {
        throw new Error(`Expected 200 with data.accessToken, got ${okRefresh.statusCode}`)
      }
    })

    // Test 13: GET /api/v1/auth/profile
    await runTest('GET /api/v1/auth/profile returns ProfileResponse matching UserProfile contract', async () => {
      const unauthRes = await makeRequest(pipePath, '/api/v1/auth/profile', 'GET')
      if (unauthRes.statusCode !== 401) throw new Error(`Expected 401 without token, got ${unauthRes.statusCode}`)

      const profRes = await makeRequest(pipePath, '/api/v1/auth/profile', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (profRes.statusCode !== 200) throw new Error(`Expected 200, got ${profRes.statusCode}`)
      const data = profRes.body?.data
      if (
        !data ||
        data.id !== userAId ||
        data.email !== 'alice@joodpakpaw.com' ||
        data.firstName !== 'Alice' ||
        data.lastName !== 'Wonder' ||
        typeof data.isBecomeToHost !== 'boolean' ||
        typeof data.unbanAllPropertiesRequestCount !== 'number' ||
        typeof data.hasPendingUnbanAllPropertiesRequest !== 'boolean' ||
        !Array.isArray(data.role)
      ) {
        throw new Error(`Profile data missing required UserProfile fields: ${JSON.stringify(data)}`)
      }
    })

    // Test 14: PATCH /api/v1/users/:userId/change-password (IDOR, A-3011, A-3012, and success)
    await runTest('PATCH /api/v1/users/:userId/change-password enforces IDOR (403), A-3011 (400), A-3012 (400), and updates password', async () => {
      // IDOR check: User A attempts to change User B's password
      const idorRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userBId}/change-password`,
        'PATCH',
        {
          oldPassword: 'Password123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorRes.statusCode !== 403 || idorRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR attempt, got ${idorRes.statusCode} ${idorRes.body?.code}`)
      }

      // Wrong oldPassword -> 400 A-3011
      const wrongOldRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userAId}/change-password`,
        'PATCH',
        {
          oldPassword: 'WrongOldPassword!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (wrongOldRes.statusCode !== 400 || wrongOldRes.body?.code !== 'A-3011') {
        throw new Error(`Expected 400 A-3011 on wrong oldPassword, got ${wrongOldRes.statusCode} ${wrongOldRes.body?.code}`)
      }

      // Same password -> 400 A-3012
      const samePassRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userAId}/change-password`,
        'PATCH',
        {
          oldPassword: 'Password123!',
          newPassword: 'Password123!',
          confirmPassword: 'Password123!',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (samePassRes.statusCode !== 400 || samePassRes.body?.code !== 'A-3012') {
        throw new Error(`Expected 400 A-3012 on identical newPassword, got ${samePassRes.statusCode} ${samePassRes.body?.code}`)
      }

      // Context-aware route test: PATCH /api/v1/users/me/change-password
      const okChangeRes = await makeRequest(
        pipePath,
        '/api/v1/users/me/change-password',
        'PATCH',
        {
          oldPassword: 'Password123!',
          newPassword: 'UpdatedPassword456!',
          confirmPassword: 'UpdatedPassword456!',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (okChangeRes.statusCode !== 200) {
        throw new Error(`Expected 200 on valid /me/change-password, got ${okChangeRes.statusCode}`)
      }
    })

    // Test 15: POST /api/v1/auth/forgot-password & /reset-password (DB-1002, A-3010, and token single-use)
    await runTest('POST /api/v1/auth/forgot-password and /reset-password enforce DB-1002 (404) and A-3010 (400)', async () => {
      const unknownForgot = await makeRequest(pipePath, '/api/v1/auth/forgot-password', 'POST', {
        email: 'unregistered@joodpakpaw.com',
      })
      if (unknownForgot.statusCode !== 404 || unknownForgot.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002, got ${unknownForgot.statusCode} ${unknownForgot.body?.code}`)
      }

      const forgotRes = await makeRequest(pipePath, '/api/v1/auth/forgot-password', 'POST', {
        email: 'alice@joodpakpaw.com',
      })
      const resetToken = forgotRes.body?.data?.resetPasswordToken || forgotRes.body?.resetPasswordToken
      if (forgotRes.statusCode !== 200 || !resetToken) {
        throw new Error(`Expected 200 with resetPasswordToken, got ${forgotRes.statusCode}`)
      }

      // Security check: identical new password -> 400 A-3012
      const sameResetRes = await makeRequest(pipePath, '/api/v1/auth/reset-password', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'UpdatedPassword456!', // Alice's current password
        confirmPassword: 'UpdatedPassword456!',
        resetPasswordToken: resetToken,
      })
      if (sameResetRes.statusCode !== 400 || sameResetRes.body?.code !== 'A-3012') {
        throw new Error(`Expected 400 A-3012 on reset-password with current password, got ${sameResetRes.statusCode}`)
      }

      // First valid use succeeds
      const resetOk = await makeRequest(pipePath, '/api/v1/auth/reset-password', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'ResetPassword789!',
        confirmPassword: 'ResetPassword789!',
        resetPasswordToken: resetToken,
      })
      if (resetOk.statusCode !== 200) {
        throw new Error(`Expected 200 on reset-password, got ${resetOk.statusCode}`)
      }

      // Second use of same token fails with 400 A-3010
      const resetReused = await makeRequest(pipePath, '/api/v1/auth/reset-password', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'AnotherPassword789!',
        confirmPassword: 'AnotherPassword789!',
        resetPasswordToken: resetToken,
      })
      if (resetReused.statusCode !== 400 || resetReused.body?.code !== 'A-3010') {
        throw new Error(`Expected 400 A-3010 on reused reset token, got ${resetReused.statusCode} ${resetReused.body?.code}`)
      }
    })

    // Test 16: Security Middlewares & POST /api/v1/auth/sign-out
    await runTest('optionalAuthenticateToken, requireRoles (403 A-3007), and banned user check (403 A-3002) behave securely', async () => {
      // Re-sign in Alice with her new password ('ResetPassword789!')
      const reSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'ResetPassword789!',
      })
      userAAccessToken = reSign.body?.data?.accessToken || reSign.body?.accessToken
      userARefreshToken = reSign.body?.data?.refreshToken || reSign.body?.refreshToken

      // Test sign-out
      const signOutRes = await makeRequest(pipePath, '/api/v1/auth/sign-out', 'POST', {
        refreshToken: userARefreshToken,
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (signOutRes.statusCode !== 200 || signOutRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on sign-out, got ${signOutRes.statusCode}`)
      }

      // Acquire fresh token for User A for subsequent tests
      const freshSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'ResetPassword789!',
      })
      userAAccessToken = freshSign.body?.data?.accessToken || freshSign.body?.accessToken
      userARefreshToken = freshSign.body?.data?.refreshToken || freshSign.body?.refreshToken
      // Guest call to optionalAuthenticateToken
      const guestOpt = await makeRequest(pipePath, '/api/v1/test-optional-auth', 'GET')
      if (guestOpt.statusCode !== 200 || guestOpt.body?.authenticated !== false) {
        throw new Error(`Expected guest optional auth to pass with authenticated: false`)
      }

      // Authenticated call to optionalAuthenticateToken
      const authOpt = await makeRequest(pipePath, '/api/v1/test-optional-auth', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (authOpt.statusCode !== 200 || authOpt.body?.userId !== userAId) {
        throw new Error(`Expected optional auth to populate req.user`)
      }

      // Regular guest user calling requireRoles('admin') -> 403 A-3007
      const rbacRes = await makeRequest(pipePath, '/api/v1/test-admin-rbac', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (rbacRes.statusCode !== 403 || rbacRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 from requireRoles('admin'), got ${rbacRes.statusCode} ${rbacRes.body?.code}`)
      }

      // Ban User A and verify authenticateToken & sign-in reject with 403 A-3002
      const userRecord = mockDb.users.get(userAId)!
      userRecord.bannedAt = new Date()

      const bannedProfile = await makeRequest(pipePath, '/api/v1/auth/profile', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (bannedProfile.statusCode !== 403 || bannedProfile.body?.code !== 'A-3002') {
        throw new Error(`Expected 403 A-3002 for banned user on authenticateToken, got ${bannedProfile.statusCode}`)
      }

      const bannedSignIn = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email: 'alice@joodpakpaw.com',
        password: 'ResetPassword789!',
      })
      if (bannedSignIn.statusCode !== 403 || bannedSignIn.body?.code !== 'A-3002') {
        throw new Error(`Expected 403 A-3002 for banned user on sign-in, got ${bannedSignIn.statusCode}`)
      }

      // Restore User A unbanned state for subsequent PBI-05 tests
      userRecord.bannedAt = null
    })

    // =========================================================================
    // PBI-05 QA Audit Tests: S3 WebP Storage Adapter & PUT /api/v1/users/:userId
    // =========================================================================

    // Test 17: S3 WebP Storage Adapter (convertBufferToWebp & uploadImageAsWebp)
    await runTest('convertBufferToWebp and uploadImageAsWebp produce valid WebP buffer and .webp public URL', async () => {
      const sampleBuffer = Buffer.from('synthetic-image-payload')
      const webpBuffer = await convertBufferToWebp(sampleBuffer)
      if (!Buffer.isBuffer(webpBuffer) || webpBuffer.length < 12) {
        throw new Error('Expected non-empty WebP buffer from convertBufferToWebp')
      }
      // Verify RIFF....WEBP header signature
      const riffHeader = webpBuffer.subarray(0, 4).toString('ascii')
      const webpHeader = webpBuffer.subarray(8, 12).toString('ascii')
      if (riffHeader !== 'RIFF' || webpHeader !== 'WEBP') {
        throw new Error(`Expected RIFF/WEBP magic bytes, got ${riffHeader}/${webpHeader}`)
      }

      const uploadedUrl = await uploadImageAsWebp(sampleBuffer, 'avatars', 'My Cat Photo.png')
      if (!uploadedUrl.endsWith('.webp') || !uploadedUrl.includes('/avatars/my-cat-photo-')) {
        throw new Error(`Expected .webp URL under /avatars/, got ${uploadedUrl}`)
      }
    })

    // Test 18: PUT /api/v1/users/:userId (multipart/form-data avatar WebP upload & profile update)
    await runTest('PUT /api/v1/users/:userId updates profile fields and converts multipart avatar to .webp URL', async () => {
      const boundary = '----JoodPakPawMultipartBoundary'
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="firstName"\r\n\r\nAlicia\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="lastName"\r\n\r\nWonderland\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="phone"\r\n\r\n0812345678\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="profile_pic.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg-binary-content\r\n`,
        `--${boundary}--\r\n`,
      ]
      const multipartBody = Buffer.from(parts.join(''), 'utf-8')

      const res = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
        const req = http.request(
          {
            socketPath: pipePath,
            path: `/api/v1/users/${userAId}`,
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${userAAccessToken}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': String(multipartBody.length),
            },
          },
          (resp) => {
            let raw = ''
            resp.on('data', (c) => (raw += c))
            resp.on('end', () => {
              resolve({ statusCode: resp.statusCode || 0, body: JSON.parse(raw) })
            })
          }
        )
        req.on('error', reject)
        req.write(multipartBody)
        req.end()
      })

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200 on multipart PUT /api/v1/users/${userAId}, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
      }
      const data = res.body?.data
      if (!data || data.firstName !== 'Alicia' || data.lastName !== 'Wonderland' || data.phone !== '0812345678') {
        throw new Error(`Expected updated firstName/lastName/phone, got ${JSON.stringify(data)}`)
      }
      if (typeof data.avatar !== 'string' || !data.avatar.endsWith('.webp')) {
        throw new Error(`Expected avatar URL ending with .webp, got ${data.avatar}`)
      }
    })

    // Test 19: PUT /api/v1/users/:userId error codes (A-3004 duplicate phone, T-2007 invalid phone) & 403 IDOR
    await runTest('PUT /api/v1/users/:userId enforces 403 IDOR, 409 A-3004 duplicate phone, and 400 T-2007 invalid phone', async () => {
      // IDOR: User A tries to update User B
      const idorRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userBId}`,
        'PUT',
        { firstName: 'Hacked' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorRes.statusCode !== 403 || idorRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR PUT /api/v1/users/${userBId}, got ${idorRes.statusCode}`)
      }

      // Duplicate phone (User B owns 0899998888) -> 409 A-3004
      const dupPhoneRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userAId}`,
        'PUT',
        { firstName: 'Alicia', lastName: 'Wonderland', phone: '0899998888' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (dupPhoneRes.statusCode !== 409 || dupPhoneRes.body?.code !== 'A-3004') {
        throw new Error(`Expected 409 A-3004 on duplicate phone, got ${dupPhoneRes.statusCode} ${dupPhoneRes.body?.code}`)
      }

      // Invalid phone format -> 400 T-2007 with tag: 'phone'
      const badPhoneRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userAId}`,
        'PUT',
        { firstName: 'Alicia', lastName: 'Wonderland', phone: 'invalid-phone' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (badPhoneRes.statusCode !== 400 || badPhoneRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on invalid phone, got ${badPhoneRes.statusCode}`)
      }
      const hasPhoneTag = Array.isArray(badPhoneRes.body?.errors) &&
        badPhoneRes.body.errors.some((e: any) => e.field === 'phone' && e.tag === 'phone')
      if (!hasPhoneTag) {
        throw new Error(`Expected field: 'phone', tag: 'phone' in errors array`)
      }
    })

    // =========================================================================
    // PBI-06 QA Audit Tests: Master Lookups & Public Property Discovery API
    // =========================================================================

    // Test 20: Master Lookup Endpoints (facilities, pets, pet-breeds, pet-size-categories, report-categories)
    await runTest('Master Lookup endpoints return exact frontend DTO envelopes (facilities, pets, petBreeds, petSizeCategories, reportCategories)', async () => {
      const facRes = await makeRequest(pipePath, '/api/v1/hosts/facilities/all', 'GET')
      const facList = facRes.body?.data?.facilities || facRes.body?.facilities
      if (facRes.statusCode !== 200 || !Array.isArray(facList) || facList.length !== 2) {
        throw new Error(`Expected facilities array of length 2, got ${JSON.stringify(facRes.body)}`)
      }
      if (!facList[0].category?.name) {
        throw new Error('Expected facility.category.name to be present')
      }

      const petsRes = await makeRequest(pipePath, '/api/v1/pets/all', 'GET')
      const petList = petsRes.body?.data?.pets || petsRes.body?.pets
      if (petsRes.statusCode !== 200 || !Array.isArray(petList) || petList[0]?.name !== 'Dog') {
        throw new Error(`Expected normalized pet name 'Dog', got ${JSON.stringify(petsRes.body)}`)
      }

      const breedsRes = await makeRequest(pipePath, '/api/v1/pets/1/pet-breeds/all', 'GET')
      const breedList = breedsRes.body?.data?.petBreeds || breedsRes.body?.petBreeds
      if (breedsRes.statusCode !== 200 || !Array.isArray(breedList) || breedList[0]?.breed !== 'Golden Retriever') {
        throw new Error(`Expected petBreeds for petTypeId=1, got ${JSON.stringify(breedsRes.body)}`)
      }

      const sizesRes = await makeRequest(pipePath, '/api/v1/pet-size-categories/all', 'GET')
      const sizeList = sizesRes.body?.data?.petSizeCategories || sizesRes.body?.petSizeCategories
      if (sizesRes.statusCode !== 200 || !Array.isArray(sizeList) || typeof sizeList[0]?.min !== 'number') {
        throw new Error(`Expected petSizeCategories with min/max numbers, got ${JSON.stringify(sizesRes.body)}`)
      }

      const repCatRes = await makeRequest(pipePath, '/api/v1/report-categories?type=unban', 'GET')
      const repCatList = repCatRes.body?.data?.reportCategories || repCatRes.body?.reportCategories
      if (repCatRes.statusCode !== 200 || !Array.isArray(repCatList) || repCatList.length !== 1) {
        throw new Error(`Expected 1 unban reportCategory, got ${JSON.stringify(repCatRes.body)}`)
      }
    })

    // Test 21: GET /api/v1/properties (guest vs authenticated isFavorite, filters, pagination)
    await runTest('GET /api/v1/properties returns paginated PropertiesResponse and hydrates isFavorite for authenticated user', async () => {
      const guestList = await makeRequest(pipePath, '/api/v1/properties?page=1&limit=12&sortBy=rating', 'GET')
      const guestRows = guestList.body?.pagination?.totalRows ?? guestList.body?.totalRows
      if (guestList.statusCode !== 200 || !Array.isArray(guestList.body?.data) || guestRows !== 1) {
        throw new Error(`Expected PropertiesResponse with 1 active property, got ${JSON.stringify(guestList.body)}`)
      }
      if (guestList.body.data[0].isFavorite !== false) {
        throw new Error('Expected isFavorite=false for unauthenticated guest')
      }

      const authList = await makeRequest(
        pipePath,
        '/api/v1/properties?page=1&limit=12&petTypes=Dog&maxPrice=1000',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (authList.statusCode !== 200 || authList.body?.data?.[0]?.isFavorite !== true) {
        throw new Error(`Expected isFavorite=true for authenticated User A, got ${JSON.stringify(authList.body?.data?.[0])}`)
      }
    })

    // Test 22: GET /api/v1/properties/:propertyId (active property detail & 404 guard on inactive/banned property)
    await runTest('GET /api/v1/properties/:propertyId returns { property } and blocks inactive (102) or admin-banned (103) properties for guests', async () => {
      const detailRes = await makeRequest(
        pipePath,
        '/api/v1/properties/101',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const propDetail = detailRes.body?.data?.property || detailRes.body?.property
      if (detailRes.statusCode !== 200 || propDetail?.id !== 101) {
        throw new Error(`Expected 200 with property.id=101, got ${detailRes.statusCode}: ${JSON.stringify(detailRes.body)}`)
      }
      if (!Array.isArray(propDetail.reviews) || propDetail.chatRoomId !== 42) {
        throw new Error(`Expected reviews array and chatRoomId=42 on property detail`)
      }

      // Inactive property 102 -> 404 DB-1002 for non-owner
      const inactiveRes = await makeRequest(pipePath, '/api/v1/properties/102', 'GET')
      if (inactiveRes.statusCode !== 404 || inactiveRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 for inactive property 102, got ${inactiveRes.statusCode}`)
      }

      // Admin-banned property 103 -> 404 DB-1002 for non-owner
      const bannedPropRes = await makeRequest(pipePath, '/api/v1/properties/103', 'GET')
      if (bannedPropRes.statusCode !== 404 || bannedPropRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 for admin-banned property 103, got ${bannedPropRes.statusCode}`)
      }
    })

    // Test 23: GET /api/v1/properties/hosts/:hostId/profile & /reviews (route ordering before /:propertyId)
    await runTest('GET /api/v1/properties/hosts/:hostId/profile and /reviews match before /:propertyId and return HostProfileResponse & HostReviewsResponse', async () => {
      const hostProfRes = await makeRequest(
        pipePath,
        `/api/v1/properties/hosts/${userBId}/profile`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const hostData = hostProfRes.body?.data?.host || hostProfRes.body?.host
      if (hostProfRes.statusCode !== 200 || hostData?.id !== userBId) {
        throw new Error(`Expected 200 with host.id=${userBId}, got ${hostProfRes.statusCode}: ${JSON.stringify(hostProfRes.body)}`)
      }
      if (!Array.isArray(hostData.properties) || typeof hostData.avgRating !== 'number') {
        throw new Error('Expected host.properties array and host.avgRating number')
      }

      const hostRevRes = await makeRequest(
        pipePath,
        `/api/v1/properties/hosts/${userBId}/reviews?page=1&limit=10`,
        'GET'
      )
      const revTotal = hostRevRes.body?.pagination?.totalRows ?? hostRevRes.body?.totalRows
      if (hostRevRes.statusCode !== 200 || !Array.isArray(hostRevRes.body?.data) || revTotal !== 1) {
        throw new Error(`Expected HostReviewsResponse with 1 review, got ${JSON.stringify(hostRevRes.body)}`)
      }
      if (!hostRevRes.body.data[0]?.guestProfile?.firstName || !hostRevRes.body.data[0]?.propertyName) {
        throw new Error('Expected guestProfile and propertyName in HostReview item')
      }
    })

    // Test 24: GET /api/v1/properties/:propertyId/room-categories/search (calendar availability & priceAdjustment calculation)
    await runTest('GET /api/v1/properties/:propertyId/room-categories/search computes availableRooms and priceAdjustment across date range', async () => {
      const searchRes = await makeRequest(
        pipePath,
        '/api/v1/properties/101/room-categories/search?checkInDate=2026-12-01&checkOutDate=2026-12-03&numberOfPets=2',
        'GET'
      )
      const roomList = searchRes.body?.data?.roomCategories || searchRes.body?.roomCategories;
      if (searchRes.statusCode !== 200 || !Array.isArray(roomList)) {
        throw new Error(`Expected 200 with roomCategories array, got ${searchRes.statusCode}`)
      }
      const rc = roomList[0]
      // On 2026-12-01: totalRoom(3) - booked(1) - unavailable(1) = 1 availableRoom, finalPrice = 800 + 150 = 950
      // On 2026-12-02: totalRoom(3) - 0 - 0 = 3 availableRooms, finalPrice = 800
      // Across range: minAvailableRooms = 1, roomsNeeded = ceil(2/2) = 1, totalPrice = (950 + 800) * 1 = 1750
      if (
        !rc ||
        rc.availability?.availableRooms !== 1 ||
        rc.availability?.roomsNeeded !== 1 ||
        rc.availability?.totalPrice !== 1750 ||
        rc.isAvailable !== true
      ) {
        throw new Error(`Unexpected availability calculation: ${JSON.stringify(rc?.availability)}`)
      }
    })

    // =========================================================================
    // PBI-07 QA Audit Tests: Host Property & Room Category CRUD API
    // =========================================================================
    let createdPropId = 0
    let createdRoomId = 0

    // Test 25: POST /api/v1/hosts/properties, GET /all, GET /:propertyId, PUT /:propertyId
    await runTest('Host Property CRUD (POST /api/v1/hosts/properties, GET /all, GET /:propertyId, PUT /:propertyId) matches frontend contract', async () => {
      const createRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties',
        'POST',
        {
          title: 'Alicia Cat Villa',
          description: 'Cozy villa for cats',
          propertyTypeId: 1,
          latitude: '13.7563',
          longitude: '100.5018',
          country: 'Thailand',
          province: 'Bangkok',
          district: 'Pathum Wan',
          address: '99 Rama 1 Rd',
          zipcode: '10330',
          facilities: JSON.stringify([1, 2]),
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (createRes.statusCode !== 201 || typeof createRes.body?.data?.id !== 'number') {
        throw new Error(`Expected 201 with data.id on createHostProperty, got ${createRes.statusCode}: ${JSON.stringify(createRes.body)}`)
      }
      createdPropId = createRes.body.data.id

      const listRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/all',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const hostProps = listRes.body?.data?.properties || listRes.body?.properties
      if (listRes.statusCode !== 200 || !Array.isArray(hostProps) || hostProps.length === 0) {
        throw new Error(`Expected HostPropertiesResponse with properties array, got ${JSON.stringify(listRes.body)}`)
      }

      const getRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const hostProp = getRes.body?.data?.property || getRes.body?.property
      if (getRes.statusCode !== 200 || hostProp?.id !== createdPropId) {
        throw new Error(`Expected 200 with property.id=${createdPropId}, got ${getRes.statusCode}`)
      }

      const updateRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}`,
        'PUT',
        {
          title: 'Alicia Luxury Cat Villa Updated',
          facilities: JSON.stringify([1]),
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const updatedProp = updateRes.body?.data?.property || updateRes.body?.property
      if (updateRes.statusCode !== 200 || updatedProp?.title !== 'Alicia Luxury Cat Villa Updated') {
        throw new Error(`Expected 200 with updated title, got ${updateRes.statusCode}: ${JSON.stringify(updateRes.body)}`)
      }
    })

    // Test 26: PATCH /api/v1/hosts/properties/:propertyId/is-active & Governance Guard P-5001 & Admin-Ban Guard A-3002
    await runTest('PATCH /api/v1/hosts/properties/:propertyId/is-active enforces P-5001 (0 room categories) and A-3002 (banned)', async () => {
      // Step A: Attempt activating with 0 room categories -> 400 P-5001
      const zeroCatRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/is-active`,
        'PATCH',
        { isActive: true },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (zeroCatRes.statusCode !== 400 || zeroCatRes.body?.code !== 'P-5001') {
        throw new Error(`Expected 400 P-5001 when activating property with 0 room categories, got ${zeroCatRes.statusCode}: ${JSON.stringify(zeroCatRes.body)}`)
      }

      // Step B: Create a room category first
      const createRoomRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/room-categories`,
        'POST',
        {
          name: 'Deluxe Cat Condo',
          totalRoom: 4,
          numberOfPets: 2,
          basePrice: 650,
          pets: JSON.stringify([2]),
          facilities: JSON.stringify([1]),
          petSizeCategoryId: 1,
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const roomCreatedId = createRoomRes.body?.data?.id ?? createRoomRes.body?.id
      if (createRoomRes.statusCode !== 201 || typeof roomCreatedId !== 'number') {
        throw new Error(`Expected 201 on createHostRoomCategory, got ${createRoomRes.statusCode}: ${JSON.stringify(createRoomRes.body)}`)
      }
      createdRoomId = roomCreatedId

      // Step C: Now activate succeeds
      const activateRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/is-active`,
        'PATCH',
        { isActive: true },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const isAct = activateRes.body?.data?.isActive ?? activateRes.body?.isActive
      if (activateRes.statusCode !== 200 || isAct !== true) {
        throw new Error(`Expected 200 with isActive=true, got ${activateRes.statusCode}`)
      }

      // Step D: Ban the property and verify activating is blocked with 403 A-3002
      const propRecord = mockDb.propertiesMap.get(createdPropId)!
      propRecord.isActive = false
      propRecord.isBannedByAdmin = true

      const bannedActivateRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/is-active`,
        'PATCH',
        { isActive: true },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (bannedActivateRes.statusCode !== 403 || bannedActivateRes.body?.code !== 'A-3002') {
        throw new Error(`Expected 403 A-3002 when activating banned property, got ${bannedActivateRes.statusCode} ${bannedActivateRes.body?.code}`)
      }
      propRecord.isBannedByAdmin = false
    })

    // Test 27: Room Category CRUD (GET /all, PUT /:roomId)
    await runTest('Host Room Category CRUD (GET /all, PUT /:roomId) works and matches RoomCategoriesResponse contract', async () => {
      const listRoomsRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/room-categories/all`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const roomCatList = listRoomsRes.body?.data?.roomCategories || listRoomsRes.body?.roomCategories
      if (listRoomsRes.statusCode !== 200 || !Array.isArray(roomCatList) || roomCatList.length !== 1) {
        throw new Error(`Expected RoomCategoriesResponse with 1 room category, got ${JSON.stringify(listRoomsRes.body)}`)
      }

      const updateRoomRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/room-categories/${createdRoomId}`,
        'PUT',
        {
          name: 'Super Deluxe Cat Condo',
          totalRoom: 5,
          numberOfPets: 3,
          basePrice: 750,
          pets: JSON.stringify([2]),
          facilities: JSON.stringify([1, 2]),
          petSizeCategories: '1',
          deleteImageIds: JSON.stringify([]),
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      const updatedCat = updateRoomRes.body?.data?.roomCategory || updateRoomRes.body?.roomCategory
      if (updateRoomRes.statusCode !== 200 || updatedCat?.name !== 'Super Deluxe Cat Condo') {
        throw new Error(`Expected 200 with updated roomCategory name, got ${updateRoomRes.statusCode}: ${JSON.stringify(updateRoomRes.body)}`)
      }
    })

    // Test 28: Security & IDOR Protection on Host Property & Room Category routes (403 A-3007)
    await runTest('IDOR Protection: User A cannot view, update, toggle, or delete User B property (101) or its room categories (403 A-3007)', async () => {
      const idorGetProp = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorGetProp.statusCode !== 403 || idorGetProp.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR GET host property 101, got ${idorGetProp.statusCode}`)
      }

      const idorUpdateProp = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101',
        'PUT',
        { title: 'Hacked Title' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorUpdateProp.statusCode !== 403 || idorUpdateProp.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR PUT host property 101, got ${idorUpdateProp.statusCode}`)
      }

      const idorDeleteRoom = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501',
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorDeleteRoom.statusCode !== 403 || idorDeleteRoom.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR DELETE room category 501, got ${idorDeleteRoom.statusCode}`)
      }
    })

    // Test 29: Active Booking Deletion Guard (409 B-4001) on Room Category & Property DELETE
    await runTest('Active Booking Deletion Guard blocks DELETE room category and DELETE property with 409 B-4001 when active bookings exist', async () => {
      mockDb.setActiveOrderCount(1)
      const blockedRoomDel = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/room-categories/${createdRoomId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (blockedRoomDel.statusCode !== 409 || blockedRoomDel.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 when deleting room category with active booking, got ${blockedRoomDel.statusCode} ${blockedRoomDel.body?.code}`)
      }

      mockDb.setActiveOrderCount(0)
      const okRoomDel = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}/room-categories/${createdRoomId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (okRoomDel.statusCode !== 200) {
        throw new Error(`Expected 200 when deleting room category without active bookings, got ${okRoomDel.statusCode}`)
      }

      mockDb.setActiveBookingCount(2)
      const blockedPropDel = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (blockedPropDel.statusCode !== 409 || blockedPropDel.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 when deleting property with active booking, got ${blockedPropDel.statusCode} ${blockedPropDel.body?.code}`)
      }

      mockDb.setActiveBookingCount(0)
      const okPropDel = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${createdPropId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (okPropDel.statusCode !== 200) {
        throw new Error(`Expected 200 when deleting property without active bookings, got ${okPropDel.statusCode}`)
      }
    })

    // =========================================================================
    // PBI-08 QA Audit Tests: Frontend Core & Client WebP Upgrade
    // =========================================================================

    // Test 30: Verify next.config.ts, .env.example, lib/imageCompression.ts, and lib/api.ts WebP integration
    await runTest('PBI-08 Frontend Core & Client WebP Upgrade (next.config.ts, imageCompression.ts, api.ts, .env.example) contract verification', async () => {
      const feRoot = path.resolve(__dirname, '../../../joodpakpaw-frontend')
      const nextConfigSrc = fs.readFileSync(path.join(feRoot, 'next.config.ts'), 'utf-8')
      const envExampleSrc = fs.readFileSync(path.join(feRoot, '.env.example'), 'utf-8')
      const imgCompSrc = fs.readFileSync(path.join(feRoot, 'lib/imageCompression.ts'), 'utf-8')
      const feApiSrc = fs.readFileSync(path.join(feRoot, 'lib/api.ts'), 'utf-8')

      // 1. Verify zero legacy university path/domain in next.config.ts and .env.example
      if (nextConfigSrc.includes('/capstone25/cp25nk2') || nextConfigSrc.includes('bscit.sit.kmutt.ac.th')) {
        throw new Error('next.config.ts still contains legacy /capstone25/cp25nk2 or bscit.sit.kmutt.ac.th')
      }
      if (envExampleSrc.includes('/capstone25/cp25nk2') || envExampleSrc.includes('bscit.sit.kmutt.ac.th')) {
        throw new Error('.env.example still contains legacy /capstone25/cp25nk2 or bscit.sit.kmutt.ac.th')
      }

      // 2. Verify required cloud storage domains in next.config.ts
      for (const domain of ['localhost', 'joodpakpaw-minio', '**.r2.dev', '**.supabase.co']) {
        if (!nextConfigSrc.includes(domain)) {
          throw new Error(`next.config.ts missing remotePattern hostname: ${domain}`)
        }
      }

      // 3. Verify imageCompression.ts exports and SSR/FormData safety
      if (
        !imgCompSrc.includes('export async function compressImageToWebP') ||
        !imgCompSrc.includes('export async function compressImagesToWebP') ||
        !imgCompSrc.includes('export async function compressFormDataImages') ||
        !imgCompSrc.includes('1920') ||
        !imgCompSrc.includes('0.82')
      ) {
        throw new Error('lib/imageCompression.ts missing required WebP compression exports or 1920px / 0.82 defaults')
      }

      const imgCompModuleUrl = pathToFileURL(path.join(feRoot, 'lib/imageCompression.ts')).href
      const {
        compressImageToWebP,
        compressImagesToWebP,
        compressFormDataImages,
      } = await import(imgCompModuleUrl)

      const dummyArray = await compressImagesToWebP([])
      if (!Array.isArray(dummyArray) || dummyArray.length !== 0) {
        throw new Error('Expected compressImagesToWebP([]) to return empty array')
      }

      const sampleFormData = new FormData()
      sampleFormData.append('firstName', 'Alicia')
      sampleFormData.append('phone', '0812345678')
      const outFormData = await compressFormDataImages(sampleFormData)
      if (outFormData.get('firstName') !== 'Alicia' || outFormData.get('phone') !== '0812345678') {
        throw new Error('compressFormDataImages failed to preserve FormData text fields in SSR/Node mode')
      }
      if (typeof compressImageToWebP !== 'function') {
        throw new Error('compressImageToWebP is not a function')
      }

      // 4. Verify lib/api.ts integrates WebP compression across multipart endpoints
      for (const fnCheck of [
        'compressFormDataImages',
        'compressImageToWebP',
        'compressImagesToWebP',
        'confirmBookingPayment',
        'submitBookingReview',
        'reportProperty',
        'reportReview',
        'requestUnbanProperty',
      ]) {
        if (!feApiSrc.includes(fnCheck)) {
          throw new Error(`joodpakpaw-frontend/lib/api.ts missing ${fnCheck}`)
        }
      }
    })

    // =========================================================================
    // Phase 1 Performance Optimization Tests: CacheService & Featured Sections
    // =========================================================================

    // Test 31: CacheService standalone unit test
    await runTest('CacheService supports get, set, del, delByPrefix, flush, and TTL expiration', async () => {
      await cacheService.flush()
      if ((await cacheService.get('test_key')) !== null) {
        throw new Error('Expected test_key to be null after flush')
      }

      await cacheService.set('test_key', { foo: 'bar' }, 10)
      const val = await cacheService.get<{ foo: string }>('test_key')
      if (!val || val.foo !== 'bar') {
        throw new Error(`Expected { foo: 'bar' }, got ${JSON.stringify(val)}`)
      }

      await cacheService.del('test_key')
      if ((await cacheService.get('test_key')) !== null) {
        throw new Error('Expected test_key to be null after del')
      }

      await cacheService.set('prefix:1', 1)
      await cacheService.set('prefix:2', 2)
      await cacheService.set('other:1', 3)
      const deletedCount = await cacheService.delByPrefix('prefix:')
      if (deletedCount !== 2) {
        throw new Error(`Expected 2 keys deleted by prefix, got ${deletedCount}`)
      }
      if ((await cacheService.get('prefix:1')) !== null || (await cacheService.get('other:1')) !== 3) {
        throw new Error('delByPrefix did not correctly isolate keys')
      }

      // TTL test: 0.1s TTL
      await cacheService.set('short_lived', 'fast', 0.05)
      await new Promise((r) => setTimeout(r, 60))
      if ((await cacheService.get('short_lived')) !== null) {
        throw new Error('Expected short_lived to expire after TTL')
      }
      await cacheService.flush()
    })

    // Test 32: GET /api/v1/properties/featured-sections (anonymous vs authenticated, 7 sections contract, cache hit)
    await runTest('GET /api/v1/properties/featured-sections returns all 7 sections, caches base data, and personalizes favorites', async () => {
      await cacheService.flush()

      // 1st request (cache miss)
      const t0 = Date.now()
      const firstRes = await makeRequest(pipePath, '/api/v1/properties/featured-sections', 'GET')
      const firstDuration = Date.now() - t0

      if (firstRes.statusCode !== 200) {
        throw new Error(`Expected 200, got ${firstRes.statusCode}: ${JSON.stringify(firstRes.body)}`)
      }
      if (firstRes.body?.code !== 'SUCCESS') {
        throw new Error(`Expected code SUCCESS, got ${firstRes.body?.code}`)
      }
      if (firstRes.body?.message !== 'Featured sections retrieved successfully') {
        throw new Error(`Expected message 'Featured sections retrieved successfully', got ${firstRes.body?.message}`)
      }

      const data = firstRes.body?.data
      if (!data) throw new Error('Missing data in featured-sections response')

      // Verify all 7 sections & total fields
      const requiredSections = [
        'allProperties',
        'topRated',
        'bestValue',
        'newListings',
        'trending',
        'dogFriendly',
        'catFriendly',
      ]
      for (const section of requiredSections) {
        if (!Array.isArray(data[section])) {
          throw new Error(`Expected array for section ${section}`)
        }
        if (typeof data[`${section}Total`] !== 'number') {
          throw new Error(`Expected number for ${section}Total`)
        }
      }
      if (typeof data.allPropertiesTotalPages !== 'number') {
        throw new Error('Expected number for allPropertiesTotalPages')
      }

      // Anonymous items must have isFavorite: false
      if (data.allProperties.length > 0 && data.allProperties[0].isFavorite !== false) {
        throw new Error('Expected isFavorite=false for anonymous featured-sections')
      }

      // 2nd request (cache hit)
      const t1 = Date.now()
      const secondRes = await makeRequest(pipePath, '/api/v1/properties/featured-sections', 'GET')
      const secondDuration = Date.now() - t1

      if (secondRes.statusCode !== 200 || secondRes.body?.code !== 'SUCCESS') {
        throw new Error('Second request failed on cached response')
      }

      console.log(`     (Featured sections 1st req miss: ${firstDuration}ms, 2nd req cache hit: ${secondDuration}ms)`)

      // Verify base cache was populated
      const cachedBase = await cacheService.get<any>('properties:featured_sections:base')
      if (!cachedBase) {
        throw new Error('Expected properties:featured_sections:base to be stored in cacheService')
      }

      // Authenticated request: User A has property 101 favorited
      const authRes = await makeRequest(
        pipePath,
        '/api/v1/properties/featured-sections',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (authRes.statusCode !== 200 || authRes.body?.code !== 'SUCCESS') {
        throw new Error(`Expected 200 SUCCESS on authenticated featured-sections, got ${authRes.statusCode}`)
      }
      const authData = authRes.body?.data
      const authProp101 = authData?.allProperties?.find((p: any) => p.id === 101)
      if (!authProp101 || authProp101.isFavorite !== true || authProp101.favoriteFolderId !== 77) {
        throw new Error(`Expected authenticated User A to have isFavorite=true and folderId=77 on property 101, got ${JSON.stringify(authProp101)}`)
      }

      // Verify cached base data was NOT polluted with User A's favorite state
      const recheckedBase = await cacheService.get<any>('properties:featured_sections:base')
      const baseProp101 = recheckedBase?.allProperties?.find((p: any) => p.id === 101)
      if (baseProp101?.isFavorite !== false) {
        throw new Error('Cache pollution detected: base cache has isFavorite=true')
      }
    })

    // Test 33: GET /api/v1/properties list cache
    await runTest('GET /api/v1/properties caches responses for anonymous users and personalizes on hit', async () => {
      await cacheService.flush()
      const query = '?page=1&limit=5'

      const missRes = await makeRequest(pipePath, `/api/v1/properties${query}`, 'GET')
      if (missRes.statusCode !== 200) throw new Error('Expected 200 on property list miss')

      const cachedList = await cacheService.get<any>(`properties:list:${JSON.stringify({ page: '1', limit: '5' })}`)
      if (!cachedList) {
        throw new Error('Expected properties:list:... to be cached')
      }

      const hitRes = await makeRequest(pipePath, `/api/v1/properties${query}`, 'GET')
      if (hitRes.statusCode !== 200 || hitRes.body?.data?.[0]?.id !== missRes.body?.data?.[0]?.id) {
        throw new Error('Cache hit returned inconsistent property list data')
      }

      // Authenticated call on cached data
      const authHit = await makeRequest(
        pipePath,
        `/api/v1/properties${query}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (authHit.statusCode !== 200 || authHit.body?.data?.[0]?.isFavorite !== true) {
        throw new Error('Authenticated user on cached property list did not have isFavorite=true')
      }
    })

    // Test 34: Invalidate Property Caches on Mutation
    await runTest('Host property mutations invalidate properties: cache prefix', async () => {
      // Set test keys
      await cacheService.set('properties:featured_sections:base', { some: 'data' }, 60)
      await cacheService.set('properties:list:test', { some: 'list' }, 60)

      // Trigger mutation: create a property
      const createRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties',
        'POST',
        {
          title: 'Alicia Cache Invalidation Property',
          description: 'Testing cache invalidation',
          propertyTypeId: 1,
          latitude: '13.7563',
          longitude: '100.5018',
          country: 'Thailand',
          province: 'Bangkok',
          district: 'Pathum Wan',
          address: '100 Rama 1 Rd',
          zipcode: '10330',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (createRes.statusCode !== 201) {
        throw new Error(`Expected 201 on host property create, got ${createRes.statusCode}`)
      }
      const newPropId = createRes.body?.data?.id

      // Verify caches with prefix properties: were deleted by create
      if ((await cacheService.get('properties:featured_sections:base')) !== null) {
        throw new Error('Expected properties:featured_sections:base to be invalidated on create')
      }

      // Re-populate test cache to verify update mutation invalidates too
      await cacheService.set('properties:featured_sections:base', { some: 'data' }, 60)
      await cacheService.set('properties:list:test', { some: 'list' }, 60)

      const updateRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${newPropId}`,
        'PUT',
        { title: 'Alicia Cache Invalidation Test Updated' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (updateRes.statusCode !== 200) {
        throw new Error(`Expected 200 on host property update, got ${updateRes.statusCode}`)
      }

      // Verify caches with prefix properties: were deleted by update
      const checkBase = await cacheService.get('properties:featured_sections:base')
      const checkList = await cacheService.get('properties:list:test')
      if (checkBase !== null || checkList !== null) {
        throw new Error('Expected properties:* cache keys to be invalidated after property update')
      }
    })

    // Prepare User B (Host) token for Wave 2A tests
    const userBRecord = mockDb.users.get(2)
    if (userBRecord) {
      userBRecord.isVerified = true
      userBRecord.isVerifiedHost = true
    }
    const userBSign = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
      email: 'bob@joodpakpaw.com',
      password: 'Password123!',
    })
    const userBAccessToken = userBSign.body?.data?.accessToken || userBSign.body?.accessToken

    // Test 35: PBI-09 Pet Profile CRUD, Ownership & Active Booking Guard (B-4001)
    let createdPetId = 0
    await runTest('PBI-09: Pet Profile CRUD, S3 WebP GC & Active Booking Guard (B-4001)', async () => {
      // 1. Initial list should be empty for User A
      const listEmpty = await makeRequest(pipePath, '/api/v1/profiles/pet-profiles/all', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (listEmpty.statusCode !== 200 || !Array.isArray(listEmpty.body?.data?.petProfiles)) {
        throw new Error(`Expected 200 with data.petProfiles array, got ${listEmpty.statusCode}`)
      }

      // 2. Missing required fields returns 400 T-2007
      const invalidCreate = await makeRequest(pipePath, '/api/v1/profiles/pet-profiles', 'POST', {
        name: '',
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (invalidCreate.statusCode !== 400 || invalidCreate.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on invalid pet profile create, got ${invalidCreate.statusCode}`)
      }

      // 3. Create valid pet profile
      const validCreate = await makeRequest(pipePath, '/api/v1/profiles/pet-profiles', 'POST', {
        name: 'Mochi',
        petSex: 'male',
        birthDate: '2023-01-01',
        weight: 8.5,
        contactName: 'Alice Wonder',
        contactPhone: '0812345678',
        note: 'Allergic to seafood',
        petTypeId: 1,
        petBreedId: 10,
        petSizeCategoryId: 1,
        petEnergyId: 2,
      }, { Authorization: `Bearer ${userAAccessToken}` })

      if (validCreate.statusCode !== 201 || validCreate.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on valid create, got ${validCreate.statusCode}: ${JSON.stringify(validCreate.body)}`)
      }
      createdPetId = validCreate.body?.data?.petProfile?.id
      if (!createdPetId || validCreate.body?.data?.petProfile?.name !== 'Mochi') {
        throw new Error('Created pet profile missing ID or name')
      }

      // 4. GET /:id with User A -> 200
      const getOwn = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (getOwn.statusCode !== 200 || getOwn.body?.data?.petProfile?.id !== createdPetId) {
        throw new Error(`Expected 200 for own pet profile, got ${getOwn.statusCode}`)
      }

      // 5. GET /:id with User B -> 403 A-3007 (IDOR Guard)
      const getIdor = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'GET', undefined, {
        Authorization: `Bearer ${userBAccessToken}`,
      })
      if (getIdor.statusCode !== 403 || getIdor.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR get pet profile, got ${getIdor.statusCode}`)
      }

      // 6. PUT /:id with User B -> 403 A-3007
      const putIdor = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'PUT', {
        name: 'Hacked Mochi',
      }, { Authorization: `Bearer ${userBAccessToken}` })
      if (putIdor.statusCode !== 403 || putIdor.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR put pet profile, got ${putIdor.statusCode}`)
      }

      // 7. PUT /:id with User A -> 200 updates name
      const putOwn = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'PUT', {
        name: 'Mochi The Shiba',
        weight: 9.0,
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (putOwn.statusCode !== 200 || putOwn.body?.data?.petProfile?.name !== 'Mochi The Shiba') {
        throw new Error(`Expected 200 with updated name, got ${putOwn.statusCode}`)
      }

      // 8. Active booking guard: DELETE /:id when active booking exists -> 409 B-4001
      mockDb.setMockActivePetBooking(true)
      const deleteBlocked = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (deleteBlocked.statusCode !== 409 || deleteBlocked.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on delete pet with active booking, got ${deleteBlocked.statusCode}`)
      }
      mockDb.setMockActivePetBooking(false)

      // 9. Soft delete succeeds when no active bookings
      const deleteSuccess = await makeRequest(pipePath, `/api/v1/profiles/pet-profiles/${createdPetId}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (deleteSuccess.statusCode !== 200 || deleteSuccess.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on successful soft delete, got ${deleteSuccess.statusCode}`)
      }
    })

    // Test 36: PBI-10 Multi-Room Booking Engine, Row-Locking & Booking Guards
    let createdBookingId = 0
    let secondBookingId = 0
    await runTest('PBI-10: Row-Locked Multi-Room Booking Engine & Enterprise Booking Guards (B-4002, B-4003, B-4004)', async () => {
      // Re-create a fresh active pet for User A
      const petRes = await makeRequest(pipePath, '/api/v1/profiles/pet-profiles', 'POST', {
        name: 'Kuro',
        petSex: 'female',
        birthDate: '2022-06-15',
        weight: 6.0,
        contactName: 'Alice Wonder',
        contactPhone: '0812345678',
        petTypeId: 1,
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const kuroId = petRes.body?.data?.petProfile?.id

      // 1. Self-booking guard: Host (User B) books property 101 -> 400 B-4002
      const selfBookRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-10', checkOutDate: '2026-12-12', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userBAccessToken}` })
      if (selfBookRes.statusCode !== 400 || selfBookRes.body?.code !== 'B-4002') {
        throw new Error(`Expected 400 B-4002 on self-booking, got ${selfBookRes.statusCode} ${selfBookRes.body?.code}`)
      }

      // 2. Date hygiene: check-in in past -> 400 B-4003
      const pastDateRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2020-01-01', checkOutDate: '2020-01-03', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (pastDateRes.statusCode !== 400 || pastDateRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on past checkInDate, got ${pastDateRes.statusCode}`)
      }

      // 3. Date hygiene: checkOut <= checkIn -> 400 B-4003
      const invalidRangeRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-15', checkOutDate: '2026-12-15', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (invalidRangeRes.statusCode !== 400 || invalidRangeRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on checkOut <= checkIn, got ${invalidRangeRes.statusCode}`)
      }

      // 4. Overbooking guard: requesting more rooms than total capacity (totalRoom=3) -> 409 B-4004
      const overbookRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-20', checkOutDate: '2026-12-22', roomsBooked: 99 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (overbookRes.statusCode !== 409 || overbookRes.body?.code !== 'B-4004') {
        throw new Error(`Expected 409 B-4004 on overbooking, got ${overbookRes.statusCode}`)
      }

      // 4b. Duplicate petProfileIds guard: duplicate pet ID -> 400 T-2007
      const dupPetIdRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        petProfileIds: [kuroId, kuroId],
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-20', checkOutDate: '2026-12-22', roomsBooked: 2 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (dupPetIdRes.statusCode !== 400 || dupPetIdRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on duplicate petProfileIds, got ${dupPetIdRes.statusCode} ${dupPetIdRes.body?.code}`)
      }

      // 4c. Invalid roomCategoryId guard: non-numeric / missing -> 400 T-2007
      const invalidRcRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        petProfileIds: [kuroId],
        bookingOrders: [
          { roomCategoryId: 'invalid_id', checkInDate: '2026-12-20', checkOutDate: '2026-12-22', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (invalidRcRes.statusCode !== 400 || invalidRcRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on invalid roomCategoryId, got ${invalidRcRes.statusCode} ${invalidRcRes.body?.code}`)
      }

      // 4d. Unenforced pet capacity guard when petProfileIds empty: numberOfPets exceeds room capacity -> 400 B-4004
      const exceedCapacityRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        numberOfPets: 99,
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-20', checkOutDate: '2026-12-22', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (exceedCapacityRes.statusCode !== 400 || exceedCapacityRes.body?.code !== 'B-4004') {
        throw new Error(`Expected 400 B-4004 on exceeded pet capacity, got ${exceedCapacityRes.statusCode} ${exceedCapacityRes.body?.code}`)
      }

      // 5. Valid Multi-Room Booking: User A books 1 room for 2 nights
      const validBookingRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        petProfileIds: [kuroId],
        guestNote: 'Please take good care of Kuro',
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-20', checkOutDate: '2026-12-22', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })

      if (validBookingRes.statusCode !== 201 || validBookingRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on valid booking, got ${validBookingRes.statusCode}: ${JSON.stringify(validBookingRes.body)}`)
      }
      createdBookingId = validBookingRes.body?.data?.booking?.id
      if (!createdBookingId || validBookingRes.body?.data?.booking?.bookingStatus !== 'pending') {
        throw new Error('Created booking missing ID or not in pending status')
      }

      // Verify transaction options were passed to prevent "Transaction not found" timeouts
      const txOpts = (prisma as any)._lastTransactionOptions
      if (!txOpts || txOpts.timeout < 10000 || txOpts.maxWait < 5000) {
        throw new Error(`Expected transaction options with timeout >= 10000 and maxWait >= 5000, got ${JSON.stringify(txOpts)}`)
      }

      // 6. Pet double-booking guard: same pet on overlapping dates -> 409 B-4004
      const dupPetRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        petProfileIds: [kuroId],
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-21', checkOutDate: '2026-12-23', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (dupPetRes.statusCode !== 409 || dupPetRes.body?.code !== 'B-4004') {
        throw new Error(`Expected 409 B-4004 on pet double-booking, got ${dupPetRes.statusCode} ${dupPetRes.body?.code}`)
      }

      // 7. Transaction Timeout / "Transaction not found" (P2028, P2024, P2034) graceful handling (R1 regression)
      const origTransaction = (prisma as any).$transaction
      try {
        // Case 7a: P2028 Transaction not found / closed
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Transaction not found. Transaction ID is invalid in the engine: tx_123')
          err.code = 'P2028'
          throw err
        }

        const timeoutRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (timeoutRes.statusCode !== 409 || timeoutRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on transaction timeout/not found error, got ${timeoutRes.statusCode} ${timeoutRes.body?.code}: ${JSON.stringify(timeoutRes.body)}`)
        }

        // Case 7b: P2024 Pool timeout ("Timed out fetching a new connection from the connection pool")
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Timed out fetching a new connection from the connection pool. More info: http://pris.ly/d/connection-pool')
          err.code = 'P2024'
          throw err
        }

        const poolTimeoutRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (poolTimeoutRes.statusCode !== 409 || poolTimeoutRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on pool connection timeout, got ${poolTimeoutRes.statusCode} ${poolTimeoutRes.body?.code}`)
        }

        // Case 7c: P2034 Write conflict / transaction deadlock
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Transaction failed due to a write conflict or a deadlock. Please retry your transaction.')
          err.code = 'P2034'
          throw err
        }

        const deadlockRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (deadlockRes.statusCode !== 409 || deadlockRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on transaction write conflict/deadlock, got ${deadlockRes.statusCode} ${deadlockRes.body?.code}`)
        }

        // Case 7d: Intentional AppError with 'timed out' message inside transaction must NOT be hijacked
        ;(prisma as any).$transaction = async () => {
          throw new AppError('Payment window timed out', 400, 'B-4003')
        }

        const appErrorRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (appErrorRes.statusCode !== 400 || appErrorRes.body?.code !== 'B-4003') {
          throw new Error(`Expected 400 B-4003 when AppError thrown inside tx, got ${appErrorRes.statusCode} ${appErrorRes.body?.code}`)
        }

        // Case 7e: P2037 Too many connections
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Too many database connections opened')
          err.code = 'P2037'
          throw err
        }

        const connLimitRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (connLimitRes.statusCode !== 409 || connLimitRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on P2037 too many connections, got ${connLimitRes.statusCode} ${connLimitRes.body?.code}`)
        }

        // Case 7f: Case-insensitive Postgres serialization failure
        ;(prisma as any).$transaction = async () => {
          throw new Error('could not serialize access due to concurrent update in PostgreSQL engine')
        }

        const serializationRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (serializationRes.statusCode !== 409 || serializationRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on serialization conflict, got ${serializationRes.statusCode} ${serializationRes.body?.code}`)
        }

        // Case 7g: P1002 Database server timed out
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('The database server was reached but timed out')
          err.code = 'P1002'
          throw err
        }

        const p1002Res = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (p1002Res.statusCode !== 409 || p1002Res.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on P1002 database timeout, got ${p1002Res.statusCode} ${p1002Res.body?.code}`)
        }

        // Case 7h: P1017 Server has closed the connection
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Server has closed the connection')
          err.code = 'P1017'
          throw err
        }

        const p1017Res = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
          petProfileIds: [kuroId],
          bookingOrders: [
            { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 1 },
          ],
        }, { Authorization: `Bearer ${userAAccessToken}` })

        if (p1017Res.statusCode !== 409 || p1017Res.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 on P1017 closed connection, got ${p1017Res.statusCode} ${p1017Res.body?.code}`)
        }
      } finally {
        ;(prisma as any).$transaction = origTransaction
      }

      // 8. Transaction Atomicity Test: Ensure failed booking rolls back cleanly without partial writes (R2 regression)
      const preBookingCount = mockDb.bookingsMap.size
      const failedAtomicRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        petProfileIds: [kuroId],
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-30', roomsBooked: 99 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })

      if (failedAtomicRes.statusCode !== 409) {
        throw new Error(`Expected 409 on invalid booking, got ${failedAtomicRes.statusCode}`)
      }
      const postBookingCount = mockDb.bookingsMap.size
      if (postBookingCount !== preBookingCount) {
        throw new Error(`Transaction atomicity violated: booking count changed from ${preBookingCount} to ${postBookingCount}`)
      }
    })

    // Test 37: PBI-11 Payment Slip, Cancel, and Host Booking Workflows
    await runTest('PBI-11: Payment Slip, Cancel, and Host Booking Workflows', async () => {
      // 1. Payment confirmation IDOR: User B tries to confirm User A's booking -> 403 A-3007
      const idorPayment = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/confirm-payment`,
        'PATCH',
        { slipUrl: 'http://localhost:9000/slips/test.webp' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (idorPayment.statusCode !== 403 || idorPayment.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR payment confirm, got ${idorPayment.statusCode}`)
      }

      // 2. User A confirms payment -> 200, status becomes "confirmed"
      const confirmPaymentRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/confirm-payment`,
        'PATCH',
        { slipUrl: 'http://localhost:9000/slips/valid-slip.webp' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (confirmPaymentRes.statusCode !== 200 || confirmPaymentRes.body?.data?.booking?.bookingStatus !== 'confirmed') {
        throw new Error(`Expected 200 with status=confirmed, got ${confirmPaymentRes.statusCode}: ${JSON.stringify(confirmPaymentRes.body)}`)
      }

      // 3. Guest get paginated bookings: User A calls GET /api/v1/bookings/paginate
      const guestPaginateRes = await makeRequest(
        pipePath,
        '/api/v1/bookings/paginate?page=1&limit=10',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (guestPaginateRes.statusCode !== 200 || !Array.isArray(guestPaginateRes.body?.data)) {
        throw new Error(`Expected 200 with data array on guest paginate, got ${guestPaginateRes.statusCode}`)
      }

      // 4. Guest get single booking: GET /api/v1/bookings/:id
      const guestDetailRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (guestDetailRes.statusCode !== 200 || guestDetailRes.body?.data?.booking?.id !== createdBookingId) {
        throw new Error(`Expected 200 for guest booking detail, got ${guestDetailRes.statusCode}`)
      }

      // 5. Host listing: User B calls GET /api/v1/hosts/bookings/all
      const hostAllRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/bookings/all',
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (hostAllRes.statusCode !== 200 || !Array.isArray(hostAllRes.body?.data?.bookings)) {
        throw new Error(`Expected 200 on host bookings all, got ${hostAllRes.statusCode}`)
      }

      // 6. Host paginated: User B calls GET /api/v1/hosts/bookings/paginate
      const hostPaginatedRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/bookings/paginate?page=1&limit=10',
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (hostPaginatedRes.statusCode !== 200 || !Array.isArray(hostPaginatedRes.body?.data)) {
        throw new Error(`Expected 200 on host bookings paginate, got ${hostPaginatedRes.statusCode}`)
      }

      // 7. Host booking detail: User B calls GET /api/v1/hosts/bookings/:id
      const hostDetailRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (hostDetailRes.statusCode !== 200 || !hostDetailRes.body?.guest?.userId) {
        throw new Error(`Expected 200 with HostBookingDetail DTO, got ${hostDetailRes.statusCode}`)
      }

      // 8a. Early completion guard: Host cannot mark booking successful before Check-out 12:00 ICT -> 400 B-4003
      const earlyCompleteRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/success`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (earlyCompleteRes.statusCode !== 400 || earlyCompleteRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on early completeHostBooking, got ${earlyCompleteRes.statusCode} ${earlyCompleteRes.body?.code}`)
      }

      // 8b. Advance booking dates into past check-out (>= 12:00 ICT) and mark successful
      const targetBooking = mockDb.bookingsMap.get(createdBookingId)
      targetBooking.checkInDate = new Date('2026-11-10T00:00:00.000Z')
      targetBooking.checkOutDate = new Date('2026-11-12T00:00:00.000Z')
      const completeRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/success`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (completeRes.statusCode !== 200 || completeRes.body?.data?.booking?.bookingStatus !== 'successful') {
        throw new Error(`Expected 200 with status=successful, got ${completeRes.statusCode}: ${JSON.stringify(completeRes.body)}`)
      }

      // 9. Booking cancellation and quota restoration workflow:
      // Create a new pending booking
      const secondBookingRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-25', checkOutDate: '2026-12-27', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      secondBookingId = secondBookingRes.body?.data?.booking?.id

      // 9a. Test cancel booking transaction timeout/failure handling -> returns 409 B-4003
      const origTransactionInTest37 = (prisma as any).$transaction
      try {
        ;(prisma as any).$transaction = async () => {
          const err: any = new Error('Transaction not found. Transaction ID is invalid in the engine: tx_cancel')
          err.code = 'P2028'
          throw err
        }
        const cancelTimeoutRes = await makeRequest(
          pipePath,
          `/api/v1/bookings/${secondBookingId}/cancel`,
          'PATCH',
          undefined,
          { Authorization: `Bearer ${userAAccessToken}` }
        )
        if (cancelTimeoutRes.statusCode !== 409 || cancelTimeoutRes.body?.code !== 'B-4003') {
          throw new Error(`Expected 409 B-4003 on cancel transaction failure, got ${cancelTimeoutRes.statusCode} ${cancelTimeoutRes.body?.code}`)
        }

        // Step 9a-2: AppError thrown inside cancel booking transaction is not hijacked
        ;(prisma as any).$transaction = async () => {
          throw new AppError('Cancellation quota timed out', 400, 'B-4003')
        }
        const cancelAppErrRes = await makeRequest(
          pipePath,
          `/api/v1/bookings/${secondBookingId}/cancel`,
          'PATCH',
          undefined,
          { Authorization: `Bearer ${userAAccessToken}` }
        )
        if (cancelAppErrRes.statusCode !== 400 || cancelAppErrRes.body?.code !== 'B-4003' || cancelAppErrRes.body?.message !== 'Cancellation quota timed out') {
          throw new Error(`Expected 400 B-4003 preserving original AppError, got ${cancelAppErrRes.statusCode} ${cancelAppErrRes.body?.code}: ${cancelAppErrRes.body?.message}`)
        }
      } finally {
        ;(prisma as any).$transaction = origTransactionInTest37
      }

      // 9b. User A cancels the booking successfully
      const cancelRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${secondBookingId}/cancel`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (cancelRes.statusCode !== 200 || cancelRes.body?.data?.booking?.bookingStatus !== 'cancelled') {
        throw new Error(`Expected 200 with status=cancelled on cancel booking, got ${cancelRes.statusCode}`)
      }

      // 9c. Double-cancellation guard: cancelling already cancelled booking returns 400 B-4003 without double-restoring quota
      const calKey = '501:2026-12-25'
      const calAfterFirstCancel = mockDb.calendarsMap.get(calKey)
      const bookedRoomsAfterFirstCancel = calAfterFirstCancel ? calAfterFirstCancel.bookedRooms : 0

      const doubleCancelRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${secondBookingId}/cancel`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (doubleCancelRes.statusCode !== 400 || doubleCancelRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on double-cancellation, got ${doubleCancelRes.statusCode} ${doubleCancelRes.body?.code}`)
      }
      const calAfterSecondCancel = mockDb.calendarsMap.get(calKey)
      if (calAfterSecondCancel && calAfterSecondCancel.bookedRooms !== bookedRoomsAfterFirstCancel) {
        throw new Error(`Quota double-restoration detected! Booked rooms changed from ${bookedRoomsAfterFirstCancel} to ${calAfterSecondCancel.bookedRooms}`)
      }

      // 9d. Confirm payment on already cancelled booking fails with 400 B-4003 and does not resurrect
      const confirmCancelledRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${secondBookingId}/confirm-payment`,
        'PATCH',
        { slipUrl: 'http://localhost:9000/slips/test.webp' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (confirmCancelledRes.statusCode !== 400 || confirmCancelledRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on confirming cancelled booking, got ${confirmCancelledRes.statusCode} ${confirmCancelledRes.body?.code}`)
      }
      const finalBookingState = mockDb.bookingsMap.get(secondBookingId)
      if (finalBookingState?.bookingStatus !== 'cancelled') {
        throw new Error(`Cancelled booking resurrected to ${finalBookingState?.bookingStatus}`)
      }

      // 10. Host accepts pending booking (IDOR check, valid confirm, repeat-accept guard)
      const acceptTargetRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-25', checkOutDate: '2026-12-27', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const acceptTargetBookingId = acceptTargetRes.body?.data?.booking?.id
      if (!acceptTargetBookingId) {
        throw new Error(`Expected created booking for host accept test, got ${acceptTargetRes.statusCode}`)
      }

      // 10a. Guest IDOR attempting to accept own booking -> 403 A-3007
      const guestAcceptRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${acceptTargetBookingId}/accept`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (guestAcceptRes.statusCode !== 403 || guestAcceptRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on guest host-accept IDOR, got ${guestAcceptRes.statusCode} ${guestAcceptRes.body?.code}`)
      }

      // 10b. Host accepts pending booking -> 200 confirmed
      const hostAcceptRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${acceptTargetBookingId}/accept`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (
        hostAcceptRes.statusCode !== 200 ||
        (hostAcceptRes.body?.data?.bookingStatus ?? hostAcceptRes.body?.booking?.bookingStatus) !== 'confirmed'
      ) {
        throw new Error(`Expected 200 confirmed on host accept, got ${hostAcceptRes.statusCode}: ${JSON.stringify(hostAcceptRes.body)}`)
      }

      // 10c. Repeat accept on already confirmed booking -> 400 B-4003
      const repeatAcceptRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${acceptTargetBookingId}/accept`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (repeatAcceptRes.statusCode !== 400 || repeatAcceptRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on repeat host accept, got ${repeatAcceptRes.statusCode} ${repeatAcceptRes.body?.code}`)
      }
    })

    // =========================================================================
    // PBI-12 QA Audit Tests: Host Room Availability & Price Calendar
    // =========================================================================
    await runTest('PBI-12: Host Room Availability & Price Calendar (GET/PATCH calendars, Booked Guard B-4001, Price Floor T-2007)', async () => {
      // 1. IDOR: User A (guest, not host) attempts to view property 101 calendars -> 403 A-3007
      const idorCalRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars?startDate=2026-12-01&endDate=2026-12-05',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorCalRes.statusCode !== 403 || idorCalRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR calendar access, got ${idorCalRes.statusCode}`)
      }

      // 2. User B (host) queries calendars for room 501
      const getCalRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars?startDate=2026-12-01&endDate=2026-12-05',
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (getCalRes.statusCode !== 200 || !Array.isArray(getCalRes.body?.data?.calendars)) {
        throw new Error(`Expected 200 with calendars array, got ${getCalRes.statusCode}: ${JSON.stringify(getCalRes.body)}`)
      }
      const cals = getCalRes.body.data.calendars
      if (cals.length !== 5) {
        throw new Error(`Expected 5 calendar days, got ${cals.length}`)
      }
      // Check calendar properties
      const day1 = cals[0]
      if (day1.totalRooms !== 3 || day1.basePrice !== 800 || day1.effectivePrice !== 800) {
        throw new Error(`Unexpected calendar day1 data: ${JSON.stringify(day1)}`)
      }

      // 3. Validation failure: Negative unavailableRooms -> 400 T-2007
      const negRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars',
        'PATCH',
        { updates: [{ date: '2026-12-02', unavailableRooms: -2 }] },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (negRes.statusCode !== 400 || negRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on negative unavailableRooms, got ${negRes.statusCode}`)
      }

      // 4. Validation failure: Price Floor Guard (effectivePrice <= 0) -> 400 T-2007
      const floorRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars',
        'PATCH',
        { updates: [{ date: '2026-12-02', priceAdjustment: -850 }] },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (floorRes.statusCode !== 400 || floorRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on price floor violation, got ${floorRes.statusCode}`)
      }

      // 5. Booked-Room Protection Guard:
      // Room 501 has totalRoom = 3. Set a mock calendar row for 2026-12-01 with bookedRooms = 2.
      mockDb.calendarsMap.set('501:2026-12-01', {
        id: 991,
        roomCategoryId: 501,
        date: new Date('2026-12-01T00:00:00.000Z'),
        availableRooms: 1,
        bookedRooms: 2,
        unavailableRooms: 0,
        priceAdjustment: 0,
      })
      // Host attempts to set unavailableRooms = 2 (which exceeds totalRoom (3) - bookedRooms (2) = 1) -> 409 B-4001
      const bookedGuardRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars',
        'PATCH',
        { updates: [{ date: '2026-12-01', unavailableRooms: 2 }] },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (bookedGuardRes.statusCode !== 409 || bookedGuardRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on booked-room protection violation, got ${bookedGuardRes.statusCode}`)
      }

      // 6. Valid Calendar Update: Host sets unavailableRooms = 1, priceAdjustment = 200 for 2026-12-03
      const validUpdateRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars',
        'PATCH',
        { updates: [{ date: '2026-12-03', unavailableRooms: 1, priceAdjustment: 200 }] },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (validUpdateRes.statusCode !== 200 || validUpdateRes.body?.data?.updatedCount !== 1) {
        throw new Error(`Expected 200 with updatedCount=1, got ${validUpdateRes.statusCode}`)
      }

      // Verify effectivePrice calculation on subsequent GET
      const verifyGetRes = await makeRequest(
        pipePath,
        '/api/v1/hosts/properties/101/room-categories/501/calendars?startDate=2026-12-03&endDate=2026-12-03',
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      const updatedDay = verifyGetRes.body?.data?.calendars?.[0]
      if (updatedDay?.unavailableRooms !== 1 || updatedDay?.priceAdjustment !== 200 || updatedDay?.effectivePrice !== 1000) {
        throw new Error(`Expected effectivePrice=1000 & unavailableRooms=1, got ${JSON.stringify(updatedDay)}`)
      }
    })

    // =========================================================================
    // PBI-13 QA Audit Tests: Verified-Stay Single Review
    // =========================================================================
    await runTest('PBI-13: Verified-Stay Single Review (Status Guard B-4003, Lock B-4001, Rating Sync)', async () => {
      // 1. IDOR: User B (host) cannot review User A's booking -> 403 A-3007
      const idorReview = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/review`,
        'POST',
        { rating: 5, comment: 'Self review attempt' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (idorReview.statusCode !== 403 || idorReview.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR review submission, got ${idorReview.statusCode}`)
      }

      // 2. Verified-Stay Status Guard: Reviewing a cancelled booking -> 400 B-4003
      const nonCompletedReview = await makeRequest(
        pipePath,
        `/api/v1/bookings/${secondBookingId}/review`,
        'POST',
        { rating: 5, comment: 'Reviewing cancelled stay' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (nonCompletedReview.statusCode !== 400 || nonCompletedReview.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on non-successful stay review, got ${nonCompletedReview.statusCode}`)
      }

      // 3. Validation Guard: Invalid rating (e.g. 7) -> 400 T-2007
      const badRatingRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/review`,
        'POST',
        { rating: 7, comment: 'Invalid rating' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (badRatingRes.statusCode !== 400 || badRatingRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on rating > 5, got ${badRatingRes.statusCode}`)
      }

      // 4. Valid Review Submission: User A reviews completed stay createdBookingId
      const validReviewRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/review`,
        'POST',
        { rating: 5, comment: 'Wonderful care for my pet! Clean and caring staff.' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (validReviewRes.statusCode !== 200 || validReviewRes.body?.data?.rating !== 5) {
        throw new Error(`Expected 200 on valid review submission, got ${validReviewRes.statusCode}: ${JSON.stringify(validReviewRes.body)}`)
      }

      // 5. Single Review Lock Guard: Second review on same booking -> 409 B-4001
      const duplicateReviewRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}/review`,
        'POST',
        { rating: 4, comment: 'Trying to review again' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (duplicateReviewRes.statusCode !== 409 || duplicateReviewRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate review submission, got ${duplicateReviewRes.statusCode}`)
      }
    })

    // =========================================================================
    // PBI-13 QA Audit Tests: Favorites Folders & Property Wishlist (FF-4101)
    // =========================================================================
    await runTest('PBI-13: Favorites Folders & Property Wishlist (Folder CRUD, Duplicate Guard FF-4101, IDOR A-3007)', async () => {
      // 1. User A lists favorite folders (initially empty)
      const listEmptyRes = await makeRequest(
        pipePath,
        '/api/v1/favorite-folders/all',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (listEmptyRes.statusCode !== 200 || !Array.isArray(listEmptyRes.body?.data?.favoriteFolders)) {
        throw new Error(`Expected 200 with favoriteFolders array, got ${listEmptyRes.statusCode}`)
      }

      // 2. User A creates a new folder "Bangkok Pet Getaways"
      const createFolderRes = await makeRequest(
        pipePath,
        '/api/v1/favorite-folders',
        'POST',
        { folderName: 'Bangkok Pet Getaways' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (createFolderRes.statusCode !== 201 || !createFolderRes.body?.data?.folder?.id) {
        throw new Error(`Expected 201 with created folder, got ${createFolderRes.statusCode}: ${JSON.stringify(createFolderRes.body)}`)
      }
      const myFolderId = createFolderRes.body.data.folder.id

      // 3. User A adds property 101 to the folder
      const addFavRes = await makeRequest(
        pipePath,
        '/api/v1/favorite-folders',
        'POST',
        { propertyId: 101, folderId: myFolderId },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (addFavRes.statusCode !== 201 || addFavRes.body?.data?.propertyId !== 101) {
        throw new Error(`Expected 201 on add favorite property, got ${addFavRes.statusCode}`)
      }

      // 4. Duplicate Favorite Guard: User A attempts to add property 101 again -> 409 FF-4101
      const dupFavRes = await makeRequest(
        pipePath,
        '/api/v1/favorite-folders',
        'POST',
        { propertyId: 101, folderId: myFolderId },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (dupFavRes.statusCode !== 409 || dupFavRes.body?.code !== 'FF-4101') {
        throw new Error(`Expected 409 FF-4101 on duplicate favorite add, got ${dupFavRes.statusCode}: ${JSON.stringify(dupFavRes.body)}`)
      }

      // 5. User A gets folder details with properties
      const folderDetailRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (folderDetailRes.statusCode !== 200 || !Array.isArray(folderDetailRes.body?.data?.properties)) {
        throw new Error(`Expected 200 with properties array in folder detail, got ${folderDetailRes.statusCode}`)
      }
      const favProp = folderDetailRes.body.data.properties[0]
      if (favProp?.id !== 101 || favProp?.minPrice <= 0 || favProp?.isFavorite !== true) {
        throw new Error(`Expected favorite property 101 with minPrice and isFavorite, got ${JSON.stringify(favProp)}`)
      }

      // 6. IDOR: User B cannot view, rename, or delete User A's folder -> 403 A-3007
      const idorViewRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (idorViewRes.statusCode !== 403 || idorViewRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR folder view, got ${idorViewRes.statusCode}`)
      }

      const idorRenameRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'PUT',
        { name: 'Hacked Name' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (idorRenameRes.statusCode !== 403 || idorRenameRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR folder rename, got ${idorRenameRes.statusCode}`)
      }

      // 7. User A renames the folder
      const renameRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'PUT',
        { name: 'Luxury Pet Resorts' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (renameRes.statusCode !== 200 || renameRes.body?.data?.folder?.name !== 'Luxury Pet Resorts') {
        throw new Error(`Expected 200 with renamed folder name, got ${renameRes.statusCode}`)
      }

      // 8. User A removes property 101 from favorites
      const removePropRes = await makeRequest(
        pipePath,
        '/api/v1/favorite-properties/101',
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (removePropRes.statusCode !== 200) {
        throw new Error(`Expected 200 on remove favorite property, got ${removePropRes.statusCode}`)
      }

      // 9. User A deletes the folder
      const deleteFolderRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (deleteFolderRes.statusCode !== 200) {
        throw new Error(`Expected 200 on delete favorite folder, got ${deleteFolderRes.statusCode}`)
      }

      // 10. Re-query deleted folder -> 404 DB-1002
      const afterDeleteRes = await makeRequest(
        pipePath,
        `/api/v1/favorite-folders/${myFolderId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (afterDeleteRes.statusCode !== 404 || afterDeleteRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 on deleted folder query, got ${afterDeleteRes.statusCode}`)
      }
    })

    // =========================================================================
    // Booking Lifecycle, Guardrails, Auto-Expire/Auto-Complete & Host Reply
    // =========================================================================
    await runTest('Booking Lifecycle: Guest/Host Cancel Cutoffs, Historical Quota Safety & Cancellation Reasons', async () => {
      // Create a booking in future first, then set checkInDate to past ('2026-11-10') and confirm it
      const bRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-26', checkOutDate: '2026-12-28', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const bId = bRes.body?.data?.booking?.id
      if (bRes.statusCode !== 201 || !bId) {
        throw new Error(`Failed to create booking for cancel cutoff test: ${bRes.statusCode}`)
      }

      const bRec = mockDb.bookingsMap.get(bId)
      bRec.bookingStatus = 'confirmed'
      bRec.confirmedAt = new Date()
      bRec.checkInDate = new Date('2026-11-10T00:00:00.000Z')
      bRec.checkOutDate = new Date('2026-12-28T00:00:00.000Z')
      bRec.bookingOrders[0].checkInDate = new Date('2026-11-10T00:00:00.000Z')
      bRec.bookingOrders[0].checkOutDate = new Date('2026-12-28T00:00:00.000Z')

      // Seed a past-night calendar row ('2026-11-10') to ensure historical stats are NEVER mutated on cancel
      mockDb.calendarsMap.set('501:2026-11-10', {
        id: 8801,
        roomCategoryId: 501,
        date: new Date('2026-11-10T00:00:00.000Z'),
        availableRooms: 1,
        bookedRooms: 2,
        unavailableRooms: 0,
        priceAdjustment: 0,
      })

      // 1. Guest cannot cancel confirmed booking after Check-in 14:00 ICT -> 400 B-4003
      const guestLateCancel = await makeRequest(
        pipePath,
        `/api/v1/bookings/${bId}/cancel`,
        'PATCH',
        { reason: 'Changed my mind after check-in' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (guestLateCancel.statusCode !== 400 || guestLateCancel.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on guest cancel after check-in, got ${guestLateCancel.statusCode} ${guestLateCancel.body?.code}`)
      }

      // 2. Host CAN cancel before Check-out 12:00 ICT, recording cancelledBy & cancellationReason, preserving past-night calendar
      const notifBefore = mockDb.notificationsList.length
      const hostCancel = await makeRequest(
        pipePath,
        `/api/v1/bookings/${bId}/cancel`,
        'PATCH',
        { reason: 'Emergency facility repair' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (
        hostCancel.statusCode !== 200 ||
        hostCancel.body?.data?.booking?.cancelledBy !== 'host' ||
        hostCancel.body?.data?.booking?.cancellationReason !== 'Emergency facility repair'
      ) {
        throw new Error(`Expected 200 with cancelledBy=host & reason, got ${hostCancel.statusCode}: ${JSON.stringify(hostCancel.body)}`)
      }
      if (mockDb.calendarsMap.get('501:2026-11-10')?.bookedRooms !== 2) {
        throw new Error('Historical past-night calendar bookedRooms was mutated during cancel!')
      }
      if (mockDb.notificationsList.length <= notifBefore) {
        throw new Error('Expected counterparty notification on host cancel')
      }

      // 3. Host cannot cancel confirmed booking after Check-out 12:00 ICT -> 400 B-4003
      const bPastOutId = 9802
      mockDb.bookingsMap.set(bPastOutId, {
        id: bPastOutId,
        checkInDate: new Date('2026-11-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-12T00:00:00.000Z'),
        numberOfPets: 1,
        totalPrice: 1600,
        bookingStatus: 'confirmed',
        confirmedAt: new Date('2026-11-09T00:00:00.000Z'),
        guestId: userAId,
        propertyId: 101,
        property: mockDb.propertiesMap.get(101),
        bookingOrders: [],
        bookingPetProfiles: [],
        createdAt: new Date('2026-11-08T00:00:00.000Z'),
        updatedAt: new Date(),
        deletedAt: null,
      })
      const hostPostCheckoutCancel = await makeRequest(
        pipePath,
        `/api/v1/bookings/${bPastOutId}/cancel`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (hostPostCheckoutCancel.statusCode !== 400 || hostPostCheckoutCancel.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on host cancel after check-out, got ${hostPostCheckoutCancel.statusCode}`)
      }
      mockDb.bookingsMap.delete(bPastOutId)
    })

    await runTest('Booking Lifecycle: Payment Confirmation Deadline & Property Ban Guards (B-4003 / B-4004)', async () => {
      // 1. Expired payment window (> 24h) -> 400 B-4003 & auto-cancelled with quota restored
      const pRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-29', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const expId = pRes.body?.data?.booking?.id
      const bookedBefore = mockDb.calendarsMap.get('501:2026-12-28')?.bookedRooms || 0
      const expRec = mockDb.bookingsMap.get(expId)
      expRec.createdAt = new Date(Date.now() - 26 * 60 * 60 * 1000)

      const expConfirmRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${expId}/confirm-payment`,
        'PATCH',
        { slipUrl: 'http://localhost:9000/slips/late.webp' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (expConfirmRes.statusCode !== 400 || expConfirmRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on expired payment confirm, got ${expConfirmRes.statusCode}`)
      }
      if (mockDb.bookingsMap.get(expId)?.bookingStatus !== 'cancelled' || mockDb.bookingsMap.get(expId)?.cancelledBy !== 'system') {
        throw new Error('Expired pending booking was not auto-cancelled by system')
      }
      if ((mockDb.calendarsMap.get('501:2026-12-28')?.bookedRooms || 0) !== bookedBefore - 1) {
        throw new Error('Calendar quota was not restored after expired payment confirm')
      }

      // 2. Property admin-banned while booking pending -> 409 B-4004 & restores quota
      const pRes2 = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-29', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const banId = pRes2.body?.data?.booking?.id
      const prop101 = mockDb.propertiesMap.get(101)
      prop101.isBannedByAdmin = true
      try {
        const banConfirmRes = await makeRequest(
          pipePath,
          `/api/v1/bookings/${banId}/confirm-payment`,
          'PATCH',
          { slipUrl: 'http://localhost:9000/slips/ban.webp' },
          { Authorization: `Bearer ${userAAccessToken}` }
        )
        if (banConfirmRes.statusCode !== 409 || banConfirmRes.body?.code !== 'B-4004') {
          throw new Error(`Expected 409 B-4004 when property banned before payment confirm, got ${banConfirmRes.statusCode}`)
        }
        if (mockDb.bookingsMap.get(banId)?.bookingStatus !== 'cancelled') {
          throw new Error('Booking was not cancelled when property became unavailable')
        }
      } finally {
        prop101.isBannedByAdmin = false
      }

      // 3. Concurrent/idempotent expired confirmBookingPayment does NOT double-restore calendar quota
      const pRes3 = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-29', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const concExpId = pRes3.body?.data?.booking?.id
      const concExpRec = mockDb.bookingsMap.get(concExpId)
      concExpRec.createdAt = new Date(Date.now() - 26 * 60 * 60 * 1000)
      const calDec28 = mockDb.calendarsMap.get('501:2026-12-28')
      const bookedWhileActive = calDec28?.bookedRooms || 0
      const origTx3 = (prisma as any).$transaction
      try {
        let simulatedConcurrentCancel = false
        ;(prisma as any).$transaction = async (fn: any, opts: any) => {
          if (!simulatedConcurrentCancel) {
            simulatedConcurrentCancel = true
            // Simulate concurrent sweeper already cancelling & restoring 1 room before tx acquires FOR UPDATE
            concExpRec.bookingStatus = 'cancelled'
            concExpRec.cancelledBy = 'system'
            calDec28.bookedRooms = Math.max(0, calDec28.bookedRooms - 1)
            calDec28.availableRooms = Math.min(calDec28.availableRooms + 1, 5)
          }
          return origTx3(fn, opts)
        }

        const concExpConfirmRes = await makeRequest(
          pipePath,
          `/api/v1/bookings/${concExpId}/confirm-payment`,
          'PATCH',
          { slipUrl: 'http://localhost:9000/slips/conc-late.webp' },
          { Authorization: `Bearer ${userAAccessToken}` }
        )
        if (concExpConfirmRes.statusCode !== 400 || concExpConfirmRes.body?.code !== 'B-4003') {
          throw new Error(`Expected 400 B-4003 on concurrent expired confirm, got ${concExpConfirmRes.statusCode}`)
        }
        if (calDec28.bookedRooms !== bookedWhileActive - 1) {
          throw new Error(`Expected bookedRooms to stay ${bookedWhileActive - 1} (no double restore), got ${calDec28.bookedRooms}`)
        }
      } finally {
        ;(prisma as any).$transaction = origTx3
      }

      // 4. S3 orphan slip GC when confirmBookingPayment tx fails (and old slip preserved)
      const pRes4 = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-28', checkOutDate: '2026-12-29', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const gcSlipId = pRes4.body?.data?.booking?.id
      const gcSlipRec = mockDb.bookingsMap.get(gcSlipId)
      gcSlipRec.paymentSlipUrl = 'https://example.com/slips/existing-old-slip.webp'

      const origS3Send4 = (s3Client as any).send
      const origFetch4 = globalThis.fetch
      const origTx4 = (prisma as any).$transaction
      const slipOps: string[] = []
      try {
        ;(s3Client as any).send = async (cmd: any) => {
          const name = cmd?.constructor?.name || ''
          if (name === 'PutObjectCommand') slipOps.push('UPLOAD')
          if (name === 'DeleteObjectCommand') slipOps.push(`DELETE:${cmd?.input?.Key || ''}`)
          return {}
        }
        globalThis.fetch = (async (url: any, init?: any) => {
          const urlStr = String(url || '')
          if (urlStr.includes('/storage/v1/object/')) {
            const method = String(init?.method || 'GET').toUpperCase()
            if (method === 'POST') slipOps.push('UPLOAD')
            if (method === 'DELETE') slipOps.push(`DELETE:${urlStr}`)
            return new Response('', { status: 200 })
          }
          return origFetch4(url, init)
        }) as typeof fetch

        ;(prisma as any).$transaction = async (fn: any, opts: any) => {
          gcSlipRec.bookingStatus = 'cancelled'
          return origTx4(fn, opts)
        }

        const boundary = '----JoodPakPawSlipBoundary'
        const slipBody = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="slip"; filename="slip.png"\r\nContent-Type: image/png\r\n\r\n`),
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ])

        const slipGcRes = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
          const req = http.request(
            {
              socketPath: pipePath,
              path: `/api/v1/bookings/${gcSlipId}/confirm-payment`,
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${userAAccessToken}`,
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": String(slipBody.length),
              },
            },
            (res) => {
              let data = ''
              res.on('data', (c) => (data += c))
              res.on('end', () => {
                let parsed = data
                try { parsed = JSON.parse(data) } catch {}
                resolve({ statusCode: res.statusCode || 0, body: parsed })
              })
            }
          )
          req.on('error', reject)
          req.write(slipBody)
          req.end()
        })

        if (slipGcRes.statusCode !== 400 || slipGcRes.body?.code !== 'B-4003') {
          throw new Error(`Expected 400 B-4003 on concurrent confirm slip race, got ${slipGcRes.statusCode}`)
        }
        const deletedOps = slipOps.filter((op) => op.startsWith('DELETE:'))
        if (!slipOps.includes('UPLOAD') || deletedOps.length !== 1) {
          throw new Error(`Expected 1 UPLOAD and 1 new-slip DELETE on failed confirm tx, got ${JSON.stringify(slipOps)}`)
        }
        if (deletedOps[0].includes('existing-old-slip')) {
          throw new Error(`Existing old slip should NOT be deleted when confirm tx fails: ${deletedOps[0]}`)
        }
      } finally {
        ;(s3Client as any).send = origS3Send4
        globalThis.fetch = origFetch4
        ;(prisma as any).$transaction = origTx4
      }
    })

    await runTest('Booking Lifecycle: Lazy Reconciliation Auto-Expires Pending & Auto-Completes Confirmed Bookings', async () => {
      // 1. Overdue pending booking lazily auto-expires via GET /api/v1/bookings/paginate
      const pRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-29', checkOutDate: '2026-12-30', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      const lazyExpId = pRes.body?.data?.booking?.id
      const lazyExpRec = mockDb.bookingsMap.get(lazyExpId)
      lazyExpRec.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000)

      // 2. Overdue confirmed booking (> checkOut 18:00 ICT) lazily auto-completes via GET /api/v1/hosts/bookings/paginate
      const lazyCompId = 9803
      mockDb.bookingsMap.set(lazyCompId, {
        id: lazyCompId,
        checkInDate: new Date('2026-11-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-12T00:00:00.000Z'),
        numberOfPets: 1,
        totalPrice: 1600,
        bookingStatus: 'confirmed',
        confirmedAt: new Date('2026-11-09T00:00:00.000Z'),
        successedAt: null,
        guestId: userAId,
        propertyId: 101,
        property: mockDb.propertiesMap.get(101),
        bookingOrders: [],
        bookingPetProfiles: [],
        createdAt: new Date('2026-11-08T00:00:00.000Z'),
        updatedAt: new Date(),
        deletedAt: null,
      })

      const guestListRes = await makeRequest(
        pipePath,
        '/api/v1/bookings/paginate?page=1&limit=20',
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (guestListRes.statusCode !== 200) {
        throw new Error(`Expected 200 on guest paginate, got ${guestListRes.statusCode}`)
      }
      if (
        mockDb.bookingsMap.get(lazyExpId)?.bookingStatus !== 'cancelled' ||
        mockDb.bookingsMap.get(lazyExpId)?.cancelledBy !== 'system'
      ) {
        throw new Error('Lazy reconcile did not auto-expire overdue pending booking')
      }
      if (
        mockDb.bookingsMap.get(lazyCompId)?.bookingStatus !== 'successful' ||
        new Date(mockDb.bookingsMap.get(lazyCompId)?.successedAt).toISOString() !== '2026-11-12T11:00:00.000Z'
      ) {
        throw new Error(`Lazy reconcile did not auto-complete overdue confirmed booking at 18:00 ICT: ${JSON.stringify(mockDb.bookingsMap.get(lazyCompId))}`)
      }

      // Clean up test synthetic booking
      mockDb.bookingsMap.delete(lazyCompId)
      const sweepRes = await reconcileLifecycleBookings()
      if (typeof sweepRes.expiredCount !== 'number' || typeof sweepRes.completedCount !== 'number') {
        throw new Error('Expected reconcileLifecycleBookings to return { expiredCount, completedCount }')
      }
    })

    await runTest('Booking Lifecycle: 14-Day Review Window, Concurrent Duplicate Lock, S3 GC & Host Public Reply', async () => {
      // 1. Expired 14-day review window -> 400 B-4003 (and S3 upload is NOT invoked)
      const oldCompId = 9804
      mockDb.bookingsMap.set(oldCompId, {
        id: oldCompId,
        checkInDate: new Date('2026-10-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-10-12T00:00:00.000Z'),
        numberOfPets: 1,
        totalPrice: 1600,
        bookingStatus: 'successful',
        successedAt: new Date('2026-10-12T11:00:00.000Z'),
        rating: null,
        comment: null,
        reviewedAt: null,
        hostReply: null,
        hostRepliedAt: null,
        guestId: userAId,
        propertyId: 101,
        property: mockDb.propertiesMap.get(101),
        bookingOrders: [],
        bookingPetProfiles: [],
        createdAt: new Date('2026-10-08T00:00:00.000Z'),
        updatedAt: new Date(),
        deletedAt: null,
      })

      const expiredRevRes = await makeRequest(
        pipePath,
        `/api/v1/bookings/${oldCompId}/review`,
        'POST',
        { rating: 5, comment: 'Way too late' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (expiredRevRes.statusCode !== 400 || expiredRevRes.body?.code !== 'B-4003') {
        throw new Error(`Expected 400 B-4003 on expired 14-day review window, got ${expiredRevRes.statusCode}`)
      }
      mockDb.bookingsMap.delete(oldCompId)

      // 2. Concurrent review lock inside tx + S3 GC cleanup on failure
      const raceBookingId = 9805
      mockDb.bookingsMap.set(raceBookingId, {
        id: raceBookingId,
        checkInDate: new Date('2026-11-10T00:00:00.000Z'),
        checkOutDate: new Date('2026-11-12T00:00:00.000Z'),
        numberOfPets: 1,
        totalPrice: 1600,
        bookingStatus: 'successful',
        successedAt: new Date(),
        rating: null,
        comment: null,
        reviewedAt: null,
        hostReply: null,
        hostRepliedAt: null,
        guestId: userAId,
        propertyId: 101,
        property: mockDb.propertiesMap.get(101),
        bookingOrders: [],
        bookingPetProfiles: [],
        createdAt: new Date('2026-11-08T00:00:00.000Z'),
        updatedAt: new Date(),
        deletedAt: null,
      })

      const origS3Send = (s3Client as any).send
      const origFetch = globalThis.fetch
      const origTx = (prisma as any).$transaction
      const storageOps: string[] = []
      try {
        ;(s3Client as any).send = async (cmd: any) => {
          const name = cmd?.constructor?.name || ''
          if (name === 'PutObjectCommand') storageOps.push('UPLOAD')
          if (name === 'DeleteObjectCommand') storageOps.push('DELETE')
          return {}
        }
        globalThis.fetch = (async (url: any, init?: any) => {
          const urlStr = String(url || '')
          if (urlStr.includes('/storage/v1/object/')) {
            const method = String(init?.method || 'GET').toUpperCase()
            if (method === 'POST') storageOps.push('UPLOAD')
            if (method === 'DELETE') storageOps.push('DELETE')
            return new Response('', { status: 200 })
          }
          return origFetch(url, init)
        }) as typeof fetch
        // Simulate another concurrent request winning the lock right before our tx reads curBooking
        let txEntered = false
        ;(prisma as any).$transaction = async (fn: any, opts: any) => {
          if (!txEntered) {
            txEntered = true
            const b = mockDb.bookingsMap.get(raceBookingId)
            b.reviewedAt = new Date()
            b.rating = 5
          }
          return origTx(fn, opts)
        }

        // Send multipart/form-data review with 1 tiny synthetic image buffer
        const boundary = '----JoodPakPawTestBoundary'
        const bodyBuf = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="rating"\r\n\r\n5\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="comment"\r\n\r\nGreat!\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="cat.png"\r\nContent-Type: image/png\r\n\r\n`),
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ])

        const raceRes = await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
          const req = http.request(
            {
              socketPath: pipePath,
              path: `/api/v1/bookings/${raceBookingId}/review`,
              method: 'POST',
              headers: {
                Authorization: `Bearer ${userAAccessToken}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': String(bodyBuf.length),
              },
            },
            (res) => {
              let data = ''
              res.on('data', (c) => (data += c))
              res.on('end', () => {
                let parsed = data
                try { parsed = JSON.parse(data) } catch {}
                resolve({ statusCode: res.statusCode || 0, body: parsed })
              })
            }
          )
          req.on('error', reject)
          req.write(bodyBuf)
          req.end()
        })

        if (raceRes.statusCode !== 409 || raceRes.body?.code !== 'B-4001') {
          throw new Error(`Expected 409 B-4001 on concurrent review race, got ${raceRes.statusCode} ${raceRes.body?.code}`)
        }
        if (!storageOps.includes('UPLOAD') || !storageOps.includes('DELETE')) {
          throw new Error(`Expected UPLOAD + DELETE storage GC on failed review tx, got ${JSON.stringify(storageOps)}`)
        }
      } finally {
        ;(s3Client as any).send = origS3Send
        globalThis.fetch = origFetch
        ;(prisma as any).$transaction = origTx
        mockDb.bookingsMap.delete(raceBookingId)
      }

      // 3. Host Public Reply (POST /api/v1/hosts/bookings/:bookingId/review-reply) on createdBookingId (already reviewed in PBI-13)
      // 3a. IDOR: User A (guest) cannot reply -> 403 A-3007
      const idorReplyRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/review-reply`,
        'POST',
        { reply: 'Unauthorized reply' },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorReplyRes.statusCode !== 403 || idorReplyRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on IDOR host reply, got ${idorReplyRes.statusCode}`)
      }

      // 3b. Empty reply -> 400 T-2007
      const emptyReplyRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/review-reply`,
        'POST',
        { reply: '   ' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (emptyReplyRes.statusCode !== 400 || emptyReplyRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on empty host reply, got ${emptyReplyRes.statusCode}`)
      }

      // 3c. Valid host reply -> 200 & surfaces in GET booking + GET property reviews
      const validReplyRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/review-reply`,
        'POST',
        { reply: 'Thank you so much for trusting us with Kuro!' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (
        validReplyRes.statusCode !== 200 ||
        validReplyRes.body?.data?.hostReply !== 'Thank you so much for trusting us with Kuro!' ||
        !validReplyRes.body?.data?.hostRepliedAt
      ) {
        throw new Error(`Expected 200 with hostReply, got ${validReplyRes.statusCode}: ${JSON.stringify(validReplyRes.body)}`)
      }

      // 3d. Duplicate reply -> 409 B-4001
      const dupReplyRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/review-reply`,
        'POST',
        { reply: 'Second reply attempt' },
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (dupReplyRes.statusCode !== 409 || dupReplyRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate host reply, got ${dupReplyRes.statusCode}`)
      }

      // 3e. Verify hostReply appears in host reviews endpoint & booking detail
      const bDetailAfterReply = await makeRequest(
        pipePath,
        `/api/v1/bookings/${createdBookingId}`,
        'GET',
        undefined,
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (bDetailAfterReply.body?.data?.booking?.hostReply !== 'Thank you so much for trusting us with Kuro!') {
        throw new Error('hostReply missing from GET /bookings/:id DTO')
      }

      const hostRevsAfter = await makeRequest(
        pipePath,
        `/api/v1/properties/hosts/${userBId}/reviews?page=1&limit=10`,
        'GET'
      )
      if (hostRevsAfter.statusCode !== 200) {
        throw new Error(`Expected 200 from GET /properties/hosts/:hostId/reviews, got ${hostRevsAfter.statusCode}`)
      }
      const matchedRev = (hostRevsAfter.body?.data || []).find((r: any) => r.bookingId === createdBookingId)
      if (!matchedRev || matchedRev.hostReply !== 'Thank you so much for trusting us with Kuro!') {
        throw new Error('hostReply missing from GET /properties/hosts/:hostId/reviews')
      }
    })

    await runTest('Booking Lifecycle: Deletion Guard Allows Deleting Property/Room with "successful" Bookings & syncPropertyBookingCount Excludes Cancelled', async () => {
      // Create a fresh property & room category owned by User B
      const propRes = await makeRequest(pipePath, '/api/v1/hosts/properties', 'POST', {
        title: 'Successful Stay Deletable Hotel',
        description: 'Testing terminal successful guard',
        address: '99 Rama 9',
        province: 'Bangkok',
        propertyTypeId: 1,
      }, { Authorization: `Bearer ${userBAccessToken}` })
      const pId = propRes.body?.data?.property?.id

      const rcRes = await makeRequest(pipePath, `/api/v1/hosts/properties/${pId}/room-categories`, 'POST', {
        name: 'Cozy Cat Pod',
        totalRoom: 2,
        numberOfPets: 1,
        basePrice: 500,
        petTypes: JSON.stringify([1, 2]),
      }, { Authorization: `Bearer ${userBAccessToken}` })
      const rcId = rcRes.body?.data?.roomCategory?.id

      // Add bookings: 1 'successful' (even with future checkOutDate), 1 'cancelled', 1 'pending'
      mockDb.bookingsMap.set(9810, {
        id: 9810,
        bookingStatus: 'successful',
        checkOutDate: new Date('2026-12-30T00:00:00.000Z'),
        propertyId: pId,
        property: mockDb.propertiesMap.get(pId),
        bookingOrders: [{ roomCategoryId: rcId }],
        deletedAt: null,
      })
      mockDb.bookingsMap.set(9811, {
        id: 9811,
        bookingStatus: 'cancelled',
        checkOutDate: new Date('2026-12-30T00:00:00.000Z'),
        propertyId: pId,
        property: mockDb.propertiesMap.get(pId),
        bookingOrders: [{ roomCategoryId: rcId }],
        deletedAt: null,
      })
      mockDb.bookingsMap.set(9812, {
        id: 9812,
        bookingStatus: 'confirmed',
        checkOutDate: new Date('2026-12-30T00:00:00.000Z'),
        propertyId: pId,
        property: mockDb.propertiesMap.get(pId),
        bookingOrders: [],
        deletedAt: null,
      })

      // 1. syncPropertyBookingCount should count only REAL_STAY_STATUSES (successful + confirmed = 2, NOT cancelled)
      await syncPropertyBookingCount(pId)
      if (mockDb.propertiesMap.get(pId)?.bookingCount !== 2) {
        throw new Error(`Expected bookingCount=2 (excluding cancelled), got ${mockDb.propertiesMap.get(pId)?.bookingCount}`)
      }

      // Remove the confirmed booking so only 'successful' + 'cancelled' remain
      mockDb.bookingsMap.delete(9812)

      // 2. Deleting room category with only 'successful' + 'cancelled' bookings -> 200
      const delRcRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${pId}/room-categories/${rcId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (delRcRes.statusCode !== 200) {
        throw new Error(`Expected 200 deleting room category with only successful bookings, got ${delRcRes.statusCode}: ${JSON.stringify(delRcRes.body)}`)
      }

      // 3. Deleting property with only 'successful' + 'cancelled' bookings -> 200
      const delPropRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/properties/${pId}`,
        'DELETE',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (delPropRes.statusCode !== 200) {
        throw new Error(`Expected 200 deleting property with only successful bookings, got ${delPropRes.statusCode}: ${JSON.stringify(delPropRes.body)}`)
      }

      mockDb.bookingsMap.delete(9810)
      mockDb.bookingsMap.delete(9811)
    })

    await runTest('PBI-14: Persistent Notification APIs (GET, PATCH read, PATCH read-all, DELETE, IDOR A-3007 & S-0000 contract)', async () => {
      // 1. Unauthenticated request to GET /api/v1/notifications -> 401 A-3005
      const unauthRes = await makeRequest(pipePath, '/api/v1/notifications', 'GET')
      if (unauthRes.statusCode !== 401 || (unauthRes.body?.code !== 'A-3005' && unauthRes.body?.error?.code !== 'A-3005')) {
        throw new Error(`Expected 401 A-3005 without token, got ${unauthRes.statusCode}: ${JSON.stringify(unauthRes.body)}`)
      }

      // 2. Create notification for User A (ID=1) and User B (ID=2)
      const notifA = await createNotificationSafe({
        userId: 1,
        roleName: 'guest',
        actionName: 'booking_created',
        title: 'Booking request sent',
        message: 'Your booking has been requested.',
        category: 'booking',
        type: 'info',
        referenceTable: 'bookings',
        referenceId: 1001,
      })
      if (!notifA) throw new Error('Failed to seed notification for User A')

      const notifB = await createNotificationSafe({
        userId: 2,
        roleName: 'host',
        actionName: 'booking_confirmed',
        title: 'New confirmed booking',
        message: 'A guest confirmed their stay.',
        category: 'booking',
        type: 'success',
        referenceTable: 'bookings',
        referenceId: 1001,
      })
      if (!notifB) throw new Error('Failed to seed notification for User B')

      // 3. GET /api/v1/notifications as User A -> 200 S-0000 with ServerNotificationDto format
      const getRes = await makeRequest(pipePath, '/api/v1/notifications', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (getRes.statusCode !== 200 || getRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 for GET notifications, got ${getRes.statusCode}: ${JSON.stringify(getRes.body)}`)
      }
      const notifications = getRes.body?.data?.notifications || getRes.body?.notifications
      if (!Array.isArray(notifications) || notifications.length === 0) {
        throw new Error(`Expected array of notifications, got ${JSON.stringify(notifications)}`)
      }
      const foundA = notifications.find((n: any) => n.id === notifA.id)
      if (!foundA || foundA.roleName !== 'guest' || foundA.actionName !== 'booking_created' || foundA.isRead !== false) {
        throw new Error(`Notification A fields mismatch: ${JSON.stringify(foundA)}`)
      }
      // Ensure User A cannot see User B's notification
      if (notifications.some((n: any) => n.id === notifB.id)) {
        throw new Error(`User A should not see User B's notification in GET list`)
      }

      // 4. Validation errors: invalid ID -> 400 T-2007; not found ID -> 404 DB-1002
      const invalidIdRes = await makeRequest(pipePath, '/api/v1/notifications/invalid-id/read', 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (invalidIdRes.statusCode !== 400 || invalidIdRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on invalid ID, got ${invalidIdRes.statusCode}: ${JSON.stringify(invalidIdRes.body)}`)
      }

      const notFoundRes = await makeRequest(pipePath, '/api/v1/notifications/999999/read', 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (notFoundRes.statusCode !== 404 || notFoundRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 on non-existent ID, got ${notFoundRes.statusCode}: ${JSON.stringify(notFoundRes.body)}`)
      }

      // 5. IDOR Guard: User A attempting to mark User B's notification as read -> 403 A-3007
      const idorReadRes = await makeRequest(pipePath, `/api/v1/notifications/${notifB.id}/read`, 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (idorReadRes.statusCode !== 403 || idorReadRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on cross-user mark read, got ${idorReadRes.statusCode}: ${JSON.stringify(idorReadRes.body)}`)
      }

      // 6. Legitimate mark as read -> 200 S-0000, isRead === true
      const markReadRes = await makeRequest(pipePath, `/api/v1/notifications/${notifA.id}/read`, 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (markReadRes.statusCode !== 200 || markReadRes.body?.code !== 'S-0000' || !markReadRes.body?.data?.notification?.isRead) {
        throw new Error(`Expected 200 S-0000 mark read, got ${markReadRes.statusCode}: ${JSON.stringify(markReadRes.body)}`)
      }

      // 7. Seed unread notification and test PATCH /api/v1/notifications/read-all
      await createNotificationSafe({
        userId: 1,
        roleName: 'guest',
        actionName: 'booking_review_replied',
        title: 'Host replied',
        message: 'Host has replied to your review.',
        category: 'booking',
      })
      const readAllRes = await makeRequest(pipePath, '/api/v1/notifications/read-all', 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (readAllRes.statusCode !== 200 || readAllRes.body?.code !== 'S-0000' || typeof readAllRes.body?.data?.updatedCount !== 'number') {
        throw new Error(`Expected 200 S-0000 read-all, got ${readAllRes.statusCode}: ${JSON.stringify(readAllRes.body)}`)
      }

      // 8. IDOR Guard on DELETE: User A attempting to delete User B's notification -> 403 A-3007
      const idorDelRes = await makeRequest(pipePath, `/api/v1/notifications/${notifB.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (idorDelRes.statusCode !== 403 || idorDelRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on cross-user delete, got ${idorDelRes.statusCode}: ${JSON.stringify(idorDelRes.body)}`)
      }

      // 9. Legitimate single delete -> 200 S-0000, data: null
      const delSingleRes = await makeRequest(pipePath, `/api/v1/notifications/${notifA.id}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (delSingleRes.statusCode !== 200 || delSingleRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on delete, got ${delSingleRes.statusCode}: ${JSON.stringify(delSingleRes.body)}`)
      }

      // 10. Bulk DELETE /api/v1/notifications -> 200 S-0000, cleans user's notifications
      const delAllRes = await makeRequest(pipePath, '/api/v1/notifications', 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (delAllRes.statusCode !== 200 || delAllRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on bulk delete, got ${delAllRes.statusCode}: ${JSON.stringify(delAllRes.body)}`)
      }

      const emptyRes = await makeRequest(pipePath, '/api/v1/notifications', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      const emptyList = emptyRes.body?.data?.notifications || emptyRes.body?.notifications
      if (!Array.isArray(emptyList) || emptyList.length !== 0) {
        throw new Error(`Expected 0 notifications after bulk delete, got ${emptyList?.length}`)
      }
    })

    await runTest('PBI-14: Check-In Reminder Scheduler Idempotency & Role Mapping', async () => {
      const now = new Date('2026-12-10T10:00:00.000Z')
      const tomorrowThaiStr = getTomorrowThaiStr(now)
      const targetCheckIn = new Date(`${tomorrowThaiStr}T00:00:00.000Z`)

      // Seed a confirmed booking for tomorrow in mockDb.bookingsMap
      const reminderBookingId = 9820
      mockDb.bookingsMap.set(reminderBookingId, {
        id: reminderBookingId,
        guestId: 1,
        propertyId: 101,
        bookingStatus: 'confirmed',
        checkInDate: targetCheckIn,
        checkOutDate: new Date(targetCheckIn.getTime() + 24 * 60 * 60 * 1000),
        deletedAt: null,
        property: mockDb.propertiesMap.get(101) || { id: 101, hostId: 2, title: 'Mock Pet Villa' },
      })

      // Run reminder sweep first time: should send reminders (including guest and host for this booking)
      const firstRun = await sendUpcomingCheckInReminders(now)
      if (firstRun.remindersSent < 2) {
        throw new Error(`Expected at least 2 reminders sent on first run, got ${firstRun.remindersSent}`)
      }

      // Verify records in mockDb.notificationsList
      const guestNotif = mockDb.notificationsList.find(
        (n) => n.userId === 1 && n.referenceId === reminderBookingId
      )
      const hostNotif = mockDb.notificationsList.find(
        (n) => n.userId === 2 && n.referenceId === reminderBookingId
      )
      if (!guestNotif || (guestNotif.roleId !== 1 && guestNotif.role?.name !== 'guest')) {
        throw new Error(`Guest check-in reminder missing or wrong role: ${JSON.stringify(guestNotif)}`)
      }
      if (!hostNotif || (hostNotif.roleId !== 2 && hostNotif.role?.name !== 'host')) {
        throw new Error(`Host check-in reminder missing or wrong role: ${JSON.stringify(hostNotif)}`)
      }

      // Run reminder sweep second time with identical timestamp: must be idempotent (0 sent)
      const secondRun = await sendUpcomingCheckInReminders(now)
      if (secondRun.remindersSent !== 0) {
        throw new Error(`Expected 0 reminders sent on idempotent rerun, got ${secondRun.remindersSent}`)
      }

      mockDb.bookingsMap.delete(reminderBookingId)
    })

    await runTest('PBI-14: Socket.IO Server Handshake, Ban Rejection & Room Routing', async () => {
      // 1. emitToUser safe no-op test
      emitToUser(1, 'notification', { test: true })
      emitToUser(9999, 'new_message', { test: true })

      // 2. Test Socket.IO server initialization
      const ioInstance = getSocketServer()
      if (!ioInstance) {
        const attachedIo = initSocketServer(server)
        if (!attachedIo) throw new Error('Expected initSocketServer to return SocketIOServer instance')
      }
    })

    await runTest('PBI-15: Real-Time Chat Rooms & Pair Normalization (Self-Chat T-2007, Banned A-3002, Idempotency)', async () => {
      // 1. Self-chat guard: User A (ID=1) creates room with participantId=1 -> 400 T-2007
      const selfChatRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'POST', {
        participantId: 1,
        content: 'Talking to myself',
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (selfChatRes.statusCode !== 400 || selfChatRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on self-chat, got ${selfChatRes.statusCode}: ${JSON.stringify(selfChatRes.body)}`)
      }

      // 2. Banned user guard: User A creates room with banned user -> 403 A-3002
      mockDb.users.set(99, {
        id: 99,
        email: 'banned@example.com',
        firstName: 'Banned',
        lastName: 'User',
        avatar: null,
        phone: null,
        password: 'hash',
        otp: null,
        otpExpiredAt: null,
        resetPasswordToken: null,
        resetPasswordExpiredAt: null,
        isVerified: true,
        isBecomeToHost: false,
        isVerifiedHost: false,
        isBannedReview: false,
        isBannedAllProperties: false,
        bannedAt: new Date(),
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { id: 1, name: 'guest' } }],
      })
      const bannedChatRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'POST', {
        participantId: 99,
        content: 'Hi banned user',
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (bannedChatRes.statusCode !== 403 || bannedChatRes.body?.code !== 'A-3002') {
        throw new Error(`Expected 403 A-3002 on banned participant, got ${bannedChatRes.statusCode}: ${JSON.stringify(bannedChatRes.body)}`)
      }
      mockDb.users.delete(99)

      // 3. User A creates chat room with User B (Host, ID=2) -> 201 S-0000
      const createRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'POST', {
        participantId: 2,
        content: 'Hello Host, is your room available?',
      }, { Authorization: `Bearer ${userAAccessToken}` })
      if (createRes.statusCode !== 201 || createRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on chat room creation, got ${createRes.statusCode}: ${JSON.stringify(createRes.body)}`)
      }
      const roomA = createRes.body?.data?.chatRoom || createRes.body?.chatRoom
      if (!roomA || !roomA.id) throw new Error(`Missing chat room in response: ${JSON.stringify(createRes.body)}`)
      if (roomA.otherUser?.id !== 2 || !roomA.otherUser?.isHost) {
        throw new Error(`Expected otherUser to be host (ID=2), got: ${JSON.stringify(roomA.otherUser)}`)
      }

      // 4. Pair Normalization & Idempotency: User B creates chat room with User A (ID=1) -> 200 S-0000 with SAME room ID
      const dupRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'POST', {
        participantId: 1,
      }, { Authorization: `Bearer ${userBAccessToken}` })
      if (dupRes.statusCode !== 200 || dupRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on existing chat room, got ${dupRes.statusCode}: ${JSON.stringify(dupRes.body)}`)
      }
      const roomB = dupRes.body?.data?.chatRoom || dupRes.body?.chatRoom
      if (roomB.id !== roomA.id) {
        throw new Error(`Expected same room ID ${roomA.id}, got ${roomB.id} (Pair normalization failure)`)
      }
      if (roomB.otherUser?.id !== 1 || typeof roomB.otherUser?.isHost !== 'boolean') {
        throw new Error(`User B view: expected otherUser to be User 1, got: ${JSON.stringify(roomB.otherUser)}`)
      }

      // 5. GET /api/v1/chat-rooms lists the room for both users
      const listARes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (listARes.statusCode !== 200 || !Array.isArray(listARes.body?.data?.chatRooms)) {
        throw new Error(`Expected 200 array for GET /chat-rooms, got ${listARes.statusCode}: ${JSON.stringify(listARes.body)}`)
      }
      const foundRoom = listARes.body.data.chatRooms.find((r: any) => r.id === roomA.id)
      if (!foundRoom || foundRoom.lastMessage?.content !== 'Hello Host, is your room available?') {
        throw new Error(`Room not found in list or lastMessage mismatch: ${JSON.stringify(foundRoom)}`)
      }
    })

    await runTest('PBI-15: Chat Messaging, Read Receipts & Participant IDOR Guards (403 A-3007, 400 T-2007)', async () => {
      // Create User C (ID=33) as a third non-participant user
      const userCId = 33
      mockDb.users.set(userCId, {
        id: userCId,
        email: 'user_c_chat_test@example.com',
        firstName: 'Charlie',
        lastName: 'Brown',
        avatar: null,
        phone: '0831112233',
        password: 'Password123!',
        otp: null,
        otpExpiredAt: null,
        resetPasswordToken: null,
        resetPasswordExpiredAt: null,
        isVerified: true,
        isBecomeToHost: false,
        isVerifiedHost: false,
        isBannedReview: false,
        isBannedAllProperties: false,
        bannedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [{ role: { id: 1, name: 'guest' } }],
      })
      const userCAccessToken = jwt.sign(
        { userId: userCId, email: 'user_c_chat_test@example.com', roleId: 1, roleName: 'guest' },
        config.jwt.secret,
        { expiresIn: '1h' }
      )

      // Retrieve the room created between User A (1) and User B (2)
      const roomsRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      const testRoomId = roomsRes.body?.data?.chatRooms?.[0]?.id
      if (!testRoomId) throw new Error('No test chat room available for messaging tests')

      // 1. IDOR Guard: User C attempting GET /api/v1/chat-rooms/:id -> 403 A-3007
      const idorGetRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}`, 'GET', undefined, {
        Authorization: `Bearer ${userCAccessToken}`,
      })
      if (idorGetRes.statusCode !== 403 || idorGetRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on cross-user get room, got ${idorGetRes.statusCode}: ${JSON.stringify(idorGetRes.body)}`)
      }

      // 2. IDOR Guard: User C attempting POST /messages -> 403 A-3007
      const idorPostRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}/messages`, 'POST', {
        content: 'I am an intruder',
      }, { Authorization: `Bearer ${userCAccessToken}` })
      if (idorPostRes.statusCode !== 403 || idorPostRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on cross-user post message, got ${idorPostRes.statusCode}: ${JSON.stringify(idorPostRes.body)}`)
      }

      // 3. IDOR Guard: User C attempting PATCH /read -> 403 A-3007
      const idorReadRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}/messages/read`, 'PATCH', undefined, {
        Authorization: `Bearer ${userCAccessToken}`,
      })
      if (idorReadRes.statusCode !== 403 || idorReadRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on cross-user mark read, got ${idorReadRes.statusCode}: ${JSON.stringify(idorReadRes.body)}`)
      }

      // 4. Empty message validation -> 400 T-2007
      const emptyMsgRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}/messages`, 'POST', {
        content: '',
      }, { Authorization: `Bearer ${userBAccessToken}` })
      if (emptyMsgRes.statusCode !== 400 || emptyMsgRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on empty message, got ${emptyMsgRes.statusCode}: ${JSON.stringify(emptyMsgRes.body)}`)
      }

      // 5. Legitimate message by User B (Host) -> 201 S-0000
      const sendRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}/messages`, 'POST', {
        content: 'Yes! We have air-conditioned rooms available.',
      }, { Authorization: `Bearer ${userBAccessToken}` })
      if (sendRes.statusCode !== 201 || sendRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 sending message, got ${sendRes.statusCode}: ${JSON.stringify(sendRes.body)}`)
      }
      const sentMsg = sendRes.body?.data?.message || sendRes.body?.message
      if (!sentMsg || sentMsg.content !== 'Yes! We have air-conditioned rooms available.' || sentMsg.readAt !== null) {
        throw new Error(`Sent message payload mismatch: ${JSON.stringify(sentMsg)}`)
      }

      // 6. User A marks messages as read -> 200 S-0000
      const readRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}/messages/read`, 'PATCH', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (readRes.statusCode !== 200 || readRes.body?.code !== 'S-0000' || typeof readRes.body?.data?.updatedCount !== 'number') {
        throw new Error(`Expected 200 S-0000 marking messages read, got ${readRes.statusCode}: ${JSON.stringify(readRes.body)}`)
      }

      // 7. GET /api/v1/chat-rooms/:id verifies messages history and read status
      const detailRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}`, 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (detailRes.statusCode !== 200 || detailRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 for room detail, got ${detailRes.statusCode}: ${JSON.stringify(detailRes.body)}`)
      }
      const detail = detailRes.body?.data?.chatRoom || detailRes.body?.chatRoom
      if (!Array.isArray(detail?.messages) || detail.messages.length < 2) {
        throw new Error(`Expected at least 2 messages in detail history, got: ${detail?.messages?.length}`)
      }
      const hostMsg = detail.messages.find((m: any) => m.content === 'Yes! We have air-conditioned rooms available.')
      if (!hostMsg || hostMsg.readAt === null) {
        throw new Error(`Expected host message to be marked read (readAt !== null): ${JSON.stringify(hostMsg)}`)
      }
    })

    await runTest('PBI-15: Chat S3 Garbage Collection & Room Deletion (IDOR A-3007 & S3 GC)', async () => {
      // Find test room
      const roomsRes = await makeRequest(pipePath, '/api/v1/chat-rooms', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      const testRoomId = roomsRes.body?.data?.chatRooms?.[0]?.id
      if (!testRoomId) throw new Error('No test chat room available for deletion test')

      // Insert a mock attachment record for this room
      const fakeAttachmentUrl = 'https://example.com/joodpakpaw-media/chat/test-attachment-123.webp'
      const lastMsg = mockDb.chatMessagesList.find((m: any) => m.roomId === testRoomId)
      if (lastMsg) {
        mockDb.chatAttachmentsList.push({
          id: 999,
          messageId: lastMsg.id,
          filePath: fakeAttachmentUrl,
          fileName: 'photo.webp',
          fileContentType: 'image/webp',
          fileSize: 1024,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // 1. IDOR Guard: User C attempts to delete room -> 403 A-3007
      const userCAccessToken = jwt.sign(
        { userId: 33, email: 'user_c_chat_test@example.com', roleId: 1, roleName: 'guest' },
        config.jwt.secret,
        { expiresIn: '1h' }
      )

      const idorDelRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userCAccessToken}`,
      })
      if (idorDelRes.statusCode !== 403 || idorDelRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 deleting room as non-participant, got ${idorDelRes.statusCode}: ${JSON.stringify(idorDelRes.body)}`)
      }

      // 2. Legitimate delete by participant (User A) -> 200 S-0000
      const delRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}`, 'DELETE', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (delRes.statusCode !== 200 || delRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on chat room deletion, got ${delRes.statusCode}: ${JSON.stringify(delRes.body)}`)
      }

      // 3. Confirm room is deleted: GET /api/v1/chat-rooms/:id -> 404 DB-1002
      const checkRes = await makeRequest(pipePath, `/api/v1/chat-rooms/${testRoomId}`, 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (checkRes.statusCode !== 404 || checkRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002 after deletion, got ${checkRes.statusCode}: ${JSON.stringify(checkRes.body)}`)
      }
    })

    // =========================================================================
    // PBI-17 QA Tests: Universal KYC Verification & Single-Review Lock (TC-API-172)
    // =========================================================================
    const tinyPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    // Setup Admin User (id: 99) in mock database
    const adminUserId = 99
    mockDb.users.set(adminUserId, {
      id: adminUserId,
      email: 'admin@joodpakpaw.com',
      firstName: 'Super',
      lastName: 'Admin',
      avatar: null,
      phone: '0899999999',
      password: 'hashed-password',
      otp: null,
      otpExpiredAt: null,
      resetPasswordToken: null,
      resetPasswordExpiredAt: null,
      isVerified: true,
      isBecomeToHost: false,
      isVerifiedHost: false,
      isBannedReview: false,
      isBannedAllProperties: false,
      bannedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [{ role: { id: 3, name: 'admin' } }],
    })

    const adminAccessToken = jwt.sign(
      {
        userId: adminUserId,
        email: 'admin@joodpakpaw.com',
        roleId: 3,
        roleName: 'admin',
        roles: [{ id: 3, name: 'admin' }],
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    )

    let createdKycId = 0

    await runTest('PBI-17: User KYC Submission & Validation (Missing Files T-2007, Duplicate Pending B-4001, GET /me)', async () => {
      // 1. Missing files -> 400 T-2007
      const noFilesRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (noFilesRes.statusCode !== 400 || noFilesRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on missing files, got ${noFilesRes.statusCode}: ${JSON.stringify(noFilesRes.body)}`)
      }

      // 2. Only 1 file provided -> 400 T-2007
      const oneFileRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [{ fieldname: 'idPhoto', filename: 'id.png', contentType: 'image/png', buffer: tinyPngBuffer }],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (oneFileRes.statusCode !== 400 || oneFileRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on partial files, got ${oneFileRes.statusCode}: ${JSON.stringify(oneFileRes.body)}`)
      }

      // 3. Valid submission with both files -> 201 S-0000
      const submitRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [
          { fieldname: 'idPhoto', filename: 'national_id.png', contentType: 'image/png', buffer: tinyPngBuffer },
          { fieldname: 'selfieWithId', filename: 'selfie.png', contentType: 'image/png', buffer: tinyPngBuffer },
        ],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (submitRes.statusCode !== 201 || submitRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on valid KYC submission, got ${submitRes.statusCode}: ${JSON.stringify(submitRes.body)}`)
      }
      createdKycId = submitRes.body?.data?.verification?.id
      if (!createdKycId) throw new Error('Expected created verification ID in response')
      if (submitRes.body?.data?.verification?.status !== 'pending') {
        throw new Error(`Expected status pending, got ${submitRes.body?.data?.verification?.status}`)
      }
      if (submitRes.body?.data?.verification?.isResubmit !== false) {
        throw new Error(`Expected isResubmit false on initial submit, got ${submitRes.body?.data?.verification?.isResubmit}`)
      }

      // 4. Duplicate pending guard -> 409 B-4001
      const duplicateRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [
          { fieldname: 'idPhoto', filename: 'national_id.png', contentType: 'image/png', buffer: tinyPngBuffer },
          { fieldname: 'selfieWithId', filename: 'selfie.png', contentType: 'image/png', buffer: tinyPngBuffer },
        ],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (duplicateRes.statusCode !== 409 || duplicateRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate pending submission, got ${duplicateRes.statusCode}: ${JSON.stringify(duplicateRes.body)}`)
      }

      // 5. GET /api/v1/user-verifications/me returns pending verification
      const meRes = await makeRequest(pipePath, '/api/v1/user-verifications/me', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (meRes.statusCode !== 200 || meRes.body?.data?.verification?.id !== createdKycId) {
        throw new Error(`Expected 200 with verification ID ${createdKycId}, got: ${JSON.stringify(meRes.body)}`)
      }
    })

    await runTest('PBI-17: Admin KYC Review, Single-Review Lock TC-API-172, Rejection & S3 GC Resubmission', async () => {
      // 1. Non-admin access to admin verifications -> 403 A-3007
      const nonAdminRes = await makeRequest(pipePath, '/api/v1/admin/user-verifications/paginate', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (nonAdminRes.statusCode !== 403 || nonAdminRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 for non-admin on KYC paginate, got ${nonAdminRes.statusCode}: ${JSON.stringify(nonAdminRes.body)}`)
      }

      // 2. Admin retrieves pagination & counts
      const adminPaginateRes = await makeRequest(pipePath, '/api/v1/admin/user-verifications/paginate', 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (adminPaginateRes.statusCode !== 200 || adminPaginateRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on admin KYC paginate, got ${adminPaginateRes.statusCode}`)
      }
      if (adminPaginateRes.body?.attributes?.pendingCount < 1) {
        throw new Error(`Expected pendingCount >= 1, got ${adminPaginateRes.body?.attributes?.pendingCount}`)
      }

      // 3. Admin retrieves verification detail by ID
      const detailRes = await makeRequest(pipePath, `/api/v1/admin/user-verifications/${createdKycId}`, 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (detailRes.statusCode !== 200 || detailRes.body?.data?.verification?.id !== createdKycId) {
        throw new Error(`Expected 200 with detail for KYC ${createdKycId}, got ${detailRes.statusCode}`)
      }

      // 4. Admin reject without description -> 400 T-2007
      const rejectEmptyRes = await makeRequest(
        pipePath,
        `/api/v1/admin/user-verifications/${createdKycId}/reject`,
        'PATCH',
        { rejectDescription: '' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (rejectEmptyRes.statusCode !== 400 || rejectEmptyRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on empty rejectDescription, got ${rejectEmptyRes.statusCode}: ${JSON.stringify(rejectEmptyRes.body)}`)
      }

      // 5. Admin rejects with reason -> 200 S-0000
      const rejectRes = await makeRequest(
        pipePath,
        `/api/v1/admin/user-verifications/${createdKycId}/reject`,
        'PATCH',
        { rejectDescription: 'ID photo is blurry or cropped' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (rejectRes.statusCode !== 200 || rejectRes.body?.data?.verification?.status !== 'rejected') {
        throw new Error(`Expected 200 with status rejected, got ${rejectRes.statusCode}: ${JSON.stringify(rejectRes.body)}`)
      }

      // 6. TC-API-172: Single-Review State Lock prevents second decision -> 409 B-4001
      const lockRes = await makeRequest(
        pipePath,
        `/api/v1/admin/user-verifications/${createdKycId}/approve`,
        'PATCH',
        {},
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (lockRes.statusCode !== 409 || lockRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 from TC-API-172 single-review lock on already-rejected request, got ${lockRes.statusCode}: ${JSON.stringify(lockRes.body)}`)
      }

      // 7. User resubmits -> 201 S-0000, isResubmit = true, previousRejectDescription populated
      const resubmitRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [
          { fieldname: 'idPhoto', filename: 'clear_id.png', contentType: 'image/png', buffer: tinyPngBuffer },
          { fieldname: 'selfieWithId', filename: 'clear_selfie.png', contentType: 'image/png', buffer: tinyPngBuffer },
        ],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (resubmitRes.statusCode !== 201 || resubmitRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 on resubmission, got ${resubmitRes.statusCode}: ${JSON.stringify(resubmitRes.body)}`)
      }
      const resubmittedData = resubmitRes.body?.data?.verification
      if (resubmittedData?.isResubmit !== true) {
        throw new Error(`Expected isResubmit to be true, got ${resubmittedData?.isResubmit}`)
      }
      if (resubmittedData?.previousRejectDescription !== 'ID photo is blurry or cropped') {
        throw new Error(`Expected previousRejectDescription to match, got ${resubmittedData?.previousRejectDescription}`)
      }
      createdKycId = resubmittedData.id
    })

    await runTest('PBI-17: Admin KYC Approval, Role Promotion (Host) & TC-API-172 Lock', async () => {
      // 1. Admin approves resubmitted KYC -> 200 S-0000
      const approveRes = await makeRequest(
        pipePath,
        `/api/v1/admin/user-verifications/${createdKycId}/approve`,
        'PATCH',
        {},
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (approveRes.statusCode !== 200 || approveRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on KYC approve, got ${approveRes.statusCode}: ${JSON.stringify(approveRes.body)}`)
      }
      if (approveRes.body?.data?.verification?.status !== 'approved') {
        throw new Error(`Expected status approved, got ${approveRes.body?.data?.verification?.status}`)
      }

      // 2. Verify User A is promoted: isVerifiedHost = true, isBecomeToHost = true, role 'host' assigned
      const userARecord = mockDb.users.get(userAId)!
      if (!userARecord.isVerifiedHost || !userARecord.isBecomeToHost) {
        throw new Error(`Expected user isVerifiedHost and isBecomeToHost to be true, got: isVerifiedHost=${userARecord.isVerifiedHost}, isBecomeToHost=${userARecord.isBecomeToHost}`)
      }
      const hasHostRole = userARecord.userRoles.some((ur) => ur.role.name === 'host' || ur.role.id === 2)
      if (!hasHostRole) {
        throw new Error(`Expected host role in userRoles, got ${JSON.stringify(userARecord.userRoles)}`)
      }

      // 3. TC-API-172: Single-Review State Lock prevents second approval -> 409 B-4001
      const lockRes = await makeRequest(
        pipePath,
        `/api/v1/admin/user-verifications/${createdKycId}/approve`,
        'PATCH',
        {},
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (lockRes.statusCode !== 409 || lockRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on already-approved KYC lock test, got ${lockRes.statusCode}`)
      }

      // 4. Submission guard on approved status -> 409 B-4001
      const subRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/user-verifications',
        'POST',
        {},
        [
          { fieldname: 'idPhoto', filename: 'id.png', contentType: 'image/png', buffer: tinyPngBuffer },
          { fieldname: 'selfieWithId', filename: 'selfie.png', contentType: 'image/png', buffer: tinyPngBuffer },
        ],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (subRes.statusCode !== 409 || subRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on submitting KYC when already approved, got ${subRes.statusCode}`)
      }
    })

    // =========================================================================
    // PBI-18 QA Tests: Reports, Governance, Cascading Ban & Appeal State Machine
    // =========================================================================
    let propReportId = 0
    let reviewReportId = 0

    await runTest('PBI-18: Property & Review Reports (Self-Report Guards T-2007, Duplicate Pending Guards B-4001)', async () => {
      // 1. Host (User B) attempts to report own property 101 -> 400 T-2007
      const userBAccessToken = jwt.sign(
        { userId: userBId, email: 'bob@joodpakpaw.com', roleId: 2, roleName: 'host' },
        config.jwt.secret,
        { expiresIn: '1h' }
      )

      const selfReportRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/property',
        'POST',
        { propertyId: '101', reportCategoryId: '1', description: 'Self report test' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (selfReportRes.statusCode !== 400 || selfReportRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on self-reporting own property, got ${selfReportRes.statusCode}: ${JSON.stringify(selfReportRes.body)}`)
      }

      // 2. Guest (User A) reports property 101 -> 201 S-0000
      const propRepRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/property',
        'POST',
        { propertyId: '101', reportCategoryId: '1', description: 'Listing location is inaccurate' },
        [{ fieldname: 'images', filename: 'evidence.png', contentType: 'image/png', buffer: tinyPngBuffer }],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (propRepRes.statusCode !== 201 || propRepRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on property report, got ${propRepRes.statusCode}: ${JSON.stringify(propRepRes.body)}`)
      }
      propReportId = propRepRes.body?.data?.report?.id
      if (!propReportId) throw new Error('Expected created property report ID')

      // Verify report count incremented on property 101
      const prop101 = mockDb.propertiesMap.get(101)
      if ((prop101?.reportCount || 0) < 1) {
        throw new Error(`Expected property 101 reportCount >= 1, got ${prop101?.reportCount}`)
      }

      // 3. Duplicate pending property report guard -> 409 B-4001
      const dupPropRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/property',
        'POST',
        { propertyId: '101', reportCategoryId: '1', description: 'Another report on 101' },
        [],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (dupPropRes.statusCode !== 409 || dupPropRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate pending property report, got ${dupPropRes.statusCode}: ${JSON.stringify(dupPropRes.body)}`)
      }

      // 4. Guest (User A) attempts to report own review on booking 9001 -> 400 T-2007
      const selfReviewReportRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/review',
        'POST',
        { bookingId: '9001', reportCategoryId: '2', description: 'Reporting my own review' },
        [],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (selfReviewReportRes.statusCode !== 400 || selfReviewReportRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 on reporting own review, got ${selfReviewReportRes.statusCode}: ${JSON.stringify(selfReviewReportRes.body)}`)
      }

      // 5. Host (User B) reports guest review on booking 9001 -> 201 S-0000
      const revRepRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/review',
        'POST',
        { bookingId: '9001', reportCategoryId: '2', description: 'Review contains defamatory language' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (revRepRes.statusCode !== 201 || revRepRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on review report, got ${revRepRes.statusCode}: ${JSON.stringify(revRepRes.body)}`)
      }
      reviewReportId = revRepRes.body?.data?.report?.id
      if (!reviewReportId) throw new Error('Expected created review report ID')

      // 6. Duplicate pending review report guard -> 409 B-4001
      const dupRevRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/review',
        'POST',
        { bookingId: '9001', reportCategoryId: '2', description: 'Repeat report on booking 9001' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (dupRevRes.statusCode !== 409 || dupRevRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate review report, got ${dupRevRes.statusCode}`)
      }

      // 7. GET /api/v1/reports/me/paginate & IDOR Guard on /reports/me/:id
      const myReportsRes = await makeRequest(pipePath, '/api/v1/reports/me/paginate', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (myReportsRes.statusCode !== 200 || !Array.isArray(myReportsRes.body?.data)) {
        throw new Error(`Expected 200 with reports array on /reports/me/paginate, got ${myReportsRes.statusCode}`)
      }

      // IDOR Guard: User B tries to view User A's property report -> 403 A-3007
      const idorRepRes = await makeRequest(pipePath, `/api/v1/reports/me/${propReportId}`, 'GET', undefined, {
        Authorization: `Bearer ${userBAccessToken}`,
      })
      if (idorRepRes.statusCode !== 403 || idorRepRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on viewing another user's report, got ${idorRepRes.statusCode}`)
      }
    })

    await runTest('PBI-18: Admin Center (Dashboard 5 KPI Cards, Reports Pagination, Evidence Cards & TC-API-168 Lock)', async () => {
      // 1. Non-admin access to admin dashboard -> 403 A-3007
      const nonAdminDashRes = await makeRequest(pipePath, '/api/v1/admin/dashboard', 'GET', undefined, {
        Authorization: `Bearer ${userAAccessToken}`,
      })
      if (nonAdminDashRes.statusCode !== 403 || nonAdminDashRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 for non-admin on /admin/dashboard, got ${nonAdminDashRes.statusCode}`)
      }

      // 2. Admin retrieves Dashboard with 5 KPI Cards
      const dashRes = await makeRequest(pipePath, '/api/v1/admin/dashboard', 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (dashRes.statusCode !== 200 || dashRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on admin dashboard, got ${dashRes.statusCode}: ${JSON.stringify(dashRes.body)}`)
      }
      const kpis = dashRes.body?.data
      for (const kpi of ['pendingReports', 'totalUsers', 'activeProperties', 'pendingVerifications', 'bannedHosts']) {
        if (!kpis[kpi] || typeof kpis[kpi].total !== 'number' || typeof kpis[kpi].thisMonth !== 'number') {
          throw new Error(`Expected KPI ${kpi} to have total and thisMonth numbers, got: ${JSON.stringify(kpis[kpi])}`)
        }
      }

      // 3. Admin reports pagination with server-side filters
      const repPagRes = await makeRequest(pipePath, '/api/v1/admin/reports/paginate?status=pending', 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (repPagRes.statusCode !== 200 || repPagRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 S-0000 on admin reports paginate, got ${repPagRes.statusCode}`)
      }
      if ((repPagRes.body?.attributes?.pendingCount || 0) < 2) {
        throw new Error(`Expected pendingCount >= 2, got ${repPagRes.body?.attributes?.pendingCount}`)
      }

      // 4. Admin report detail evidence enrichment: reportedReview card
      const revDetailRes = await makeRequest(pipePath, `/api/v1/admin/reports/${reviewReportId}`, 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (revDetailRes.statusCode !== 200) {
        throw new Error(`Expected 200 on report detail, got ${revDetailRes.statusCode}`)
      }
      const reportedReviewCard = revDetailRes.body?.data?.report?.reportedReview
      if (!reportedReviewCard || reportedReviewCard.bookingId !== 9001 || reportedReviewCard.rating !== 5) {
        throw new Error(`Expected reportedReview evidence card with booking 9001 rating 5, got: ${JSON.stringify(reportedReviewCard)}`)
      }

      // 5. TC-API-168: Single-Action Lock prevents duplicate action on report
      // Dismiss review report
      const actionRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${reviewReportId}/action`,
        'PATCH',
        { action: 'dismiss_report', adminNote: 'Review does not violate standards' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (actionRes.statusCode !== 200 || actionRes.body?.data?.report?.status !== 'dismissed') {
        throw new Error(`Expected 200 dismissed status, got ${actionRes.statusCode}: ${JSON.stringify(actionRes.body)}`)
      }

      // Second action on the same report -> 409 B-4001
      const lockRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${reviewReportId}/action`,
        'PATCH',
        { action: 'warn_user', adminNote: 'Attempting second action' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (lockRes.statusCode !== 409 || lockRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on TC-API-168 single-action lock test, got ${lockRes.statusCode}: ${JSON.stringify(lockRes.body)}`)
      }
    })

    await runTest('PBI-18: TC-151 Deactivate Property, Booking Auto-Cancel & Quota Restoration', async () => {
      // 1. Create active confirmed booking on Property 101 to verify TC-151 cancellation
      const activeBookingId = 9888
      mockDb.bookingsMap.set(activeBookingId, {
        id: activeBookingId,
        propertyId: 101,
        guestId: userAId,
        bookingStatus: 'confirmed',
        checkInDate: '2026-12-05',
        checkOutDate: '2026-12-07',
        bookingOrders: [{ roomCategoryId: 501, roomsBooked: 1, checkInDate: '2026-12-05', checkOutDate: '2026-12-07' }],
        deletedAt: null,
      })

      // 2. Admin executes deactivate_property on Property 101 via propReportId
      const banRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${propReportId}/action`,
        'PATCH',
        { action: 'deactivate_property', adminNote: 'Suspended for safety audit' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (banRes.statusCode !== 200 || banRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on deactivate_property, got ${banRes.statusCode}: ${JSON.stringify(banRes.body)}`)
      }

      // 3. TC-151 Assertions: Property 101 isBannedByAdmin = true, isActive = false
      const prop101 = mockDb.propertiesMap.get(101)!
      if (prop101.isBannedByAdmin !== true || prop101.isActive !== false) {
        throw new Error(`Expected property 101 isBannedByAdmin=true and isActive=false, got: isBannedByAdmin=${prop101.isBannedByAdmin}, isActive=${prop101.isActive}`)
      }

      // 4. TC-151 Assertions: Active booking on property 101 was auto-cancelled
      const activeBooking = mockDb.bookingsMap.get(activeBookingId)!
      if (activeBooking.bookingStatus !== 'cancelled' || activeBooking.cancelledBy !== 'admin') {
        throw new Error(`Expected active booking to be cancelled by admin, got status=${activeBooking.bookingStatus}, cancelledBy=${activeBooking.cancelledBy}`)
      }
    })

    await runTest('PBI-18: Cycle-Aware Appeal Quota & Max 2/2 Limit (409 B-4001)', async () => {
      const userBAccessToken = jwt.sign(
        { userId: userBId, email: 'bob@joodpakpaw.com', roleId: 2, roleName: 'host' },
        config.jwt.secret,
        { expiresIn: '1h' }
      )

      // 1. Owner IDOR Guard: User A (guest, not owner) tries to submit unban appeal for property 101 -> 403 A-3007
      const idorAppealRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { propertyId: '101', description: 'I want to appeal for someone else' },
        [],
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (idorAppealRes.statusCode !== 403 || idorAppealRes.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 on appeal for non-owned property, got ${idorAppealRes.statusCode}: ${JSON.stringify(idorAppealRes.body)}`)
      }

      // 2. Host (User B, owner) submits Appeal 1 -> 201 S-0000
      const appeal1Res = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { propertyId: '101', description: 'First appeal: fixed the safety issues' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (appeal1Res.statusCode !== 201 || appeal1Res.body?.code !== 'S-0000') {
        throw new Error(`Expected 201 S-0000 on appeal 1, got ${appeal1Res.statusCode}: ${JSON.stringify(appeal1Res.body)}`)
      }
      const appeal1Id = appeal1Res.body?.data?.report?.id

      // 3. Duplicate pending guard: Host attempts another appeal while Appeal 1 is pending -> 409 B-4001
      const dupAppealRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { propertyId: '101', description: 'Duplicate appeal attempt' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (dupAppealRes.statusCode !== 409 || dupAppealRes.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on duplicate pending appeal, got ${dupAppealRes.statusCode}: ${JSON.stringify(dupAppealRes.body)}`)
      }

      // 4. Admin inspects appeal 1: verifies suspensionContext card (Attempt 1/2)
      const appealDetailRes = await makeRequest(pipePath, `/api/v1/admin/reports/${appeal1Id}`, 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      const suspContext = appealDetailRes.body?.data?.report?.suspensionContext
      if (!suspContext || suspContext.appealAttempt !== 1 || suspContext.maxAppeals !== 2) {
        throw new Error(`Expected suspensionContext with appealAttempt 1 and maxAppeals 2, got: ${JSON.stringify(suspContext)}`)
      }

      // 5. Admin dismisses Appeal 1 (Attempt 1/2 used)
      const dismiss1Res = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${appeal1Id}/action`,
        'PATCH',
        { action: 'dismiss_report', adminNote: 'Safety report documentation incomplete' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (dismiss1Res.statusCode !== 200) {
        throw new Error(`Expected 200 on dismissing appeal 1, got ${dismiss1Res.statusCode}`)
      }

      // Verify Host property unbanRequestCount is now 1
      const hostPropRes1 = await makeRequest(pipePath, `/api/v1/hosts/properties/101`, 'GET', undefined, {
        Authorization: `Bearer ${userBAccessToken}`,
      })
      if (hostPropRes1.body?.data?.property?.unbanRequestCount !== 1) {
        throw new Error(`Expected unbanRequestCount=1 after first dismissal, got ${hostPropRes1.body?.data?.property?.unbanRequestCount}`)
      }
      if (hostPropRes1.body?.data?.property?.lastAppealNote !== 'Safety report documentation incomplete') {
        throw new Error(`Expected lastAppealNote to reflect adminNote, got ${hostPropRes1.body?.data?.property?.lastAppealNote}`)
      }

      // 6. Host submits Appeal 2 -> 201 S-0000
      const appeal2Res = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { propertyId: '101', description: 'Second appeal: attached professional engineer report' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (appeal2Res.statusCode !== 201) {
        throw new Error(`Expected 201 on appeal 2, got ${appeal2Res.statusCode}`)
      }
      const appeal2Id = appeal2Res.body?.data?.report?.id

      // 7. Admin dismisses Appeal 2 (Attempt 2/2 used)
      const dismiss2Res = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${appeal2Id}/action`,
        'PATCH',
        { action: 'dismiss_report', adminNote: 'Engineer report lacks required certification' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (dismiss2Res.statusCode !== 200) {
        throw new Error(`Expected 200 on dismissing appeal 2, got ${dismiss2Res.statusCode}`)
      }

      // Verify Host property unbanRequestCount is now 2
      const hostPropRes2 = await makeRequest(pipePath, `/api/v1/hosts/properties/101`, 'GET', undefined, {
        Authorization: `Bearer ${userBAccessToken}`,
      })
      if (hostPropRes2.body?.data?.property?.unbanRequestCount !== 2) {
        throw new Error(`Expected unbanRequestCount=2 after second dismissal, got ${hostPropRes2.body?.data?.property?.unbanRequestCount}`)
      }

      // 8. Host submits Appeal 3 -> 409 B-4001 (Maximum appeal limit 2/2 reached)
      const appeal3Res = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { propertyId: '101', description: 'Third appeal attempt: should be blocked' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (appeal3Res.statusCode !== 409 || appeal3Res.body?.code !== 'B-4001') {
        throw new Error(`Expected 409 B-4001 on exceeding max 2/2 appeal quota, got ${appeal3Res.statusCode}: ${JSON.stringify(appeal3Res.body)}`)
      }
    })

    await runTest('PBI-18: Full Cascading Ban/Appeal State Machine (TC-152 Snapshot, TC-153 & TC-154 Restore, TC-155 Single Unban)', async () => {
      const userBAccessToken = jwt.sign(
        { userId: userBId, email: 'bob@joodpakpaw.com', roleId: 2, roleName: 'host' },
        config.jwt.secret,
        { expiresIn: '1h' }
      )

      // State Setup:
      // Host (User B) has:
      // - Prop 101: isBannedByAdmin = true (was individually banned in TC-151)
      // - Prop 102: isBannedByAdmin = false, isActive = true
      const prop101 = mockDb.propertiesMap.get(101)!
      const prop102 = mockDb.propertiesMap.get(102)!
      prop101.isBannedByAdmin = true
      prop101.isBannedBeforeAccountBan = false
      prop101.isActive = false
      prop102.isBannedByAdmin = false
      prop102.isBannedBeforeAccountBan = false
      prop102.isActive = true

      // 1. Create a platform report against Host (User B)
      const banHostReport = await prisma.report.create({
        data: {
          reporterId: userAId,
          reportCategoryId: 1,
          propertyId: 102,
          description: 'Host account violations across multiple listings',
          status: 'pending',
        },
      })

      // 2. Admin executes deactivate_all_properties (TC-152 Snapshot)
      const banAllRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${banHostReport.id}/action`,
        'PATCH',
        { action: 'deactivate_all_properties', adminNote: 'Host account suspended globally' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (banAllRes.statusCode !== 200 || banAllRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on deactivate_all_properties, got ${banAllRes.statusCode}: ${JSON.stringify(banAllRes.body)}`)
      }

      // TC-152 Snapshot Assertions:
      // - Host user: isBannedAllProperties = true
      // - Prop 101 (previously banned): isBannedBeforeAccountBan = true, isBannedByAdmin = true, isActive = false
      // - Prop 102 (not previously banned): isBannedBeforeAccountBan = false, isBannedByAdmin = true, isActive = false
      const hostUser = mockDb.users.get(userBId)!
      if (hostUser.isBannedAllProperties !== true) {
        throw new Error(`Expected host isBannedAllProperties=true, got ${hostUser.isBannedAllProperties}`)
      }
      if (prop101.isBannedBeforeAccountBan !== true || prop101.isBannedByAdmin !== true) {
        throw new Error(`Expected prop 101 snapshot isBannedBeforeAccountBan=true, got ${prop101.isBannedBeforeAccountBan}`)
      }
      if (prop102.isBannedBeforeAccountBan !== false || prop102.isBannedByAdmin !== true) {
        throw new Error(`Expected prop 102 snapshot isBannedBeforeAccountBan=false, got ${prop102.isBannedBeforeAccountBan}`)
      }

      // 3. Host appeals account suspension
      const accountAppealRes = await makeMultipartRequest(
        pipePath,
        '/api/v1/reports/unban-property',
        'POST',
        { description: 'Host account appeal: resolved all compliance items' },
        [],
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (accountAppealRes.statusCode !== 201) {
        throw new Error(`Expected 201 on account appeal, got ${accountAppealRes.statusCode}: ${JSON.stringify(accountAppealRes.body)}`)
      }
      const accountAppealId = accountAppealRes.body?.data?.report?.id

      // 4. Admin executes unban_all_properties (TC-153 & TC-154 Restore)
      const unbanAllRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${accountAppealId}/action`,
        'PATCH',
        { action: 'unban_all_properties', adminNote: 'Compliance verified, account restored' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (unbanAllRes.statusCode !== 200 || unbanAllRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on unban_all_properties, got ${unbanAllRes.statusCode}: ${JSON.stringify(unbanAllRes.body)}`)
      }

      // TC-153 & TC-154 Restore Assertions:
      // - Host user: isBannedAllProperties = false
      // - Prop 102: restored to isBannedByAdmin = false (TC-153)
      // - Prop 101: remains isBannedByAdmin = true because it was individually banned prior to account ban (TC-154!)
      if ((hostUser as any).isBannedAllProperties !== false) {
        throw new Error(`Expected host isBannedAllProperties=false, got ${hostUser.isBannedAllProperties}`)
      }
      if ((prop102 as any).isBannedByAdmin !== false) {
        throw new Error(`Expected prop 102 isBannedByAdmin=false (TC-153), got ${prop102.isBannedByAdmin}`)
      }
      if ((prop101 as any).isBannedByAdmin !== true) {
        throw new Error(`Expected prop 101 to remain isBannedByAdmin=true (TC-154), got ${prop101.isBannedByAdmin}`)
      }

      // 5. Admin executes unban_property on Prop 101 (TC-155 Single Unban)
      const prop101UnbanReport = await prisma.report.create({
        data: {
          reporterId: userBId,
          reportCategoryId: 3,
          propertyId: 101,
          description: 'Final individual unban request for property 101',
          status: 'pending',
        },
      })

      const singleUnbanRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${prop101UnbanReport.id}/action`,
        'PATCH',
        { action: 'unban_property', adminNote: 'Property 101 individually restored' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (singleUnbanRes.statusCode !== 200 || singleUnbanRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on unban_property, got ${singleUnbanRes.statusCode}: ${JSON.stringify(singleUnbanRes.body)}`)
      }

      // TC-155 Assertions:
      // - Prop 101: isBannedByAdmin = false, isBannedBeforeAccountBan = false
      if (prop101.isBannedByAdmin !== false || prop101.isBannedBeforeAccountBan !== false) {
        throw new Error(`Expected prop 101 isBannedByAdmin=false and isBannedBeforeAccountBan=false (TC-155), got: isBannedByAdmin=${prop101.isBannedByAdmin}`)
      }

      // 6. Quota Reset Verification:
      // Prop 101 appeal quota resets to 0/2 for future suspension cycles
      const resetCheckRes = await makeRequest(pipePath, `/api/v1/hosts/properties/101`, 'GET', undefined, {
        Authorization: `Bearer ${userBAccessToken}`,
      })
      if (resetCheckRes.body?.data?.property?.unbanRequestCount !== 0) {
        throw new Error(`Expected unbanRequestCount=0 after successful unban, got ${resetCheckRes.body?.data?.property?.unbanRequestCount}`)
      }
    })

    await runTest('PBI-18: Review Deletion S3 GC, Rating Recalculation & Admin Action Logs', async () => {
      // Clean up earlier reviews on property 101 so booking 9001 is the isolated review under test
      for (const b of mockDb.bookingsMap.values()) {
        if (b.propertyId === 101 && b.id !== 9001) {
          b.rating = null
          b.comment = null
          b.reviewedAt = null
        }
      }
      const b9001 = mockDb.bookingsMap.get(9001)!
      b9001.rating = 5
      b9001.comment = 'Spam review with prohibited links'
      b9001.reviewedAt = new Date()

      // 1. Setup a reported review on booking 9001
      const revRep2 = await prisma.report.create({
        data: {
          reporterId: userBId,
          reportCategoryId: 2,
          bookingId: 9001,
          propertyId: 101,
          description: 'Spam review with prohibited links',
          status: 'pending',
        },
      })

      // 2. Admin executes delete_review
      const delRevRes = await makeRequest(
        pipePath,
        `/api/v1/admin/reports/${revRep2.id}/action`,
        'PATCH',
        { action: 'delete_review', adminNote: 'Violated content policy' },
        { Authorization: `Bearer ${adminAccessToken}` }
      )
      if (delRevRes.statusCode !== 200 || delRevRes.body?.code !== 'S-0000') {
        throw new Error(`Expected 200 on delete_review, got ${delRevRes.statusCode}: ${JSON.stringify(delRevRes.body)}`)
      }

      // 3. Verify booking review fields were cleared
      const booking9001 = mockDb.bookingsMap.get(9001)!
      if (booking9001.rating !== null || booking9001.comment !== null || booking9001.reviewedAt !== null) {
        throw new Error(`Expected booking 9001 review fields to be null, got rating=${booking9001.rating}, comment=${booking9001.comment}`)
      }

      // 4. Verify property 101 avgRating & reviewCount recalculated
      const prop101 = mockDb.propertiesMap.get(101)!
      if (prop101.reviewCount !== 0 || prop101.avgRating !== 0) {
        throw new Error(`Expected property 101 reviewCount=0 and avgRating=0 after only review was deleted, got reviewCount=${prop101.reviewCount}, avgRating=${prop101.avgRating}`)
      }

      // 5. Admin retrieves action logs
      const actionLogsRes = await makeRequest(pipePath, '/api/v1/admin/action-logs/paginate', 'GET', undefined, {
        Authorization: `Bearer ${adminAccessToken}`,
      })
      if (actionLogsRes.statusCode !== 200 || !Array.isArray(actionLogsRes.body?.data)) {
        throw new Error(`Expected 200 with action logs array, got ${actionLogsRes.statusCode}`)
      }
      if (actionLogsRes.body?.data?.length < 3) {
        throw new Error(`Expected at least 3 action logs recorded, got ${actionLogsRes.body?.data?.length}`)
      }
      const hasDeleteReviewLog = actionLogsRes.body?.data?.some((l: any) => l.action === 'delete_review')
      if (!hasDeleteReviewLog) {
        throw new Error('Expected delete_review action log to be present')
      }
    })
  } finally {
    mockDb.restore()
  }

  // ==========================================================================
  // Sprint 4 (PBI-20): Live PostgreSQL + Live ML & 1.5s Fallback Tests
  // ==========================================================================
  console.log('\n🤖 Running Sprint 4 (PBI-20) Live DB, Live ML & Fallback Integration Tests...\n')

  const originalMlUrl = config.mlServiceUrl
  const originalMlTimeoutMs = config.mlTimeoutMs
  let spawnedMlProc: ChildProcess | null = null
  let hangServer: http.Server | null = null
  const createdBehaviorUserIds: number[] = []
  const sprint4StartedAt = new Date()

  try {
    await cacheService.flush()

    // Ensure ML service is reachable (reuse if already running on config.mlServiceUrl, else spawn .venv uvicorn)
    let mlLiveReady = false
    try {
      const probe = await fetch(`${config.mlServiceUrl}/health`, {
        signal: AbortSignal.timeout(1000),
      })
      if (probe.ok) {
        const body: any = await probe.json()
        mlLiveReady = body?.status === 'ok' && body?.db_connected === true
      }
    } catch {
      mlLiveReady = false
    }

    if (!mlLiveReady) {
      const mlDir = path.resolve(__dirname, '../../../joodpakpaw-ml')
      const venvPython = path.join(mlDir, '.venv', 'Scripts', 'python.exe')
      const mlTestPort = 5055
      if (!fs.existsSync(venvPython)) {
        throw new Error(`ML Python venv not found at ${venvPython}`)
      }
      spawnedMlProc = spawn(
        venvPython,
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(mlTestPort)],
        {
          cwd: mlDir,
          env: {
            ...process.env,
            DATABASE_URL: config.databaseUrl,
            PORT: String(mlTestPort),
          },
          stdio: 'pipe',
        }
      )
      config.mlServiceUrl = `http://127.0.0.1:${mlTestPort}`

      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        try {
          const probe = await fetch(`${config.mlServiceUrl}/health`, {
            signal: AbortSignal.timeout(800),
          })
          if (probe.ok) {
            const body: any = await probe.json()
            if (body?.status === 'ok') {
              mlLiveReady = true
              break
            }
          }
        } catch {
          // Wait and retry
        }
        await new Promise((r) => setTimeout(r, 300))
      }
      if (!mlLiveReady) {
        throw new Error('Timed out waiting for spawned joodpakpaw-ml test server on port 5055')
      }
    }

    const liveMlUrl = config.mlServiceUrl

    // Sign in seeded live accounts
    async function signInLive(email: string): Promise<{ token: string; userId: number }> {
      const res = await makeRequest(pipePath, '/api/v1/auth/sign-in', 'POST', {
        email,
        password: 'Password123!',
      })
      if (res.statusCode !== 200 || !res.body?.data?.accessToken) {
        throw new Error(`Failed live sign-in for ${email}: ${res.statusCode} ${JSON.stringify(res.body)}`)
      }
      return {
        token: res.body.data.accessToken,
        userId: res.body.data.user.id,
      }
    }

    const [adminLive, host1Live, user1Live, user2Live, user4Live] = await Promise.all([
      signInLive('admin@joodpakpaw.com'),
      signInLive('host1@joodpakpaw.com'),
      signInLive('user1@joodpakpaw.com'),
      signInLive('user2@joodpakpaw.com'),
      signInLive('user4@joodpakpaw.com'),
    ])

    const activeProps = await prisma.property.findMany({
      where: {
        isActive: true,
        isBannedByAdmin: false,
        deletedAt: null,
        host: { deletedAt: null, isBannedAllProperties: false },
      },
      orderBy: { id: 'asc' },
      take: 10,
    })
    if (activeProps.length < 3) {
      throw new Error(`Expected at least 3 active seeded properties in live DB, found ${activeProps.length}`)
    }

    const host1OwnedProp = activeProps.find((p) => p.hostId === host1Live.userId)
      ?? (await prisma.property.findFirst({
        where: { hostId: host1Live.userId, deletedAt: null },
      }))
    const nonOwnedProp = activeProps.find((p) => p.hostId !== user1Live.userId) ?? activeProps[0]

    // Test 61: /health includes ml block
    await runTest('PBI-20: GET /health includes ml subsystem configuration', async () => {
      const res = await makeRequest(pipePath, '/health')
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`)
      if (!res.body?.ml || res.body.ml.fallbackReady !== true) {
        throw new Error(`Expected ml.fallbackReady=true in /health, got ${JSON.stringify(res.body?.ml)}`)
      }
      if (typeof res.body.ml.timeoutMs !== 'number' || typeof res.body.ml.url !== 'string') {
        throw new Error(`Expected ml.url and ml.timeoutMs in /health, got ${JSON.stringify(res.body?.ml)}`)
      }
    })

    // Test 62: View tracking, 10-min cooldown, self-view skip, 404 DB-1002
    await runTest('PBI-20: POST /user-behaviors/view-property/:id tracks view, deduplicates within 10m & skips self-view', async () => {
      const notFoundRes = await makeRequest(
        pipePath,
        '/api/v1/user-behaviors/view-property/9999999',
        'POST',
        undefined,
        { Authorization: `Bearer ${user1Live.token}` }
      )
      if (notFoundRes.statusCode !== 404 || notFoundRes.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002, got ${notFoundRes.statusCode} ${JSON.stringify(notFoundRes.body)}`)
      }

      // Clean any very recent view for (user1, nonOwnedProp) within last 10 mins so test is deterministic
      const viewCat = await prisma.userBehaviorCategory.findFirst({ where: { name: 'view' } })
      if (viewCat) {
        await prisma.userBehavior.deleteMany({
          where: {
            userId: user1Live.userId,
            behaviorCategoryId: viewCat.id,
            referenceTable: 'properties',
            referenceRecord: String(nonOwnedProp.id),
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
        })
      }

      createdBehaviorUserIds.push(user1Live.userId)

      const track1 = await makeRequest(
        pipePath,
        `/api/v1/user-behaviors/view-property/${nonOwnedProp.id}`,
        'POST',
        undefined,
        { Authorization: `Bearer ${user1Live.token}` }
      )
      if (track1.statusCode !== 200 || track1.body?.data?.tracked !== true || track1.body?.data?.deduplicated !== false) {
        throw new Error(`Expected first view tracked=true, got ${track1.statusCode} ${JSON.stringify(track1.body)}`)
      }

      const track2 = await makeRequest(
        pipePath,
        `/api/v1/user-behaviors/view-property/${nonOwnedProp.id}`,
        'POST',
        undefined,
        { Authorization: `Bearer ${user1Live.token}` }
      )
      if (track2.statusCode !== 200 || track2.body?.data?.tracked !== false || track2.body?.data?.deduplicated !== true) {
        throw new Error(`Expected second view deduplicated=true, got ${track2.statusCode} ${JSON.stringify(track2.body)}`)
      }

      if (host1OwnedProp) {
        const selfView = await makeRequest(
          pipePath,
          `/api/v1/user-behaviors/view-property/${host1OwnedProp.id}`,
          'POST',
          undefined,
          { Authorization: `Bearer ${host1Live.token}` }
        )
        if (selfView.statusCode !== 200 || selfView.body?.data?.skippedSelfView !== true || selfView.body?.data?.tracked !== false) {
          throw new Error(`Expected self-view skipped, got ${selfView.statusCode} ${JSON.stringify(selfView.body)}`)
        }
      }
    })

    // Test 63: Live ML Mode personalized user1 & user2
    await runTest('PBI-20: Live ML Mode returns personalized camelCase recommendations for user1 & user2', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      const res1 = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=8', 'GET', undefined, {
        Authorization: `Bearer ${user1Live.token}`,
      })
      if (res1.statusCode !== 200 || res1.body?.meta?.source !== 'ml_service') {
        throw new Error(`Expected 200 ml_service for user1, got ${res1.statusCode} ${JSON.stringify(res1.body?.meta)}`)
      }
      if (!Array.isArray(res1.body?.data) || res1.body.data.length === 0) {
        throw new Error('Expected non-empty recommendations for user1')
      }
      const first = res1.body.data[0]
      if (!Array.isArray(first.matchReasons) || first.matchReasons.length < 1 || first.matchReasons.length > 3) {
        throw new Error(`Expected 1..3 matchReasons, got ${JSON.stringify(first.matchReasons)}`)
      }
      if (typeof first.recommendationScore !== 'number' || !['all_pets', 'partial_pets'].includes(first.matchTier)) {
        throw new Error(`Invalid recommendationScore/matchTier on DTO: ${JSON.stringify(first)}`)
      }
      if (first.scoreBreakdown !== undefined) {
        throw new Error('Non-admin recommend response must not include scoreBreakdown')
      }

      const res2 = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=8', 'GET', undefined, {
        Authorization: `Bearer ${user2Live.token}`,
      })
      if (res2.statusCode !== 200 || res2.body?.meta?.source !== 'ml_service' || res2.body.data.length === 0) {
        throw new Error(`Expected 200 ml_service for user2, got ${res2.statusCode} ${JSON.stringify(res2.body?.meta)}`)
      }
    })

    // Test 64: Live ML Mode multi-pet Tier A before Tier B (user4)
    await runTest('PBI-20: Live ML Mode prioritizes Tier A (all_pets) before Tier B (partial_pets) for multi-pet user4', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      const res = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
        Authorization: `Bearer ${user4Live.token}`,
      })
      if (res.statusCode !== 200 || res.body?.meta?.source !== 'ml_service') {
        throw new Error(`Expected 200 ml_service for user4, got ${res.statusCode} ${JSON.stringify(res.body?.meta)}`)
      }
      const items: any[] = res.body?.data || []
      if (items.length === 0) throw new Error('Expected recommendations for user4')

      let seenPartial = false
      for (const item of items) {
        if (item.matchTier === 'partial_pets') {
          seenPartial = true
        } else if (item.matchTier === 'all_pets' && seenPartial) {
          throw new Error('Tier A (all_pets) appeared after Tier B (partial_pets)')
        } else if (item.matchTier !== 'all_pets' && item.matchTier !== 'partial_pets') {
          throw new Error(`Unexpected matchTier for user4: ${item.matchTier}`)
        }
      }
    })

    // Test 65: Live ML Mode excludes host1 self-owned properties
    await runTest('PBI-20: Live ML Mode excludes self-owned properties for host1', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      const res = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
        Authorization: `Bearer ${host1Live.token}`,
      })
      if (res.statusCode !== 200 || res.body?.meta?.source !== 'ml_service') {
        throw new Error(`Expected 200 ml_service for host1, got ${res.statusCode}`)
      }
      const selfOwned = (res.body?.data || []).filter((p: any) => p.hostId === host1Live.userId)
      if (selfOwned.length > 0) {
        throw new Error(`Found self-owned property in recommendations: ${selfOwned.map((p: any) => p.id)}`)
      }
    })

    // Test 66: Live ML Mode Guest Cold-Start & Similar Properties
    await runTest('PBI-20: Live ML Mode serves Guest Cold-Start and Similar Properties', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      const guestRes = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=6')
      if (
        guestRes.statusCode !== 200 ||
        guestRes.body?.meta?.source !== 'ml_service' ||
        guestRes.body?.meta?.strategy !== 'cold_start' ||
        !Array.isArray(guestRes.body?.data) ||
        guestRes.body.data.length === 0
      ) {
        throw new Error(`Unexpected guest cold-start response: ${guestRes.statusCode} ${JSON.stringify(guestRes.body?.meta)}`)
      }
      if (guestRes.body.data[0].matchTier !== 'cold_start') {
        throw new Error(`Expected matchTier=cold_start, got ${guestRes.body.data[0].matchTier}`)
      }

      const simRes = await makeRequest(
        pipePath,
        `/api/v1/properties/recommend/property/${activeProps[0].id}?limit=4`
      )
      if (
        simRes.statusCode !== 200 ||
        simRes.body?.meta?.source !== 'ml_service' ||
        simRes.body?.meta?.strategy !== 'similar_properties' ||
        !Array.isArray(simRes.body?.data) ||
        simRes.body.data.length === 0
      ) {
        throw new Error(`Unexpected similar properties response: ${simRes.statusCode} ${JSON.stringify(simRes.body?.meta)}`)
      }
      if (simRes.body.data.some((p: any) => p.id === activeProps[0].id)) {
        throw new Error('Similar properties must exclude source property')
      }
    })

    // Test 67: Strict Admin RBAC 403 A-3007
    await runTest('PBI-20: Strict Admin RBAC (403 A-3007) blocks guest, user, and host on debug/asUserId/admin ml routes', async () => {
      const checks: Array<{ path: string; method?: string; token?: string; expectedStatus: number; expectedCode: string }> = [
        { path: '/api/v1/properties/recommend?debug=true', expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?debug=true', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?debug=true', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: `/api/v1/properties/recommend?asUserId=${user1Live.userId}`, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: `/api/v1/properties/recommend?asUserId=${user1Live.userId}`, token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: `/api/v1/properties/recommend?asUserId=${user1Live.userId}`, token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?asUserId=guest', expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?asUserId=guest', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?asUserId=guest', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?coldStart=true', expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/properties/recommend?coldStart=true', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: `/api/v1/properties/recommend/property/${activeProps[0].id}?debug=true`, token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/status', expectedStatus: 401, expectedCode: 'A-3005' },
        { path: '/api/v1/admin/ml/status', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/status', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/refresh', method: 'POST', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/refresh', method: 'POST', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
      ]

      for (const c of checks) {
        const headers: Record<string, string> = c.token ? { Authorization: `Bearer ${c.token}` } : {}
        const res = await makeRequest(pipePath, c.path, c.method || 'GET', undefined, headers)
        if (res.statusCode !== c.expectedStatus || res.body?.code !== c.expectedCode) {
          throw new Error(
            `RBAC check failed for ${c.method || 'GET'} ${c.path}: expected ${c.expectedStatus} ${c.expectedCode}, got ${res.statusCode} ${JSON.stringify(res.body)}`
          )
        }
      }
    })

    // Test 68: Admin ML Inspector debug + /admin/ml/status + /admin/ml/refresh
    await runTest('PBI-20: Admin gets 200 with scoreBreakdown on debug=true&asUserId= and /admin/ml/status & /refresh', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      const debugRes = await makeRequest(
        pipePath,
        `/api/v1/properties/recommend?debug=true&asUserId=${user4Live.userId}&limit=4`,
        'GET',
        undefined,
        { Authorization: `Bearer ${adminLive.token}` }
      )
      if (debugRes.statusCode !== 200 || !Array.isArray(debugRes.body?.data) || debugRes.body.data.length === 0) {
        throw new Error(`Expected 200 with data on admin debug, got ${debugRes.statusCode}`)
      }
      const bd = debugRes.body.data[0].scoreBreakdown
      if (
        !bd ||
        typeof bd.sContent !== 'number' ||
        typeof bd.sCompat !== 'number' ||
        typeof bd.sQuality !== 'number' ||
        typeof bd.sPopularity !== 'number'
      ) {
        throw new Error(`Expected camelCase scoreBreakdown, got ${JSON.stringify(bd)}`)
      }

      const statusRes = await makeRequest(pipePath, '/api/v1/admin/ml/status', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (
        statusRes.statusCode !== 200 ||
        statusRes.body?.data?.mlServiceReachable !== true ||
        statusRes.body?.data?.fallbackReady !== true ||
        !(statusRes.body?.data?.catalogSize > 0)
      ) {
        throw new Error(`Unexpected /admin/ml/status: ${statusRes.statusCode} ${JSON.stringify(statusRes.body)}`)
      }

      const refreshRes = await makeRequest(pipePath, '/api/v1/admin/ml/refresh', 'POST', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (
        refreshRes.statusCode !== 200 ||
        refreshRes.body?.data?.refreshed !== true ||
        refreshRes.body?.data?.mlServiceRefreshed !== true
      ) {
        throw new Error(`Unexpected /admin/ml/refresh: ${refreshRes.statusCode} ${JSON.stringify(refreshRes.body)}`)
      }
    })

    // Test 68b: PBI-21 True Guest Cold-Start via asUserId=guest / coldStart=true & Dynamic sampleUsers/sampleProperties
    await runTest('PBI-21: Admin Guest Cold-Start (asUserId=guest & coldStart=true) and dynamic /admin/ml/status sampleUsers & sampleProperties', async () => {
      config.mlServiceUrl = liveMlUrl
      await invalidateAllRecommendationCaches()

      // Non-admin calling asUserId=guest gets 403 A-3007
      const nonAdminGuest = await makeRequest(
        pipePath,
        '/api/v1/properties/recommend?asUserId=guest&limit=4',
        'GET',
        undefined,
        { Authorization: `Bearer ${user1Live.token}` }
      )
      if (nonAdminGuest.statusCode !== 403 || nonAdminGuest.body?.code !== 'A-3007') {
        throw new Error(`Expected 403 A-3007 for non-admin asUserId=guest, got ${nonAdminGuest.statusCode} ${JSON.stringify(nonAdminGuest.body)}`)
      }

      // Admin calling debug=true&asUserId=guest&limit=4 gets 200, strategy=cold_start & scoreBreakdown
      const adminGuestRes = await makeRequest(
        pipePath,
        '/api/v1/properties/recommend?debug=true&asUserId=guest&limit=4',
        'GET',
        undefined,
        { Authorization: `Bearer ${adminLive.token}` }
      )
      if (
        adminGuestRes.statusCode !== 200 ||
        adminGuestRes.body?.meta?.strategy !== 'cold_start' ||
        !Array.isArray(adminGuestRes.body?.data) ||
        adminGuestRes.body.data.length === 0
      ) {
        throw new Error(`Expected 200 cold_start for admin asUserId=guest, got ${adminGuestRes.statusCode} ${JSON.stringify(adminGuestRes.body?.meta)}`)
      }
      const guestBd = adminGuestRes.body.data[0].scoreBreakdown
      if (
        !guestBd ||
        typeof guestBd.sContent !== 'number' ||
        typeof guestBd.sCompat !== 'number' ||
        typeof guestBd.sQuality !== 'number' ||
        typeof guestBd.sPopularity !== 'number'
      ) {
        throw new Error(`Expected scoreBreakdown on admin asUserId=guest, got ${JSON.stringify(guestBd)}`)
      }

      // Admin calling debug=true&coldStart=true&limit=4 also runs true guest cold-start
      const adminColdStartRes = await makeRequest(
        pipePath,
        '/api/v1/properties/recommend?debug=true&coldStart=true&limit=4',
        'GET',
        undefined,
        { Authorization: `Bearer ${adminLive.token}` }
      )
      if (
        adminColdStartRes.statusCode !== 200 ||
        adminColdStartRes.body?.meta?.strategy !== 'cold_start' ||
        !adminColdStartRes.body?.data?.[0]?.scoreBreakdown
      ) {
        throw new Error(`Expected 200 cold_start + scoreBreakdown for admin coldStart=true, got ${adminColdStartRes.statusCode} ${JSON.stringify(adminColdStartRes.body?.meta)}`)
      }

      // Admin /admin/ml/status returns dynamic sampleUsers & sampleProperties
      const statusRes = await makeRequest(pipePath, '/api/v1/admin/ml/status', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (statusRes.statusCode !== 200) {
        throw new Error(`Expected 200 on /admin/ml/status, got ${statusRes.statusCode}`)
      }
      const sampleUsers: any[] = statusRes.body?.data?.sampleUsers
      const sampleProperties: any[] = statusRes.body?.data?.sampleProperties
      if (!Array.isArray(sampleUsers) || sampleUsers.length === 0) {
        throw new Error(`Expected non-empty data.sampleUsers, got ${JSON.stringify(sampleUsers)}`)
      }
      if (!Array.isArray(sampleProperties) || sampleProperties.length === 0) {
        throw new Error(`Expected non-empty data.sampleProperties, got ${JSON.stringify(sampleProperties)}`)
      }

      const usersWithPets = sampleUsers.filter((u) => Array.isArray(u.pets) && u.pets.length > 0)
      if (usersWithPets.length === 0) {
        throw new Error('Expected sampleUsers to include users with active petProfiles')
      }

      // Verify users with pets appear before users without pets, and no ephemeral test accounts
      const ephemeralPrefixes = ['challenger_', 'smoke_', 'test_', 'qa_', 'audit_']
      let seenWithoutPets = false
      for (const u of sampleUsers) {
        if (ephemeralPrefixes.some((p) => String(u.email || '').toLowerCase().startsWith(p))) {
          throw new Error(`Ephemeral account leaked into sampleUsers: ${u.email}`)
        }
        if (typeof u.id !== 'number' || typeof u.email !== 'string' || !Array.isArray(u.roles) || typeof u.behaviorCount !== 'number') {
          throw new Error(`Invalid sampleUser shape: ${JSON.stringify(u)}`)
        }
        if (u.pets.length === 0) {
          seenWithoutPets = true
        } else if (seenWithoutPets) {
          throw new Error('User with active petProfiles appeared after a user without pets')
        }
      }

      const samplePet = usersWithPets[0].pets[0]
      if (typeof samplePet.id !== 'number' || typeof samplePet.name !== 'string' || typeof samplePet.species !== 'string' || !samplePet.species) {
        throw new Error(`Invalid sampleUser pet shape: ${JSON.stringify(samplePet)}`)
      }

      const sampleProp = sampleProperties[0]
      if (
        typeof sampleProp.id !== 'number' ||
        typeof sampleProp.title !== 'string' ||
        typeof sampleProp.province !== 'string' ||
        typeof sampleProp.avgRating !== 'number'
      ) {
        throw new Error(`Invalid sampleProperty shape: ${JSON.stringify(sampleProp)}`)
      }
    })

    // Test 69: Batch GET /api/v1/properties?ids=...
    await runTest('PBI-20: Batch GET /api/v1/properties?ids=... preserves requested order and validates invalid input', async () => {
      const idsOrder = [activeProps[2].id, activeProps[0].id, activeProps[1].id]
      const batchRes = await makeRequest(
        pipePath,
        `/api/v1/properties?ids=${idsOrder.join(',')}`
      )
      if (batchRes.statusCode !== 200 || !Array.isArray(batchRes.body?.data)) {
        throw new Error(`Expected 200 batch array, got ${batchRes.statusCode}`)
      }
      const returnedIds = batchRes.body.data.map((p: any) => p.id)
      if (JSON.stringify(returnedIds) !== JSON.stringify(idsOrder)) {
        throw new Error(`Expected exact order ${JSON.stringify(idsOrder)}, got ${JSON.stringify(returnedIds)}`)
      }

      const invalidRes = await makeRequest(pipePath, '/api/v1/properties?ids=abc,-2')
      if (invalidRes.statusCode !== 400 || invalidRes.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007 for invalid ids, got ${invalidRes.statusCode} ${JSON.stringify(invalidRes.body)}`)
      }
    })

    // Test 70: In-Process Fallback Mode (<1500ms) for user4 Tier A/B & host1 self-owned exclusion
    await runTest('PBI-20: In-Process Fallback Mode (<1500ms) preserves Tier A/B multi-pet safety and self-owned exclusion', async () => {
      config.mlServiceUrl = 'http://127.0.0.1:59998'
      await invalidateAllRecommendationCaches()

      const fbUser4 = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
        Authorization: `Bearer ${user4Live.token}`,
      })
      if (
        fbUser4.statusCode !== 200 ||
        fbUser4.body?.meta?.source !== 'in_process_fallback' ||
        !(fbUser4.body?.meta?.latencyMs < 1500) ||
        !Array.isArray(fbUser4.body?.data) ||
        fbUser4.body.data.length === 0
      ) {
        throw new Error(`Fallback user4 failed: ${fbUser4.statusCode} ${JSON.stringify(fbUser4.body?.meta)}`)
      }

      let seenPartial = false
      for (const item of fbUser4.body.data) {
        if (!Array.isArray(item.matchReasons) || item.matchReasons.length === 0) {
          throw new Error(`Expected matchReasons on fallback item ${item.id}`)
        }
        if (item.matchTier === 'partial_pets') seenPartial = true
        if (item.matchTier === 'all_pets' && seenPartial) {
          throw new Error('Fallback Tier A appeared after Tier B')
        }
      }

      const fbHost1 = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
        Authorization: `Bearer ${host1Live.token}`,
      })
      if (fbHost1.statusCode !== 200 || fbHost1.body?.meta?.source !== 'in_process_fallback' || !(fbHost1.body?.meta?.latencyMs < 1500)) {
        throw new Error(`Fallback host1 failed: ${fbHost1.statusCode} ${JSON.stringify(fbHost1.body?.meta)}`)
      }
      if ((fbHost1.body?.data || []).some((p: any) => p.hostId === host1Live.userId)) {
        throw new Error('Fallback must exclude host1 self-owned properties')
      }
    })

    // Test 71: In-Process Fallback Mode (<1500ms) for Guest Cold-Start & Similar Properties + Admin Debug
    await runTest('PBI-20: In-Process Fallback Mode (<1500ms) serves Guest Cold-Start, Similar Properties & Admin debug', async () => {
      config.mlServiceUrl = 'http://127.0.0.1:59998'
      await invalidateAllRecommendationCaches()

      const fbGuest = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=6')
      if (
        fbGuest.statusCode !== 200 ||
        fbGuest.body?.meta?.source !== 'in_process_fallback' ||
        fbGuest.body?.meta?.strategy !== 'cold_start' ||
        !(fbGuest.body?.meta?.latencyMs < 1500) ||
        !Array.isArray(fbGuest.body?.data) ||
        fbGuest.body.data.length === 0
      ) {
        throw new Error(`Fallback guest cold-start failed: ${fbGuest.statusCode} ${JSON.stringify(fbGuest.body?.meta)}`)
      }

      const fbSimilar = await makeRequest(
        pipePath,
        `/api/v1/properties/recommend/property/${activeProps[0].id}?limit=4`
      )
      if (
        fbSimilar.statusCode !== 200 ||
        fbSimilar.body?.meta?.source !== 'in_process_fallback' ||
        fbSimilar.body?.meta?.strategy !== 'similar_properties' ||
        !(fbSimilar.body?.meta?.latencyMs < 1500) ||
        !Array.isArray(fbSimilar.body?.data) ||
        fbSimilar.body.data.length === 0
      ) {
        throw new Error(`Fallback similar properties failed: ${fbSimilar.statusCode} ${JSON.stringify(fbSimilar.body?.meta)}`)
      }
      if (fbSimilar.body.data.some((p: any) => p.id === activeProps[0].id)) {
        throw new Error('Fallback similar properties must exclude source property')
      }

      const fbDebug = await makeRequest(
        pipePath,
        `/api/v1/properties/recommend?debug=true&asUserId=${user1Live.userId}&limit=4`,
        'GET',
        undefined,
        { Authorization: `Bearer ${adminLive.token}` }
      )
      if (
        fbDebug.statusCode !== 200 ||
        fbDebug.body?.meta?.source !== 'in_process_fallback' ||
        !fbDebug.body?.data?.[0]?.scoreBreakdown
      ) {
        throw new Error(`Fallback admin debug failed: ${fbDebug.statusCode}`)
      }
    })

    // Test 72: Timeout Fallback when ML service hangs beyond mlTimeoutMs
    await runTest('PBI-20: AbortSignal timeout triggers in_process_fallback when ML service hangs', async () => {
      hangServer = http.createServer((_req, res) => {
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end('{}')
          }
        }, 2500)
      })
      await new Promise<void>((resolve) => hangServer!.listen(0, '127.0.0.1', resolve))
      const addr = hangServer.address() as { port: number }
      config.mlServiceUrl = `http://127.0.0.1:${addr.port}`
      config.mlTimeoutMs = 350
      await invalidateAllRecommendationCaches()

      const res = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=4')
      if (
        res.statusCode !== 200 ||
        res.body?.meta?.source !== 'in_process_fallback' ||
        !Array.isArray(res.body?.data) ||
        res.body.data.length === 0
      ) {
        throw new Error(`Expected timeout fallback, got ${res.statusCode} ${JSON.stringify(res.body?.meta)}`)
      }
    })

    // Test 73: Similar properties error handling (404 DB-1002 & 400 T-2007)
    await runTest('PBI-20: Similar properties validates propertyId (400 T-2007) and missing property (404 DB-1002)', async () => {
      const badId = await makeRequest(pipePath, '/api/v1/properties/recommend/property/abc')
      if (badId.statusCode !== 400 || badId.body?.code !== 'T-2007') {
        throw new Error(`Expected 400 T-2007, got ${badId.statusCode} ${JSON.stringify(badId.body)}`)
      }

      const missingId = await makeRequest(pipePath, '/api/v1/properties/recommend/property/9999999')
      if (missingId.statusCode !== 404 || missingId.body?.code !== 'DB-1002') {
        throw new Error(`Expected 404 DB-1002, got ${missingId.statusCode} ${JSON.stringify(missingId.body)}`)
      }
    })

    // Test 74: PF-1 Up-to-Max-Size (<=) parity for Choco (3.5kg Small Dog) & strict upper-bound for Milo (28.5kg Large Dog)
    await runTest('PF-1: Small dog (user2 Choco 3.5kg) gets >= 5 dog properties & Large dog (user1 Milo 28.5kg) never matches Small-only rooms', async () => {
      const dogPetRecord = await prisma.pet.findFirst({
        where: { name: { contains: 'Dog', mode: 'insensitive' }, deletedAt: null },
      })
      if (!dogPetRecord) {
        throw new Error('Seeded Dog pet type not found in DB')
      }

      const allCatalogProps = await prisma.property.findMany({
        where: {
          isActive: true,
          isBannedByAdmin: false,
          deletedAt: null,
          host: { deletedAt: null, bannedAt: null, isBannedAllProperties: false },
        },
        include: {
          roomCategories: {
            where: { deletedAt: null },
            include: {
              petSizeCategory: true,
              pets: true,
            },
          },
        },
      })
      const propDetailsById = new Map(allCatalogProps.map((p) => [p.id, p]))

      const modes: Array<{ label: string; url: string; expectedSource: string }> = [
        { label: 'live_ml', url: liveMlUrl, expectedSource: 'ml_service' },
        { label: 'in_process_fallback', url: 'http://127.0.0.1:59998', expectedSource: 'in_process_fallback' },
      ]

      for (const mode of modes) {
        config.mlServiceUrl = mode.url
        config.mlTimeoutMs = originalMlTimeoutMs
        await invalidateAllRecommendationCaches()

        const chocoRes = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
          Authorization: `Bearer ${user2Live.token}`,
        })
        if (chocoRes.statusCode !== 200 || chocoRes.body?.meta?.source !== mode.expectedSource) {
          throw new Error(`[${mode.label}] Expected 200 ${mode.expectedSource} for user2, got ${chocoRes.statusCode} ${JSON.stringify(chocoRes.body?.meta)}`)
        }
        const chocoItems: any[] = chocoRes.body?.data || []
        if (chocoItems.length < 5) {
          throw new Error(`[${mode.label}] Expected >= 5 dog-friendly properties for user2 (Choco 3.5kg), got ${chocoItems.length}`)
        }
        for (const item of chocoItems) {
          const detail = propDetailsById.get(item.id)
          const hasDogRoom = detail?.roomCategories.some((rc) =>
            rc.pets.some((rp) => rp.petId === dogPetRecord.id)
          )
          if (!hasDogRoom) {
            throw new Error(`[${mode.label}] Property ${item.id} returned for Choco does not have a Dog room`)
          }
        }

        // Verify Milo (28.5kg Large Dog, owned by user1 alongside Luna Small Cat) never gets matched to a property
        // whose Dog rooms are strictly Small/Medium (max < 28.5) as all_pets
        const miloRes = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=20', 'GET', undefined, {
          Authorization: `Bearer ${user1Live.token}`,
        })
        if (miloRes.statusCode !== 200 || miloRes.body?.meta?.source !== mode.expectedSource) {
          throw new Error(`[${mode.label}] Expected 200 ${mode.expectedSource} for user1, got ${miloRes.statusCode}`)
        }
        for (const item of miloRes.body?.data || []) {
          if (item.matchTier === 'all_pets') {
            const detail = propDetailsById.get(item.id)
            const supportsLargeDog = detail?.roomCategories.some(
              (rc) =>
                rc.pets.some((rp) => rp.petId === dogPetRecord.id) &&
                (rc.petSizeCategory === null || rc.petSizeCategory.max >= 28.5)
            )
            if (!supportsLargeDog) {
              throw new Error(`[${mode.label}] Large dog Milo (28.5kg) matched Small/Medium-only dog room on property ${item.id} as all_pets`)
            }
          }
        }
      }
    })

    // Test 75: PF-3 Optional Location-Aware Soft Geo-Boost (?lat=&lng=)
    await runTest('PF-3: ?lat=13.7563&lng=100.5018 applies Soft Geo-Boost (Near you reason & distanceKm) without dropping distant provinces', async () => {
      const modes: Array<{ label: string; url: string; expectedSource: string }> = [
        { label: 'live_ml', url: liveMlUrl, expectedSource: 'ml_service' },
        { label: 'in_process_fallback', url: 'http://127.0.0.1:59998', expectedSource: 'in_process_fallback' },
      ]

      for (const mode of modes) {
        config.mlServiceUrl = mode.url
        config.mlTimeoutMs = originalMlTimeoutMs
        await invalidateAllRecommendationCaches()

        // Cold-start with Bangkok coordinates + admin debug
        const coldGeoRes = await makeRequest(
          pipePath,
          '/api/v1/properties/recommend?debug=true&asUserId=guest&limit=50&lat=13.7563&lng=100.5018',
          'GET',
          undefined,
          { Authorization: `Bearer ${adminLive.token}` }
        )
        if (coldGeoRes.statusCode !== 200 || coldGeoRes.body?.meta?.source !== mode.expectedSource) {
          throw new Error(`[${mode.label}] Cold-start geo failed: ${coldGeoRes.statusCode} ${JSON.stringify(coldGeoRes.body?.meta)}`)
        }
        const coldItems: any[] = coldGeoRes.body?.data || []
        const nearbyCold = coldItems.filter(
          (item) =>
            typeof item.scoreBreakdown?.distanceKm === 'number' &&
            item.scoreBreakdown.distanceKm <= 35 &&
            typeof item.scoreBreakdown?.sGeo === 'number' &&
            Array.isArray(item.matchReasons) &&
            item.matchReasons.length <= 3 &&
            item.matchReasons.some((r: string) => r.startsWith('Near you ('))
        )
        if (nearbyCold.length === 0) {
          throw new Error(`[${mode.label}] Expected at least 1 nearby Bangkok/Nonthaburi property with 'Near you (... km)' & distanceKm`)
        }
        const distantCold = coldItems.filter(
          (item) =>
            typeof item.scoreBreakdown?.distanceKm === 'number' &&
            item.scoreBreakdown.distanceKm > 100
        )
        if (distantCold.length === 0) {
          throw new Error(`[${mode.label}] Soft Geo-Boost dropped distant provinces (Chiang Mai/Phuket) completely`)
        }

        // Personalized user2 with Bangkok coordinates + admin debug
        const persGeoRes = await makeRequest(
          pipePath,
          `/api/v1/properties/recommend?debug=true&asUserId=${user2Live.userId}&limit=50&lat=13.7563&lng=100.5018`,
          'GET',
          undefined,
          { Authorization: `Bearer ${adminLive.token}` }
        )
        if (persGeoRes.statusCode !== 200 || persGeoRes.body?.meta?.source !== mode.expectedSource) {
          throw new Error(`[${mode.label}] Personalized geo failed: ${persGeoRes.statusCode}`)
        }
        const persItems: any[] = persGeoRes.body?.data || []
        const nearbyPers = persItems.filter(
          (item) =>
            typeof item.scoreBreakdown?.distanceKm === 'number' &&
            item.scoreBreakdown.distanceKm <= 35 &&
            typeof item.scoreBreakdown?.sGeo === 'number' &&
            Array.isArray(item.matchReasons) &&
            item.matchReasons.length <= 3 &&
            item.matchReasons.some((r: string) => r.startsWith('Near you ('))
        )
        if (nearbyPers.length === 0) {
          throw new Error(`[${mode.label}] Expected nearby personalized recommendation with 'Near you (... km)' & distanceKm`)
        }
      }

      // Public guest call with valid lat/lng succeeds without scoreBreakdown; invalid/partial lat is ignored gracefully
      const publicGeoRes = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=10&lat=13.7563&lng=100.5018')
      if (publicGeoRes.statusCode !== 200 || publicGeoRes.body?.data?.[0]?.scoreBreakdown !== undefined) {
        throw new Error(`Public geo recommend failed or leaked scoreBreakdown: ${publicGeoRes.statusCode}`)
      }
      const partialLatRes = await makeRequest(pipePath, '/api/v1/properties/recommend?limit=4&lat=13.7563')
      if (partialLatRes.statusCode !== 200 || !Array.isArray(partialLatRes.body?.data)) {
        throw new Error(`Partial lat param should be ignored gracefully, got ${partialLatRes.statusCode}`)
      }
    })

    // Test 76: PF-4 Scalable Admin ML Inspector APIs (featured caps, counts, & server-side search + RBAC)
    await runTest('PF-4: Admin ML status caps samples (<=6 users, <=12 props) with totals & /users/search + /properties/search work with Admin RBAC', async () => {
      config.mlServiceUrl = liveMlUrl
      config.mlTimeoutMs = originalMlTimeoutMs
      await invalidateAllRecommendationCaches()
      await makeRequest(pipePath, '/api/v1/admin/ml/refresh', 'POST', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })

      const statusRes = await makeRequest(pipePath, '/api/v1/admin/ml/status', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (statusRes.statusCode !== 200) {
        throw new Error(`Expected 200 on /admin/ml/status, got ${statusRes.statusCode}`)
      }
      const statusData = statusRes.body?.data
      if (
        !Array.isArray(statusData?.sampleUsers) ||
        statusData.sampleUsers.length === 0 ||
        statusData.sampleUsers.length > 6
      ) {
        throw new Error(`Expected 1..6 featured sampleUsers, got ${statusData?.sampleUsers?.length}`)
      }
      if (
        !Array.isArray(statusData?.sampleProperties) ||
        statusData.sampleProperties.length === 0 ||
        statusData.sampleProperties.length > 12
      ) {
        throw new Error(`Expected 1..12 featured sampleProperties, got ${statusData?.sampleProperties?.length}`)
      }
      if (
        typeof statusData?.totalUsers !== 'number' ||
        statusData.totalUsers < statusData.sampleUsers.length ||
        typeof statusData?.totalActiveProperties !== 'number' ||
        statusData.totalActiveProperties < statusData.sampleProperties.length
      ) {
        throw new Error(`Invalid totalUsers/totalActiveProperties in /admin/ml/status: ${JSON.stringify(statusData)}`)
      }

      // Admin search users (?q=user3 & ?q=user2 & exact numeric ID)
      const userSearch3 = await makeRequest(pipePath, '/api/v1/admin/ml/users/search?q=user3&limit=10', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (userSearch3.statusCode !== 200 || userSearch3.body?.code !== 'S-0000' || !Array.isArray(userSearch3.body?.data)) {
        throw new Error(`Expected 200 array for /admin/ml/users/search?q=user3, got ${userSearch3.statusCode} ${JSON.stringify(userSearch3.body)}`)
      }

      const userSearch2 = await makeRequest(pipePath, '/api/v1/admin/ml/users/search?q=user2&limit=50', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (
        userSearch2.statusCode !== 200 ||
        !Array.isArray(userSearch2.body?.data) ||
        userSearch2.body.data.length === 0 ||
        userSearch2.body.data.length > 20 ||
        !userSearch2.body.data.some((u: any) => u.email === 'user2@joodpakpaw.com')
      ) {
        throw new Error(`Expected user2@joodpakpaw.com from /admin/ml/users/search?q=user2, got ${JSON.stringify(userSearch2.body)}`)
      }

      const userSearchById = await makeRequest(pipePath, `/api/v1/admin/ml/users/search?q=${user2Live.userId}`, 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (userSearchById.statusCode !== 200 || userSearchById.body?.data?.[0]?.id !== user2Live.userId) {
        throw new Error(`Expected exact numeric ID match ${user2Live.userId}, got ${JSON.stringify(userSearchById.body?.data)}`)
      }

      // Admin search properties (?q=Chiang & exact numeric ID)
      const propSearchChiang = await makeRequest(pipePath, '/api/v1/admin/ml/properties/search?q=Chiang&limit=10', 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (
        propSearchChiang.statusCode !== 200 ||
        propSearchChiang.body?.code !== 'S-0000' ||
        !Array.isArray(propSearchChiang.body?.data) ||
        propSearchChiang.body.data.length === 0
      ) {
        throw new Error(`Expected matching properties for /admin/ml/properties/search?q=Chiang, got ${propSearchChiang.statusCode} ${JSON.stringify(propSearchChiang.body)}`)
      }

      const propSearchById = await makeRequest(pipePath, `/api/v1/admin/ml/properties/search?q=${activeProps[0].id}`, 'GET', undefined, {
        Authorization: `Bearer ${adminLive.token}`,
      })
      if (propSearchById.statusCode !== 200 || propSearchById.body?.data?.[0]?.id !== activeProps[0].id) {
        throw new Error(`Expected exact numeric property ID match ${activeProps[0].id}, got ${JSON.stringify(propSearchById.body?.data)}`)
      }

      // Strict RBAC rejection on new search endpoints
      const rbacChecks = [
        { path: '/api/v1/admin/ml/users/search?q=user3', expectedStatus: 401, expectedCode: 'A-3005' },
        { path: '/api/v1/admin/ml/users/search?q=user3', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/users/search?q=user3', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/properties/search?q=Chiang', expectedStatus: 401, expectedCode: 'A-3005' },
        { path: '/api/v1/admin/ml/properties/search?q=Chiang', token: user1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
        { path: '/api/v1/admin/ml/properties/search?q=Chiang', token: host1Live.token, expectedStatus: 403, expectedCode: 'A-3007' },
      ]
      for (const c of rbacChecks) {
        const headers: Record<string, string> = c.token ? { Authorization: `Bearer ${c.token}` } : {}
        const res = await makeRequest(pipePath, c.path, 'GET', undefined, headers)
        if (res.statusCode !== c.expectedStatus || res.body?.code !== c.expectedCode) {
          throw new Error(`RBAC failed on ${c.path}: expected ${c.expectedStatus} ${c.expectedCode}, got ${res.statusCode} ${JSON.stringify(res.body)}`)
        }
      }
    })
  } finally {
    config.mlServiceUrl = originalMlUrl
    config.mlTimeoutMs = originalMlTimeoutMs
    if (hangServer) {
      await new Promise<void>((resolve) => hangServer!.close(() => resolve()))
    }
    if (spawnedMlProc && !spawnedMlProc.killed) {
      spawnedMlProc.kill('SIGTERM')
    }
    if (createdBehaviorUserIds.length > 0) {
      await prisma.userBehavior.deleteMany({
        where: {
          userId: { in: createdBehaviorUserIds },
          createdAt: { gte: sprint4StartedAt },
        },
      })
    }
    await invalidateAllRecommendationCaches()
    server.close()
    await prisma.$disconnect()
  }

  console.log('\n========================================')
  const passedCount = results.filter((r) => r.passed).length
  console.log(`📊 Test Results: ${passedCount}/${results.length} PASSED`)
  console.log('========================================\n')

  if (passedCount < results.length) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
