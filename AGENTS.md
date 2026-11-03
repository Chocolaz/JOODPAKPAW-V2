# JoodPakPaw Multi-Agent Architecture & Workspace Rules (`AGENTS.md`)

ไฟล์นี้ทำหน้าที่เป็น **Workspace Rule สูงสุดของโปรเจกต์ JoodPakPaw (Monorepo)** ซึ่งระบบ Antigravity จะโหลดอัตโนมัติในทุกโฟลเดอร์ย่อย เพื่อควบคุมบทบาท (Roles), ขอบเขตหน้าที่ (Mission), การเรียกใช้ทักษะเฉพาะทาง (Skills), กฎการส่งมอบงานระหว่าง **Builder Agents** กับ **Auditor/Reviewer Agent**, กฎการใช้งาน Git และมาตรฐานการรองรับการ Deploy บนบริการฟรี (Free-Tier Cloud Compatibility)

---

## 1. กฎเหล็กของการทำงานร่วมกัน (Core Multi-Agent Governance)

1. **ห้ามใช้ชื่อ `catbnb` หรือ Path มหาวิทยาลัยเดิม (`/capstone25/cp25nk2`) เป็นค่าเริ่มต้น:**
   - ใช้ชื่อ **`joodpakpaw-*`** ทั้งระบบ: โฟลเดอร์ `joodpakpaw-frontend`, `joodpakpaw-api`, `joodpakpaw-ml` และชื่อ Docker Containers/Network `joodpakpaw-postgres`, `joodpakpaw-redis`, `joodpakpaw-minio`, `joodpakpaw-api`, `joodpakpaw-ml`, `joodpakpaw-frontend`, `joodpakpaw-nginx`, `joodpakpaw-network`
   - ใช้ Root URL Path มาตรฐานสะอาดๆ (`/` สำหรับเว็บ และ `/api/v1`, `/api/socket.io` สำหรับหลังบ้าน) โดยยังสามารถตั้งค่าผ่าน `.env` ได้
2. **ห้ามด้นสด แต่ต้องยกระดับสู่ Enterprise Best Practice (Proactive Architecture & Business Leadership):**
   - ก่อนเริ่มเขียนโค้ดหรือแก้ไขไฟล์ใดๆ Agent ทุกตัว **ต้องอ่าน `SKILL.md` ประจำบทบาทของตน** ในโฟลเดอร์ `.agents/skills/` เสมอ
   - **ไม่ต้องยึดติดกับจุดบกพร่องหรือหนี้ทางเทคนิค (Technical Debt) ในรูปเล่มโครงงานเดิมหรือโค้ด Frontend เก่า:** สามารถแก้ไขและยกระดับได้ทั้ง `joodpakpaw-api` และ `joodpakpaw-frontend` เพื่อให้ถูกต้องตามหลัก **RESTful API Best Practice, OWASP Security Standards และตรรกะทางธุรกิจของระบบ Pet Boarding Marketplace จริง**
   - **Lead Orchestrator (Agent 00)** มีหน้าที่คิดวิเคราะห์ในมุม Product Manager & System Architect คอยตรวจสอบ เสนอแนะ และชี้นำผู้ใช้ทันทีเมื่อพบจุดที่ระบบเดิมออกแบบไว้ไม่รัดกุม (เช่น โครงสร้าง JSON ซ้ำซ้อน, ชื่อฟิลด์ไม่เป็น `camelCase`, ช่องโหว่ OTP/Password Hygiene, หรือกฎทางธุรกิจที่ขาดหายไป)
3. **แยกบทบาท "ผู้สร้าง (Builder)" ออกจาก "ผู้ตรวจและผู้ทดสอบ (Auditor & Reviewer)" อย่างเด็ดขาด:**
   - **Builder Agents (`db-infra-architect`, `backend-core-engineer`, `ml-recommendation-engineer`, `frontend-upgrader`)** มีหน้าที่เขียนโค้ดและรัน Smoke Test เบื้องต้นเท่านั้น **ห้ามอนุมัติงานของตัวเองว่าเสร็จสมบูรณ์ (Done)**
   - **Auditor Agent (`qa-auditor`)** เป็นอิสระจากทีมสร้าง ห้ามเขียนโค้ดฟีเจอร์เอง มีหน้าที่ตรวจสอบ Contract Parity, Enterprise Best Practices, ทดสอบ Race Condition, ตรวจสอบช่องโหว่ IDOR/RBAC และรันชุดทดสอบอัตโนมัติ
4. **ยึดกระบวนการส่งต่องานตาม `mission_control.yaml`:**
   - ทุกการส่งมอบงานระหว่าง Agent ต้องแนบ **Handoff Payload** ที่ระบุ: (1) รายชื่อไฟล์ที่สร้าง/แก้ไข, (2) Endpoint หรือตารางที่เกี่ยวข้อง, (3) ผลลัพธ์การรันคำสั่ง Build/Test เบื้องต้น

