# Design: JoodPakPaw

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- **Genre:** `editorial` (warm consumer hospitality marketplace)
- **Shape of the first page:** Airbnb-based Discovery Marketplace (Hallmark 3-Zone Desktop Nav · Sticky 3-Part Pet-Aware Search Pill · Category Icon Rail with Display Total Price toggle · Compact Warm Off-White Hospitality Banner · Horizontal Scrollable Recently Viewed Rail · 4-Column Multi-Photo Property Grids with Pagination · Split Map Explorer · Two-Sided Host Onboarding Band)
- **Theme:** `joodpakpaw-airbnb-clay` (custom — vibe: *"warm trusted pet hospitality with crisp editorial craft"*)
- **Axes:** warm off-white & crisp white paper / friendly rounded display (`Baloo 2`) + clean humanist body (`Afacad` / `Prompt` / `Sarabun`) / deep forest-teal trust + terracotta-orange action · **posture:** booking-first discovery

## Tokens & Typography
`joodpakpaw-frontend/app/globals.css` is the source of truth. The brand roles:
```css
:root {
  --off-white: #f7f2e8;       /* Warm hospitality canvas & hero banner surface */
  --background: oklch(1 0 0); /* Crisp white listing grid & card canvas */
  --map-canvas: #e7f1ee;      /* Soft teal-tinted fallback map surface */
  --foreground: #323232;      /* Primary ink */
  --neutral-gray: #6a6a6a;    /* Secondary ink & supporting captions */
  --deep-teal: #1c4f4a;       /* Brand trust, active underline, focus ring, primary links */
  --accent-orange: #ff6f3c;   /* Primary search & conversion CTA, unread badges */
  --positive-green: #65bf73;  /* Verified / available / success confirmation */
  --border: oklch(0.922 0 0); /* Hairline card, pill, and divider borders */

  --font-display: var(--font-baloo2), var(--font-prompt), sans-serif;
  --font-body: var(--font-afacad), var(--font-sarabun), sans-serif;

  --radius: 0.625rem;         /* Base 10px; cards 16px (rounded-2xl), search pill 9999px (rounded-full) */
}
```
## Typography
- **Display & UI Headings / Buttons:** `--font-baloo2`, `--font-prompt`, `sans-serif`
- **Body & Captions:** `--font-afacad`, `--font-sarabun`, `sans-serif`
- **Responsive Type Scale (`app/globals.css`):**
  - `h1` (global): `20px` base · `21px` (`md`) · `22px` (`lg`) · `24px` (`xl`) · weight `600`
  - Home Hero `h1` (`BrowseHero.tsx`): `18px` (`text-lg`) · `20px` (`sm:text-xl`) · `22px` (`lg:text-[22px]`) · weight `700`
  - `h2`: `18px` base · `19px` (`md`) · `20px` (`lg`) · `22px` (`xl`) · weight `500`–`700`
  - `h3`: `16px` base · `17px` (`md`) · `18px` (`lg`) · `19px` (`xl`) · weight `600`
  - `h4`: `15px` base · `16px` (`md`/`lg`) · `17px` (`xl`) · weight `600`
  - `h5`: `14px` base · `14px` (`md`) · `15px` (`lg`) · `16px` (`xl`) · weight `500`
  - `body`: `14px` base · `15px` (`md`) · `16px` (`lg`) · `17px` (`xl`)
- **Container & Grid:** `max-w-[1440px] mx-auto` with responsive horizontal padding (`px-4 sm:px-6 lg:px-10`). Listing grids use `grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5` (`minmax(0, 1fr)`), paginated at `20` stays per page (`LCM(5, 4, 2) = 20`) so every row is evenly filled across 5-column, 4-column, and 2-column breakpoints.

## Navigation & Visual Identity
- **Desktop Navigation (`DesktopNav.tsx`):** Solid `bg-white border-b border-border` (never combined with `shadow-sm`). Three balanced zones:
  - Left: `JOODPAK.svg` wordmark
  - Center: Quiet editorial links (`Explore`, `Favorites`, `Messages`, `Notifications`) with `border-b-2 border-deep-teal` active indicator and `bg-accent-orange` unread count badges
  - Right: `Become a host` / `Host mode` quiet action + optional `Admin` link + Airbnb-style Account Pill (`rounded-full border border-border`, avatar/initials + short name or `Sign in`)
- **Brand & 3D Pastel Clay Assets:**
  - Home hero illustration: `joodpakpaw-frontend/public/graphics/home.svg`
  - Host onboarding artwork: `joodpakpaw-frontend/public/graphics/hero-clay-home.webp`
  - Species icons (3D Pastel Clay): `public/icons/species/clay-dog-transparent.webp`, `clay-cat-transparent.webp`, `clay-exotic-transparent.webp`
  - Energy icons: `public/icons/pets/energy-1.webp` .. `energy-5.webp`
  - Wordmark: `public/icons/JOODPAK.svg`

## Discovery Patterns & Controls
- **Primary CTA:** `bg-accent-orange` (`#ff6f3c`), white text, `rounded-full` (search pill) or `rounded-xl` (forms), height `44px`–`48px`.
- **Trust / Secondary CTA:** `bg-deep-teal` (`#1c4f4a`) or `border-deep-teal text-deep-teal`, same radius and height.
- **Strict 77-Province Where Picker:** Backed by PostgreSQL `provinces` (`GET /api/v1/locations/provinces`, 77 official Thai provinces EN/TH) with client fallback; users search by Thai or English name and must select a valid province (or `Anywhere in Thailand`) to prevent invalid free-text queries.
- **Date Range Picker:** Spacious `w-[min(94vw,660px)]` popover — 2 months side-by-side on desktop, 1 month on mobile, `h-10 w-10` day cells, `bg-deep-teal text-white` range caps, `bg-deep-teal/10` range span.
- **Pricing Display Toggle:** Defaults to Airbnb total-stay mode (`Display total price: ON`), showing `฿X,XXX total` + `N nights` when dates are selected and toggling cleanly to `฿XXX / night` when switched off.
- **Property Cards & Rails:** Multi-photo cards auto-slide horizontally (`translateX` track) every `2800ms` (with per-card stagger, pause on hover/focus, disabled under `prefers-reduced-motion: reduce`) plus manual chevrons & clickable dots. `Recently viewed` uses a horizontal snap-scroll rail (`overflow-x-auto snap-x`) with a `See all` link.
- **Map Explorer:** Floating bottom-right `"Show map"` / `"Show list"` pill (`right-4 sm:right-6 lg:right-10`). Map centers on the user's current geolocation when available, defaulting to Bangkok (`13.7563, 100.5018`).
- **Accessibility & Floor:** `overflow-x: clip` on `html, body`; instant `:focus-visible` ring (`2px solid var(--deep-teal)`, `outline-offset: 2px`); `:active` and `:disabled` states on all controls; zero `transition-all`; zero decorative status dots, middle-dot-joined meta strings, uppercase tracked eyebrows, glass blurs over translucent fills, or invented metrics.

## Motion
- **Character:** `calm` — explicit property transitions only (`transition-colors`, `transition-transform`, `transition-opacity`, `transition-shadow`); `motion-reduce:animate-none` on skeletons; `@media (prefers-reduced-motion: reduce)` resolves all motion and pauses auto-sliding galleries immediately.

## Exports
- Primary CSS tokens & Tailwind v4 `@theme inline`: `joodpakpaw-frontend/app/globals.css`
- Typography loader: `joodpakpaw-frontend/app/fonts.ts`
