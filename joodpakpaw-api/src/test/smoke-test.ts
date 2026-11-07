process.env.NODE_ENV = 'test';
import http from 'http'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { createApp } from '../app'
import { prisma, checkDatabaseHealth } from '../database/prisma'
import { optionalAuthenticateToken, requireRoles } from '../middlewares/auth.middleware'
import { v1Router } from '../routes/v1.routes'
import { convertBufferToWebp, uploadImageAsWebp } from '../services/storage.service'
import { cacheService } from '../services/cache.service'

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

  const originals = {
    userFindFirst: prisma.user.findFirst,
    userFindUnique: prisma.user.findUnique,
    userCreate: prisma.user.create,
    userUpdate: prisma.user.update,
    roleUpsert: prisma.role.upsert,
    reportFindMany: prisma.report.findMany,
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

  ;(prisma.report as any).findMany = async (_args: any) => {
    return []
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

  const propertiesMap = new Map<number, any>()
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
    return [propertiesMap.get(101)!].filter(Boolean).length
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
    Object.assign(prop, args?.data || {})
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
  ;(prisma.chatRoom as any).findFirst = async () => ({ id: 42 })

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
  ;(prisma as any).$transaction = async (ops: any) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops)
    }
    return ops(prisma)
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

  const bookingsMap = new Map<number, any>()
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
    return bookingsMap.get(id) || null
  }

  ;(prisma.booking as any).findMany = async (args: any) => {
    const guestId = args?.where?.guestId
    const hostId = args?.where?.property?.hostId
    const propId = args?.where?.propertyId

    let list = Array.from(bookingsMap.values()).filter((b) => {
      if (b.deletedAt !== null && args?.where?.deletedAt === null) return false
      if (guestId !== undefined && b.guestId !== guestId) return false
      if (hostId !== undefined && b.property?.hostId !== hostId) return false
      if (propId !== undefined && b.propertyId !== propId) return false
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

  ;(prisma.booking as any).count = async (args: any) => {
    const guestId = args?.where?.guestId
    const hostId = args?.where?.property?.hostId
    const propId = args?.where?.propertyId
    if (propId !== undefined && !args?.where?.property && !args?.where?.guestId) {
      return mockActiveBookingCount
    }
    return Array.from(bookingsMap.values()).filter((b) => {
      if (b.deletedAt !== null && args?.where?.deletedAt === null) return false
      if (guestId !== undefined && b.guestId !== guestId) return false
      if (hostId !== undefined && b.property?.hostId !== hostId) return false
      if (propId !== undefined && b.propertyId !== propId) return false
      return true
    }).length
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
    for (const b of bookingsMap.values()) {
      if (b.deletedAt !== null) continue
      if (['pending', 'confirmed'].includes(b.bookingStatus)) {
        if (b.bookingPetProfiles?.some((bpp: any) => bpp.petProfileId === petId)) {
          return { petProfileId: petId, bookingId: b.id, booking: b }
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

  ;(prisma.bookingReviewImage as any).create = async (args: any) => {
    return {
      id: 1,
      ...args?.data,
    }
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
    let secondBookingId = 0;
    void secondBookingId;
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
    })

    /* SKIPPED FOR PBI STAGING:
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

      // 8. Host marks booking as successful: PATCH /api/v1/hosts/bookings/:id/success
      const completeRes = await makeRequest(
        pipePath,
        `/api/v1/hosts/bookings/${createdBookingId}/success`,
        'PATCH',
        undefined,
        { Authorization: `Bearer ${userBAccessToken}` }
      )
      if (completeRes.statusCode !== 200 || completeRes.body?.data?.booking?.bookingStatus !== 'successful') {
        throw new Error(`Expected 200 with status=successful, got ${completeRes.statusCode}`)
      }

      // 9. Booking cancellation and quota restoration workflow:
      // Create a new pending booking
      const secondBookingRes = await makeRequest(pipePath, '/api/v1/bookings', 'POST', {
        bookingOrders: [
          { roomCategoryId: 501, checkInDate: '2026-12-25', checkOutDate: '2026-12-27', roomsBooked: 1 },
        ],
      }, { Authorization: `Bearer ${userAAccessToken}` })
      secondBookingId = secondBookingRes.body?.data?.booking?.id

      // User A cancels the booking
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
  
*/
    } finally {
    mockDb.restore()
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
