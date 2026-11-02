# Frontend: Component Design
**Project: Joodpakpaw** — Pet Accommodation Booking Platform
*(Next.js 15, App Router, TypeScript, Tailwind CSS v4)*

---

## 1. Design Principles & Theory

The frontend is structured around four core design goals:

| Goal | Description |
|------|-------------|
| **Design Consistency** | A shared design system (colors, fonts, radii, spacing) ensures every screen feels like one coherent product |
| **Maintainability** | Logic is isolated into dedicated layers (UI, API, state, hooks) so a change in one layer does not break another |
| **Scalability** | Reusable primitives and context-based state allow new features to be added without rewriting existing code |
| **Faster Future Development** | A catalogue of ready-made components, hooks, and utilities lets developers assemble new pages from existing parts |

---

## 2. JS Library — Common Functions (`lib/`)

Shared utility functions are centralised in `lib/` so no page or component duplicates logic.

### 2.1 API Client (`lib/apiClient.ts`)
Single HTTP wrapper used by **every** API call in the app.

| Responsibility | Detail |
|---|---|
| Token attachment | Automatically injects `Authorization` header (`requiresAuth`, `sendAuthIfAvailable`) |
| Token refresh | On 401 response, silently refreshes the token and retries the original request |
| FormData support | Handles multipart uploads without caller needing to set headers manually |
| Centralised error | Throws `ApiError` with code → message mapping; callers never parse raw HTTP |

**Reuse evidence:** `lib/api.ts` (29 KB) contains every endpoint of the platform — Auth, Properties, Bookings, Chat, Notifications, Favorites, Reviews, Pets, Admin — all routed through `apiClient`. Adding a new endpoint = one function, zero boilerplate.

---

### 2.2 Utility Functions (`lib/utils.ts`)

| Function | Used by |
|---|---|
| `cn(...classes)` | Every component — merges Tailwind classes safely (clsx + twMerge) |
| `assetPath(path)` | All `<Image>` and `<img>` tags — resolves `NEXT_PUBLIC_BASE_PATH` once |
| `getLowestPrice(rooms)` | `PropertyCard`, search result pages |
| `formatPetSizeRange(min, max)` | Pet profile forms, booking detail |
| `validatePassword(pw)` | Auth forms (Login, Register, Reset Password) |
| `getPetPolicy(pets)` | Property detail, booking confirmation |

**Key principle:** any helper used in more than one place lives here — never inlined inside a component.

---

### 2.3 Token Manager (`lib/tokenManager.ts`)

Encapsulates all cookie operations for auth tokens.
Exposed API: `saveTokens` · `clearTokens` · `getAccessToken` · `getRefreshToken` · `getUserRole` · `isAuthenticated`

No component ever reads cookies directly — all go through this module.

---

### 2.4 Error Handling (`lib/errorHandling.ts`)

- `ApiError` class — wraps server error codes into a typed object
- `getApiErrorMessages(err)` — maps field-level codes (`A-3001`, `A-3003` …) to human-readable strings
- `handleError(err)` — centralised handler so UI components only call one function

---

### 2.5 Socket Client (`lib/socket.ts`)

Real-time layer shared by Notification and Chat features.

| Function | Purpose |
|---|---|
| `connectSocket()` | Connects with token auth, long-polling transport |
| `addSocketListener(event, fn)` | Registers persistent listeners that survive reconnects |
| `emitSocketEvent(event, data)` | Sends events; callers never touch `socket.io-client` directly |

**Reuse:** `NotificationContext` and `ChatContext` both consume this module independently without coupling to each other.

---

## 3. Component Library — Common Components (`app/_components/`)

Reusable UI components are extracted to `app/_components/` and composed inside feature pages.

### 3.1 Core Display Components

| Component | Reused In |
|---|---|
| **`PropertyCard`** | Home page grid, Browse page, Favorites, Host dashboard, Host public profile |
| **`PropertyList`** | Any page that renders a grid of `PropertyCard` — accepts `columns` prop |
| **`RoomCategoryCard`** | Property detail, Booking drawer |
| **`BookingCard`** | Guest booking history, Host booking list |
| **`PetCard`** | Pet list page, Pet selector in booking flow |
| **`FavoriteFolderCard`** | Favorites page, `FavoriteDrawer` |

**Extension pattern:** `PropertyCard` accepts optional `showPetPolicy`, `showStatus`, and `onHeartToggle` props. The base card is rendered everywhere; feature-specific behaviour is added via props — no duplication.

---

### 3.2 Layout & Navigation Components

