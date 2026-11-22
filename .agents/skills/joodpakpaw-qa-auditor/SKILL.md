---
name: joodpakpaw-qa-auditor
description: Independent Quality Assurance & Security Auditor runbook for JoodPakPaw V2 covering Enterprise DTO parity, Concurrency race-condition tests, IDOR/RBAC security, Admin Ban Cascade, Context-Aware Hybrid ML verification, and Hallmark UI/Console/Git hygiene.
---

# JoodPakPaw V2 QA & Security Auditor Runbook (`joodpakpaw-qa-auditor`)

Use this skill when acting as the independent **Auditor & Reviewer (`qa-auditor`)** verifying work produced by Builder agents (`db-infra-architect`, `backend-core-engineer`, `ml-recommendation-engineer`, `frontend-upgrader`).

## 1. Core Auditing Principles
1. **Strict Separation of Builder and Auditor**: Never rubber-stamp code or write feature code yourself. Inspect actual source files, run automated test suites (`smoke-test.ts`, `pytest`, `tsc --noEmit`, `next build`, `sloplint`), and verify live HTTP/UI behavior against contracts.
2. **Evidence-Based Verdicts**: Every audit report must end with a clear `STATUS: PASS` or `STATUS: FAIL (Action Required)` and list specific `file:///path#Lstart-Lend` references for any defect.

---

## 2. The 6-Gate Enterprise Verification Checklist

### Gate 1: Enterprise V2 DTO, Single `data` Envelope & Error Code Parity
- Verify that every Backend response uses the clean Single Standard Envelope (`{ code: 'S-0000', message, data, pagination? }`) without redundant top-level field duplication, and matches `d:\Project\joodpakpaw\joodpakpaw-frontend\types\*.ts` and `d:\Project\joodpakpaw\joodpakpaw-frontend\lib\api.ts`.
- Verify strict `camelCase` field naming (`firstName`, `lastName`, `petProfileIds`, `petSizeCategoryId`, `stayNights`, `stayTotalPrice`, `matchReasons`, `matchTier`).
- Verify custom error codes in `joodpakpaw-frontend/lib/errorHandling.ts`:
  - `T-2007` (with `errors: [{ field, tag, value }]` and passwords redacted as `"[REDACTED]"`), `A-3001`..`A-3012`, `DB-1002`, `FF-4101`, `P-5001`, `B-4001`..`B-4004`, `RATE_LIMIT_EXCEEDED`.

### Gate 2: Concurrency, Booking Integrity, Date-Range Availability & Marketplace Rules
- **TC-051 / TC-API-085 (Last-Room Race Condition)**:
  - Simulate 2 concurrent `POST /api/v1/bookings` requests for the last remaining room on overlapping dates.
  - Expected: Exactly 1 request succeeds (`201`/`200`) and 1 fails (`409`/`400`), and `room_category_calendars.booked_rooms` never exceeds `total_rooms - unavailable_rooms`.
- **Discovery Date-Range Availability & Dynamic Pricing (`GET /api/v1/properties?checkIn=...&checkOut=...`)**:
  - Verify `checkOut <= checkIn` returns `400 B-4003`.
  - Verify valid date ranges filter out properties with 0 available rooms on any night in `[checkIn, checkOut)` and compute accurate `stayNights` and `stayTotalPrice` (including daily `priceAdjustment`).
- **Self-Booking Prevention (`B-4002`) & Date Hygiene (`B-4003`)**:
  - Attempt to book a property owned by the same user (`property.hostId === req.user.id`) -> Rejected with `B-4002`.
- **TC-API-086 & `B-4004` (Pet Eligibility, Up-to-Max-Size & Double-Booking Guard)**:
  - Verify `petSizeCategoryId` uses Up-to-Max-Size filtering in search and strict weight/type eligibility in booking.
  - Attempt to book with another user's `petProfileId`, unsupported pet type/size, exceeding capacity, or overlapping dates -> Rejected with `B-4004` / `403 A-3007`.
- **Host Calendar Guard & Active Booking Deletion Guard (`B-4001`)**:
  - Attempt to set `unavailableRooms > totalRooms - bookedRooms` -> Rejected with `409 Conflict`.
  - Attempt to `DELETE` a `pet_profile`, `room_category`, or `property` with active/upcoming bookings -> Blocked with `409 B-4001`.

