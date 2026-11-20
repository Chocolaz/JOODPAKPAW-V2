import { prisma } from '../database/prisma';
import { config } from '../config/env';
import { cacheService } from './cache.service';

export type MatchTier = 'all_pets' | 'partial_pets' | 'cold_start' | 'similar';

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface ScoreBreakdown {
  sContent: number;
  sCompat: number;
  sQuality: number;
  sPopularity: number;
  sGeo?: number | null;
  distanceKm?: number | null;
}

export interface RecommendationItem {
  propertyId: number;
  score: number;
  matchTier: MatchTier;
  matchReasons: string[];
  scoreBreakdown?: ScoreBreakdown;
}

export interface RecommendationMeta {
  source: 'ml_service' | 'in_process_fallback';
  strategy: string;
  snapshotAgeSeconds: number;
  latencyMs: number;
  totalCandidates: number;
}

export interface RecommendationResult {
  recommendations: RecommendationItem[];
  meta: RecommendationMeta;
}

export interface MlHealthPayload {
  status: string;
  service: string;
  catalog_size: number;
  snapshot_age_seconds: number;
  db_connected: boolean;
}

export interface MlStatusResponse {
  mlServiceUrl: string;
  timeoutMs: number;
  mlServiceReachable: boolean;
  status: 'live' | 'fallback';
  mlHealth: {
    status: string;
    service: string;
    catalogSize: number;
    snapshotAgeSeconds: number;
    dbConnected: boolean;
  } | null;
  fallbackReady: boolean;
  catalogSize: number;
  snapshotAgeSeconds: number;
}

interface MlApiScoreBreakdown {
  s_content: number;
  s_compat: number;
  s_quality: number;
  s_popularity: number;
  s_geo?: number | null;
  distance_km?: number | null;
}

interface MlApiRecommendationItem {
  property_id: number;
  score: number;
  match_tier: MatchTier;
  match_reasons?: string[];
  score_breakdown?: MlApiScoreBreakdown | null;
}

interface MlApiRecommendationResponse {
  strategy: string;
  snapshot_age_seconds: number;
  total_candidates: number;
  recommendations: MlApiRecommendationItem[];
}

interface MlApiRefreshResponse {
  refreshed: boolean;
  catalog_size: number;
  snapshot_age_seconds: number;
}

interface SnapshotRoomCategory {
  id: number;
  petSizeCategoryId: number | null;
  sizeCode: number | null;
  sizeName: string | null;
  minWeight: number | null;
  maxWeight: number | null;
  roomAreaSqm: number;
  petTypeIds: Set<number>;
}

interface SnapshotProperty {
  id: number;
  hostId: number;
  title: string;
  description: string;
  propertyType: string;
  province: string;
  district: string;
  subdistrict: string;
  latitude: number | null;
  longitude: number | null;
  minPrice: number;
  avgRating: number;
  reviewCount: number;
  bookingCount: number;
  favoriteCount: number;
  viewCount30d: number;
  facilities: string[];
  maxRoomAreaSqm: number;
  roomCategories: SnapshotRoomCategory[];
  allowedPetTypeIds: Set<number>;
  allowedPetTypeNames: string[];
  petSizeNames: string[];
}

interface CatalogSnapshot {
  properties: SnapshotProperty[];
  propById: Map<number, SnapshotProperty>;
  propIdxById: Map<number, number>;
  idfByTerm: Map<string, number>;
  tfidfVectors: Map<string, number>[];
  globalMeanRating: number;
  maxLogEngagement: number;
  qualityScores: Map<number, number>;
  popularityScores: Map<number, number>;
  builtAtMs: number;
}

interface UserPetData {
  id: number;
  name: string;
  petTypeId: number;
  petTypeName: string;
  breedName: string | null;
  weight: number | null;
  petSizeCategoryId: number | null;
  sizeCode: number | null;
  sizeName: string | null;
  energyRating: number;
}

interface UserBehaviorData {
  propertyId: number;
  action: string;
  daysElapsed: number;
}

interface UserContextData {
  userId: number;
  pets: UserPetData[];
  behaviors: UserBehaviorData[];
}

const REC_CACHE_PREFIX = 'properties:rec:';
const CATALOG_SNAPSHOT_KEY = 'properties:ml_catalog_snapshot';
const REC_CACHE_TTL_SECONDS = 30;
const CATALOG_SNAPSHOT_TTL_SECONDS = 60;
const VIEW_COOLDOWN_MS = 10 * 60 * 1000;
const TIME_DECAY_LAMBDA = 0.05;
const BAYESIAN_M = 3.0;
const FALLBACK_GLOBAL_MEAN_RATING = 4.2;

const ACTION_WEIGHTS: Record<string, number> = {
  book: 5.0,
  favorite: 3.0,
  view: 1.0,
};

function getMlBaseUrl(): string {
  return (config.mlServiceUrl || 'http://localhost:5000').replace(/\/+$/, '');
}

function getMlTimeoutMs(): number {
  return Math.max(200, Number(config.mlTimeoutMs) || 1500);
}

function getMlInternalSecret(): string {
  return (process.env.ML_INTERNAL_SECRET || '').trim();
}

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function extractEnglishLabel(rawName: string): string {
  const match = rawName.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const inner = match[1].trim();
    if (inner) return inner;
  }
  return rawName.trim();
}

function cleanTokenText(raw: string): string {
  return raw.replace(/[()/,_-]+/g, ' ').trim();
}

function priceTier(minPrice: number): string {
  if (minPrice <= 700) return 'budget';
  if (minPrice <= 1800) return 'midrange';
  return 'premium';
}

