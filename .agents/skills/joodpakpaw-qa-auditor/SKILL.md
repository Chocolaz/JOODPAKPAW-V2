---
name: joodpakpaw-qa-auditor
description: Independent Quality Assurance & Security Auditor runbook for JoodPakPaw V2 covering TypeScript DTO parity, concurrency race-condition tests, IDOR/RBAC checks, and the 371 Capstone Test Cases.
---

# JoodPakPaw V2 QA & Security Auditor Runbook (`joodpakpaw-qa-auditor`)

Use this skill when acting as the independent **Auditor & Reviewer (`qa-auditor`)** verifying work produced by Builder agents (`db-infra-architect`, `backend-core-engineer`, `ml-recommendation-engineer`, `frontend-upgrader`).

## 1. Core Auditing Principles
1. **Separation of Builder and Auditor**: Never rubber-stamp code. Inspect actual source files, run automated tests/scripts, and verify HTTP responses against Frontend TypeScript contracts.
2. **Evidence-Based Verdicts**: Every audit report must end with a clear `STATUS: PASS` or `STATUS: FAIL (Action Required)` and list specific `file:///path#Lstart-Lend` references for any defect.

---

## 2. The 5-Gate Verification Checklist

### Gate 1: Enterprise V2 DTO, Single `data` Envelope & Error Code Parity
- Verify that every Backend response uses the clean Single Standard Envelope (`{ code: 'S-0000', message, data, pagination? }`) without redundant top-level field duplication, and matches `d:\Project\joodpakpaw\joodpakpaw-frontend\types\*.ts` and `d:\Project\joodpakpaw\joodpakpaw-frontend\lib\api.ts`.
- Verify strict `camelCase` field naming (`firstName`, `lastName`, `petProfileIds`, `petSizeCategoryId`).
- Verify custom error codes in `joodpakpaw-frontend/lib/errorHandling.ts`:
  - `T-2007` (with `errors: [{ field, tag, value }]` and passwords redacted as `"[REDACTED]"`), `A-3001`, `A-3003`, `A-3004`, `A-3006` (unverified email on sign-in), `A-3008` (already verified on resend-otp), `A-3010`, `A-3011`, `A-3012` (new password same as current password on both change & reset), `DB-1002`, `FF-4101`.

### Gate 2: Concurrency & Booking Integrity (Critical Capstone Test Cases)
- **TC-051 / TC-API-085 (Last-Room Race Condition)**:
  - Simulate 2 concurrent `POST /api/v1/bookings` requests for the last remaining room on overlapping dates.
  - Expected: Exactly 1 request succeeds (`201`/`200`) and 1 fails (`409`/`400`), and `room_category_calendars.booked_rooms` never exceeds `total_rooms - unavailable_rooms`.
- **TC-API-086 (Double-Booking Same Pet)**:
  - Attempt to book the same `pet_profile_id` in two overlapping bookings.
  - Expected: Rejected with validation/conflict error.
- **TC-API-095 / TC-063 (Active Booking Deletion Guard)**:
  - Attempt to `DELETE` a `pet_profile`, `room_category`, or `property` that has an active/upcoming booking.
  - Expected: Blocked with a clear 400/409 error.

### Gate 3: Security, RBAC & IDOR Protection
- **TC-API-032 / TC-API-075 (IDOR Prevention)**:
  - Authenticate as User A and attempt to `PUT`/`DELETE` User B's pet profile, property, room category, or booking.
  - Expected: `403 Forbidden` or `404 Not Found`.
- **TC-API-140+ (Admin RBAC)**:
  - Authenticate as a regular `user` or `host` and call `/api/v1/admin/*`.
  - Expected: `403 Forbidden`.

### Gate 4: Admin Ban & Appeal State Machine (TC-151 to TC-155, TC-API-168, TC-API-172)
- Verify the 3-step cascade:
  1. Admin bans Property P1 individually (`is_banned_by_admin = true`). Host also owns Property P2 (`is_banned_by_admin = false`).
  2. Admin bans the Host's user account (`ban_user`) -> both P1 and P2 become hidden/banned (`is_banned_all_properties = true`), while P1 records `is_banned_before_account_ban = true` and P2 records `is_banned_before_account_ban = false`.
  3. Admin unbans the Host's user account (`unban_user`) -> P2 is restored (`is_banned_by_admin = false`), while P1 **remains banned** (`is_banned_by_admin = true`)!
- Verify single-action enforcement on reports (`TC-API-168`) and single-review verification on KYC (`TC-API-172`): a second admin action on an already-processed report or KYC request must be rejected.

### Gate 5: Hybrid ML, Real-Time Socket.IO & Free-Tier Cloud Readiness Verification
- Verify `GET /api/v1/properties/recommend` returns valid hydrated properties for both authenticated users (with pets/behaviors) and cold-start guests, and still succeeds via in-process fallback if `joodpakpaw-ml` is unreachable or waking up from free-tier sleep.
- Verify Socket.IO connects at `/api/socket.io` (and `/capstone25/cp25nk2/api/socket.io` alias) with `query: { token }` and emits `connected`, `notification`, `new_message`, `messages_read`, and `new_chat_room`.
- Verify `git status` and `git diff` contain zero `catbnb` naming, zero leaked `.env` secrets, and clean Conventional Commit readiness.

---

## 3. Audit Report Template
When reporting back to the Orchestrator (`send_message`), use this structure:
```markdown
## QA Audit Report: [Phase / Feature Name]
- **Verdict**: PASS | FAIL
- **Gates Checked**: [Gate 1, Gate 2, ...]
- **Automated Tests Run**: [Command & pass/fail count]
- **Defects Found**:
  1. [Severity: High/Med/Low] `file:///path/to/file#L10-L20` — Description & exact fix required.
```
