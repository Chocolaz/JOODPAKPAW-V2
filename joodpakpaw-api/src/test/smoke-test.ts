import http from 'http'
import { createApp } from '../app'
import { prisma, checkDatabaseHealth } from '../database/prisma'

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
  method = 'GET'
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: pipePath,
        path,
        method,
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
    req.end()
  })
}

async function main() {
  console.log('🧪 Starting JoodPakPaw V2 Core API Smoke Tests (Windows Named Pipe IPC)...\n')

  const app = createApp()
  const server = http.createServer(app)
  const pipePath = `\\\\.\\pipe\\joodpakpaw-smoke-${Date.now()}`

  await new Promise<void>((resolve) => server.listen(pipePath, resolve))

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
  } finally {
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