| Component | Where rendered | Visibility rule |
|---|---|---|
| **`BottomNav`** | Root layout | `lg:hidden` — mobile only |
| **`DesktopNav`** | Root layout | `hidden lg:block` — desktop only |
| **`AppHeader`** | Every detail/form page | Provides back arrow + centered title + menu slot |
| **`PageHeader`** | Home/Browse | Simplified hero variant |
| **`SearchBar`** | Home, Browse | Sticky on mobile (`sticky top-4`), static on desktop |

One layout component covers all breakpoints; no separate mobile/desktop page files.

---

### 3.3 Modal & Drawer Components

| Component | Triggered by |
|---|---|
| **`ConfirmationModal`** | Cancel booking, delete pet, delete message, logout |
| **`FavoriteDrawer`** | Heart icon on any `PropertyCard` |
| **`BookingDrawer`** | "Book Now" CTA on property detail |
| **`CropModal`** | Profile photo upload, property image upload |
| **`ReportPropertyDrawer`** | Report button on property detail |
| **`ReportReviewDrawer`** | Report button on each review |

**Consistency guarantee:** All overlays share the same animation, backdrop, and close-button pattern from a single implementation.

---

### 3.4 Specialised Sub-components (`app/_components/property-detail/`)

14 components encapsulate each section of the property detail page:

```
PropertyImageGallery  →  image carousel / lightbox
PropertyHeader        →  title, rating, location, verify badge
PropertyFacilities    →  facility icon grid
PropertyRoomCategories→  room list using RoomCategoryCard
PropertyLocation      →  static map via mapUtils.getStaticMapUrl()
PropertyHost          →  host card with link to host profile
PropertyReviews       →  review list + average rating
BookingDrawer         →  full booking flow (date, pets, rooms)
ContactHostButton     →  chat CTA (opens socket chat)
ReportPropertyDrawer  →  report flow
```

Each is independently importable and testable. The page file (`app/property/[id]/page.tsx`) just composes them.

---

### 3.5 Multi-Step Form Pattern

Both the **Add Property** flow (9 steps) and the **Add Pet** flow (9 steps) use the same pattern:

1. A `Context` (e.g. `AddPropertyContext`) holds all draft state and persists to `sessionStorage`
2. Step components (`Step1.tsx` … `Step9.tsx`) read/write only via the context
3. `StepNavigation` renders the progress bar and prev/next buttons
4. On unmount (browser refresh), `sessionStorage` restores the exact step and data

**Scalability benefit:** Adding a new step = add one `StepN.tsx` file + one entry in the context. No other file changes.

---

## 4. State Management — Global State (`app/_context/`)

Shared state that spans multiple components lives in React Context providers mounted at the root.

| Context | Shared State | Consumers |
|---|---|---|
| **`AuthContext`** | `user`, `isAuthenticated`, `role`, `login()`, `logout()`, `refreshAuth()` | Navbar, BottomNav, DesktopNav, any protected page, `apiClient` |
| **`BookingContext`** | Date range, selected pets, pet size, room selections, nights count | `BookingDrawer`, `BookingSearchBar`, `BookingRoomCard`, Confirm page |
| **`NotificationContext`** | Notification list, unread count, read IDs | `BottomNav` badge, `DesktopNav` badge, Notifications page |
| **`ChatContext`** | Chat rooms list, active room messages | Chat sidebar, Chat room page |

### Persistence Strategy

| Context | Storage | Reason |
|---|---|---|
| Auth tokens | `js-cookie` | Survives page reload; sent with requests |
| Booking draft | `sessionStorage` | Lost on tab close (intentional — no stale bookings) |
| Add Property draft | `sessionStorage` | Protects user input across accidental navigation |
| Notification read state | `localStorage` | Persists across sessions for read/unread UI |

### Real-time Data Flow

```
Socket.io server
    │
    ├──► NotificationContext.addSocketListener("notification")
    │         └──► updates notificationList + unreadCount
    │                   └──► BottomNav badge re-renders
    │
    └──► ChatContext.addSocketListener("message")
              └──► updates messages in active room
```

Both contexts share the same `lib/socket.ts` module but are completely decoupled from each other.

---

## 5. Custom Hooks — Reusable Logic (`app/_hooks/`)

| Hook | Abstracted Logic | Used In |
|---|---|---|
| `useMediaQuery(query)` | Subscribes to `window.matchMedia`; returns `boolean` | `BrowseLayoutClient`, `DesktopNav` |
| `useNormalizedPathname()` | Strips trailing slash from `usePathname()` | Root layout, `DesktopNav` |
| `usePropertyLoader(id)` | Fetches property + handles not-found redirect | Property detail page |
| `useBrowseFilters()` | Syncs filter state ↔ URL search params with debounce | Browse page, `FilterPanel` |
| `useHostProperties()` | Loads host's properties with refetch trigger | Host dashboard |
| `useUserPets()` | Loads user's pet profiles | Booking flow, Pet list page |
| `useGroupedFacilities()` | Groups flat facility array by category | Add property Step 4 |

