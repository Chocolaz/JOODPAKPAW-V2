# JoodPakPaw V2 Custom Product Backlog & Git Commit Tracker (`BACKLOG_AND_GIT_PLAN.md`)

เอกสารนี้ใช้ติดตามสถานะความคืบหน้าของ **Sprint 0 ถึง Sprint 4 (`PBI-01` ถึง `PBI-21`)** ของเราเอง โดยยึดกฎ:
- **1 Phase = 1 Sprint = 1 Feature Branch**
- **1 PBI = 1 Atomic Git Commit** (เมื่อผ่านการตรวจจาก `qa-auditor` แล้วเท่านั้น)
- **จบ 1 Sprint = 1 Git Merge (`--no-ff`) เข้ากิ่ง `develop` + Sync Postman Cloud**
- **Enterprise V2 Standard บังคับใช้ทุก PBI:**
  1. **Single Standard Envelope (`data` + `pagination`)** และชื่อฟิลด์ **`camelCase`** ทั้งระบบ (Backend & Frontend `lib/api.ts`)
  2. **S3 WebP Compression + Garbage Collection (`deleteObjectFromS3`)** ทุกครั้งที่ลบรูปหรืออัปโหลดรูปทับ
  3. **Strict Marketplace Business Rules, IDOR/RBAC Guards & OWASP Hygiene**
  4. **Postman Collection Auto-Update & Cloud Sync** ควบคู่กับชุดทดสอบอัตโนมัติใน `smoke-test.ts`

---

## Phase 0 / Sprint 0: Foundation, Monorepo Infra & Database (COMPLETED)
- **Branch:** `feat/phase-0-db-infra`
- **Merge Commit:** `af57081` — `chore(sprint-0): merge phase 0 database and infrastructure into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-01`** | **Docker Compose & `joodpakpaw-api` Skeleton:** ตั้งค่า `docker-compose.yml` (`joodpakpaw-postgres`, `joodpakpaw-redis`, `joodpakpaw-minio`, `joodpakpaw-network`) และโครงสร้างโปรเจกต์ `joodpakpaw-api` พร้อม `/health` และ `.env.example` | `db-infra-architect` | `feat(infra): [PBI-01] setup joodpakpaw docker-compose and api project skeleton` |
| `[x]` | **`PBI-02`** | **Complete 41-Table PostgreSQL Schema & Migrations:** สร้าง Schema & Migration ครบทั้ง 41 ตาราง (8 โดเมน) พร้อม Indexes และ Constraints กันห้องติดลบ รองรับทั้ง Local Docker และ Supabase/Neon | `db-infra-architect` | `feat(db): [PBI-02] implement complete postgresql schema, constraints, and indexes` |
| `[x]` | **`PBI-03`** | **Master Lookup & Demo Seed Data:** สร้างสคริปต์ Seed ข้อมูลตั้งต้น (Roles, Permissions, ประเภทสัตว์, สายพันธุ์, ขนาดน้ำหนัก, ระดับพลังงาน 1–5, สิ่งอำนวยความสะดวก, หมวดรายงาน) และบัญชี/ที่พักตัวอย่าง (`Password123!`) | `db-infra-architect` | `feat(seed): [PBI-03] add master lookup seed data and demo accounts/properties` |

---

