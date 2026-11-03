# JoodPakPaw V2 Custom Product Backlog & Git Commit Tracker (`BACKLOG_AND_GIT_PLAN.md`)

เอกสารนี้ใช้ติดตามสถานะความคืบหน้าของ **Sprint 0 ถึง Sprint 4 (`PBI-01` ถึง `PBI-21`)** ของเราเอง โดยยึดกฎ:
- **1 Phase = 1 Sprint = 1 Feature Branch**
- **1 PBI = 1 Atomic Git Commit** (เมื่อผ่านการตรวจจาก `qa-auditor` แล้วเท่านั้น)
- **จบ 1 Sprint = 1 Git Merge (`--no-ff`) เข้ากิ่ง `develop`**

---

## Phase 0 / Sprint 0: Foundation, Monorepo Infra & Database
- **Branch:** `feat/phase-0-db-infra`
- **Merge Commit:** `chore(sprint-0): merge phase 0 database and infrastructure into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-01`** | **Docker Compose & `joodpakpaw-api` Skeleton:** ตั้งค่า `docker-compose.yml` (`joodpakpaw-postgres`, `joodpakpaw-redis`, `joodpakpaw-minio`, `joodpakpaw-network`) และโครงสร้างโปรเจกต์ `joodpakpaw-api` พร้อม `/health` และ `.env.example` | `db-infra-architect` | `feat(infra): [PBI-01] setup joodpakpaw docker-compose and api project skeleton` |
| `[x]` | **`PBI-02`** | **Complete 41-Table PostgreSQL Schema & Migrations:** สร้าง Schema & Migration ครบทั้ง 41 ตาราง (8 โดเมน) พร้อม Indexes และ Constraints กันห้องติดลบ รองรับทั้ง Local Docker และ Supabase/Neon | `db-infra-architect` | `feat(db): [PBI-02] implement complete postgresql schema, constraints, and indexes` |
| `[x]` | **`PBI-03`** | **Master Lookup & Demo Seed Data:** สร้างสคริปต์ Seed ข้อมูลตั้งต้น (Roles, Permissions, ประเภทสัตว์, สายพันธุ์, ขนาดน้ำหนัก, ระดับพลังงาน 1–5, สิ่งอำนวยความสะดวก, หมวดรายงาน) และบัญชี/ที่พักตัวอย่าง | `db-infra-architect` | `feat(seed): [PBI-03] add master lookup seed data and demo accounts/properties` |

---

## Phase 1 / Sprint 1: Auth, User, Property/Room CRUD & Cloud Storage
- **Branch:** `feat/phase-1-auth-property`
- **Merge Commit:** `chore(sprint-1): merge phase 1 auth, user, property CRUD, and S3 WebP pipeline into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[x]` | **`PBI-04`** | **Authentication & Password Policy API:** พัฒนา `/api/v1/auth/*` (`sign-up`, `verify-otp`, `resend-otp`, `sign-in`, `refresh-token`, `forgot-password`, `reset-password`, `profile`) พร้อมรหัส Error (`T-2007`, `A-3001`..`A-3012`, `DB-1002`) | `backend-core-engineer` | `feat(auth): [PBI-04] implement JWT auth, OTP verification, and password reset APIs` |
| `[ ]` | **`PBI-05`** | **S3 WebP Storage Adapter & User Profile API:** สร้างตัวอัปโหลดและแปลงรูปเป็น `.webp` ด้วย `@aws-sdk/client-s3` + `sharp` (รองรับ MinIO / Cloudflare R2 / Supabase Storage) และพัฒนา `/api/v1/users/:userId` | `backend-core-engineer` | `feat(users): [PBI-05] implement S3 WebP storage adapter and user profile APIs` |
| `[ ]` | **`PBI-06`** | **Master Lookups & Public Property Discovery API:** พัฒนา API ตัวเลือก (`/pets/all`, `/pet-breeds/all`, `/pet-size-categories/all`, `/hosts/facilities/all`) และ API ค้นหา/กรองที่พักหน้าแรก (`GET /api/v1/properties`, `/:id`, `/hosts/:hostId/profile`, `/reviews`) | `backend-core-engineer` | `feat(properties): [PBI-06] implement lookup endpoints and public property search APIs` |
| `[ ]` | **`PBI-07`** | **Host Property & Room Category CRUD API:** พัฒนา `/api/v1/hosts/properties/*` และ `/room-categories/*` สำหรับผู้ให้บริการจัดการที่พักและประเภทห้องพัก | `backend-core-engineer` | `feat(host): [PBI-07] implement host property and room category CRUD APIs` |
| `[ ]` | **`PBI-08`** | **Frontend Core & Client WebP Upgrade:** ปรับ `joodpakpaw-frontend` ให้ใช้ Root Path `/` เป็นค่าเริ่มต้น (พร้อมขึ้น Vercel ฟรี) และเพิ่ม `lib/imageCompression.ts` บีบอัดรูปเป็น WebP ฝั่ง Client ก่อนอัปโหลด | `frontend-upgrader` | `feat(fe-core): [PBI-08] configure root path for Vercel and add client-side WebP compression` |

