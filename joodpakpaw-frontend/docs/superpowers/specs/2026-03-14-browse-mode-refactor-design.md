# Browse Mode Refactor — Design Spec
**Date:** 2026-03-14
**Status:** Approved

---

## Problem

The current Browse Mode in `app/page.tsx` has several UX issues:

1. **"All Properties" section is redundant** — every property already appears in Top Rated or New Listings
2. **Sections feel identical** — same horizontal scroll, same card, no visual hierarchy
3. **Horizontal scroll is invisible on mobile** — no peek of off-screen cards
4. **"See all" expands in-place** — pushes content down, user loses scroll context
5. **No logged-out state in Recommended slot** — silent absence, missed engagement opportunity
6. **Filter state is local** — lost on navigation, not shareable/bookmarkable

---

## Goals

- Improve discoverability and section clarity
- Make filters persistent across navigation using URL search params
- Replace in-place "See all" expansion with dedicated pages
- Add mobile scroll peek to signal more content
- Add login CTA in Recommended slot for logged-out users
- Extract Browse Mode into a clean component boundary

---

## Architecture

### Route Group: `app/(browse)/`

A Next.js route group shares the search bar and filter chips across all browse pages via a shared layout. Filter state lives in URL search params so it survives navigation and supports bookmarking.

```
app/
  (browse)/
    layout.tsx            ← renders <BrowseLayoutClient> inside <Suspense>
    _components/
      BrowseLayoutClient.tsx  ← 'use client': search bar + filter chips, reads/writes URL params
      BrowseSection.tsx       ← extracted PropertySection with mobile peek fix, Link-based seeAllHref
      RecommendedCTA.tsx      ← login prompt card for logged-out users
    page.tsx              ← home: sectioned browse (Recommended, Top Rated, New Listings)
    top-rated/
      page.tsx            ← full Top Rated grid
    new-listings/
      page.tsx            ← full New Listings grid
    recommended/
      page.tsx            ← full Recommended grid
app/
  _hooks/
    useBrowseFilters.ts   ← reads/writes URL search params for filter state
```

**Note:** `(browse)/_components/` components are scoped to browse pages only and imported via relative paths. They are not exported from `app/_components/`.

### URL Search Params Schema

| Param | Type | Values |
|-------|------|--------|
| `q` | string | any search string |
| `petTypes` | comma-separated | `dog`, `cat` |
| `minRating` | number | `3`, `4`, `4.5` |
| `maxPrice` | number | `500`, `1000`, `2000`, `3500` |

---

## Components

### `useBrowseFilters` hook (`app/_hooks/useBrowseFilters.ts`)
- Calls `useSearchParams()` and `useRouter()` — must only be used inside client components
- Returns typed `FilterState` parsed from URL. All URL params are strings — the hook parses them to the correct types: `minRating` via `parseFloat` (defaults to `0` if missing/invalid), `maxPrice` as a string (kept as-is to match `FilterState`), `petTypes` via `.split(',').filter(Boolean)`.
- Provides `setFilter(key, value)` that calls `router.replace` (no history stack pollution)
- Provides `buildSeeAllUrl(base: string): string` — appends current params to a base path (e.g. `/top-rated?petTypes=dog&minRating=4`). Used by `BrowseSection` for `seeAllHref` links and by see-all pages for the Back button.
- Provides `searchQuery` (from `q` param) and `setSearchQuery` with **300ms debounce** before writing to URL, to avoid excessive history entries on keypress
- `SearchBar` must be initialized with `value={searchQuery}` from the hook so the input restores correctly after navigation

### `(browse)/layout.tsx`
- A **server component** — its only job is to render `<BrowseLayoutClient>` wrapped in `<Suspense fallback={null}>` to satisfy Next.js streaming requirements for `useSearchParams`
- `{children}` is passed through inside the Suspense boundary

### `(browse)/_components/BrowseLayoutClient.tsx`
- `'use client'` component
- Renders `SearchBar` and quick filter chips strip
- Reads/writes filter state via `useBrowseFilters`
- Owns `isFilterOpen: boolean` state (local `useState`) — controls `FilterPanel` open/close
- Passes `filters`, `isOpen`, `onOpenChange`, and an adapter `onApply` callback to `FilterPanel`