**Principle:** A hook is created whenever the same fetch-or-derive logic appears in two or more components. The component only handles rendering.

---

## 6. Design System — Consistency Tokens

Defined once in `tailwind.config.ts` / `globals.css` via Tailwind v4 `@theme inline`:

| Token | Value | Applied To |
|---|---|---|
| `deep-teal` | `#1c4f4a` | Primary CTA buttons, active nav icons |
| `accent-orange` | `#ff6f3c` | Highlights, favourite icon active state |
| `neutral-gray` | `#6a6a6a` | Body text, secondary labels |
| `positive-green` | `#65bf73` | Success states, verified badges |
| `off-white` | `#f7f2e8` | Page backgrounds |
| `afacad` | Body font | All paragraph / label text |
| `baloo2` | Display font | Headings, button labels |
| `rounded-[20px]` | Card radius | All property/pet/booking cards |
| `rounded-full` | Pill radius | Filter chips, category tags |

Any future component automatically inherits the palette — no ad-hoc hex values in component files.

---

## 7. External Libraries (`package.json`)

Key third-party packages used in the project, grouped by purpose:

| Category | Library | Version | Purpose |
|---|---|---|---|
| **Framework** | `next` | ^16.1.6 | App Router, SSR, routing |
| **Framework** | `react` / `react-dom` | 19.2.0 | UI rendering |
| **UI Primitives** | `@radix-ui/*` | various | Unstyled accessible components (Dialog, Select, Tabs, Checkbox, Slider, Popover, Progress, Avatar) |
| **Icons** | `lucide-react` | ^0.552.0 | SVG icon set |
| **Styling** | `tailwindcss` | ^4.1.16 | Utility-first CSS |
| **Styling** | `clsx` + `tailwind-merge` | ^2.1.1 / ^3.4.0 | Safe Tailwind class merging (`cn()`) |
| **Styling** | `class-variance-authority` | ^0.7.1 | Component variant management |
| **Styling** | `tailwindcss-animate` | ^1.0.7 | Animation utility classes |
| **Animation** | `framer-motion` | ^12.25.0 | Declarative animations and transitions |
| **Drawer/Overlay** | `vaul` | ^1.1.2 | Mobile-first drawer component |
| **Toast** | `sonner` | ^2.0.7 | Toast notification system |
| **Command** | `cmdk` | ^1.1.1 | Command palette |
| **Date** | `react-day-picker` | ^9.11.2 | Calendar / date range picker |
| **Date** | `date-fns` | ^4.1.0 | Date formatting and calculation |
| **Carousel** | `embla-carousel-react` | ^8.6.0 | Touch-friendly image carousel |
| **Lightbox** | `yet-another-react-lightbox` | ^3.25.0 | Image gallery lightbox |
| **Image Crop** | `react-easy-crop` | ^5.5.6 | Profile/property image cropping (`CropModal`) |
| **Maps** | `@react-google-maps/api` + `@vis.gl/react-google-maps` | ^2.20.7 / ^1.7.1 | Google Maps embed and static maps |
| **Maps** | `use-places-autocomplete` | ^4.0.1 | Google Places search autocomplete |
| **Real-time** | `socket.io-client` | ^4.8.3 | WebSocket connection (Notifications, Chat) |
| **Auth** | `js-cookie` | ^3.0.5 | Secure cookie storage for auth tokens |
| **Search** | `fuse.js` | ^7.1.0 | Client-side fuzzy search |
| **Data** | `countries-list` | ^3.2.0 | Country name/code data |
| **Theme** | `next-themes` | ^0.4.6 | Dark/light mode toggling |

---

## 8. Summary — Evidence of Design Decisions

| Criteria | Evidence |
|---|---|
| **Common Functions reused** | `lib/utils.ts`, `lib/apiClient.ts`, `lib/tokenManager.ts` — used by every page and component |
| **Common Components reused** | `PropertyCard` appears on ≥ 5 different pages; `AppHeader` on every detail/form page |
| **Common Components extended** | `PropertyCard` props (`showPetPolicy`, `showStatus`, `onHeartToggle`) extend base without forks |
| **Global State shared** | `AuthContext` consumed by navbar, API layer, and every protected page simultaneously |
| **Scalable multi-step forms** | Add Property & Add Pet — 9 steps each, same pattern, no code duplication between the two flows |
| **Real-time shared state** | `NotificationContext` + `ChatContext` both consume one `lib/socket.ts` instance |
| **Design consistency** | Single Tailwind config defines all colours/fonts; zero inline style overrides |