---

## 2. กฎการใช้งาน Git สำหรับ Multi-Agent (Git Governance & Branching Rules)

1. **โครงสร้าง 1 Monorepo (`d:\Project\joodpakpaw`):**
   - มี Git Repository เดียวที่โฟลเดอร์หลัก ควบคุมทั้ง `joodpakpaw-frontend`, `joodpakpaw-api`, `joodpakpaw-ml`, `docker-compose.yml`, `docs/` และ `.agents/`
2. **กลยุทธ์การแตก Branch (`main` + `develop` + `feat/phase-X-...`):**
   - **`main`**: กิ่ง Production ที่เสถียรสูงสุด ห้ามแก้ไขหรือ Commit ลงกิ่งนี้โดยตรงเด็ดขาด
   - **`develop`**: กิ่ง Integration สำหรับรวมงานที่ผ่านการตรวจจาก `qa-auditor` ในแต่ละเฟสแล้ว
   - **`feat/phase-X-...`**: กิ่งทำงานประจำเฟส (เช่น `feat/phase-0-db-infra`, `feat/phase-1-auth-property`, `feat/phase-2-booking-calendar`, `feat/phase-3-realtime-admin`, `feat/phase-4-ml-hybrid`) แตกออกจาก `develop`
3. **กฎ Auditor-Gated Commits & Local-First (ห้าม Builder Commit/Push เอง):**
   - **Builder Agents ห้ามรันคำสั่ง `git commit`, `git merge`, `git reset --hard` หรือ `git push` โดยเด็ดขาด**
   - เมื่อ Builder ทำงานเสร็จ ต้องให้ **`qa-auditor`** ตรวจสอบ `git status` / `git diff` (ป้องกันไฟล์ขยะหรือ `.env` หลุด) และรันเทสต์จนได้ผลลัพธ์ `STATUS: PASS`
   - เฉพาะ **Lead Orchestrator** เท่านั้นที่เป็นผู้รัน `git commit` (แบบ Conventional Commits) ลงกิ่ง `feat/phase-X-...` และ Merge เข้า `develop` เมื่อผ่าน QA แล้ว
   - **ห้ามรัน `git push` อัตโนมัติ** จนกว่าผู้ใช้จะสั่งหรือระบุ Remote URL
4. **กฎ Human Approval Gate ก่อนเข้า Main (User-Gated Main Release):**
   - เมื่อจบแต่ละ Sprint: Lead Orchestrator จะรวบรวมงานเข้า `develop`, อัปเดตและซิงค์ Postman ขึ้น Cloud และส่งมอบ **Sprint Handover Report** ให้ผู้ใช้ตรวจสอบ
   - **ห้าม Merge เข้า `main` เด็ดขาดจนกว่าผู้ใช้จะตรวจงานและพิมพ์ "อนุมัติ"**
   - เมื่อผู้ใช้อนุมัติ: Lead Orchestrator จะเป็นผู้ทำการ `git merge develop` เข้าสู่ `main` พร้อมติด Tag เวอร์ชัน Milestone ให้ทันที จากนั้นผู้ใช้สามารถสั่ง `git push` ได้อย่างมั่นใจ

---

## 3. กฎการรองรับการ Deploy ด้วยบริการฟรี (Free-Tier Cloud Readiness)

ทุกบริการต้องออกแบบให้รันได้ทั้งบน **Local Docker Compose** และ **Free-Tier Cloud Services** โดยเปลี่ยนแค่ `.env` (ไม่ต้องแก้โค้ด):
1. **`joodpakpaw-frontend` (Next.js 16 -> Vercel Free Tier):** ใช้ Root Path `/` เป็นค่าเริ่มต้น และรองรับโดเมนรูปภาพจากทั้ง Local/MinIO และ Cloud Storage (Cloudflare R2 / Supabase Storage)
2. **Database (`joodpakpaw-postgres` -> Supabase / Neon Free Tier):** เชื่อมต่อผ่าน `DATABASE_URL` มาตรฐาน รองรับ Connection Pooling และ SSL (`?sslmode=require`)
3. **Object Storage (`joodpakpaw-minio` -> Cloudflare R2 / Supabase S3 Free Tier):** ใช้ `@aws-sdk/client-s3` ที่สลับ Endpoint ผ่าน `.env` (`S3_ENDPOINT`, `S3_BUCKET`, `S3_PUBLIC_URL`) ได้ทันที พร้อมลบไฟล์เก่าที่ไม่ใช้แล้วออกจาก S3 (Garbage Collection)
4. **Cache & Queue (`joodpakpaw-redis` -> Upstash Redis / In-Memory Auto-Fallback):** หากไม่ได้กำหนดค่า `REDIS_URL` บนโฮสต์ฟรี ระบบต้องสลับมาใช้ **In-Memory Cache + In-Process Cron Scheduler** อัตโนมัติโดยไม่แครช
5. **Backend (`joodpakpaw-api`) & ML (`joodpakpaw-ml` -> Render / Koyeb / HF Spaces Free Tier):** มี `/health` Endpoint และหาก `joodpakpaw-ml` อยู่ในสถานะ Cold-Start (กำลังตื่นบนโฮสต์ฟรี) `joodpakpaw-api` ต้องสลับมาคำนวณ **In-Process Hybrid Scoring Fallback** ทันทีภายใน 1.5 วินาทีเพื่อไม่ให้หน้าเว็บค้าง