### FilterPanel integration
`FilterPanel` keeps its existing prop API (`filters: FilterState`, `isOpen: boolean`, `onOpenChange`, `onApply: (filters: FilterState) => void`). `BrowseLayoutClient` passes:
- `filters` — the current `FilterState` derived from URL params
- `isOpen` / `onOpenChange` — local boolean state owned by `BrowseLayoutClient`
- `onApply` — an adapter that calls `setFilter` for each changed key, translating the full `FilterState` object back to individual URL param updates

This means `FilterPanel` is **unchanged**. The adapter and open-state live in `BrowseLayoutClient`.

### `(browse)/_components/BrowseSection.tsx`
- Extracted from current `PropertySection` in `page.tsx`
- Accepts `seeAllHref?: string` prop (a URL string built by `buildSeeAllUrl`)  — renders as `<Link href={seeAllHref}>` instead of a button
- No expand-in-place behavior (removed)
- Mobile horizontal scroll container gets `pr-10` so the last visible card is partially clipped — signals more cards off-screen

### `(browse)/_components/RecommendedCTA.tsx`
- Renders when user is logged out in the Recommended slot
- Dashed-border card with heart icon, short copy ("Log in to see picks for you"), and a teal "Log in" button
- Matches the card width (`w-44 shrink-0`) so it sits naturally in the mobile scroll row
- Clicking "Log in" triggers the existing auth modal (via `AuthModalContext`)
- Always rendered in the Recommended slot — it does NOT disappear when `filteredProperties` is empty. The empty state (no matching properties) only affects Top Rated and New Listings sections.

### "See all" pages (`/top-rated`, `/new-listings`, `/recommended`)
- Each page is `'use client'`, reads filter state from `useBrowseFilters`
- Full grid layout: `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6` (consistent with project standard)
- Page heading + property count
- **Loading state**: same skeleton pattern as home page — `animate-pulse` cards in the same grid
- **Back navigation**: `<Link href={`/?${searchParams}`}>` — reconstructs the home URL with current params preserved, so filters remain active on return. Uses `buildSeeAllUrl('/')` from `useBrowseFilters`.
- Fetches full dataset (no SECTION_LIMIT slice)

### `(browse)/page.tsx` (home)
- `'use client'`, reads filter state from `useBrowseFilters`
- Renders 3 sections: Recommended (or `RecommendedCTA`), Top Rated, New Listings
- "See all" href built via `buildSeeAllUrl('/top-rated')` etc.
- Removes "All Properties" section entirely
- Removes `expandedTopRated`, `expandedNewListings`, `expandedRecommended` state
- Empty state: when `filteredProperties.length === 0`, show the same "No properties found" UI. `RecommendedCTA` still renders above it (it does not depend on `filteredProperties`).
- **Outer wrapper**: replaces the current `<div className="...min-h-screen flex flex-col">` with a plain `<div>` — the root `app/layout.tsx` already provides `<main className="flex-1">` wrapping, so browse pages must not add another `<main>` tag. The search bar / chips in the browse layout sit outside `<main>` in the layout, above `{children}`.

### Route group URL transparency
Next.js route groups (folders wrapped in parentheses) are transparent to the URL. The home page at `app/(browse)/page.tsx` resolves to `/`, and the see-all pages resolve to `/top-rated`, `/new-listings`, `/recommended` — exactly as specified.

---

## DesktopNav update

`DesktopNav` currently uses an allowlist `VISIBLE_PATHS`. The three new routes (`/top-rated`, `/new-listings`, `/recommended`) must be added to `VISIBLE_PATHS` so the nav is visible on "see all" pages.

---

## Data Flow

```
URL search params
       ↓
useBrowseFilters (hook)
       ↓                    ↓
BrowseLayoutClient      page.tsx / see-all pages
(search bar, chips,     (filter + render properties,
 FilterPanel adapter)    "See all" links via buildSeeAllUrl)
```

Pages fetch all properties once, then filter client-side using values from `useBrowseFilters` — same pattern as current implementation.

---

## What Is Removed

- `expandedTopRated`, `expandedNewListings`, `expandedRecommended` state
- "All Properties" section
- In-place "See all" expand logic
- `useState` for `filters`, `searchQuery` from `page.tsx` — moves to URL params

---

## What Is Preserved

- `PropertyCard` — unchanged
- `PropertyList` — unchanged
- `FilterPanel` — unchanged (receives adapter callback from browse layout)
- `app/layout.tsx` — unchanged
- All existing API calls (`getProperties`, `getRecommendedProperties`)
- Existing `SearchBar` component interface

---

## Non-Goals

- No new card designs or visual redesign of PropertyCard
- No server-side filtering
- No pagination on "see all" pages