function tokenizeNgrams(text: string): string[] {
  const cleaned = cleanTokenText(text).toLowerCase();
  const words = cleaned.match(/[a-z0-9\u0e00-\u0e7f]+/g) ?? [];
  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    tokens.push(words[i]);
    if (i + 1 < words.length) {
      tokens.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  return tokens;
}

function buildPropertyDocument(prop: SnapshotProperty): string {
  const petTokens = prop.allowedPetTypeNames.map(cleanTokenText);
  const sizeTokens = prop.petSizeNames.map(cleanTokenText);
  const facilityTokens = prop.facilities.map(cleanTokenText);

  const parts = [
    cleanTokenText(prop.propertyType),
    cleanTokenText(prop.province),
    cleanTokenText(prop.district),
    facilityTokens.join(' '),
    petTokens.join(' '),
    sizeTokens.join(' '),
    priceTier(prop.minPrice),
    prop.title,
    prop.description,
  ];
  return parts.filter(Boolean).join(' ').trim();
}

function l2NormalizeSparse(vec: Map<string, number>): Map<string, number> | null {
  let sumSq = 0;
  for (const v of vec.values()) {
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm <= 1e-12) return null;
  const out = new Map<string, number>();
  for (const [k, v] of vec.entries()) {
    out.set(k, v / norm);
  }
  return out;
}

function vectorizeTextWithIdf(
  text: string,
  idfByTerm: Map<string, number>
): Map<string, number> | null {
  const tokens = tokenizeNgrams(text);
  if (tokens.length === 0) return null;
  const tfCounts = new Map<string, number>();
  for (const tok of tokens) {
    if (!idfByTerm.has(tok)) continue;
    tfCounts.set(tok, (tfCounts.get(tok) ?? 0) + 1);
  }
  if (tfCounts.size === 0) return null;
  const weighted = new Map<string, number>();
  for (const [tok, count] of tfCounts.entries()) {
    const idf = idfByTerm.get(tok) ?? 1;
    const sublinearTf = 1 + Math.log(count);
    weighted.set(tok, sublinearTf * idf);
  }
  return l2NormalizeSparse(weighted);
}

function cosineSparse(a: Map<string, number> | null, b: Map<string, number> | null): number {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;
  let smaller = a;
  let larger = b;
  if (b.size < a.size) {
    smaller = b;
    larger = a;
  }
  let dot = 0;
  for (const [k, v] of smaller.entries()) {
    const lv = larger.get(k);
    if (lv !== undefined) {
      dot += v * lv;
    }
  }
  return Math.max(0, Math.min(1, dot));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function computePropertyGeo(
  prop: SnapshotProperty,
  userLocation: UserLocation | null
): { distanceKm: number | null; sGeo: number | null } {
  if (!userLocation) return { distanceKm: null, sGeo: null };
  if (
    prop.latitude === null ||
    prop.longitude === null ||
    !Number.isFinite(prop.latitude) ||
    !Number.isFinite(prop.longitude) ||
    (prop.latitude === 0 && prop.longitude === 0)
  ) {
    return { distanceKm: null, sGeo: null };
  }
  const distanceKm = haversineKm(
    userLocation.lat,
    userLocation.lng,
    prop.latitude,
    prop.longitude
  );
  const sGeo = Math.exp(-distanceKm / 50.0);
  return { distanceKm, sGeo };
}

function formatNearYouReason(distanceKm: number): string {
  return distanceKm < 1
    ? 'Near you (<1 km)'
    : `Near you (${distanceKm.toFixed(1)} km)`;
}

function petMatchesRoom(pet: UserPetData, rc: SnapshotRoomCategory): boolean {
  if (!rc.petTypeIds.has(pet.petTypeId)) return false;
  if (rc.petSizeCategoryId === null) return true;
  if (pet.weight !== null && rc.maxWeight !== null) {
    return pet.weight <= rc.maxWeight;
  }
  if (pet.petSizeCategoryId !== null) {
    return pet.sizeCode !== null && rc.sizeCode !== null
      ? pet.sizeCode <= rc.sizeCode
      : pet.petSizeCategoryId <= rc.petSizeCategoryId;
  }
  return false;
}

function petMatchesProperty(pet: UserPetData, prop: SnapshotProperty): boolean {
  for (const rc of prop.roomCategories) {
    if (petMatchesRoom(pet, rc)) return true;
  }
  return false;
}

function computePetSizeFitScore(pet: UserPetData, prop: SnapshotProperty): number {
  let bestFit = 0.55;
  for (const rc of prop.roomCategories) {
    if (!petMatchesRoom(pet, rc)) continue;
    const isExactFit =
      rc.petSizeCategoryId === null ||
      (pet.petSizeCategoryId !== null && rc.petSizeCategoryId === pet.petSizeCategoryId) ||
      (pet.weight !== null &&
        rc.minWeight !== null &&
        rc.maxWeight !== null &&
        rc.minWeight <= pet.weight &&
        pet.weight <= rc.maxWeight);
    if (isExactFit) return 1.0;

    const isNextTier =
      (pet.sizeCode !== null && rc.sizeCode !== null && rc.sizeCode - pet.sizeCode === 1) ||
      (pet.weight !== null &&
        pet.weight > 0 &&
        rc.maxWeight !== null &&
        rc.maxWeight <= pet.weight * 4);
    if (isNextTier && bestFit < 0.75) {
      bestFit = 0.75;
    }
  }
  return bestFit;
}

type EnergyBucket = 'high' | 'medium' | 'low';

function energyBucket(rating: number): EnergyBucket {
  if (rating >= 4) return 'high';
  if (rating === 3) return 'medium';
  return 'low';
}

function computePetEnergyFacilityScore(
  pet: UserPetData,
  prop: SnapshotProperty
): { score: number; matched: Array<[number, EnergyBucket, string]> } {
  const facilitiesLower = new Set(prop.facilities.map((f) => f.trim().toLowerCase()));
  const bucket = energyBucket(pet.energyRating);
  const matched: Array<[number, EnergyBucket, string]> = [];
  let score = 0;

  let checks: Array<[string, number, string]>;
  if (bucket === 'high') {
    checks = [
      ['outdoor play area', 0.35, 'Outdoor Play Area'],
      ['indoor play area', 0.25, 'Indoor Play Area'],
      ['__room_area_6__', 0.2, 'Spacious Room'],
      ['cctv 24h', 0.1, 'CCTV 24h'],
      ['daily updates', 0.1, 'Daily Updates'],
    ];
  } else if (bucket === 'medium') {
    checks = [
      ['indoor play area', 0.25, 'Indoor Play Area'],
      ['air conditioning', 0.25, 'Air Conditioning'],
      ['daily updates', 0.2, 'Daily Updates'],
      ['cctv 24h', 0.15, 'CCTV 24h'],
      ['outdoor play area', 0.15, 'Outdoor Play Area'],
    ];
  } else {
    checks = [
      ['separated zones', 0.3, 'Separated Zones'],
      ['air conditioning', 0.25, 'Air Conditioning'],
      ['cctv 24h', 0.2, 'CCTV 24h'],
      ['nearby vet', 0.15, 'Nearby Vet'],
      ['daily updates', 0.1, 'Daily Updates'],
    ];
  }

  for (const [key, weight, label] of checks) {
    if (key === '__room_area_6__') {
      if (prop.maxRoomAreaSqm >= 6.0) {
        score += weight;
        matched.push([weight, bucket, label]);
      }
    } else if (facilitiesLower.has(key)) {
      score += weight;
      matched.push([weight, bucket, label]);
    }
  }

  return { score: Math.min(1, score), matched };
}

function buildSyntheticPetQuery(pets: UserPetData[]): string {
  const tokens: string[] = [];
  for (const pet of pets) {
    if (pet.petTypeName) tokens.push(cleanTokenText(pet.petTypeName));
    if (pet.sizeName) tokens.push(cleanTokenText(pet.sizeName));
    const bucket = energyBucket(pet.energyRating);
    if (bucket === 'high') {
      tokens.push('Outdoor Play Area Indoor Play Area CCTV 24h Daily Updates');
    } else if (bucket === 'medium') {
      tokens.push('Indoor Play Area Air Conditioning Daily Updates CCTV 24h Outdoor Play Area');
    } else {
      tokens.push('Separated Zones Air Conditioning CCTV 24h Nearby Vet Daily Updates');
    }
  }
  return tokens.join(' ').trim();
}

interface RawCatalogRoomPet {
  id: number;
  name: string;
}

interface RawCatalogRoomCategory {
  id: number;
  petSizeCategoryId: number | null;
  sizeCode: number | null;
  sizeName: string | null;
  minWeight: number | null;
  maxWeight: number | null;
  roomAreaSqm: number;
  pets: RawCatalogRoomPet[];
}

interface RawCatalogPropertyRow {
  id: number;
  hostId: number;
  title: string;
  description: string;
  propertyType: string;
  province: string;
  district: string;
  subdistrict: string;
  latitude: number | null;
  longitude: number | null;
  minPrice: number;
  avgRating: number;
  reviewCount: number;
  bookingCount: number;
  favoriteCount: number;
  viewCount30d: number;
  facilitiesJson: unknown;
  roomCategoriesJson: unknown;
}

interface RawUserContextRow {
  petsJson: unknown;
  behaviorsJson: unknown;
}

interface RawUserPetJson {
  id: number;
  name: string;
  petTypeId: number;
  petTypeName: string;
  breedName: string | null;
  weight: number | null;
  petSizeCategoryId: number | null;
  sizeCode: number | null;
  sizeName: string | null;
  energyRating: number;
}

interface RawUserBehaviorJson {
  propertyId: number;
  action: string;
  daysElapsed: number;
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function buildCatalogSnapshot(): Promise<CatalogSnapshot> {
  const rawRows = await prisma.$queryRaw<RawCatalogPropertyRow[]>`
    WITH rc_pets AS (
      SELECT
        rc.id AS room_category_id,
        rc.property_id,
        psc.id AS pet_size_category_id,
        psc.code::int AS size_code,
        psc.name AS size_name,
        psc.min::float8 AS min_weight,
        psc.max::float8 AS max_weight,
        COALESCE(rc.room_size_width * rc.room_size_length, 0)::float8 AS room_area_sqm,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', pet.id, 'name', pet.name)
            ORDER BY pet.id ASC
          ) FILTER (WHERE pet.id IS NOT NULL),
          '[]'::json
        ) AS pets_json
      FROM room_categories rc
      INNER JOIN properties p
        ON p.id = rc.property_id
       AND p.is_active = true
       AND p.is_banned_by_admin = false
       AND p.deleted_at IS NULL
      INNER JOIN users u
        ON u.id = p.host_id
       AND u.deleted_at IS NULL
       AND u.banned_at IS NULL
       AND u.is_banned_all_properties = false
      LEFT JOIN pet_size_categories psc
        ON psc.id = rc.pet_size_category_id
       AND psc.deleted_at IS NULL
      LEFT JOIN room_has_pets rhp
        ON rhp.room_category_id = rc.id
      LEFT JOIN pets pet
        ON pet.id = rhp.pet_id
       AND pet.deleted_at IS NULL
      WHERE rc.deleted_at IS NULL
      GROUP BY
        rc.id,
        rc.property_id,
        psc.id,
        psc.code,
        psc.name,
        psc.min,
        psc.max,
        rc.room_size_width,
        rc.room_size_length
    ),
    rc_by_prop AS (
      SELECT
        property_id,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', room_category_id,
            'petSizeCategoryId', pet_size_category_id,
            'sizeCode', size_code,
            'sizeName', size_name,
            'minWeight', min_weight,
            'maxWeight', max_weight,
            'roomAreaSqm', room_area_sqm,
            'pets', pets_json
          )
          ORDER BY room_category_id ASC
        ) AS room_categories_json
      FROM rc_pets
      GROUP BY property_id
    ),
    fac_by_prop AS (
      SELECT
        phf.property_id,
        JSON_AGG(f.name ORDER BY f.id ASC) AS facilities_json
      FROM properties_has_facilities phf
      INNER JOIN facilities f
        ON f.id = phf.facility_id
       AND f.deleted_at IS NULL
      GROUP BY phf.property_id
    ),
    fav_by_prop AS (
      SELECT
        fp.property_id,
        COUNT(DISTINCT ff.user_id)::int AS favorite_count
      FROM favorite_properties fp
      INNER JOIN favorite_folders ff
        ON ff.id = fp.folder_id
       AND ff.deleted_at IS NULL
      GROUP BY fp.property_id
    ),
    views_by_prop AS (
      SELECT
        ub.reference_record::int AS property_id,
        COUNT(*)::int AS view_count_30d
      FROM user_behaviors ub
      INNER JOIN user_behavior_categories ubc
        ON ubc.id = ub.behavior_category_id
      WHERE ubc.name = 'view'
        AND ub.reference_table = 'properties'
        AND ub.reference_record ~ '^[0-9]{1,9}$'
        AND ub.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY ub.reference_record::int
    )
    SELECT
      p.id::int AS id,
      p.host_id::int AS "hostId",
      COALESCE(p.title, '') AS title,
      COALESCE(p.description, '') AS description,
      COALESCE(pt.name, '') AS "propertyType",
      COALESCE(p.province, '') AS province,
      COALESCE(p.district, '') AS district,
      COALESCE(p.subdistrict, '') AS subdistrict,
      p.latitude::float8 AS latitude,
      p.longitude::float8 AS longitude,
      COALESCE(p.min_price, 0)::float8 AS "minPrice",
      COALESCE(p.avg_rating, 0)::float8 AS "avgRating",
      COALESCE(p.review_count, 0)::int AS "reviewCount",
      COALESCE(p.booking_count, 0)::int AS "bookingCount",
      COALESCE(fav.favorite_count, 0)::int AS "favoriteCount",
      COALESCE(vw.view_count_30d, 0)::int AS "viewCount30d",
      COALESCE(fac.facilities_json, '[]'::json) AS "facilitiesJson",
      COALESCE(rcp.room_categories_json, '[]'::json) AS "roomCategoriesJson"
    FROM properties p
    INNER JOIN users u
      ON u.id = p.host_id
     AND u.deleted_at IS NULL
     AND u.banned_at IS NULL
     AND u.is_banned_all_properties = false
    LEFT JOIN property_types pt
      ON pt.id = p.property_type_id
     AND pt.deleted_at IS NULL
    LEFT JOIN rc_by_prop rcp ON rcp.property_id = p.id
    LEFT JOIN fac_by_prop fac ON fac.property_id = p.id
    LEFT JOIN fav_by_prop fav ON fav.property_id = p.id
    LEFT JOIN views_by_prop vw ON vw.property_id = p.id
    WHERE p.is_active = true
      AND p.is_banned_by_admin = false
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
  `;

  const properties: SnapshotProperty[] = rawRows.map((p) => {
    const allowedPetTypeIds = new Set<number>();
    const petNamesSet = new Set<string>();
    const sizeNamesSet = new Set<string>();
    let maxRoomAreaSqm = 0;

    const rawRcs = parseJsonArray<RawCatalogRoomCategory>(p.roomCategoriesJson);
    const roomCategories: SnapshotRoomCategory[] = rawRcs.map((rc) => {
      const rcPetIds = new Set<number>();
      for (const pet of Array.isArray(rc.pets) ? rc.pets : []) {
        const petId = Number(pet.id);
        if (Number.isInteger(petId) && petId > 0) {
          rcPetIds.add(petId);
          allowedPetTypeIds.add(petId);
          if (pet.name) petNamesSet.add(String(pet.name));
        }
      }
      const sizeId = rc.petSizeCategoryId != null ? Number(rc.petSizeCategoryId) : null;
      const sizeName = rc.sizeName ? String(rc.sizeName) : null;
      if (sizeName) {
        sizeNamesSet.add(sizeName);
      }
      const area = Number(rc.roomAreaSqm ?? 0) || 0;
      if (area > maxRoomAreaSqm) {
        maxRoomAreaSqm = area;
      }
      return {
        id: Number(rc.id),
        petSizeCategoryId: sizeId,
        sizeCode: rc.sizeCode != null ? Number(rc.sizeCode) : null,
        sizeName,
        minWeight: rc.minWeight != null ? Number(rc.minWeight) : null,
        maxWeight: rc.maxWeight != null ? Number(rc.maxWeight) : null,
        roomAreaSqm: area,
        petTypeIds: rcPetIds,
      };
    });

    const facilities = parseJsonArray<unknown>(p.facilitiesJson).filter(
      (f): f is string => typeof f === 'string' && f.length > 0
    );

    return {
      id: Number(p.id),
      hostId: Number(p.hostId),
      title: String(p.title || ''),
      description: String(p.description || ''),
      propertyType: String(p.propertyType || ''),
      province: String(p.province || ''),
      district: String(p.district || ''),
      subdistrict: String(p.subdistrict || ''),
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      minPrice: p.minPrice != null ? Number(p.minPrice) : 0,
      avgRating: p.avgRating != null ? Number(p.avgRating) : 0,
      reviewCount: Number(p.reviewCount ?? 0),
      bookingCount: Number(p.bookingCount ?? 0),
      favoriteCount: Number(p.favoriteCount ?? 0),
      viewCount30d: Number(p.viewCount30d ?? 0),
      facilities,
      maxRoomAreaSqm,
      roomCategories,
      allowedPetTypeIds,
      allowedPetTypeNames: Array.from(petNamesSet).sort(),
      petSizeNames: Array.from(sizeNamesSet).sort(),
    };
  });

  const propById = new Map<number, SnapshotProperty>();
  const propIdxById = new Map<number, number>();
  properties.forEach((p, idx) => {
    propById.set(p.id, p);
    propIdxById.set(p.id, idx);
  });

  const rated = properties.filter((p) => p.reviewCount > 0 && p.avgRating > 0);
  const globalMeanRating =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + p.avgRating, 0) / rated.length
      : FALLBACK_GLOBAL_MEAN_RATING;

  const rawLogs = new Map<number, number>();
  let maxLogEngagement = 0;
  for (const p of properties) {
    const eng =
      3 * Math.max(0, p.bookingCount) +
      2 * Math.max(0, p.favoriteCount) +
      Math.max(0, p.viewCount30d);
    const val = Math.log(1 + eng);
    rawLogs.set(p.id, val);
    if (val > maxLogEngagement) maxLogEngagement = val;
  }

  const qualityScores = new Map<number, number>();
  const popularityScores = new Map<number, number>();
  for (const p of properties) {
    const v = Math.max(0, p.reviewCount);
    const r = Math.max(0, p.avgRating);
    const wr =
      (v / (v + BAYESIAN_M)) * r + (BAYESIAN_M / (v + BAYESIAN_M)) * globalMeanRating;
    qualityScores.set(p.id, Math.min(1, Math.max(0, wr / 5)));
    popularityScores.set(
      p.id,
      maxLogEngagement > 0 ? (rawLogs.get(p.id) ?? 0) / maxLogEngagement : 0
    );
  }

  // Build TF-IDF vectors over catalog documents
  const docCount = properties.length;
  const docTokens = properties.map((p) => tokenizeNgrams(buildPropertyDocument(p)));
  const dfByTerm = new Map<string, number>();
  for (const tokens of docTokens) {
    const unique = new Set(tokens);
    for (const tok of unique) {
      dfByTerm.set(tok, (dfByTerm.get(tok) ?? 0) + 1);
    }
  }

  const idfByTerm = new Map<string, number>();
  for (const [tok, df] of dfByTerm.entries()) {
    idfByTerm.set(tok, Math.log((1 + docCount) / (1 + df)) + 1);
  }

  const tfidfVectors: Map<string, number>[] = docTokens.map((tokens) => {
    const tfCounts = new Map<string, number>();
    for (const tok of tokens) {
      tfCounts.set(tok, (tfCounts.get(tok) ?? 0) + 1);
    }
    const weighted = new Map<string, number>();
    for (const [tok, count] of tfCounts.entries()) {
      const idf = idfByTerm.get(tok) ?? 1;
      weighted.set(tok, (1 + Math.log(count)) * idf);
    }
    return l2NormalizeSparse(weighted) ?? new Map<string, number>();
  });

  return {
    properties,
    propById,
    propIdxById,
    idfByTerm,
    tfidfVectors,
    globalMeanRating,
    maxLogEngagement,
    qualityScores,
    popularityScores,
    builtAtMs: Date.now(),
  };
}

async function getFallbackCatalogSnapshot(forceRefresh = false): Promise<CatalogSnapshot> {
  if (!forceRefresh) {
    const cached = await cacheService.get<CatalogSnapshot>(CATALOG_SNAPSHOT_KEY);
    if (cached) return cached;
  }
  const snap = await buildCatalogSnapshot();
  await cacheService.set(CATALOG_SNAPSHOT_KEY, snap, CATALOG_SNAPSHOT_TTL_SECONDS);
  return snap;
}

async function fetchUserContext(userId: number): Promise<UserContextData> {
  const rows = await prisma.$queryRaw<RawUserContextRow[]>`
    SELECT
      COALESCE((
        SELECT JSON_AGG(pet_row ORDER BY pet_row.id ASC)
        FROM (
          SELECT
            pp.id::int AS id,
            COALESCE(pp.name, '') AS name,
            pp.pet_type_id::int AS "petTypeId",
            COALESCE(pet.name, '') AS "petTypeName",
            pb.breed AS "breedName",
            pp.weight::float8 AS weight,
            psc.id::int AS "petSizeCategoryId",
            psc.code::int AS "sizeCode",
            psc.name AS "sizeName",
            COALESCE(ppe.rating, 3)::int AS "energyRating"
          FROM pet_profiles pp
          INNER JOIN pets pet
            ON pet.id = pp.pet_type_id
           AND pet.deleted_at IS NULL
          LEFT JOIN pet_breeds pb
            ON pb.id = pp.breed_id
           AND pb.deleted_at IS NULL
          LEFT JOIN pet_size_categories psc
            ON psc.id = pp.pet_size_category_id
           AND psc.deleted_at IS NULL
          LEFT JOIN pet_profile_energies ppe
            ON ppe.id = pp.pet_energy_id
          WHERE pp.guest_id = ${userId}
            AND pp.deleted_at IS NULL
          ORDER BY pp.id ASC
        ) pet_row
      ), '[]'::json) AS "petsJson",
      COALESCE((
        SELECT JSON_AGG(beh_row ORDER BY beh_row."createdAtMs" DESC)
        FROM (
          SELECT
            ub.reference_record::int AS "propertyId",
            ubc.name AS action,
            GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - ub.created_at)) / 86400.0)::float8 AS "daysElapsed",
            (EXTRACT(EPOCH FROM ub.created_at) * 1000.0)::float8 AS "createdAtMs"
          FROM user_behaviors ub
          INNER JOIN user_behavior_categories ubc
            ON ubc.id = ub.behavior_category_id
          WHERE ub.user_id = ${userId}
            AND ub.reference_table = 'properties'
            AND ub.reference_record ~ '^[0-9]{1,9}$'
            AND ubc.name IN ('view', 'favorite', 'book')
            AND (
              ubc.name = 'view'
              OR (
                ubc.name = 'favorite'
                AND EXISTS (
                  SELECT 1
                  FROM favorite_properties fp
                  INNER JOIN favorite_folders ff
                    ON ff.id = fp.folder_id
                  WHERE ff.user_id = ${userId}
                    AND ff.deleted_at IS NULL
                    AND fp.property_id = ub.reference_record::int
                )
              )
              OR (
                ubc.name = 'book'
                AND EXISTS (
                  SELECT 1
                  FROM bookings b
                  WHERE b.guest_id = ${userId}
                    AND b.deleted_at IS NULL
                    AND b.booking_status <> 'cancelled'
                    AND b.property_id = ub.reference_record::int
                )
              )
            )
          ORDER BY ub.created_at DESC
        ) beh_row
      ), '[]'::json) AS "behaviorsJson"
  `;

  const row = rows[0];
  const rawPets = parseJsonArray<RawUserPetJson>(row?.petsJson);
  const rawBehaviors = parseJsonArray<RawUserBehaviorJson>(row?.behaviorsJson);

  const pets: UserPetData[] = rawPets.map((pp) => ({
    id: Number(pp.id),
    name: String(pp.name || ''),
    petTypeId: Number(pp.petTypeId),
    petTypeName: String(pp.petTypeName || ''),
    breedName: pp.breedName ? String(pp.breedName) : null,
    weight: pp.weight != null ? Number(pp.weight) : null,
    petSizeCategoryId: pp.petSizeCategoryId != null ? Number(pp.petSizeCategoryId) : null,
    sizeCode: pp.sizeCode != null ? Number(pp.sizeCode) : null,
    sizeName: pp.sizeName ? String(pp.sizeName) : null,
    energyRating: pp.energyRating != null ? Number(pp.energyRating) : 3,
  }));

  const behaviors: UserBehaviorData[] = [];
  for (const ub of rawBehaviors) {
    const pid = Number(ub.propertyId);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const action = ub.action;
    if (action !== 'view' && action !== 'favorite' && action !== 'book') continue;
    behaviors.push({
      propertyId: pid,
      action,
      daysElapsed: Math.max(0, Number(ub.daysElapsed) || 0),
    });
  }

  return { userId, pets, behaviors };
}

function computeContentScores(
  snapshot: CatalogSnapshot,
  userCtx: UserContextData
): {
  scores: number[];
  interactedProvinces: Set<string>;
  interactedTypes: Set<string>;
} {
  const nProps = snapshot.properties.length;
  if (nProps === 0) {
    return {
      scores: [],
      interactedProvinces: new Set(),
      interactedTypes: new Set(),
    };
  }

  const behaviorVec = new Map<string, number>();
  const interactedProvinces = new Set<string>();
  const interactedTypes = new Set<string>();
  let totalWeight = 0;

  for (const beh of userCtx.behaviors) {
    const idx = snapshot.propIdxById.get(beh.propertyId);
    if (idx === undefined) continue;
    const prop = snapshot.properties[idx];
    if (prop.hostId === userCtx.userId) continue;

    const baseW = ACTION_WEIGHTS[beh.action] ?? 1.0;
    const decayW = baseW * Math.exp(-TIME_DECAY_LAMBDA * Math.max(0, beh.daysElapsed));
    if (decayW <= 0) continue;

    const propVec = snapshot.tfidfVectors[idx];
    for (const [term, val] of propVec.entries()) {
      behaviorVec.set(term, (behaviorVec.get(term) ?? 0) + decayW * val);
    }
    totalWeight += decayW;
    if (prop.province) interactedProvinces.add(prop.province);
    if (prop.propertyType) interactedTypes.add(prop.propertyType);
  }

  const vBehavior = totalWeight > 0 ? l2NormalizeSparse(behaviorVec) : null;
  let vPet: Map<string, number> | null = null;
  if (userCtx.pets.length > 0) {
    const petQuery = buildSyntheticPetQuery(userCtx.pets);
    if (petQuery) {
      vPet = vectorizeTextWithIdf(petQuery, snapshot.idfByTerm);
    }
  }

  let vUser: Map<string, number> | null = null;
  if (vBehavior && vPet) {
    const combined = new Map<string, number>();
    for (const [k, v] of vBehavior.entries()) {
      combined.set(k, 0.8 * v);
    }
    for (const [k, v] of vPet.entries()) {
      combined.set(k, (combined.get(k) ?? 0) + 0.2 * v);
    }
    vUser = l2NormalizeSparse(combined);
  } else if (vBehavior) {
    vUser = vBehavior;
  } else if (vPet) {
    vUser = vPet;
  }

  if (!vUser) {
    return {
      scores: new Array(nProps).fill(0),
      interactedProvinces,
      interactedTypes,
    };
  }

  const scores = snapshot.tfidfVectors.map((pv) => cosineSparse(vUser, pv));
  return { scores, interactedProvinces, interactedTypes };
}

function buildPersonalizedReasons(params: {
  prop: SnapshotProperty;
  matchedPets: UserPetData[];
  totalPets: number;
  matchTier: MatchTier;
  energyMatchedLabels: Array<[number, EnergyBucket, string]>;
  sContent: number;
  sCompat: number;
  sQuality: number;
  sPopularity: number;
  interactedProvinces: Set<string>;
  interactedTypes: Set<string>;
  distanceKm?: number | null;
  sGeo?: number | null;
}): string[] {
  const {
    prop,
    matchedPets,
    totalPets,
    matchTier,
    energyMatchedLabels,
    sContent,
    sCompat,
    sQuality,
    sPopularity,
    interactedProvinces,
    interactedTypes,
    distanceKm,
    sGeo,
  } = params;

  const candidates: Array<[number, string]> = [];

  if (totalPets > 0) {
    let petReason: string;
    if (matchTier === 'all_pets') {
      if (totalPets === 1) {
        const pet = matchedPets[0];
        petReason = pet.breedName
          ? `Ideal for your ${pet.breedName}`
          : `Fits your ${extractEnglishLabel(pet.petTypeName)}`;
      } else {
        petReason = 'Fits all your pets';
      }
    } else {
      let names = matchedPets
        .slice(0, 2)
        .map((p) => p.name)
        .filter(Boolean)
        .join(', ');
      if (matchedPets.length > 2) {
        names = `${names} +${matchedPets.length - 2}`;
      }
      petReason = names
        ? `Fits ${names} (${matchedPets.length}/${totalPets} pets)`
        : `Fits ${matchedPets.length}/${totalPets} of your pets`;
    }
    candidates.push([0.3 * sCompat + 0.2, petReason]);
  }

  if (distanceKm !== undefined && distanceKm !== null && distanceKm <= 35) {
    candidates.push([0.12 * (sGeo ?? 0) + 0.22, formatNearYouReason(distanceKm)]);
  }

  if (energyMatchedLabels.length > 0 && matchedPets.length > 0) {
    const sorted = [...energyMatchedLabels].sort((a, b) => b[0] - a[0]);
    const [topWeight, topBucket, topLabel] = sorted[0];
    let energyReason: string;
    if (topBucket === 'high') {
      energyReason =
        topLabel === 'Spacious Room'
          ? `Spacious ${Math.round(prop.maxRoomAreaSqm)}m² room · High-energy match`
          : `${topLabel} · High-energy match`;
    } else if (topBucket === 'medium') {
      energyReason = `${topLabel} · Balanced care match`;
    } else {
      energyReason = `${topLabel} · Calm-pet friendly`;
    }
    candidates.push([0.3 * sCompat * topWeight + 0.05, energyReason]);
  }

  if (sContent >= 0.12) {
    let contentReason: string;
    if (prop.province && interactedProvinces.has(prop.province)) {
      contentReason = `Matches your interest in ${prop.province}`;
    } else if (prop.propertyType && interactedTypes.has(prop.propertyType)) {
      contentReason = `Matches your ${prop.propertyType} preference`;
    } else {
      contentReason = 'Matches your stay preferences';
    }
    candidates.push([0.4 * sContent, contentReason]);
  }

  if (prop.reviewCount > 0 && prop.avgRating >= 4.2) {
    candidates.push([0.2 * sQuality, `Top rated (${prop.avgRating.toFixed(1)}★)`]);
  }

  if (prop.bookingCount >= 2 || prop.favoriteCount >= 1) {
    candidates.push([0.1 * sPopularity, 'Popular pet stay']);
  }

  candidates.sort((a, b) => b[0] - a[0]);
  const reasons: string[] = [];
  for (const [, text] of candidates) {
    if (!reasons.includes(text)) {
      reasons.push(text);
    }
    if (reasons.length === 3) break;
  }

  if (reasons.length === 0) {
    reasons.push(prop.province ? `Pet-friendly stay in ${prop.province}` : 'Pet-friendly stay');
  }
  return reasons;
}

function buildColdStartReasons(
  prop: SnapshotProperty,
  sQuality: number,
  sPopularity: number,
  distanceKm?: number | null,
  sGeo?: number | null
): string[] {
  const candidates: Array<[number, string]> = [];
  if (distanceKm !== undefined && distanceKm !== null && distanceKm <= 35) {
    candidates.push([0.15 * (sGeo ?? 0) + 0.25, formatNearYouReason(distanceKm)]);
  }
  if (prop.reviewCount > 0 && prop.avgRating >= 4.0) {
    const reviewWord = prop.reviewCount === 1 ? 'review' : 'reviews';
    candidates.push([
      0.65 * sQuality,
      `Top rated (${prop.avgRating.toFixed(1)}★ · ${prop.reviewCount} ${reviewWord})`,
    ]);
  } else if (prop.reviewCount > 0) {
    candidates.push([0.65 * sQuality, `Rated ${prop.avgRating.toFixed(1)}★`]);
  }

  if (prop.bookingCount > 0) {
    const bookingLabel =
      prop.bookingCount === 1 ? 'Booked 1 time' : `Booked ${prop.bookingCount}+ times`;
    candidates.push([0.35 * sPopularity + 0.05, bookingLabel]);
  } else if (prop.favoriteCount > 0) {
    candidates.push([0.35 * sPopularity, 'Saved by pet owners']);
  }

  if (prop.province) {
    candidates.push([0.1, `Popular in ${prop.province}`]);
  }
  if (prop.facilities.length > 0) {
    candidates.push([0.05, `Includes ${prop.facilities[0]}`]);
  }

  candidates.sort((a, b) => b[0] - a[0]);
  const reasons: string[] = [];
  for (const [, text] of candidates) {
    if (!reasons.includes(text)) {
      reasons.push(text);
    }
    if (reasons.length === 3) break;
  }

  if (reasons.length === 0) {
    reasons.push('Verified pet boarding stay');
  }
  return reasons;
}

function coldStartRank(params: {
  snapshot: CatalogSnapshot;
  candidates: SnapshotProperty[];
  limit: number;
  debug: boolean;
  contentScores?: number[];
  interactedProvinces?: Set<string>;
  interactedTypes?: Set<string>;
  userLocation?: UserLocation | null;
}): RecommendationItem[] {
  const {
    snapshot,
    candidates,
    limit,
    debug,
    contentScores,
    interactedProvinces,
    interactedTypes,
    userLocation = null,
  } = params;

  type ScoredEntry = {
    prop: SnapshotProperty;
    score: number;
    sContent: number;
    sQuality: number;
    sPopularity: number;
    sGeo: number | null;
    distanceKm: number | null;
  };

  const remaining: ScoredEntry[] = candidates.map((prop) => {
    const sQ = snapshot.qualityScores.get(prop.id) ?? 0;
    const sP = snapshot.popularityScores.get(prop.id) ?? 0;
    let sC = 0;
    let baseScore: number;
    if (contentScores) {
      const idx = snapshot.propIdxById.get(prop.id) ?? 0;
      sC = contentScores[idx] ?? 0;
      baseScore = 0.4 * sC + 0.4 * sQ + 0.2 * sP;
    } else {
      baseScore = 0.65 * sQ + 0.35 * sP;
    }
    const { distanceKm, sGeo } = computePropertyGeo(prop, userLocation);
    let finalScore = baseScore;
    if (sGeo !== null) {
      finalScore = contentScores
        ? 0.88 * baseScore + 0.12 * sGeo
        : 0.85 * baseScore + 0.15 * sGeo;
    }
    return {
      prop,
      score: round4(finalScore),
      sContent: sC,
      sQuality: sQ,
      sPopularity: sP,
      sGeo,
      distanceKm,
    };
  });

  const provinceCounts = new Map<string, number>();
  const selected: ScoredEntry[] = [];

  while (remaining.length > 0 && selected.length < limit) {
    remaining.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = provinceCounts.get(a.prop.province) ?? 0;
      const pb = provinceCounts.get(b.prop.province) ?? 0;
      if (pa !== pb) return pa - pb;
      return a.prop.id - b.prop.id;
    });
    const chosen = remaining.shift()!;
    selected.push(chosen);
    if (chosen.prop.province) {
      provinceCounts.set(chosen.prop.province, (provinceCounts.get(chosen.prop.province) ?? 0) + 1);
    }
  }

  return selected.map(({ prop, score, sContent, sQuality, sPopularity, sGeo, distanceKm }) => {
    const reasons =
      contentScores && sContent >= 0.12
        ? buildPersonalizedReasons({
            prop,
            matchedPets: [],
            totalPets: 0,
            matchTier: 'cold_start',
            energyMatchedLabels: [],
            sContent,
            sCompat: 0,
            sQuality,
            sPopularity,
            interactedProvinces: interactedProvinces ?? new Set(),
            interactedTypes: interactedTypes ?? new Set(),
            distanceKm,
            sGeo,
          })
        : buildColdStartReasons(prop, sQuality, sPopularity, distanceKm, sGeo);

    const item: RecommendationItem = {
      propertyId: prop.id,
      score,
      matchTier: 'cold_start',
      matchReasons: reasons,
    };
    if (debug) {
      item.scoreBreakdown = {
        sContent: round4(sContent),
        sCompat: 0,
        sQuality: round4(sQuality),
        sPopularity: round4(sPopularity),
        ...(userLocation
          ? {
              sGeo: sGeo !== null ? round4(sGeo) : null,
              distanceKm: distanceKm !== null ? round2(distanceKm) : null,
            }
          : {}),
      };
    }
    return item;
  });
}