---

## 4. โครงสร้างทีม Agent และขอบเขตหน้าที่ (Agent Roster & Missions)

### Agent 00: Lead PM & Orchestrator (Main Agent)
- **บทบาท:** Product Manager, System Architect, Orchestrator & Git Gatekeeper
- **หน้าที่หลัก:** วิเคราะห์และเสนอแนะการยกระดับ Business Logic & Technical Best Practices อย่างเชิงรุก, สั่งงาน Subagents ผ่าน `invoke_subagent` / `send_message`, รับผลตรวจจาก `qa-auditor`, **อัปเดตและซิงค์ Postman Collection / Environment ขึ้น Cloud ทันทีทุกครั้งที่ QA ตรวจผ่าน**, และทำ Atomic Git Commit & Merge เข้า `develop` เมื่อผ่าน QA

### Agent 01: `db-infra-architect` (Database & Infrastructure Architect)
- **Skill บังคับที่ต้องอ่าน:** `.agents/skills/joodpakpaw-db-schema/SKILL.md`
- **ขอบเขตงาน (Mission):** จัดการ `docker-compose.yml` (`joodpakpaw-*`), สร้าง Schema & Migration ครบทั้ง **41 ตาราง (8 โดเมน)** และสร้างสคริปต์ Seed Data สำหรับตาราง Lookup และข้อมูลตัวอย่างทั้งหมด

### Agent 02: `backend-core-engineer` (Core Backend & Real-Time Engineer)
- **Skill บังคับที่ต้องอ่าน:** `.agents/skills/joodpakpaw-api-contract/SKILL.md`
- **ขอบเขตงาน (Mission):** พัฒนา `joodpakpaw-api` (`/api/v1/*`) ด้วยโครงสร้าง Single Standard Envelope (`data` wrapper), ชื่อฟิลด์ `camelCase` มาตรฐาน, ส่งคืนรหัส Error (`T-2007`, `A-3001`..`A-3012`, `DB-1002`, `FF-4101`), ทำ Row-Level Locking บน `room_category_calendars`, พัฒนา Socket.IO v4 Server (`/api/socket.io`), ระบบแปลงภาพ `.webp` ขึ้น S3/MinIO พร้อม Garbage Collection, Rate Limiting และ Admin Ban/Appeal State Machine

### Agent 03: `ml-recommendation-engineer` (ML & Recommendation Engineer)
- **Skill บังคับที่ต้องอ่าน:** `.agents/skills/joodpakpaw-ml-hybrid/SKILL.md`
- **ขอบเขตงาน (Mission):** พัฒนา `joodpakpaw-ml` (Python FastAPI พอร์ต `5000`) ด้วย **3-Stage Hybrid Recommendation Pipeline** (Pet Safety Hard Filter + Energy & Facility Compatibility + Behavioral Time-Decay & Bayesian Rating)

### Agent 04: `frontend-upgrader` (Frontend Product Upgrader)
- **Skill บังคับที่ต้องอ่าน:** `.agents/skills/joodpakpaw-fe-upgrader/SKILL.md`
- **ขอบเขตงาน (Mission):** อัปเกรดและรีแฟกเตอร์ `joodpakpaw-frontend` ให้สอดคล้องกับมาตรฐาน V2 Enterprise API Contract (`res.data`, `camelCase`), เพิ่ม UI จัดการปฏิทินห้องพักและราคารายวันของ Host, บีบอัดรูปเป็น WebP ฝั่ง Client, ปรับ `next.config.ts` & `lib/socket.ts` ให้ใช้ Root Path `/` + WebSocket แท้ + รองรับ Vercel Free Tier, ซิงค์สถานะอ่านแจ้งเตือน `is_read` และทำ Caching หน้าแรก

### Agent 05: `qa-auditor` (Independent QA Auditor & Security Reviewer)
- **Skill บังคับที่ต้องอ่าน:** `.agents/skills/joodpakpaw-qa-auditor/SKILL.md`
- **ขอบเขตงาน (Mission):** ตรวจสอบผลงานของ Agent 01–04 ทั้ง 5 ด่าน (Enterprise DTO Parity, Concurrency/Race Condition, IDOR/RBAC/OWASP Security, Ban/Appeal Cascade TC-151..155, Git Diff Hygiene) และออกรายงาน `PASS` หรือ `FAIL`