---

## Phase 2 / Sprint 2: Booking Engine, Host Calendar UI, Pets, Favorites & Reviews
- **Branch:** `feat/phase-2-booking-calendar`
- **Merge Commit:** `chore(sprint-2): merge phase 2 booking engine, host calendar UI, pets, favorites, and reviews into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[ ]` | **`PBI-09`** | **Pet Profile CRUD API:** พัฒนา `/api/v1/profiles/pet-profiles/*` พร้อมระบบป้องกันการลบโปรไฟล์สัตว์เลี้ยงที่กำลังติดใบจองอยู่ | `backend-core-engineer` | `feat(pets): [PBI-09] implement pet profile CRUD APIs with active-booking deletion guard` |
| `[ ]` | **`PBI-10`** | **Room Availability Search & Row-Locked Booking Engine:** พัฒนา `GET /properties/:id/room-categories/search` และ `POST /api/v1/bookings` แบบ Multi-Room พร้อม Row-Level Lock (`SELECT ... FOR UPDATE`) บนตาราง `room_category_calendars` | `backend-core-engineer` | `feat(booking): [PBI-10] implement room search and row-locked multi-room booking engine` |
| `[ ]` | **`PBI-11`** | **Booking Payment, Cancel & Host Booking Management API:** พัฒนา `PATCH /bookings/:id/confirm-payment`, `PATCH /bookings/:id/cancel` (คืนโควตาห้องว่าง), `PATCH /hosts/bookings/:id/success` และ API ดูรายการจองฝั่ง Host | `backend-core-engineer` | `feat(booking-flow): [PBI-11] implement payment confirmation, cancellation, checkout, and host booking APIs` |
| `[ ]` | **`PBI-12`** | **Host Room Availability & Dynamic Pricing Calendar (API + UI):** สร้าง Endpoint `GET` & `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` คู่กับ UI จัดการปฏิทินห้องพักและปรับราคารายวันของ Host ใน `joodpakpaw-frontend` | `backend-core-engineer` + `frontend-upgrader` | `feat(calendar): [PBI-12] implement host room availability and daily pricing calendar API and UI` |
| `[ ]` | **`PBI-13`** | **Favorite Folders (`FF-4101`) & Booking Review System:** พัฒนา `/api/v1/favorite-folders/*`, `/favorite-properties/:id` และระบบรีวิว `POST /api/v1/bookings/:bookingId/review` | `backend-core-engineer` | `feat(favorites-reviews): [PBI-13] implement favorite folders with FF-4101 and booking review system` |

---

