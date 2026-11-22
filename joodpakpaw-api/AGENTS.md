# JoodPakPaw Backend API Service Rules (`joodpakpaw-api/AGENTS.md`)

กฎเฉพาะสำหรับเซอร์วิส **`joodpakpaw-api`** (Node.js, Express, TypeScript, Prisma ORM, PostgreSQL 16, Socket.IO v4, AWS S3 SDK) โหลดควบคู่กับ `d:\Project\joodpakpaw\AGENTS.md`

## 1. API Contract & Response Envelope Governance
1. **Mandatory Skill Reference:** อ่าน `.agents/skills/joodpakpaw-api-contract/SKILL.md` และ `.agents/skills/joodpakpaw-db-schema/SKILL.md` ก่อนแก้ไขโค้ดเสมอ
2. **Single Standard Envelope (`data` wrapper):**
   - ทุก Endpoint ภายใต้ `/api/v1/*` ต้องส่งคืน `{ code: "S-0000", message: "...", data: ... }` (และ `pagination: { page, limit, totalRows, totalPages }` สำหรับรายการแบ่งหน้า) ห้ามคัดลอกฟิลด์ซ้ำไว้นอก `data`
   - ใช้ชื่อฟิลด์ **`camelCase`** ทั้งระบบ (`firstName`, `lastName`, `petProfileIds`, `petSizeCategoryId`, `stayNights`, `stayTotalPrice`, `matchReasons`, `matchTier`)
3. **Mandatory Custom Error Codes:**
   - ส่งคืนรหัส Error ที่ Frontend (`lib/errorHandling.ts`) ใช้งานอย่างแม่นยำ: `T-2007` (พร้อม `errors: [{ field, tag, value }]` และปิดบังรหัสผ่านเป็น `"[REDACTED]"`), `A-3001`..`A-3012`, `DB-1002`, `FF-4101`, `P-5001`, `B-4001`..`B-4004`, `RATE_LIMIT_EXCEEDED`

## 2. Discovery, Concurrency & ML Integration Rules
1. **Row-Level Locking Booking Engine (`SELECT ... FOR UPDATE`):**
   - การจองห้องพัก (`POST /api/v1/bookings`) ต้องล็อกแถวใน `room_categories` และ `room_category_calendars` ตลอดช่วง `[checkInDate, checkOutDate)` ภายใน Transaction เดียวกัน พร้อมตรวจ `B-4002` (ห้ามจองที่พักตัวเอง), `B-4003` (ความถูกต้องของวันเข้าพัก), และ `B-4004` (สิทธิ์ความเป็นเจ้าของสัตว์เลี้ยง + ชนิด/ขนาดน้ำหนัก + ห้ามจองสัตว์เลี้ยงซ้ำช่วงเวลาเดียวกัน)
2. **Airbnb-Grade Discovery & Context-Aware ML Candidate Ranking (`GET /api/v1/properties`):**
   - รองรับการค้นหาจังหวัดสองภาษา (EN/TH) ผ่านตาราง `provinces` (77 จังหวัด), การคำนวณห้องว่างและราคารวมจริงตามช่วงวัน (`checkIn`/`checkOut` -> `stayNights`, `stayTotalPrice`), การกรองขนาดสัตว์เลี้ยงแบบ **Up-to-Max-Size** (`petSizeCategoryId`), การกรองตามโปรไฟล์สัตว์เลี้ยงแบบ **IDOR-safe** (`petProfileIds` ต้องเป็นของ `req.user.id` เท่านั้น), และการคำนวณระยะทาง Haversine (`lat`/`lng` -> `distanceKm`)
   - เมื่อ `sortBy=recommended` ให้เรียก `rankCandidateProperties()` ใน `src/services/recommendation.service.ts` เพื่อส่งชุด `candidatePropertyIds` และบริบทตัวกรองไปยัง `joodpakpaw-ml` (`POST /ml/v1/rank/candidates` timeout 1500ms) พร้อม **In-Process Fallback** ที่ใช้ตรรกะเดียวกันและล็อก `catalogSnapshotInFlight` (Single-Flight Lock) เพื่อป้องกัน Prisma Connection Pool Timeout
3. **S3 WebP Pipeline & Garbage Collection:**
   - ทุกไฟล์รูปภาพที่อัปโหลดต้องแปลงเป็น `.webp` ผ่าน `sharp` และทุกครั้งที่มีการแทนที่หรือลบรูป ต้องเรียก `deleteObjectFromS3` เพื่อลบไฟล์เก่าเสมอ
4. **Verification Commands:**
   - รัน `npx tsc` (หรือ `npm run build` เมื่อ `tsx watch` ไม่ได้ล็อกไฟล์ `query_engine-windows.dll.node`) และรันชุดทดสอบ `npx tsx src/test/smoke-test.ts` (`86/86 PASSED`) ก่อนส่งมอบงานให้ `qa-auditor`
