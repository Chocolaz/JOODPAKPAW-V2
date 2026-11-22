---
name: joodpakpaw-fe-upgrader
description: Frontend upgrade and Hallmark design runbook for the JoodPakPaw Next.js 16 application (Airbnb-Grade Home Discovery, 3D Pastel Clay Icons, Global Typography Scale, Context-Aware ML Filtered Search, Split Map View, Host Room Calendar UI, Client-Side WebP Compression, and Real-Time WebSockets).
---

# JoodPakPaw V2 Frontend Upgrader Runbook (`joodpakpaw-fe-upgrader`)

Use this skill whenever modifying, designing, or upgrading the Next.js 16 Frontend in `d:\Project\joodpakpaw\joodpakpaw-frontend`.

## 1. Golden Rules for Frontend Architecture & Hallmark Design (`DESIGN.md`)
1. **Canonical Design Specification (`d:\Project\joodpakpaw\DESIGN.md`)**:
   - Always consult **`d:\Project\joodpakpaw\DESIGN.md`** at the monorepo root as the Single Source of Truth for color tokens, typography scale, 3D Pastel Clay assets, grid proportions, and Hallmark `sloplint` rules (`0 FAIL, 0 REFLEX, 0 WARN`).
2. **Global Typography Scale (`app/globals.css` — No Hardcoded Heading Sizes)**:
   - Heading sizes (`h1`, `h2`, `h3`, `h4`, `h5`) and `body` are centrally configured in `@layer base` inside `d:\Project\joodpakpaw\joodpakpaw-frontend\app\globals.css` using fluid `clamp(...)` tokens and `font-display` (`Baloo 2` + `Noto Sans Thai`) / `font-sans` (`Afacad` + `Noto Sans Thai`).
   - **Never** hardcode arbitrary `text-[...]` font-size classes directly on standard `h1`–`h5` tags; let semantic heading tags inherit their consistent scale from `globals.css`.
   - Always apply `tabular-nums` to prices, ratings, dates, distances, and counters.
3. **3D Pastel Clay Visual Language**:
   - All 9 tabs in `app/(browse)/_components/CategoryIconRail.tsx` MUST use transparent 3D Pastel Clay `.webp` assets in `/public/images/icons/`:
     - `clay-all.webp`, `clay-dog-transparent.webp`, `clay-cat-transparent.webp`, `clay-exotic-transparent.webp`, `clay-pool.webp`, `clay-vet.webp`, `clay-resort.webp`, `clay-homestay.webp`, `clay-budget.webp`
   - Never mix flat Lucide vector icons into the 3D Clay category tab rail.
   - Primary Home illustrations: `/images/home/home.svg` (`BrowseHero.tsx`) and `/images/home/tell-us.svg` (Become a Host CTA band with warm drop-shadow).
