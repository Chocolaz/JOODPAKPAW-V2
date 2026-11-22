# JoodPakPaw Multi-Agent Architecture & Workspace Rules (`AGENTS.md`)

ไฟล์นี้ทำหน้าที่เป็น **Workspace Rule สูงสุดของโปรเจกต์ JoodPakPaw V2 (Monorepo — Release `v0.6.1`)** ซึ่งระบบ Antigravity จะโหลดอัตโนมัติในทุกโฟลเดอร์ย่อยควบคู่กับ `AGENTS.md` ประจำแต่ละเซอร์วิส (`joodpakpaw-frontend/AGENTS.md`, `joodpakpaw-api/AGENTS.md`, `joodpakpaw-ml/AGENTS.md`) เพื่อควบคุมบทบาท (Roles), ขอบเขตหน้าที่ (Mission), การเรียกใช้ทักษะเฉพาะทาง (Skills), กฎการส่งมอบงานระหว่าง **Builder Agents** กับ **Auditor/Reviewer Agent**, กฎการใช้งาน Git และมาตรฐานการรองรับการ Deploy บนบริการฟรี (Free-Tier Cloud Compatibility)

---

## 1. กฎเหล็กของการทำงานร่วมกัน (Core Multi-Agent Governance)

1. **ห้ามใช้ชื่อ `catbnb` หรือ Path มหาวิทยาลัยเดิม (`/capstone25/cp25nk2`) เป็นค่าเริ่มต้น:**
   - ใช้ชื่อ **`joodpakpaw-*`** ทั้งระบบ: โฟลเดอร์ `joodpakpaw-frontend`, `joodpakpaw-api`, `joodpakpaw-ml` และชื่อ Docker Containers/Network `joodpakpaw-postgres`, `joodpakpaw-redis`, `joodpakpaw-minio`, `joodpakpaw-api`, `joodpakpaw-ml`, `joodpakpaw-frontend`, `joodpakpaw-nginx`, `joodpakpaw-network`
   - ใช้ Root URL Path มาตรฐานสะอาดๆ (`/` สำหรับเว็บ และ `/api/v1`, `/api/socket.io` สำหรับหลังบ้าน) โดยยังสามารถตั้งค่าผ่าน `.env` ได้
2. **ห้ามด้นสด แต่ต้องยกระดับสู่ Enterprise Best Practice (Proactive Architecture & Business Leadership):**
   - ก่อนเริ่มเขียนโค้ดหรือแก้ไขไฟล์ใดๆ Agent ทุกตัว **ต้องอ่าน `SKILL.md` ประจำบทบาทของตน** ในโฟลเดอร์ `.agents/skills/` และ `agent.md` ใน `.agents/agents/` เสมอ (และสำหรับงาน UI ต้องอ่าน `DESIGN.md` ที่รากของโปรเจกต์ควบคู่กัน)
   - **ไม่ต้องยึดติดกับจุดบกพร่องหรือหนี้ทางเทคนิค (Technical Debt) ในรูปเล่มโครงงานเดิมหรือโค้ดเก่า:** สามารถแก้ไขและยกระดับได้ทั้ง `joodpakpaw-api`, `joodpakpaw-ml` และ `joodpakpaw-frontend` เพื่อให้ถูกต้องตามหลัก **RESTful API Best Practice, OWASP Security Standards, Hallmark UI Quality Floor และตรรกะทางธุรกิจของระบบ Pet Boarding Marketplace จริง**
   - **Lead Orchestrator (Agent 00)** มีหน้าที่คิดวิเคราะห์ในมุม Product Manager & System Architect คอยตรวจสอบ เสนอแนะ และชี้นำผู้ใช้ทันทีเมื่อพบจุดที่ออกแบบไว้ไม่รัดกุม (เช่น โครงสร้าง JSON ซ้ำซ้อน, ชื่อฟิลด์ไม่เป็น `camelCase`, ช่องโหว่ IDOR/OTP/Password Hygiene, Connection Pool Timeout, หรือความไม่สอดคล้องของ Typography/Visual Design)