### Gate 3: Security, RBAC, IDOR, Rate Limiting & S3 Garbage Collection
- **IDOR Prevention (`TC-API-032`, `TC-API-075`, Search `petProfileIds`)**:
  - Verify `GET /api/v1/properties?petProfileIds=...` scopes pet profile lookup strictly to `guestId: req.user.id` (unauthenticated or cross-user IDs yield empty/blocked results without leaking other users' pets).
  - Verify User A cannot view/modify/delete User B's pet profile, property, room category, booking, or private chat room (`403 A-3007` or `404`).
- **Chat Self-Chat & Deduplication**:
  - Attempt to create a chat room with oneself -> `400 Bad Request`. Creating a room with an existing participant returns the existing room without duplication.
- **S3 Garbage Collection**:
  - Verify that replacing or deleting avatars, property/room images, pet images, or chat images triggers `deleteObjectFromS3`.
- **Admin RBAC (`TC-API-140+`)**:
  - Authenticate as a regular `guest` or `host` and call `/api/v1/admin/*` (including `/api/v1/admin/ml/*`) -> `403 A-3007`.

### Gate 4: Admin Ban & Appeal State Machine (TC-151 to TC-155, TC-API-168, TC-API-172)
- Verify the 3-step cascade:
  1. Admin bans Property P1 individually (`is_banned_by_admin = true`). Host also owns Property P2 (`is_banned_by_admin = false`).
  2. Admin bans the Host's user account (`ban_user`) -> both P1 and P2 become hidden/banned (`is_banned_all_properties = true`), while P1 records `is_banned_before_account_ban = true` and P2 records `is_banned_before_account_ban = false`.
  3. Admin unbans the Host's user account (`unban_user`) -> P2 is restored (`is_banned_by_admin = false`), while P1 **remains banned** (`is_banned_by_admin = true`)!
- Verify single-action lock on reports (`TC-API-168`) and KYC verifications (`TC-API-172`).

### Gate 5: Context-Aware Hybrid ML, Single-Flight Fallback & Automated Test Suites
- Verify `joodpakpaw-ml` pytest suite passes (`.\.venv\Scripts\python.exe -m pytest -v` -> `21/21 passed`), including `POST /ml/v1/rank/candidates` context-aware candidate re-ranking (traveling `pet_profile_ids`, budget affinity `max_price`, geo decay `lat`/`lng`, and swimming pool high-energy affinity).
- Verify `joodpakpaw-api` smoke test suite passes (`npx tsx src/test/smoke-test.ts` -> `86/86 PASSED`), including `GET /api/v1/properties?sortBy=recommended` and the 1.5s single-flight in-process fallback when `joodpakpaw-ml` is cold-starting.

### Gate 6: Hallmark UI Design Floor, Browser Console & Git Diff Hygiene
- Verify `joodpakpaw-frontend` passes `npm run typecheck` and `npm run build` (`Exit code 0`).
- Verify compliance with `d:\Project\joodpakpaw\DESIGN.md`:
  - Global Typography Scale inherited from `@layer base` in `app/globals.css` (no hardcoded font sizes on standard `h1`–`h5` tags).
  - All 9 tabs in `CategoryIconRail.tsx` use 3D Pastel Clay `.webp` icons.
  - 5-column desktop grid (`xl:grid-cols-5`) with `PAGE_SIZE = 20` and 5-card `Recently viewed` rail.
  - Zero React 19 `setState`-in-`useEffect` warnings, zero browser ConsoleErrors, and zero broken images (`404`).
- Verify `git status` and `git diff` contain zero `catbnb` naming, zero leaked `.env` secrets, and clean Conventional Commit readiness.

---

## 3. Audit Report Template
When reporting back to the Orchestrator (`send_message`), use this structure:
```markdown
## QA Audit Report: [Phase / Feature Name]
- **Verdict**: PASS | FAIL
- **Gates Checked**: [Gate 1 .. Gate 6]
- **Automated Tests Run**: [Command & pass/fail count]
- **Defects Found**:
  1. [Severity: High/Med/Low] `file:///path/to/file#L10-L20` — Description & exact fix required.
```
