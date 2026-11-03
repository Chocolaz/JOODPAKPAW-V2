import http from 'http'
import { createApp } from '../app'
import { prisma, checkDatabaseHealth } from '../database/prisma'
import { optionalAuthenticateToken, requireRoles } from '../middlewares/auth.middleware'
import { v1Router } from '../routes/v1.routes'

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
    const data = args?.data || {}
    Object.assign(record, data)
    return { ...record }
  }

  ;(prisma.report as any).findMany = async (_args: any) => {
    return []
  }

  return {
    users,
    restore() {
      prisma.user.findFirst = originals.userFindFirst
      prisma.user.findUnique = originals.userFindUnique
      prisma.user.create = originals.userCreate
      prisma.user.update = originals.userUpdate
      prisma.role.upsert = originals.roleUpsert
      prisma.report.findMany = originals.reportFindMany
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
      if (res.body?.error?.code !== 'ROUTE_NOT_FOUND') {
        throw new Error(`Expected error code ROUTE_NOT_FOUND, got ${res.body?.error?.code}`)
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
      if (!resA.body?.refCode || !resA.body?.otp) {
        throw new Error(`Expected refCode and otp in non-production sign-up response`)
      }
      userAId = resA.body.data.id
      userAFirstOtp = resA.body.otp

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
      if (resendRes.statusCode !== 200 || !resendRes.body?.otp || !resendRes.body?.refCode) {
        throw new Error(`Expected 200 with new otp & refCode, got ${resendRes.statusCode}`)
      }
      userAFirstOtp = resendRes.body.otp

      const verifyRes = await makeRequest(pipePath, '/api/v1/auth/verify-otp', 'POST', {
        email: 'alice@joodpakpaw.com',
        otp: userAFirstOtp,
      })
      if (verifyRes.statusCode !== 200) throw new Error(`Expected 200 on verify-otp, got ${verifyRes.statusCode}`)
      if (!verifyRes.body?.accessToken || !verifyRes.body?.refreshToken || !verifyRes.body?.user) {
        throw new Error(`Missing SignInResponse fields on verify-otp: ${JSON.stringify(verifyRes.body)}`)
      }
    })

    // Test 11: POST /api/v1/auth/sign-in (A-3001 on wrong credentials, 200 on valid)
    await runTest('POST /api/v1/auth/sign-in returns 401 A-3001 on wrong password and 200 with tokens on valid credentials', async () => {
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
      if (typeof okSign.body?.accessToken !== 'string' || typeof okSign.body?.refreshToken !== 'string') {
        throw new Error('Expected accessToken and refreshToken strings')
      }
      if (typeof okSign.body?.expiresIn !== 'number' || okSign.body?.tokenType !== 'Bearer') {
        throw new Error('Expected expiresIn number and tokenType Bearer')
      }
      userAAccessToken = okSign.body.accessToken
      userARefreshToken = okSign.body.refreshToken
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
      if (okRefresh.statusCode !== 200 || typeof okRefresh.body?.accessToken !== 'string') {
        throw new Error(`Expected 200 with top-level accessToken, got ${okRefresh.statusCode}`)
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

      // Valid change-password -> 200
      const okChangeRes = await makeRequest(
        pipePath,
        `/api/v1/users/${userAId}/change-password`,
        'PATCH',
        {
          oldPassword: 'Password123!',
          newPassword: 'UpdatedPassword456!',
          confirmPassword: 'UpdatedPassword456!',
        },
        { Authorization: `Bearer ${userAAccessToken}` }
      )
      if (okChangeRes.statusCode !== 200) {
        throw new Error(`Expected 200 on valid change-password, got ${okChangeRes.statusCode}`)
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
      if (forgotRes.statusCode !== 200 || !forgotRes.body?.resetPasswordToken) {
        throw new Error(`Expected 200 with resetPasswordToken, got ${forgotRes.statusCode}`)
      }
      const resetToken = forgotRes.body.resetPasswordToken

      // First use succeeds
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

    // Test 16: Security Middlewares (optionalAuthenticateToken, requireRoles 403, banned user 403 A-3002)
    await runTest('optionalAuthenticateToken, requireRoles (403 A-3007), and banned user check (403 A-3002) behave securely', async () => {
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
    })
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