3. **แยกบทบาท "ผู้สร้าง (Builder)" ออกจาก "ผู้ตรวจและผู้ทดสอบ (Auditor & Reviewer)" อย่างเด็ดขาด:**
   - **Builder Agents (`db-infra-architect`, `backend-core-engineer`, `ml-recommendation-engineer`, `frontend-upgrader`)** มีหน้าที่เขียนโค้ดและรัน Typecheck/Build/Smoke Test เบื้องต้นเท่านั้น **ห้ามอนุมัติงานของตัวเองว่าเสร็จสมบูรณ์ (Done)**
   - **Auditor Agent (`qa-auditor`)** เป็นอิสระจากทีมสร้าง ห้ามเขียนโค้ดฟีเจอร์เอง มีหน้าที่ตรวจสอบ Contract Parity, Enterprise Best Practices, ทดสอบ Race Condition, ตรวจสอบช่องโหว่ IDOR/RBAC, ตรวจ Hallmark `sloplint` & Browser Console และรันชุดทดสอบอัตโนมัติ
4. **ยึดกระบวนการส่งต่องานตาม `mission_control.yaml`:**
   - ทุกการส่งมอบงานระหว่าง Agent ต้องแนบ **Handoff Payload** ที่ระบุ: (1) รายชื่อไฟล์ที่สร้าง/แก้ไขพร้อมลิงก์ `file:///`, (2) Endpoint, โมเดล ML หรือตารางฐานข้อมูลที่เกี่ยวข้อง, (3) ผลลัพธ์การรันคำสั่ง Build/Test เบื้องต้น

---

## 2. กฎการใช้งาน Git สำหรับ Multi-Agent (Git Governance & Branching Rules)

1. **โครงสร้าง 1 Monorepo (`d:\Project\joodpakpaw`):**
   - มี Git Repository เดียวที่โฟลเดอร์หลัก ควบคุมทั้ง `joodpakpaw-frontend`, `joodpakpaw-api`, `joodpakpaw-ml`, `docker-compose.yml`, `DESIGN.md`, `postman/`, `docs/` และ `.agents/`
2. **กลยุทธ์การแตก Branch (`main` + `develop` + `feat/...`):**
   - **`main`**: กิ่ง Production ที่เสถียรสูงสุด ห้ามแก้ไขหรือ Commit ลงกิ่งนี้โดยตรงเด็ดขาด
   - **`develop`**: กิ่ง Integration สำหรับรวมงานที่ผ่านการตรวจจาก `qa-auditor` ในแต่ละเฟสแล้ว
   - **`feat/phase-X-...` หรือ `feat/<scope>`**: กิ่งทำงานประจำเฟส/ฟีเจอร์ (เช่น `feat/phase-0-db-infra` .. `feat/phase-5-ml-filtered-ranking`) แตกออกจาก `develop`
3. **กฎ Auditor-Gated Commits & Local-First (ห้าม Builder Commit/Push เอง):**
   - **Builder Agents ห้ามรันคำสั่ง `git commit`, `git merge`, `git reset --hard` หรือ `git push` โดยเด็ดขาด**
   - เมื่อ Builder ทำงานเสร็จ ต้องให้ **`qa-auditor`** ตรวจสอบ `git status` / `git diff` (ป้องกันไฟล์ขยะหรือ `.env` หลุด) และรันเทสต์จนได้ผลลัพธ์ `STATUS: PASS`
   - เฉพาะ **Lead Orchestrator** เท่านั้นที่เป็นผู้รัน `git commit` ลงกิ่งทำงาน และ Merge เข้า `develop` เมื่อผ่าน QA แล้ว
   - **ห้ามรัน `git push` อัตโนมัติ** จนกว่าผู้ใช้จะสั่งหรือระบุชัดเจน
4. **กฎ Granular Atomic Commits (แตก 1 Commit ต่อ 1 PBI / 1 Scope เสมอ - กฎเหล็ก):**
   - **ห้าม Commit รวมกันทั้ง Wave หรือทั้ง Sprint เป็นก้อนใหญ่โดยเด็ดขาด**
   - ทุกๆ 1 Product Backlog Item (PBI) หรือ 1 หน่วยฟีเจอร์ จะต้องมี Git Commit แยกเฉพาะของตัวเองอย่างชัดเจนในรูปแบบ Conventional Commits: `feat(pbi-XX): <รายละเอียดฟีเจอร์>`, `feat(<scope>): <รายละเอียด>` หรือ `fix(<scope>): <รายละเอียด>` พร้อมชุดเทสต์ที่เกี่ยวข้อง
   - Lead Orchestrator จะต้องแตกและบันทึก Commit ทีละ 1 รายการเสมอ เพื่อให้ประวัติ Git สะอาด โปร่งใส สามารถตรวจสอบย้อนหลัง (Auditability), ทำ `git bisect` และ Rollback รายฟีเจอร์ได้ง่าย