## Phase 3 / Sprint 3: Real-Time Socket.IO, Chat, KYC & Admin Backoffice
- **Branch:** `feat/phase-3-realtime-admin`
- **Merge Commit:** `chore(sprint-3): merge phase 3 real-time socket, chat, KYC, and admin system into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[ ]` | **`PBI-14`** | **Socket.IO v4 Server, Notifications & Check-in Reminder Scheduler:** พัฒนา Socket.IO Server (`/api/socket.io`), REST API `/api/v1/notifications/*` และระบบส่งอีเมล SMTP + แจ้งเตือนก่อนเช็คอิน (รองรับทั้ง Redis และ In-Memory Fallback) | `backend-core-engineer` | `feat(notifications): [PBI-14] implement Socket.IO server, notification APIs, and check-in reminder scheduler` |
| `[ ]` | **`PBI-15`** | **Real-Time Chat Rooms & Messaging API:** พัฒนา `/api/v1/chat-rooms/*` พร้อมยิงอีเวนต์ `new_message`, `messages_read`, `new_chat_room` | `backend-core-engineer` | `feat(chat): [PBI-15] implement real-time chat rooms and messaging APIs with Socket.IO` |
| `[ ]` | **`PBI-16`** | **Frontend Real-Time & Notification Sync Upgrade:** อัปเกรด `joodpakpaw-frontend/lib/socket.ts` ให้ใช้ Env Config + โหมด WebSocket แท้ และซิงค์สถานะ `is_read` ลงฐานข้อมูลจริง | `frontend-upgrader` | `feat(fe-realtime): [PBI-16] upgrade socket client to WebSocket transport and sync notification read state` |
| `[ ]` | **`PBI-17`** | **Host KYC Verification Workflow:** พัฒนา `/api/v1/user-verifications/*` และ `/api/v1/admin/user-verifications/*` (อนุมัติ/ปฏิเสธ พร้อมล็อกไม่ให้กดซ้ำ) | `backend-core-engineer` | `feat(kyc): [PBI-17] implement host KYC verification submission and admin review workflow` |
| `[ ]` | **`PBI-18`** | **Report System, Admin Ban/Appeal State Machine & Action Logs:** พัฒนา `/api/v1/reports/*` และ `/api/v1/admin/*` (Dashboard, จัดการรายงาน, แบนที่พักเดี่ยว vs แบนทั้งบัญชีพร้อมคืนค่าสถานะเดิมเมื่อปลดแบน และ Action Logs) | `backend-core-engineer` | `feat(admin): [PBI-18] implement report system, cascading ban/appeal state machine, and admin dashboard` |

---

## Phase 4 / Sprint 4: Hybrid ML Service (`joodpakpaw-ml`) & Production Polish
- **Branch:** `feat/phase-4-ml-hybrid`
- **Merge Commit:** `chore(sprint-4): merge phase 4 hybrid ML service and frontend optimization into develop`

| สถานะ | รหัส PBI | รายละเอียดงาน (PBI Scope) | Agent ผู้สร้าง | ข้อความ Git Commit (`git commit -m "..."`) |
| :---: | :--- | :--- | :--- | :--- |
| `[ ]` | **`PBI-19`** | **`joodpakpaw-ml` 3-Stage Hybrid Recommendation Service:** พัฒนา Python FastAPI พอร์ต `5000` (Pet Safety Filter + Energy/Facility Matching + Behavioral Time-Decay & Bayesian Rating) พร้อม Dockerfile สำหรับ Hugging Face Spaces / Render | `ml-recommendation-engineer` | `feat(ml): [PBI-19] implement joodpakpaw-ml FastAPI 3-stage pet-aware hybrid recommendation service` |
| `[ ]` | **`PBI-20`** | **Backend ML Integration & Cold-Start Fallback:** พัฒนา `POST /api/v1/user-behaviors/view-property/:id`, `GET /api/v1/properties/recommend` และ `/recommend/property/:id` พร้อมระบบ In-Process Fallback ภายใน 1.5 วินาที | `backend-core-engineer` | `feat(api-ml): [PBI-20] integrate recommendation endpoints with 1.5s cold-start fallback` |
| `[ ]` | **`PBI-21`** | **Frontend Home Feed Optimization & Free Cloud Deployment Guide:** ปรับปรุง `joodpakpaw-frontend/app/(browse)/page.tsx` ลดการยิง API ซ้ำซ้อนด้วย Caching และสร้างคู่มือการ Deploy บนบริการฟรี (`docs/FREE_CLOUD_DEPLOY_GUIDE.md`) | `frontend-upgrader` | `feat(fe-perf): [PBI-21] optimize home feed requests and add free-tier cloud deployment guide` |