async function fallbackRecommendForUser(
  userId: number | null,
  limit: number,
  debug: boolean,
  userLocation: UserLocation | null = null
): Promise<Omit<RecommendationResult, 'meta'> & { meta: Omit<RecommendationMeta, 'latencyMs'> }> {
  const [snapshot, userCtx] = await Promise.all([
    getFallbackCatalogSnapshot(),
    userId !== null ? fetchUserContext(userId) : Promise.resolve(null),
  ]);
  const snapshotAgeSeconds = round2(Math.max(0, (Date.now() - snapshot.builtAtMs) / 1000));

  if (userId === null || userCtx === null) {
    const recommendations = coldStartRank({
      snapshot,
      candidates: snapshot.properties,
      limit,
      debug,
      userLocation,
    });
    return {
      recommendations,
      meta: {
        source: 'in_process_fallback',
        strategy: 'cold_start',
        snapshotAgeSeconds,
        totalCandidates: snapshot.properties.length,
      },
    };
  }

  const candidates = snapshot.properties.filter((p) => p.hostId !== userId);
  const { scores: contentScores, interactedProvinces, interactedTypes } = computeContentScores(
    snapshot,
    userCtx
  );

  const totalPets = userCtx.pets.length;
  if (totalPets === 0) {
    const hasUsableBehavior = contentScores.some((s) => s > 0);
    const recommendations = coldStartRank({
      snapshot,
      candidates,
      limit,
      debug,
      contentScores: hasUsableBehavior ? contentScores : undefined,
      interactedProvinces,
      interactedTypes,
      userLocation,
    });
    return {
      recommendations,
      meta: {
        source: 'in_process_fallback',
        strategy: hasUsableBehavior ? 'hybrid_behavior_v2' : 'cold_start',
        snapshotAgeSeconds,
        totalCandidates: candidates.length,
      },
    };
  }

  const tierA: Array<{ score: number; id: number; item: RecommendationItem }> = [];
  const tierB: Array<{ matchedCount: number; score: number; id: number; item: RecommendationItem }> =
    [];

  for (const prop of candidates) {
    const matchedPets = userCtx.pets.filter((pet) => petMatchesProperty(pet, prop));
    const matchedCount = matchedPets.length;
    if (matchedCount === 0) continue;

    const matchTier: MatchTier = matchedCount === totalPets ? 'all_pets' : 'partial_pets';

    let energySum = 0;
    let sizeFitSum = 0;
    const energyLabels: Array<[number, EnergyBucket, string]> = [];
    for (const pet of matchedPets) {
      const { score: efScore, matched } = computePetEnergyFacilityScore(pet, prop);
      energySum += efScore;
      sizeFitSum += computePetSizeFitScore(pet, prop);
      energyLabels.push(...matched);
    }

    const avgEnergyScore = energySum / matchedCount;
    const avgSizeFit = sizeFitSum / matchedCount;
    const coverage = matchedCount / totalPets;
    const sCompat = 0.55 * avgEnergyScore + 0.3 * coverage + 0.15 * avgSizeFit;

    const idx = snapshot.propIdxById.get(prop.id) ?? 0;
    const sContent = contentScores[idx] ?? 0;
    const sQuality = snapshot.qualityScores.get(prop.id) ?? 0;
    const sPopularity = snapshot.popularityScores.get(prop.id) ?? 0;

    const baseHybridScore =
      0.4 * sContent + 0.3 * sCompat + 0.2 * sQuality + 0.1 * sPopularity;
    const { distanceKm, sGeo } = computePropertyGeo(prop, userLocation);
    const finalScore =
      sGeo !== null ? 0.88 * baseHybridScore + 0.12 * sGeo : baseHybridScore;
    const roundedScore = round4(finalScore);

    const reasons = buildPersonalizedReasons({
      prop,
      matchedPets,
      totalPets,
      matchTier,
      energyMatchedLabels: energyLabels,
      sContent,
      sCompat,
      sQuality,
      sPopularity,
      interactedProvinces,
      interactedTypes,
      distanceKm,
      sGeo,
    });

    const item: RecommendationItem = {
      propertyId: prop.id,
      score: roundedScore,
      matchTier,
      matchReasons: reasons,
    };
    if (debug) {
      item.scoreBreakdown = {
        sContent: round4(sContent),
        sCompat: round4(sCompat),
        sQuality: round4(sQuality),
        sPopularity: round4(sPopularity),
        ...(userLocation
          ? {
              sGeo: sGeo !== null ? round4(sGeo) : null,
              distanceKm: distanceKm !== null ? round2(distanceKm) : null,
            }
          : {}),
      };
    }

    if (matchTier === 'all_pets') {
      tierA.push({ score: roundedScore, id: prop.id, item });
    } else {
      tierB.push({ matchedCount, score: roundedScore, id: prop.id, item });
    }
  }

  tierA.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id - b.id));
  tierB.sort((a, b) => {
    if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
    if (b.score !== a.score) return b.score - a.score;
    return a.id - b.id;
  });

  const totalEligible = tierA.length + tierB.length;
  const ordered = tierA.map((r) => r.item);
  if (ordered.length < limit) {
    for (const row of tierB) {
      ordered.push(row.item);
      if (ordered.length >= limit) break;
    }
  }

  return {
    recommendations: ordered.slice(0, limit),
    meta: {
      source: 'in_process_fallback',
      strategy: 'hybrid_pet_aware_v2',
      snapshotAgeSeconds,
      totalCandidates: totalEligible,
    },
  };
}