5. **กฎ Human Approval Gate ก่อนเข้า Main (User-Gated Main Release):**
   - เมื่อจบแต่ละ Sprint หรือ Milestone: Lead Orchestrator จะรวบรวมงานเข้า `develop`, อัปเดตและซิงค์ Postman ขึ้น Cloud และส่งมอบรายงานสรุปให้ผู้ใช้ตรวจสอบ
   - **ห้าม Merge เข้า `main` เด็ดขาดจนกว่าผู้ใช้จะตรวจงานและพิมพ์อนุมัติ (เช่น "อนุมัติ" หรือ "merge ได้")**
   - เมื่อผู้ใช้อนุมัติ: Lead Orchestrator จะทำการ `git merge develop` เข้าสู่ `main` พร้อมสลับกลับมาที่ `develop` ให้พร้อมทำงานต่อทันที

---

## 3. กฎการรองรับการ Deploy ด้วยบริการฟรี (Free-Tier Cloud Readiness)

ทุกบริการต้องออกแบบให้รันได้ทั้งบน **Local Docker Compose** และ **Free-Tier Cloud Services** โดยเปลี่ยนแค่ `.env` (ไม่ต้องแก้โค้ด):
1. **`joodpakpaw-frontend` (Next.js 16 -> Vercel Free Tier):** ใช้ Root Path `/` เป็นค่าเริ่มต้น รองรับโดเมนรูปภาพจากทั้ง Local/MinIO, Unsplash และ Cloud Storage (Cloudflare R2 / Supabase Storage)
2. **Database (`joodpakpaw-postgres` -> Supabase / Neon Free Tier):** เชื่อมต่อผ่าน `DATABASE_URL` (และ `DIRECT_URL`) มาตรฐาน รองรับ Connection Pooling, SSL (`?sslmode=require`) และป้องกัน Connection Pool Timeout ด้วย Single-Flight Snapshot Lock
3. **Object Storage (`joodpakpaw-minio` -> Cloudflare R2 / Supabase S3 Free Tier):** ใช้ `@aws-sdk/client-s3` ที่สลับ Endpoint ผ่าน `.env` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_PUBLIC_URL`) ได้ทันที พร้อมบีบอัดเป็น `.webp` และลบไฟล์เก่าที่ไม่ใช้แล้วออกจาก S3 (Garbage Collection)
4. **Cache & Queue (`joodpakpaw-redis` -> Upstash Redis / In-Memory Auto-Fallback):** หากไม่ได้กำหนดค่า `REDIS_URL` บนโฮสต์ฟรี ระบบจะสลับมาใช้ **In-Memory Cache + In-Process Cron Scheduler** อัตโนมัติโดยไม่แครช
5. **Backend (`joodpakpaw-api`) & ML (`joodpakpaw-ml` -> Render / Koyeb / HF Spaces Free Tier):** มี `/health` Endpoint และหาก `joodpakpaw-ml` อยู่ในสถานะ Cold-Start (กำลังตื่นบนโฮสต์ฟรี) หรือไม่ได้เชื่อมต่อ DB `joodpakpaw-api` จะสลับมาคำนวณ **In-Process 3-Stage Hybrid & Candidate Ranking Fallback** (พร้อม Single-Flight Catalog Cache 60 วินาที) ทันทีภายใน 1.5 วินาทีเพื่อไม่ให้หน้าเว็บค้าง

---

## 4. มาตรฐานสถาปัตยกรรมและการออกแบบปัจจุบัน (Current V2 Enterprise Baselines — `v0.6.1`)

1. **Database Schema (42 Tables across 9 Domains):**
   - ครอบคลุม 41 ตารางหลักตาม Data Dictionary + ตารางที่ 42 **`provinces` (Domain 9: Master Locations — 77 จังหวัดประเทศไทยแบบสองภาษา EN/TH)** พร้อมฟิลด์ Denormalized บน `properties` (`min_price`, `avg_rating`, `review_count`, `booking_count`) และฟิลด์ขยายบน `bookings` (`host_reply`, `host_replied_at`, `cancelled_by`, `cancellation_reason`)
2. **API & Discovery Engine (`joodpakpaw-api`):**
   - ใช้โครงสร้าง **Single Standard Envelope** (`{ code: "S-0000", message, data, pagination? }`) และฟิลด์ **`camelCase`** ทั้งระบบ
   - `GET /api/v1/properties` รองรับตัวกรองระดับ Airbnb-Grade (`checkIn`/`checkOut` คำนวณห้องว่างจริงจาก `room_category_calendars` พร้อม `stayNights` & `stayTotalPrice`, `petTypes`, `petSizeCategoryId` แบบ Up-to-Max-Size, `petProfileIds` แบบ IDOR-safe, `facilities`, `propertyType`/`propertyTypeId`, `minPrice`/`maxPrice`, `search` สองภาษา EN/TH จากตาราง `provinces`, `lat`/`lng` Haversine `distanceKm`, และ `sortBy=recommended` ที่เรียก ML Re-Ranking)
3. **Context-Aware Hybrid ML (`joodpakpaw-ml`):**
   - รองรับทั้ง Global/Personal Feed (`GET /ml/v1/recommend/user/{user_id}`, `/cold-start`, `/similar/{property_id}`) และ **Filtered Search Candidate Re-Ranking (`POST /ml/v1/rank/candidates`)** ที่นำบริบทตัวกรองของผู้ใช้ (สัตว์เลี้ยงที่เลือกเดินทาง, งบประมาณ `max_price`, พิกัด `lat`/`lng`, สิ่งอำนวยความสะดวก เช่น สระว่ายน้ำสำหรับสัตว์พลังงานสูง) มาจัดลำดับพร้อมส่งคืน `match_reasons` และ `match_tier`
4. **Hallmark Frontend & 3D Pastel Clay Design System (`DESIGN.md` & `joodpakpaw-frontend`):**
   - ยึด `d:\Project\joodpakpaw\DESIGN.md` เป็นแหล่งอ้างอิงเดียว (Single Source of Truth)
   - **Global Typography Scale:** กำหนดขนาดฟอนต์ของ `h1`–`h5` และ `body` ผ่าน `@layer base` ใน `app/globals.css` ห้ามใส่คลาสขนาดฟอนต์แบบ Hardcode ทับบนแท็ก Heading มาตรฐาน
   - **3D Pastel Clay Visual Language:** แท็บหมวดหมู่ทั้ง 9 ใน `CategoryIconRail.tsx` ใช้ไอคอน 3D Pastel Clay `.webp` พื้นหลังโปร่งใสทั้งหมด (`clay-all.webp`, `clay-dog-transparent.webp`, `clay-cat-transparent.webp`, `clay-exotic-transparent.webp`, `clay-pool.webp`, `clay-vet.webp`, `clay-resort.webp`, `clay-homestay.webp`, `clay-budget.webp`) คู่กับภาพประกอบ `home.svg` และ `tell-us.svg`
   - **Layout Grid:** หน้าแรกใช้กริดการ์ดที่พัก **5 คอลัมน์บน Desktop** (`xl:grid-cols-5`, `PAGE_SIZE = 20`) และแถวแนวนอน `Recently viewed` บรรจุ 5 การ์ดพอดี

---

## 5. โครงสร้างทีม Agent และขอบเขตหน้าที่ (Agent Roster & Missions)

### Agent 00: Lead PM & Orchestrator (Main Agent)
- **บทบาท:** Product Manager, System Architect, Orchestrator & Git Gatekeeper
- **หน้าที่หลัก:** วิเคราะห์และเสนอแนะการยกระดับ Business Logic, UX/UI & Technical Best Practices อย่างเชิงรุก, สั่งงาน Subagents ผ่าน `invoke_subagent` / `send_message`, รับผลตรวจจาก `qa-auditor`, **อัปเดตและซิงค์ Postman Collection / Environment ขึ้น Cloud เมื่อ API เปลี่ยนแปลง**, และทำ Atomic Git Commit & Merge เข้า `develop` เมื่อผ่าน QA

### Agent 01: `db-infra-architect` (Database & Infrastructure Architect)
- **Agent Definition & Skill:** `.agents/agents/db-infra-architect/agent.md` | `.agents/skills/joodpakpaw-db-schema/SKILL.md`
- **ขอบเขตงาน (Mission):** จัดการ `docker-compose.yml` (`joodpakpaw-*`), ดูแล Schema & Migration ทั้ง **42 ตาราง (9 โดเมน รวม `provinces` 77 จังหวัด)** และสคริปต์ Seed (`seed.ts`, `seed-provinces.ts`, `seed-rich-data.ts`)

### Agent 02: `backend-core-engineer` (Core Backend & Real-Time Engineer)
- **Agent Definition & Skill:** `.agents/agents/backend-core-engineer/agent.md` | `.agents/skills/joodpakpaw-api-contract/SKILL.md`
- **ขอบเขตงาน (Mission):** พัฒนา `joodpakpaw-api` (`/api/v1/*`) ด้วย Single Standard Envelope (`data` wrapper), `camelCase` DTOs, Custom Error Codes (`T-2007`, `A-3001`..`A-3012`, `DB-1002`, `FF-4101`, `P-5001`, `B-4001`..`B-4004`), Row-Level Locking บน `room_category_calendars`, Discovery & Date Availability Engine, Context-Aware ML Candidate Ranking (`rankCandidateProperties` + Single-Flight Fallback), Socket.IO v4 (`/api/socket.io`), S3 `.webp` Upload + Garbage Collection, Rate Limiting และ Admin Ban/Appeal State Machine

### Agent 03: `ml-recommendation-engineer` (ML & Recommendation Engineer)
- **Agent Definition & Skill:** `.agents/agents/ml-recommendation-engineer/agent.md` | `.agents/skills/joodpakpaw-ml-hybrid/SKILL.md`
- **ขอบเขตงาน (Mission):** พัฒนา `joodpakpaw-ml` (Python FastAPI พอร์ต `5000`) ด้วย **3-Stage Pet-Aware Hybrid Recommendation Pipeline** และ **Context-Aware Candidate Re-Ranking (`POST /ml/v1/rank/candidates`)** พร้อมชุดทดสอบ `pytest` (`tests/test_hybrid.py`)

### Agent 04: `frontend-upgrader` (Frontend Product Upgrader)
- **Agent Definition & Skill:** `.agents/agents/frontend-upgrader/agent.md` | `.agents/skills/joodpakpaw-fe-upgrader/SKILL.md` | `DESIGN.md`
- **ขอบเขตงาน (Mission):** พัฒนาและอัปเกรด `joodpakpaw-frontend` (Next.js 16 + Tailwind CSS v4 + `shadcn/ui`) ตามมาตรฐาน `DESIGN.md` (Hallmark Floor, Global Typography Scale ใน `globals.css`, 3D Pastel Clay Icons, Airbnb Search Pill 77 จังหวัด, Split Map View, Smooth Multi-Photo Card Carousel, Context-Aware ML Filtered Search + Explainable Badges, Host Room Availability Calendar UI, Client-Side WebP Compression, Real-Time WebSocket & Persistent Notifications)

### Agent 05: `qa-auditor` (Independent QA Auditor & Security Reviewer)
- **Agent Definition & Skill:** `.agents/agents/qa-auditor/agent.md` | `.agents/skills/joodpakpaw-qa-auditor/SKILL.md`
- **ขอบเขตงาน (Mission):** ตรวจสอบผลงานของ Agent 01–04 ทั้ง 6 ด่าน (Enterprise DTO & Error Code Parity, Concurrency & Availability Pricing Integrity, IDOR/RBAC/OWASP & S3 GC Security, Admin Ban/Appeal Cascade `TC-151..155`, Context-Aware Hybrid ML & Fallback Parity `86/86` API + `21/21` ML tests, และ Hallmark UI / Browser Console / Git Diff Hygiene) และออกรายงาน `PASS` หรือ `FAIL`