## Phase 1 / Sprint 1: Auth, User, Property/Room CRUD & Cloud Storage (COMPLETED)
- **Branch:** `feat/phase-1-auth-property` & `feat/phase-1-enterprise-refactor`
- **Merge Commit:** `1def09a` / `7e11811` — `merge: feat/phase-1-enterprise-refactor into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope & Enterprise Rules) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-04`** | **Authentication, Rate Limiting & Password Policy API:** พัฒนา `/api/v1/auth/*` (`sign-up`, `verify-otp`, `resend-otp`, `sign-in`, `refresh-token`, `sign-out`, `forgot-password`, `reset-password`, `profile`) พร้อม Rate Limiting, Password Redaction, Token Revocation และรหัส Error (`T-2007`, `A-3001`..`A-3012`, `DB-1002`) | `backend-core-engineer` | `feat(auth): [PBI-04] implement JWT auth, OTP verification, and password reset APIs` |
| `[x]` | **`PBI-05`** | **S3 WebP Storage Adapter, Garbage Collection & User Profile API:** สร้างตัวอัปโหลด `.webp` + `deleteObjectFromS3` GC และพัฒนา `PUT /api/v1/users/:userId`, `PATCH /api/v1/users/me/change-password` | `backend-core-engineer` | `feat(users): [PBI-05] implement S3 WebP storage adapter and user profile APIs` |
| `[x]` | **`PBI-06`** | **Master Lookups & Public Property Discovery API:** พัฒนา API ตัวเลือกและค้นหาที่พักหน้าแรกภายใต้ Single Standard Envelope (`data` + `pagination`) | `backend-core-engineer` | `feat(properties): [PBI-06] implement lookup endpoints and public property search APIs` |
| `[x]` | **`PBI-07`** | **Host Property & Room Category CRUD API:** พัฒนา `/api/v1/hosts/properties/*` และ `/room-categories/*` พร้อมกฎ Marketplace `P-5001` (ห้ามเปิด `isActive` ถ้ายังไม่มีห้องพัก), Active Booking Deletion Guard (`B-4001`) และ S3 GC | `backend-core-engineer` | `feat(host): [PBI-07] implement host property and room category CRUD APIs` |
| `[x]` | **`PBI-08`** | **Frontend Core, Client WebP & V2 Contract Unwrapping:** ปรับ `joodpakpaw-frontend` ใช้ Root Path `/`, บีบอัดรูป WebP ฝั่ง Client, และรีแฟกเตอร์ `lib/api.ts` & `types/*.ts` ให้ใช้ Single `data` Envelope + `camelCase` DTOs | `frontend-upgrader` | `feat(refactor): [Sprint-1] standardize enterprise single data envelope, rate limiting, and security rules` |

---

