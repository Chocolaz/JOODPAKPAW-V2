---
name: joodpakpaw-fe-upgrader
description: Frontend upgrade runbook for the JoodPakPaw Next.js 16 application (Host Room Availability Calendar UI, Client-Side WebP Compression, Socket.IO WebSocket upgrade, Notification read persistence, and Home feed caching).
---

# JoodPakPaw V2 Frontend Upgrader Runbook (`joodpakpaw-fe-upgrader`)

Use this skill whenever modifying or upgrading the existing Next.js 16 Frontend in `d:\Project\joodpakpaw\joodpakpaw-frontend`.

## 1. Golden Rules for Frontend Upgrades
1. **Clean Root Path (`/`) & Free-Tier Deployment (Vercel Ready)**:
   - Default `NEXT_PUBLIC_BASE_PATH` in `next.config.ts` and `lib/socket.ts` must be `""` (root path `/`), removing the hardcoded `/capstone25/cp25nk2` and `bscit.sit.kmutt.ac.th` defaults while still allowing `.env` override.
   - Configure `images.remotePatterns` in `next.config.ts` to allow Local `localhost`, Cloudflare R2 (`*.r2.dev`), and Supabase Storage (`*.supabase.co`).
2. **Preserve Existing Route Structure & Design System**:
   - Do not break existing routes (`app/(browse)`, `app/detail/[propertyId]`, `app/[propertyId]`, `app/booking`, `app/profile/*`, `app/admin/*`, `app/authen/*`).
   - Follow the established Tailwind CSS v4 + Radix UI (`shadcn/ui`) + Lucide Icons aesthetic.
3. **Strict TypeScript Hygiene**:
   - All changes in `joodpakpaw-frontend/` must pass `npm run build` / `tsc --noEmit` without introducing implicit `any` or breaking existing prop contracts in `joodpakpaw-frontend/types/*.ts`.

---

## 2. Core V2 Frontend Upgrades

### Upgrade 1: Host Room Availability & Dynamic Pricing Calendar UI (Fixes Release 3 Retrospective Gap)
- **Problem**: The database has `room_category_calendars` (`unavailable_rooms`, `price_adjustment`, `booked_rooms`), and the Capstone Retrospective noted that Hosts had no UI to block room maintenance dates or adjust daily prices.
- **Where to Integrate**:
  - `joodpakpaw/app/profile/host/[propertyId]/page.tsx` and `joodpakpaw/app/profile/host/_components/ManageRooms.tsx`.
- **Features to Provide**:
  - A "จัดการปฏิทินห้องพัก (Manage Availability & Pricing)" modal or drawer per Room Category.
  - Interactive monthly calendar showing per-day:
    - `total_rooms`, `booked_rooms` (read-only from customer bookings), `unavailable_rooms` (editable by Host), and `available_rooms`.
    - `price_adjustment` (custom daily price override in THB).
  - Connects to `GET /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` and `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars`.

### Upgrade 2: Client-Side Image Compression to WebP Before Upload
- **Problem**: Users upload multi-megabyte photos for KYC ID cards, property galleries (up to 10+ photos), pet profiles, payment slips, and reviews, causing slow uploads or reverse-proxy `413 Payload Too Large` errors.
- **Solution**:
  - Create a lightweight client-side utility `joodpakpaw/lib/imageCompression.ts` (using HTML5 `<canvas>` to resize max dimension to `1920px` and encode as `image/webp` at `0.82` quality) and apply it transparently before appending image files to `FormData` in property, pet, KYC, slip, and review upload flows.

### Upgrade 3: Socket.IO Real-Time Transport & Env Configuration (`joodpakpaw/lib/socket.ts`)
- **Problem**: `joodpakpaw/lib/socket.ts` currently hardcodes `transports: ['polling']` and `upgrade: false` with a fixed URL fallback.
- **Solution**:
  - Configure `transports: ['polling', 'websocket']` and `upgrade: true` so connections start safely with HTTP polling (compatible with proxies) and seamlessly upgrade to low-latency WebSockets.
  - Add `markNotificationAsRead` / `markAllNotificationsAsRead` calls in `NotificationContext.tsx` so read status persists in PostgreSQL (`notifications.is_read`) instead of only local state.

### Upgrade 4: Home Feed Deduplication & Request Optimization (`joodpakpaw/app/(browse)/page.tsx`)
- **Problem**: The Home page triggers 7 concurrent `getProperties` API calls on mount plus N sequential `getPropertyById` calls for recently viewed properties.
- **Solution**:
  - Deduplicate/batch home feed requests or cache responses cleanly so navigating back and forth to the Home page is instant and does not hammer the Backend API.
