# Design: JoodPakPaw

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- **Genre:** `editorial` (warm consumer hospitality marketplace)
- **Shape of the first page:** Airbnb-based Discovery Marketplace (Sticky 3-Part Pet-Aware Search Pill · Category Icon Rail with Display Total Price toggle · Compact 3D Pastel Clay Hospitality Banner · 4-Column Multi-Photo Property Grids · Split Map Explorer · Two-Sided Host Onboarding Band)
- **Theme:** `joodpakpaw-airbnb-clay` (custom — vibe: *"warm trusted pet hospitality with 3D pastel clay craft"*)
- **Axes:** warm off-white & crisp white paper / friendly rounded display (`Baloo 2`) + clean humanist body (`Afacad` / `Prompt` / `Sarabun`) / deep forest-teal trust + terracotta-orange action · **posture:** booking-first discovery

## Tokens
`joodpakpaw-frontend/app/globals.css` is the source of truth. The brand roles:
```css
:root {
  --off-white: #f7f2e8;       /* Warm hospitality canvas & hero banner surface */
  --background: oklch(1 0 0); /* Crisp white listing grid & card canvas */
  --map-canvas: #e7f1ee;      /* Soft teal-tinted fallback map surface */
  --foreground: #323232;      /* Primary ink */
  --neutral-gray: #6a6a6a;    /* Secondary ink & supporting captions */
  --deep-teal: #1c4f4a;       /* Brand trust, active rail underline, focus ring, primary links */
  --accent-orange: #ff6f3c;   /* Primary search & conversion CTA */
  --positive-green: #65bf73;  /* Verified / available / success confirmation */
  --border: oklch(0.922 0 0); /* Hairline card, pill, and divider borders */

  --font-display: var(--font-baloo2), var(--font-prompt), sans-serif;
  --font-body: var(--font-afacad), var(--font-sarabun), sans-serif;

  --radius: 0.625rem;         /* Base 10px; cards 16px (rounded-2xl), search pill 9999px (rounded-full) */
}
```
Container cap: `max-w-[1440px] mx-auto` with responsive horizontal padding (`px-4 sm:px-6 lg:px-10`). Listing grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (`minmax(0, 1fr)`).

## Visual Identity (3D Pastel Clay CI)
- **Illustration style:** Soft matte 3D pastel clay / plasticine miniature dioramas and icons with rounded sculpted edges, warm studio daylight, and seamless `#f7f2e8` or transparent backgrounds — strictly no text, watermarks, or neon/purple gradients.
- **Canonical assets:**
  - Hero artwork: `joodpakpaw-frontend/public/graphics/hero-clay-home.webp`
  - Species icons: `public/icons/species/clay-dog-transparent.webp`, `clay-cat-transparent.webp`, `clay-exotic-transparent.webp`
  - Energy icons: `public/icons/pets/energy-1.webp` .. `energy-5.webp`
  - Wordmark: `public/icons/JOODPAK.svg`

## Controls & Pricing Behavior
- **Primary CTA:** `bg-accent-orange` (`#ff6f3c`), white text, `rounded-full` (search pill) or `rounded-xl` (forms), height `44px`–`48px`.
- **Trust / Secondary CTA:** `bg-deep-teal` (`#1c4f4a`) or `border-deep-teal text-deep-teal`, same radius and height.
- **Pricing Display Toggle:** Defaults to Airbnb total-stay mode (`Display total price: ON`), showing `฿X,XXX total` + `N nights` when dates are selected and toggling cleanly to `฿XXX / night` when switched off.
- **Accessibility & Floor:** `overflow-x: clip` on `html, body`; instant `:focus-visible` ring (`2px solid var(--deep-teal)`, `outline-offset: 2px`); zero `transition-all`; zero decorative status dots, middle-dot-joined meta strings, uppercase tracked eyebrows, or invented metrics.

## Motion
- **Character:** `calm` — explicit property transitions only (`transition-colors`, `transition-transform`, `transition-opacity`, `transition-shadow`); `motion-reduce:animate-none` on skeletons; `@media (prefers-reduced-motion: reduce)` resolves all motion instantly.

## Exports
- Primary CSS tokens & Tailwind v4 `@theme inline`: `joodpakpaw-frontend/app/globals.css`
- Typography loader: `joodpakpaw-frontend/app/fonts.ts`