4. **Desktop 5-Column Grid & `PAGE_SIZE = 20`**:
   - Home discovery property grids use **5 columns on desktop** (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-8`) with `PAGE_SIZE = 20` (`LCM(5, 4, 2)`) so rows are always completely filled.
   - The `Recently viewed` horizontal rail fits **5 cards per row** on `xl` viewports (`xl:w-[calc((100%-4*1.25rem)/5)]`).
5. **Solid Editorial Navigation (`DesktopNav.tsx`)**:
   - `DesktopNav` uses a solid `bg-white border-b border-border` 3-zone editorial layout (`JOODPAK.svg` brand left, active nav links with `border-b-2 border-deep-teal` center, `Become a host` + Account Pill right). Do not use frosted glass (`backdrop-blur`) on the top navigation bar.
6. **React 19 & Next.js 16 State Hygiene**:
   - Do **not** call `setState` synchronously inside `useEffect` (e.g., for `prefers-reduced-motion`, `localStorage`, or prop mirroring).
   - Use `useSyncExternalStore` for browser media queries / storage, and derive optimistic state directly from props + transient override state.
   - All changes in `joodpakpaw-frontend/` must pass `npm run typecheck` (`tsc --noEmit`) and `npm run build` with `0` errors and `0` browser console/image/network errors.
7. **Clean Root Path (`/`) & Free-Tier Deployment (Vercel Ready)**:
   - Default `NEXT_PUBLIC_BASE_PATH` in `next.config.ts` and `lib/socket.ts` is `""` (root path `/`).
   - `images.remotePatterns` in `next.config.ts` supports Local `localhost`, Unsplash, Cloudflare R2 (`*.r2.dev`), and Supabase Storage (`*.supabase.co`).
8. **shadcn-First Component Strategy**:
   - Always use accessible `shadcn/ui` (Radix UI + Tailwind) primitives from `@/components/ui/` for dialogs, drawers, popovers, calendars, dropdowns, and tooltips.

---

## 2. Core V2 Frontend Systems

### System 1: Airbnb-Grade Home Discovery, 77-Province Picker & Split Map View
- **`AirbnbSearchBar.tsx`**:
  - Unified 3-part search pill:
    1. **Where**: Strict 77-province searchable bilingual picker backed by `GET /api/v1/locations/provinces` (with `lib/thaiProvinces.ts` fallback) + `"Near me"` geolocation option.
    2. **Dates**: Spacious 2-month desktop / 1-month mobile range calendar (`react-day-picker`).
    3. **Who's staying**: Authenticated user's saved `PetProfile`s (`petProfileIds`) or guest 3D clay species (`petTypes`) + size (`petSizeCategoryId`).
- **`CategoryIconRail.tsx`**:
  - Sticky 9-tab 3D Pastel Clay category filter bar with **Display total price** toggle (default `ON`) and **Sort by** dropdown (`Recommended (ML)` default).
- **`PropertyCard.tsx` & `PropertyList.tsx`**:
  - Smooth `translateX` multi-photo auto-sliding carousel (`2800ms` interval, staggered start, paused on hover/focus/`prefers-reduced-motion`), `sizes` + `priorityCount={5}` LCP loading, `showTotalPrice` (`stayTotalPrice` for `stayNights` when dates are selected), and explainable ML `matchReasons` badge.
- **`HomeMapView.tsx`**:
  - Interactive Split Map View (`@vis.gl/react-google-maps` + interactive fallback canvas) centered on `userLocation` or Bangkok (`13.7563, 100.5018`), toggled via the floating bottom-right `"Show map" / "Show list"` pill in `app/(browse)/page.tsx`.

### System 2: Context-Aware ML Filtered Search Integration (`app/(browse)/page.tsx` & `lib/api.ts`)
- Whenever any filter is active (`hasActiveSearchFilters`), `page.tsx` passes `sortBy: sortBy || 'recommended'` along with `lat` and `lng` (if available) to `getProperties()`.
- Displays a `"Ranked by AI for your filters"` indicator when in `recommended` mode and renders explainable Thai `matchReasons` badges on matching property cards.

### System 3: Host Room Availability & Dynamic Pricing Calendar UI
- Integrated in `app/profile/host/[propertyId]/page.tsx` and `app/profile/host/_components/ManageRooms.tsx`.
- Connects to `GET` & `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` allowing Hosts to manage daily `unavailableRooms` and `priceAdjustment` while respecting existing `bookedRooms`.

### System 4: Client-Side Image Compression to WebP (`lib/imageCompression.ts`)
- Resizes uploaded images to max `1920px` and encodes as `image/webp` (`0.82` quality) via HTML5 `<canvas>` before appending to `FormData` across property, room, pet, KYC, payment slip, chat, and review uploads.

### System 5: Real-Time Socket.IO WebSocket Transport & Notification Persistence (`lib/socket.ts`)
- Configures `transports: ['polling', 'websocket']` and `upgrade: true`, and syncs notification read state (`PATCH /api/v1/notifications/:id/read` and `/read-all`) in `NotificationContext.tsx`.