## Phase 2 / Sprint 2: Booking Engine, Host Calendar UI, Pets, Favorites & Reviews (COMPLETED)
- **Branch:** `feat/phase-2-booking-calendar`
- **Merge Commit:** `c44cd68` — `feat(sprint-2): merge booking engine, calendar UI, pets, and reviews into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope & Proactive Enterprise Business Rules) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-09`** | **Pet Profile CRUD API & Frontend Unwrap:** พัฒนา `/api/v1/profiles/pet-profiles/*` (`GET /all`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`) ภายใต้ Single `data` Envelope + `camelCase` (`petSizeCategoryId`), S3 WebP + Garbage Collection เมื่อลบรูปสัตว์เลี้ยง, ป้องกัน IDOR (`A-3007`), และบล็อกการลบสัตว์เลี้ยงที่ติดใบจอง (`B-4001`) พร้อมอัปเดต `lib/api.ts` และ 6-step Add-Pet Wizard | `backend-core-engineer` + `frontend-upgrader` | `feat(pbi-09): implement pet profiles CRUD with S3 WebP and active booking guard` |
| `[x]` | **`PBI-10`** | **Row-Locked Multi-Room Booking Engine & Marketplace Guards:** พัฒนา `POST /api/v1/bookings`, `GET /bookings/paginate`, `GET /bookings/:id` ด้วย `SELECT ... FOR UPDATE` บน `room_category_calendars`, บล็อก Host จองที่พักตัวเอง (`B-4002`), ตรวจวันเช็คอิน/เอาต์ (`B-4003`), ตรวจสิทธิ์เจ้าของสัตว์เลี้ยง + ชนิด/ขนาดน้ำหนักสัตว์ + ความจุห้อง + กันสัตว์เลี้ยงจองซ้ำช่วงเวลาเดียวกัน (`B-4004`) และบันทึก `pet_snapshot` | `backend-core-engineer` + `frontend-upgrader` | `feat(pbi-10): implement row-locked multi-room booking engine and date availability search` |
| `[x]` | **`PBI-11`** | **Booking Payment, Cancel, Checkout & Host Booking Management:** พัฒนา `PATCH /bookings/:id/confirm-payment` (อัปโหลดสลิป `.webp` + เช็ก `paymentDeadline`), `PATCH /bookings/:id/cancel` (คืนโควตา `booked_rooms` อัตโนมัติ), `PATCH /hosts/bookings/:id/success` (เฉพาะ Host เจ้าของที่พักเมื่อถึงวันเข้าพัก) และ `/hosts/bookings/*` พร้อมปรับ `lib/api.ts` และ Lifecycle Scheduler | `backend-core-engineer` + `frontend-upgrader` | `feat(pbi-11): implement payment slip 24h window guard, atomic quota restore, and host checkout` |
| `[x]` | **`PBI-12`** | **Host Room Availability & Dynamic Pricing Calendar (API + UI):** สร้าง `GET` & `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` (พร้อม Guard ห้ามบล็อกห้องเกินจำนวนห้องว่างที่ยังไม่ถูกจอง `unavailableRooms <= totalRooms - bookedRooms`) คู่กับ **UI จัดการปฏิทินห้องพักและปรับราคารายวันของ Host** ใน `joodpakpaw-frontend` | `backend-core-engineer` + `frontend-upgrader` | `feat(pbi-12): implement host room availability and dynamic pricing calendar API and UI drawer` |
| `[x]` | **`PBI-13`** | **Favorite Folders (`FF-4101`) & Verified-Stay Review System:** พัฒนา `/api/v1/favorite-folders/*`, `/favorite-properties/:id` (พร้อมรหัส `FF-4101`) และ `POST /api/v1/bookings/:bookingId/review` (อนุญาตเฉพาะผู้เข้าพักจริงที่สถานะใบจอง `successful`/`completed` ภายใน 14 วัน, จำกัด 1 รีวิวต่อ 1 ใบจอง, อัปโหลดรูป `.webp`, คำนวณ `property.avgRating` ใหม่แบบ Atomic และรองรับ `review-reply` ของ Host) | `backend-core-engineer` + `frontend-upgrader` | `feat(pbi-13): implement favorites wishlist folders and verified-stay single reviews with rating sync` |

---

## Phase 3 / Sprint 3: Real-Time Socket.IO, Chat, KYC & Admin Backoffice (COMPLETED)
- **Branch:** `feat/phase-3-realtime-admin`
- **Status:** Integrated into `develop` (`60ad1ba`..`8906ecb`, Postman synced at `b28d601`)

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope & Proactive Enterprise Business Rules) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-14`** | **Socket.IO v4 Server, Persistent Notifications & Reminder Scheduler:** พัฒนา Socket.IO Server (`/api/socket.io`), REST API `/api/v1/notifications/*` (รวม `PATCH /:id/read` และ `PATCH /read-all` ภายใต้ Single `data` Envelope) และระบบส่งอีเมล/แจ้งเตือนก่อนเช็คอิน (รองรับทั้ง Redis และ In-Memory Fallback) | `backend-core-engineer` | `feat(notifications): [PBI-14] implement Socket.IO server, persistent notification APIs, and check-in reminder scheduler` |
| `[x]` | **`PBI-15`** | **Real-Time Chat Rooms & Messaging API:** พัฒนา `/api/v1/chat-rooms/*` พร้อมป้องกันการสร้างห้องแชทกับตัวเอง, Deduplicate ห้องแชท 1-ต่อ-1 ที่มีอยู่แล้ว, ตรวจสิทธิ์เฉพาะคู่สนทนา (`403 A-3007`), อัปโหลดรูปแชท `.webp` + S3 GC และยิงอีเวนต์ `new_message`, `messages_read`, `new_chat_room` | `backend-core-engineer` | `feat(chat): [PBI-15] implement real-time chat rooms and messaging APIs with contextual inquiry metadata` |
| `[x]` | **`PBI-16`** | **Frontend Real-Time WebSocket & Notification Sync Upgrade:** อัปเกรด `joodpakpaw-frontend/lib/socket.ts` ให้ใช้ Env Config + โหมด WebSocket แท้, เชื่อม `NotificationContext.tsx` ซิงค์สถานะ `is_read` ลงฐานข้อมูลจริง และปรับ `lib/api.ts` หมวด Chat/Notification ให้รับ Single `data` Envelope | `frontend-upgrader` | `feat(fe-realtime): [PBI-16] upgrade socket transport, actionable notifications, and Airbnb contextual chat UX` |
| `[x]` | **`PBI-17`** | **Host KYC Verification Workflow & Single-Review Guard:** พัฒนา `/api/v1/user-verifications/*` (บล็อกการส่งซ้ำถ้าสถานะ `pending`/`approved`, อัปโหลดบัตร/เซลฟี่เป็น `.webp` + S3 GC) และ `/api/v1/admin/user-verifications/*` (อนุมัติแล้วอัปเกรด `isVerifiedHost = true` + Role `host` + แจ้งเตือนทันที พร้อมล็อกไม่ให้ Admin กดซ้ำตาม `TC-API-172`) | `backend-core-engineer` + `frontend-upgrader` | `feat(kyc): [PBI-17] implement host KYC verification workflow with universal access and single-review lock` |
| `[x]` | **`PBI-18`** | **Report System, Cascading Admin Ban/Appeal State Machine & Action Logs:** พัฒนา `/api/v1/reports/*` (ป้องกันการรายงานซ้ำ, จำกัดสิทธิ์ยื่นอุทธรณ์เฉพาะเจ้าของที่พักที่ถูกแบน) และ `/api/v1/admin/*` (Dashboard, จัดการรายงานแบบ Single-Action Lock `TC-API-168`, แบนที่พักเดี่ยว vs แบนทั้งบัญชีพร้อมคืนค่า `isBannedBeforeAccountBan` เมื่อปลดแบนตาม `TC-151..155`, และ Action Logs) | `backend-core-engineer` + `frontend-upgrader` | `feat(admin): [PBI-18] implement report system, cascading ban/appeal state machine, and Airbnb-grade admin center` |

---

## Phase 4 / Sprint 4: Hybrid ML Service (`joodpakpaw-ml`) & Production Polish (COMPLETED)
- **Branch:** `feat/phase-4-ml-hybrid`
- **Merge Commit:** `chore(sprint-4): merge phase 4 hybrid ML service and frontend optimization into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope & Proactive Enterprise Business Rules) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-19`** | **`joodpakpaw-ml` 3-Stage Pet-Aware Hybrid Recommendation Service:** พัฒนา Python FastAPI พอร์ต `5000` (Stage 1: Tiered Strict-First `all_pets` / `partial_pets` + ตัดที่พักของตัวเอง/ที่พักถูกแบนออก, Stage 2: Energy-Facility Compatibility + TF-IDF Cosine Similarity, Stage 3: Reconciled Behavioral Time-Decay + IMDB Bayesian Rating) พร้อม Explainable `match_reasons`, `score_breakdown`, 60s Snapshot Cache, และ Dockerfile สำหรับ Free Cloud (`b5cdcee`) | `ml-recommendation-engineer` | `feat(ml): [PBI-19] implement joodpakpaw-ml FastAPI 3-stage pet-aware hybrid recommendation service` |
| `[x]` | **`PBI-20`** | **Backend ML Integration & 1.5s Cold-Start Fallback:** พัฒนา `POST /api/v1/user-behaviors/view-property/:id` (10-min cooldown + self-view skip), `GET /api/v1/properties/recommend`, `/recommend/property/:id`, Batch `GET /api/v1/properties?ids=...`, และ `/api/v1/admin/ml/{status,refresh}` (Admin RBAC `403 A-3007`) พร้อม **In-Process Pet-Aware + Bayesian Fallback ภายใน 1.5 วินาที** (`0910358`) | `backend-core-engineer` | `feat(api-ml): [PBI-20] integrate recommendation endpoints with 1.5s cold-start fallback` |
| `[x]` | **`PBI-21`** | **Frontend Explainable AI UI, SWR Caching, Admin ML Inspector & Free Cloud Deployment Guide:** อัปเกรด UI แสดง Match Reason Pill + Guest Cold-Start Picks + SWR Hooks + Batch `Recently Viewed` + `/admin/ml-inspector` + `docker-compose.yml` + `docs/FREE_CLOUD_DEPLOY_GUIDE.md` + Postman Sprint 4 Folder | `frontend-upgrader` + `db-infra-architect` | `feat(fe-perf): [PBI-21] optimize home feed requests and add free-tier cloud deployment guide` |
