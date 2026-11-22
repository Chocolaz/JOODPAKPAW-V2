# JoodPakPaw Frontend Service Rules (`joodpakpaw-frontend/AGENTS.md`)

กฎเฉพาะสำหรับเซอร์วิส **`joodpakpaw-frontend`** (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Radix UI / `shadcn/ui`) โหลดควบคู่กับ `d:\Project\joodpakpaw\AGENTS.md` และ `d:\Project\joodpakpaw\DESIGN.md`

## 1. Mandatory Design & Typography Governance (`DESIGN.md`)
1. **Single Source of Truth:** อ่าน `d:\Project\joodpakpaw\DESIGN.md` และ `.agents/skills/joodpakpaw-fe-upgrader/SKILL.md` ก่อนแก้ไข UI เสมอ
2. **Global Typography Scale (`app/globals.css`):**
   - ขนาดฟอนต์และ `line-height` ของแท็ก `h1`, `h2`, `h3`, `h4`, `h5` และ `body` ถูกกำหนดไว้ใน `@layer base` ของ `app/globals.css` แล้ว
   - **ห้าม** ใส่คลาสขนาดฟอนต์แบบ Hardcode (เช่น `text-[22px]`, `text-3xl`) ทับบนแท็ก `h1`–`h5` โดยตรง ให้ใช้แท็ก Heading ตามลำดับความสำคัญเพื่อให้ขนาดตัวอักษรสอดคล้องกันทั้งแอป
3. **3D Pastel Clay Visual Language:**
   - แท็บตัวกรองทั้ง 9 ใน `app/(browse)/_components/CategoryIconRail.tsx` ต้องใช้ไฟล์ไอคอน 3D Pastel Clay `.webp` พื้นหลังโปร่งใสใน `/public/images/icons/` (`clay-all.webp`, `clay-dog-transparent.webp`, `clay-cat-transparent.webp`, `clay-exotic-transparent.webp`, `clay-pool.webp`, `clay-vet.webp`, `clay-resort.webp`, `clay-homestay.webp`, `clay-budget.webp`) ห้ามสลับกลับไปใช้ไอคอนเส้นแบน (Flat Lucide SVG) ปะปนกัน
   - ภาพประกอบหลักหน้าแรกใช้ `/images/home/home.svg` (`BrowseHero.tsx`) และ `/images/home/tell-us.svg` (Become a Host CTA band)
4. **Grid & Card Proportions:**
   - กริดการ์ดที่พักหน้าแรกใช้ **5 คอลัมน์บนจอ Desktop** (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`) คู่กับ `PAGE_SIZE = 20` (`LCM(5, 4, 2)`) เพื่อไม่ให้แถวสุดท้ายแหว่ง
   - แถว `Recently viewed` ใช้โครงสร้าง 5 การ์ดต่อแถว (`w-[calc((100%-4*1.25rem)/5)]` บน `xl`)
5. **Hallmark Quality Floor (`sloplint` Zero-Defect):**
   - ห้ามใช้ `backdrop-blur` บนแถบ `DesktopNav` (ใช้พื้นหลังทึบ `bg-white border-b border-border` สไตล์ Editorial 3 โซน)
   - ใช้ `overflow-x: clip` บน `html, body`, รองรับ `:focus-visible`, `prefers-reduced-motion: reduce`, และใช้ `tabular-nums` กับตัวเลขราคา/คะแนน/ระยะทางเสมอ

## 2. React 19, Next.js 16 & API Contract Rules
1. **No `setState` in `useEffect`:**
   - ใช้ `useSyncExternalStore` สำหรับการอ่านค่า Browser Media Queries (`prefers-reduced-motion`) หรือ `localStorage`
   - ใช้การคำนวณ Derived Optimistic State จาก Props แทนการ Sync Props ลง `useState` ใน `useEffect`
2. **Single `data` Envelope & Context-Aware ML Search:**
   - อ่านข้อมูลจาก Backend ผ่าน `res.data` (และ `res.pagination`) ใน `lib/api.ts` เสมอ
   - เมื่อมีตัวกรองค้นหาในหน้าแรก (`hasActiveSearchFilters`) ให้ส่ง `sortBy: sortBy || 'recommended'` พร้อมพิกัด `lat`/`lng` (ถ้ามี) ไปยัง `GET /api/v1/properties` เพื่อให้ Backend จัดลำดับด้วย Context-Aware ML Candidate Ranking และแสดงป้าย `matchReasons` บน `PropertyCard`
3. **Verification Commands:**
   - รัน `npm run typecheck` (`tsc --noEmit`) และ `npm run build` ใน `d:\Project\joodpakpaw\joodpakpaw-frontend` ให้ผ่าน (`Exit code 0`) ก่อนส่งมอบงานให้ `qa-auditor` ทุกครั้ง