async function fallbackRecommendSimilar(
  propertyId: number,
  limit: number,
  viewerId: number | null,
  debug: boolean
): Promise<
  (Omit<RecommendationResult, 'meta'> & { meta: Omit<RecommendationMeta, 'latencyMs'> }) | null
> {
  const snapshot = await getFallbackCatalogSnapshot();
  const snapshotAgeSeconds = round2(Math.max(0, (Date.now() - snapshot.builtAtMs) / 1000));
  const target = snapshot.propById.get(propertyId);
  if (!target) return null;

  const targetIdx = snapshot.propIdxById.get(propertyId)!;
  const targetVec = snapshot.tfidfVectors[targetIdx] ?? null;
  const targetPetNames = new Set(target.allowedPetTypeNames.map(extractEnglishLabel));
  const targetFacilities = new Set(target.facilities);

  const candidates = snapshot.properties.filter(
    (p) => p.id !== propertyId && (viewerId === null || p.hostId !== viewerId)
  );

  const scored: Array<{ score: number; id: number; item: RecommendationItem }> = [];

  for (const cand of candidates) {
    const candIdx = snapshot.propIdxById.get(cand.id)!;
    const tfidfCos = cosineSparse(targetVec, snapshot.tfidfVectors[candIdx] ?? null);

    const unionPets = new Set<number>([...target.allowedPetTypeIds, ...cand.allowedPetTypeIds]);
    let intersectPetsCount = 0;
    for (const pid of target.allowedPetTypeIds) {
      if (cand.allowedPetTypeIds.has(pid)) intersectPetsCount++;
    }
    const petJaccard = unionPets.size > 0 ? intersectPetsCount / unionPets.size : 0;

    let geoSim: number;
    if (
      target.latitude !== null &&
      target.longitude !== null &&
      cand.latitude !== null &&
      cand.longitude !== null
    ) {
      const distKm = haversineKm(target.latitude, target.longitude, cand.latitude, cand.longitude);
      geoSim = Math.exp(-distKm / 50.0);
    } else if (target.province && cand.province && target.province === cand.province) {
      geoSim = target.district && cand.district && target.district === cand.district ? 1.0 : 0.7;
    } else {
      geoSim = 0.2;
    }

    const priceDenom = Math.max(target.minPrice, cand.minPrice, 500);
    const priceSim = 1 - Math.min(1, Math.abs(target.minPrice - cand.minPrice) / priceDenom);
    const geoPriceProximity = 0.5 * geoSim + 0.5 * priceSim;

    const sQuality = snapshot.qualityScores.get(cand.id) ?? 0;
    const sPopularity = snapshot.popularityScores.get(cand.id) ?? 0;

    const finalScore =
      0.55 * tfidfCos + 0.2 * petJaccard + 0.15 * geoPriceProximity + 0.1 * sQuality;
    const roundedScore = round4(finalScore);

    const reasonCandidates: Array<[number, string]> = [];
    if (target.province && cand.province && target.province === cand.province) {
      reasonCandidates.push([0.15 * geoPriceProximity + 0.05, `Same province (${cand.province})`]);
    }
    if (target.propertyType && cand.propertyType && target.propertyType === cand.propertyType) {
      reasonCandidates.push([0.55 * tfidfCos + 0.02, `Similar ${cand.propertyType}`]);
    }

    const sharedPets = cand.allowedPetTypeNames
      .map(extractEnglishLabel)
      .filter((n) => targetPetNames.has(n))
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    if (sharedPets.length > 0 && petJaccard > 0) {
      reasonCandidates.push([0.2 * petJaccard, `Accepts ${sharedPets.slice(0, 2).join(', ')}`]);
    }

    if (priceSim >= 0.75) {
      reasonCandidates.push([0.15 * priceSim * 0.5, 'Similar price range']);
    }

    const sharedFac = cand.facilities.filter((f) => targetFacilities.has(f));
    if (sharedFac.length > 0) {
      reasonCandidates.push([0.2 * tfidfCos, `Both offer ${sharedFac[0]}`]);
    }

    if (cand.reviewCount > 0 && cand.avgRating >= 4.2) {
      reasonCandidates.push([0.1 * sQuality, `Top rated (${cand.avgRating.toFixed(1)}★)`]);
    }

    reasonCandidates.sort((a, b) => b[0] - a[0]);
    const reasons: string[] = [];
    for (const [, text] of reasonCandidates) {
      if (!reasons.includes(text)) reasons.push(text);
      if (reasons.length === 3) break;
    }
    if (reasons.length === 0) {
      reasons.push('Similar pet boarding option');
    }

    const item: RecommendationItem = {
      propertyId: cand.id,
      score: roundedScore,
      matchTier: 'similar',
      matchReasons: reasons,
    };
    if (debug) {
      item.scoreBreakdown = {
        sContent: round4(tfidfCos),
        sCompat: round4((0.2 * petJaccard + 0.15 * geoPriceProximity) / 0.35),
        sQuality: round4(sQuality),
        sPopularity: round4(sPopularity),
      };
    }

    scored.push({ score: roundedScore, id: cand.id, item });
  }

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id - b.id));

  return {
    recommendations: scored.slice(0, limit).map((r) => r.item),
    meta: {
      source: 'in_process_fallback',
      strategy: 'similar_properties',
      snapshotAgeSeconds,
      totalCandidates: candidates.length,
    },
  };
}

