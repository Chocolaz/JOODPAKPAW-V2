import path from 'path';
import http from 'http';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Configure module resolution so node_modules in both sub-packages resolve cleanly
const apiModules = path.resolve(process.cwd(), 'joodpakpaw-api', 'node_modules');
const feModules = path.resolve(process.cwd(), 'joodpakpaw-frontend', 'node_modules');

process.env.NODE_PATH = [apiModules, feModules, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
require('module').Module._initPaths();

// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'joodpakpaw_super_secret_jwt_key_2026_dev';

export interface TestRecord {
  id: string;
  tier: 1 | 2 | 3 | 4;
  featureId?: number;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export const testResults: TestRecord[] = [];

export async function runTest(
  id: string,
  tier: 1 | 2 | 3 | 4,
  name: string,
  fn: () => Promise<void> | void,
  featureId?: number
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    testResults.push({ id, tier, featureId, name, passed: true, durationMs });
    console.log(`  \x1b[32m[PASS]\x1b[0m [Tier ${tier}] ${id}: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const errorMsg = err?.message || String(err);
    testResults.push({ id, tier, featureId, name, passed: false, error: errorMsg, durationMs });
    console.error(`  \x1b[31m[FAIL]\x1b[0m [Tier ${tier}] ${id}: ${name} (${durationMs}ms) - ${errorMsg}`);
  }
}

export function assert(condition: any, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ' - ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual: any, expected: any, message?: string): void {
  const actStr = JSON.stringify(actual);
  const expStr = JSON.stringify(expected);
  if (actStr !== expStr) {
    throw new Error(`${message ? message + ' - ' : ''}Deep equality mismatch: Expected ${expStr}, got ${actStr}`);
  }
}

// =========================================================================
// EMVCo PromptPay CRC16 and QR Generator / Validator
// =========================================================================
export function calculateCrc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPromptPayPayload(targetPhoneOrId: string, amount?: number): string {
  // Format target: if 10-digit mobile phone, format as 0066 + 9 digits
  const cleaned = targetPhoneOrId.replace(/[^0-9]/g, '');
  let formattedTarget = cleaned;
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    formattedTarget = '0066' + cleaned.slice(1);
  }

  const aidTag = '0016A000000677010111';
  const targetTag = '01' + String(formattedTarget.length).padStart(2, '0') + formattedTarget;
  const merchantAccountInfo = '29' + String(aidTag.length + targetTag.length).padStart(2, '0') + aidTag + targetTag;

  let payload = '000201010212' + merchantAccountInfo + '5303764';
  if (typeof amount === 'number' && amount > 0) {
    const amountStr = amount.toFixed(2);
    payload += '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  }
  payload += '5802TH6304';
  const checksum = calculateCrc16Ccitt(payload);
  return payload + checksum;
}

export function verifyPromptPayPayload(payload: string): { valid: boolean; amount?: number; target?: string } {
  if (!payload || payload.length < 20 || !payload.startsWith('000201')) {
    return { valid: false };
  }
  const dataWithoutChecksum = payload.slice(0, -4);
  const actualChecksum = payload.slice(-4).toUpperCase();
  const calculated = calculateCrc16Ccitt(dataWithoutChecksum);
  if (actualChecksum !== calculated) {
    return { valid: false };
  }

  // Parse amount if Tag 54 present
  const tag54Idx = payload.indexOf('54');
  let amount: number | undefined;
  if (tag54Idx !== -1) {
    const len = parseInt(payload.slice(tag54Idx + 2, tag54Idx + 4), 10);
    const amtStr = payload.slice(tag54Idx + 4, tag54Idx + 4 + len);
    amount = parseFloat(amtStr);
  }

  return { valid: true, amount };
}

// =========================================================================
// Bangkok ICT (UTC+7) Date & Cutoff Calculation Helpers
// =========================================================================
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateStr(dateInput: Date | string): string {
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? '' : dateInput.toISOString().slice(0, 10);
  }
  return String(dateInput || '').slice(0, 10);
}

export function getTodayThaiStr(now: Date = new Date()): string {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function toBangkokTimestamp(dateInput: Date | string, hourICT: number): Date {
  const dateStr = toDateStr(dateInput);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(NaN);
  const midnightUtcMs = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (isNaN(midnightUtcMs)) return new Date(NaN);
  return new Date(midnightUtcMs + (hourICT - 7) * 60 * 60 * 1000);
}

export function getCheckInCutoffAt(checkInDate: Date | string): Date {
  return toBangkokTimestamp(checkInDate, 14);
}

export function getCanCompleteAt(checkOutDate: Date | string): Date {
  return toBangkokTimestamp(checkOutDate, 12);
}

export function getAutoCompleteAt(checkOutDate: Date | string): Date {
  return toBangkokTimestamp(checkOutDate, 18);
}

export function getPaymentDeadline(createdAt: Date | string, checkOutDate: Date | string): Date {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const plus24h = new Date(created.getTime() + DAY_MS);
  const checkOutCutoff = getCanCompleteAt(checkOutDate);
  if (isNaN(checkOutCutoff.getTime())) return plus24h;
  if (isNaN(plus24h.getTime())) return checkOutCutoff;
  return plus24h.getTime() <= checkOutCutoff.getTime() ? plus24h : checkOutCutoff;
}

export function getReviewDeadline(
  successedAt: Date | string | null | undefined,
  checkOutDate: Date | string
): Date {
  const fallback = getAutoCompleteAt(checkOutDate);
  const parsedSuccess = successedAt
    ? successedAt instanceof Date
      ? successedAt
      : new Date(successedAt)
    : null;
  const base = parsedSuccess && !isNaN(parsedSuccess.getTime()) ? parsedSuccess : fallback;
  return new Date(base.getTime() + 14 * DAY_MS);
}

// =========================================================================
// JWT Token Generator for Test Users
// =========================================================================
export function generateTestToken(user: { id: number; email: string; roleId: number; roleName: string }): string {
  const jwt = require('jsonwebtoken');
  const payload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName,
    roles: [{ id: user.roleId, name: user.roleName }],
    type: 'access',
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'joodpakpaw_super_secret_jwt_key_2026_dev', {
    expiresIn: '1h',
  });
}

export const GUEST_USER = { id: 1, email: 'alicia@joodpakpaw.com', roleId: 1, roleName: 'guest' };
export const HOST_USER = { id: 2, email: 'bob@joodpakpaw.com', roleId: 2, roleName: 'host' };
export const ADMIN_USER = { id: 3, email: 'admin@joodpakpaw.com', roleId: 3, roleName: 'admin' };
export const INTRUDER_USER = { id: 4, email: 'dave@joodpakpaw.com', roleId: 1, roleName: 'guest' };

export const GUEST_TOKEN = generateTestToken(GUEST_USER);
export const HOST_TOKEN = generateTestToken(HOST_USER);
export const ADMIN_TOKEN = generateTestToken(ADMIN_USER);
export const INTRUDER_TOKEN = generateTestToken(INTRUDER_USER);

// =========================================================================
// In-Memory Test Server & Mock Harness
// =========================================================================
export interface MockState {
  users: Map<number, any>;
  properties: Map<number, any>;
  roomCategories: Map<number, any>;
  calendars: Map<string, any>;
  petProfiles: Map<number, any>;
  bookings: Map<number, any>;
  notifications: any[];
  deletedS3Objects: string[];
}

export const mockState: MockState = {
  users: new Map(),
  properties: new Map(),
  roomCategories: new Map(),
  calendars: new Map(),
  petProfiles: new Map(),
  bookings: new Map(),
  notifications: [],
  deletedS3Objects: [],
};

export function resetMockState(): void {
  mockState.users.clear();
  mockState.properties.clear();
  mockState.roomCategories.clear();
  mockState.calendars.clear();
  mockState.petProfiles.clear();
  mockState.bookings.clear();
  mockState.notifications = [];
  mockState.deletedS3Objects = [];

  // Seed standard users
  mockState.users.set(1, {
    id: 1,
    email: 'alicia@joodpakpaw.com',
    firstName: 'Alicia',
    lastName: 'Wonderland',
    isVerified: true,
    isBecomeToHost: false,
    isVerifiedHost: false,
    bannedAt: null,
    deletedAt: null,
    userRoles: [{ role: { id: 1, name: 'guest' } }],
  });

  mockState.users.set(2, {
    id: 2,
    email: 'bob@joodpakpaw.com',
    firstName: 'Bob',
    lastName: 'Builder',
    isVerified: true,
    isBecomeToHost: true,
    isVerifiedHost: true,
    bannedAt: null,
    deletedAt: null,
    userRoles: [{ role: { id: 2, name: 'host' } }],
  });

  mockState.users.set(3, {
    id: 3,
    email: 'admin@joodpakpaw.com',
    firstName: 'Charlie',
    lastName: 'Admin',
    isVerified: true,
    isBecomeToHost: true,
    isVerifiedHost: true,
    bannedAt: null,
    deletedAt: null,
    userRoles: [{ role: { id: 3, name: 'admin' } }],
  });

  mockState.users.set(4, {
    id: 4,
    email: 'dave@joodpakpaw.com',
    firstName: 'Dave',
    lastName: 'Intruder',
    isVerified: true,
    isBecomeToHost: false,
    isVerifiedHost: false,
    bannedAt: null,
    deletedAt: null,
    userRoles: [{ role: { id: 1, name: 'guest' } }],
  });

  // Seed property 101
  const prop101 = {
    id: 101,
    title: 'Pawradise Luxury Cat & Dog Hotel',
    description: 'Premier pet boarding in Bangkok',
    hostId: 2,
    isActive: true,
    isBannedByAdmin: false,
    latitude: '13.7563',
    longitude: '100.5018',
    country: 'Thailand',
    province: 'Bangkok',
    district: 'Pathum Wan',
    address: '100 Rama 1 Rd',
    zipcode: '10330',
    propertyTypeId: 1,
    host: mockState.users.get(2),
    roomCategories: [] as any[],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockState.properties.set(101, prop101);

  // Seed room category 501
  const room501 = {
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
    petSizeCategory: { id: 2, name: 'Medium (M)' },
    pets: [{ pet: { id: 1, name: 'Dog' } }, { pet: { id: 2, name: 'Cat' } }],
    facilities: [{ facility: { id: 1, name: 'Air Conditioning' } }],
    images: [],
    calendars: [],
    property: prop101,
    deletedAt: null,
  };
  mockState.roomCategories.set(501, room501);
  prop101.roomCategories.push(room501);

  // Seed pet profiles for User 1
  mockState.petProfiles.set(10, {
    id: 10,
    name: 'Kuro',
    petSex: 'male',
    birthDate: '2022-01-01',
    weight: 6.0,
    contactName: 'Alice',
    contactPhone: '0812345678',
    note: 'Friendly shiba inu',
    guestId: 1,
    petTypeId: 1,
    petSizeCategoryId: 2,
    deletedAt: null,
  });

  mockState.petProfiles.set(20, {
    id: 20,
    name: 'Mochi',
    petSex: 'female',
    birthDate: '2023-01-01',
    weight: 4.0,
    contactName: 'Alice',
    contactPhone: '0812345678',
    note: 'Gentle calico cat',
    guestId: 1,
    petTypeId: 2,
    petSizeCategoryId: 1,
    deletedAt: null,
  });
}

// Initial state reset
resetMockState();

export let testServerUrl = 'http://127.0.0.1:8000';
let activeServer: http.Server | null = null;

export async function initTestServer(): Promise<string> {
  // Check if live server on 8000 is running
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    if (res.ok) {
      testServerUrl = 'http://127.0.0.1:8000';
      return testServerUrl;
    }
  } catch {}

  // Otherwise, spin up ephemeral Express server using createApp
  const { createApp } = await import('../../joodpakpaw-api/src/app.js').catch(async () => {
    return await import('../../joodpakpaw-api/src/app.ts');
  });

  const app = createApp();
  activeServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    activeServer!.listen(0, '127.0.0.1', () => {
      const addr = activeServer!.address() as any;
      testServerUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
  return testServerUrl;
}

export async function closeTestServer(): Promise<void> {
  if (activeServer) {
    await new Promise<void>((resolve) => activeServer!.close(() => resolve()));
    activeServer = null;
  }
}

export async function apiRequest(
  endpointPath: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    token?: string;
  } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const url = testServerUrl.replace(/\/$/, '') + '/' + endpointPath.replace(/^\//, '');
  const reqHeaders: Record<string, string> = { ...(options.headers || {}) };
  if (options.token) {
    reqHeaders['Authorization'] = `Bearer ${options.token}`;
  }

  let reqBody: any = undefined;
  if (options.body !== undefined) {
    if (typeof options.body === 'string' || options.body instanceof FormData || options.body instanceof Buffer) {
      reqBody = options.body;
    } else {
      reqHeaders['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(options.body);
    }
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: reqHeaders,
    body: reqBody,
  });

  let parsed: any;
  const text = await res.text();
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return {
    status: res.status,
    body: parsed,
    headers: res.headers,
  };
}