function mapMlResponse(
  raw: MlApiRecommendationResponse,
  latencyMs: number,
  includeBreakdown: boolean
): RecommendationResult {
  const recommendations: RecommendationItem[] = (raw.recommendations || []).map((item) => {
    const mapped: RecommendationItem = {
      propertyId: item.property_id,
      score: item.score,
      matchTier: item.match_tier,
      matchReasons: Array.isArray(item.match_reasons) ? item.match_reasons.slice(0, 3) : [],
    };
    if (includeBreakdown && item.score_breakdown) {
      const bd: ScoreBreakdown = {
        sContent: item.score_breakdown.s_content,
        sCompat: item.score_breakdown.s_compat,
        sQuality: item.score_breakdown.s_quality,
        sPopularity: item.score_breakdown.s_popularity,
      };
      if (item.score_breakdown.s_geo !== undefined && item.score_breakdown.s_geo !== null) {
        bd.sGeo = item.score_breakdown.s_geo;
      }
      if (
        item.score_breakdown.distance_km !== undefined &&
        item.score_breakdown.distance_km !== null
      ) {
        bd.distanceKm = item.score_breakdown.distance_km;
      }
      mapped.scoreBreakdown = bd;
    }
    return mapped;
  });

  return {
    recommendations,
    meta: {
      source: 'ml_service',
      strategy: raw.strategy,
      snapshotAgeSeconds: raw.snapshot_age_seconds,
      latencyMs,
      totalCandidates: raw.total_candidates,
    },
  };
}

async function fetchFromMlService<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  timeoutMs = getMlTimeoutMs()
): Promise<T> {
  const url = `${getMlBaseUrl()}${path}`;
  const headers: Record<string, string> = {};
  const secret = getMlInternalSecret();
  if (secret && method === 'POST') {
    headers['X-ML-Secret'] = secret;
  }

  const response = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`ML service returned HTTP ${response.status} on ${path}`);
  }

  return (await response.json()) as T;
}

export async function getUserOrColdStartRecommendations(
  userId: number | null,
  limit = 50,
  debug = false,
  userLocation: UserLocation | null = null
): Promise<RecommendationResult> {
  const clampedLimit = Math.min(50, Math.max(1, limit));
  const locKey = userLocation
    ? `:loc=${userLocation.lat.toFixed(2)},${userLocation.lng.toFixed(2)}`
    : '';
  const cacheKey = `${REC_CACHE_PREFIX}user:${userId ?? 'guest'}:limit=${clampedLimit}:debug=${
    debug ? '1' : '0'
  }${locKey}`;

  const cached = await cacheService.get<RecommendationResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const startedAt = Date.now();
  let result: RecommendationResult;

  try {
    const locQuery = userLocation
      ? `&lat=${encodeURIComponent(String(userLocation.lat))}&lng=${encodeURIComponent(
          String(userLocation.lng)
        )}`
      : '';
    const endpoint =
      userId !== null
        ? `/ml/v1/recommend/user/${userId}?limit=${clampedLimit}&debug=${debug}${locQuery}`
        : `/ml/v1/recommend/cold-start?limit=${clampedLimit}&debug=${debug}${locQuery}`;
    const mlResp = await fetchFromMlService<MlApiRecommendationResponse>(endpoint, 'GET');
    const latencyMs = Math.max(1, Date.now() - startedAt);
    result = mapMlResponse(mlResp, latencyMs, debug);
  } catch (err) {
    console.warn(
      '[RecommendationService] ML service unavailable, using in-process fallback:',
      err instanceof Error ? err.message : err
    );
    const fb = await fallbackRecommendForUser(userId, clampedLimit, debug, userLocation);
    result = {
      recommendations: fb.recommendations,
      meta: {
        ...fb.meta,
        latencyMs: Math.max(1, Date.now() - startedAt),
      },
    };
  }

  await cacheService.set(cacheKey, result, REC_CACHE_TTL_SECONDS);
  return result;
}

export async function getSimilarPropertyRecommendations(
  propertyId: number,
  limit = 8,
  viewerId: number | null = null,
  debug = false
): Promise<RecommendationResult | null> {
  const clampedLimit = Math.min(50, Math.max(1, limit));
  const cacheKey = `${REC_CACHE_PREFIX}similar:${propertyId}:viewer=${
    viewerId ?? 'guest'
  }:limit=${clampedLimit}:debug=${debug ? '1' : '0'}`;

  const cached = await cacheService.get<RecommendationResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const startedAt = Date.now();
  let result: RecommendationResult | null = null;

  try {
    const viewerParam = viewerId !== null ? `&viewer_id=${viewerId}` : '';
    const endpoint = `/ml/v1/recommend/similar/${propertyId}?limit=${clampedLimit}&debug=${debug}${viewerParam}`;
    const mlResp = await fetchFromMlService<MlApiRecommendationResponse>(endpoint, 'GET');
    const latencyMs = Math.max(1, Date.now() - startedAt);
    result = mapMlResponse(mlResp, latencyMs, debug);
  } catch (err) {
    console.warn(
      '[RecommendationService] ML similar-properties unavailable, using in-process fallback:',
      err instanceof Error ? err.message : err
    );
    const fb = await fallbackRecommendSimilar(propertyId, clampedLimit, viewerId, debug);
    if (!fb) return null;
    result = {
      recommendations: fb.recommendations,
      meta: {
        ...fb.meta,
        latencyMs: Math.max(1, Date.now() - startedAt),
      },
    };
  }

  await cacheService.set(cacheKey, result, REC_CACHE_TTL_SECONDS);
  return result;
}

export async function recordUserBehaviorSafe(
  userId: number,
  propertyId: number,
  action: 'view' | 'favorite' | 'book'
): Promise<{ tracked: boolean; deduplicated: boolean }> {
  try {
    let category = await prisma.userBehaviorCategory.findFirst({
      where: { name: action },
    });
    if (!category) {
      category = await prisma.userBehaviorCategory.create({
        data: { name: action },
      });
    }

    if (action === 'view') {
      const cutoff = new Date(Date.now() - VIEW_COOLDOWN_MS);
      const recentView = await prisma.userBehavior.findFirst({
        where: {
          userId,
          behaviorCategoryId: category.id,
          referenceTable: 'properties',
          referenceRecord: String(propertyId),
          createdAt: { gte: cutoff },
        },
        select: { id: true },
      });
      if (recentView) {
        return { tracked: false, deduplicated: true };
      }
    }

    await prisma.userBehavior.create({
      data: {
        userId,
        behaviorCategoryId: category.id,
        referenceTable: 'properties',
        referenceRecord: String(propertyId),
      },
    });

    return { tracked: true, deduplicated: false };
  } catch (err) {
    console.warn(
      `[RecommendationService] Failed to record '${action}' behavior for user ${userId}, property ${propertyId}:`,
      err instanceof Error ? err.message : err
    );
    return { tracked: false, deduplicated: false };
  }
}

export async function invalidateUserRecommendationCache(userId: number): Promise<number> {
  return cacheService.delByPrefix(`${REC_CACHE_PREFIX}user:${userId}:`);
}

export async function invalidateAllRecommendationCaches(): Promise<number> {
  const recCount = await cacheService.delByPrefix(REC_CACHE_PREFIX);
  await cacheService.del(CATALOG_SNAPSHOT_KEY);
  return recCount;
}

export function triggerMlRefresh(): void {
  const refreshTimeoutMs = Math.max(getMlTimeoutMs(), 5000);
  void fetchFromMlService<MlApiRefreshResponse>('/ml/v1/refresh', 'POST', refreshTimeoutMs).catch(
    (err) => {
      console.warn(
        '[RecommendationService] Fire-and-forget ML refresh skipped:',
        err instanceof Error ? err.message : err
      );
    }
  );
}

export async function getMlServiceStatus(): Promise<MlStatusResponse> {
  const mlUrl = getMlBaseUrl();
  const timeoutMs = getMlTimeoutMs();

  let mlHealth: MlHealthPayload | null = null;
  try {
    mlHealth = await fetchFromMlService<MlHealthPayload>('/health', 'GET');
  } catch {
    mlHealth = null;
  }

  const snapshot = await getFallbackCatalogSnapshot();
  const fallbackAgeSeconds = round2(Math.max(0, (Date.now() - snapshot.builtAtMs) / 1000));

  return {
    mlServiceUrl: mlUrl,
    timeoutMs,
    mlServiceReachable: mlHealth !== null && mlHealth.status === 'ok',
    status: mlHealth !== null && mlHealth.status === 'ok' ? 'live' : 'fallback',
    mlHealth: mlHealth
      ? {
          status: mlHealth.status,
          service: mlHealth.service,
          catalogSize: mlHealth.catalog_size,
          snapshotAgeSeconds: mlHealth.snapshot_age_seconds,
          dbConnected: mlHealth.db_connected,
        }
      : null,
    fallbackReady: true,
    catalogSize: mlHealth ? mlHealth.catalog_size : snapshot.properties.length,
    snapshotAgeSeconds: mlHealth ? mlHealth.snapshot_age_seconds : fallbackAgeSeconds,
  };
}

export async function refreshMlCaches(): Promise<{
  refreshed: boolean;
  mlServiceRefreshed: boolean;
  catalogSize: number;
  snapshotAgeSeconds: number;
}> {
  await invalidateAllRecommendationCaches();

  let mlResp: MlApiRefreshResponse | null = null;
  try {
    const refreshTimeoutMs = Math.max(getMlTimeoutMs(), 5000);
    mlResp = await fetchFromMlService<MlApiRefreshResponse>(
      '/ml/v1/refresh',
      'POST',
      refreshTimeoutMs
    );
  } catch (err) {
    console.warn(
      '[RecommendationService] ML refresh endpoint unreachable during admin refresh:',
      err instanceof Error ? err.message : err
    );
  }

  const snapshot = await getFallbackCatalogSnapshot(true);
  const fallbackAgeSeconds = round2(Math.max(0, (Date.now() - snapshot.builtAtMs) / 1000));

  return {
    refreshed: true,
    mlServiceRefreshed: Boolean(mlResp?.refreshed),
    catalogSize: mlResp ? mlResp.catalog_size : snapshot.properties.length,
    snapshotAgeSeconds: mlResp ? mlResp.snapshot_age_seconds : fallbackAgeSeconds,
  };
}
