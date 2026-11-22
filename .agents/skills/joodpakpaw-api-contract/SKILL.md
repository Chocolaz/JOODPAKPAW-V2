---
name: joodpakpaw-api-contract
description: Complete Backend API, Error Code, Airbnb-Grade Discovery & Date-Range Pricing, Context-Aware ML Candidate Ranking, Socket.IO v4, Row-Locking Booking Transaction, and Admin Ban Cascade specification for JoodPakPaw V2.
---

# JoodPakPaw V2 Backend API & Real-Time Contract (`joodpakpaw-api-contract`)

Use this skill whenever building, modifying, or debugging Backend endpoints (`joodpakpaw-api`) or Frontend-Backend integrations (`joodpakpaw-frontend`).

## 1. Base Routing, Reverse Proxy & Free-Tier Cloud Contract
- **Clean Root & Proxy (`joodpakpaw-frontend/next.config.ts`)**:
  - Default `NEXT_PUBLIC_BASE_PATH` is `""` (Root `/` for Vercel & Local Dev), while remaining configurable via `.env`.
  - All REST routes are mounted under `/api/v1/...`.
  - Socket.IO server mounts at `/api/socket.io` (and aliases `/capstone25/cp25nk2/api/socket.io` for backward compatibility).
- **Free-Tier Cloud Compatibility**:
  - **Database**: Connects via `DATABASE_URL` (supports Local `joodpakpaw-postgres` as well as **Supabase Free Tier** / **Neon Serverless Postgres** with SSL).
  - **Object Storage**: Uses `@aws-sdk/client-s3` to support Local `joodpakpaw-minio`, **Cloudflare R2 (Free 10GB)**, or **Supabase S3 Storage (Free 1GB)** via `.env`.
  - **Cache & Queue**: Uses `joodpakpaw-redis` / **Upstash Redis** when `REDIS_URL` is configured, and automatically falls back to **In-Memory Cache + `node-cron`** when `REDIS_URL` is omitted.
  - **Health, Single-Flight Catalog Cache & Cold-Start Fallback**: Exposes `GET /health` for Render/Koyeb healthchecks, uses a single-flight lock (`catalogSnapshotInFlight` with 60s TTL) to prevent Prisma connection pool timeouts under concurrent loads, and includes an identical in-process 3-Stage Hybrid & Candidate Ranking fallback (1500ms timeout) if `joodpakpaw-ml` is cold-starting.
- **Standard Response Envelope (Enterprise V2 Standard — Single `data` Wrapper)**:
  - **Do NOT duplicate payload fields at the top level.** Always wrap payload inside `data` (and `pagination` for paginated lists), and ensure `joodpakpaw-frontend` callers read from `res.data` cleanly:
  - Single / Object resource:
    ```json
    {
      "code": "S-0000",
      "message": "Success",
      "data": { ... }
    }
    ```
  - Paginated list resource:
    ```json
    {
      "code": "S-0000",
      "message": "Success",
      "data": [ ... ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "totalRows": 42,
        "totalPages": 3
      }
    }
    ```
  - Error response (always redact sensitive fields like passwords as `"[REDACTED]"`):
    ```json
    {
      "code": "T-2007",
      "message": "Validation failed",
      "errors": [{ "field": "password", "tag": "min", "value": "[REDACTED]" }]
    }
    ```
- **Proactive Enterprise & Business Rules**:
  - **Strict `camelCase` DTOs**: Use `firstName`, `lastName`, `petProfileIds`, `petSizeCategoryId`, `stayNights`, `stayTotalPrice`, `matchReasons`, `matchTier` consistently across Backend & Frontend.
  - **OTP & Password Security Hygiene**:
    - Block `resend-otp` if `user.isVerified === true` (`400 A-3008`).
    - Block `sign-in` if `user.isVerified === false` (`403 A-3006`).
    - Block setting a new password identical to the current password in both `change-password` and `reset-password` (`400 A-3012`).
    - Support `/api/v1/users/me/change-password` (reading `req.user.id` from JWT) and invalidate all active refresh tokens upon password change or `POST /api/v1/auth/sign-out`.
  - **Rate Limiting & S3 Garbage Collection**: Protect auth/OTP routes against brute-force/spam and clean up replaced/deleted `.webp` objects from S3 storage across all modules (`deleteObjectFromS3`).
  - **Host Marketplace Governance (`P-5001`)**: Require at least 1 active Room Category (`roomCategories.length > 0`) and non-banned status before allowing a property to be published (`isActive: true`).
  - **Booking & Calendar Marketplace Rules**:
    - **Self-Booking Prevention (`B-4002`)**: A Host cannot book their own property (`property.hostId !== req.user.id`).
    - **Date & Stay Hygiene (`B-4003`)**: `checkInDate` must not be in the past, `checkOutDate > checkInDate` (at least 1 night), max 90 nights per booking.
    - **Pet Eligibility & Ownership (`B-4004`)**: Every `petProfileId` must belong to `req.user.id`, match the room category's accepted `petTypeId` and `petSizeCategoryId` weight range, not exceed `numberOfPets * roomAmount`, and not overlap with another active booking.
    - **Host Calendar Guard**: Hosts cannot set `unavailableRooms > totalRooms - bookedRooms` on dates that already have active guest bookings (`409 Conflict`).
    - **Verified-Stay Single Review Rule**: Only the guest of a `completed` (`success`) booking can submit a review (`POST /bookings/:id/review`), limited to 1 review per booking (`409 Conflict`), atomically updating `property.avgRating`.
  - **Real-Time Chat, KYC & Admin Governance**:
    - **Chat Integrity**: Block self-chat (`participantId === req.user.id`), deduplicate existing 1-on-1 rooms between the same pair of users, and enforce participant-only IDOR checks (`403 A-3007`).
    - **KYC State Machine**: Block duplicate KYC submissions when status is already `pending` or `approved` (`409 Conflict`); lock admin approve/reject to single execution (`TC-API-172`).
    - **Report & Appeal Hygiene**: Block duplicate pending reports by the same user on the same target; restrict unban appeals (`unban-property`) to the banned property's owner.
  - **Discovery & Context-Aware ML Candidate Ranking**:
    - Exclude inactive, banned, soft-deleted, or self-owned properties from recommendation candidates.
    - When `GET /api/v1/properties` is called with `sortBy=recommended`, invoke `rankCandidateProperties()` (`POST /ml/v1/rank/candidates` on `joodpakpaw-ml` with 1.5s timeout + identical in-process fallback) and enrich each returned property with `recommendationScore`, `matchReasons`, and `matchTier`.

---

## 2. Mandatory Custom Error Codes (`joodpakpaw-frontend/lib/errorHandling.ts` & UI Components)
The Frontend checks specific `code` strings in HTTP 4xx responses:

| Error Code | HTTP Status | When to Return | Frontend Behavior |
| :--- | :--- | :--- | :--- |
| `T-2007` | `400` | Field validation error | Parses `errors: [{ field: string, tag: string, value: string }]` (passwords redacted as `"[REDACTED]"`). |
| `A-3001` | `401` | Invalid email or password on sign-in | Displays invalid credentials alert in `LoginForm.tsx`. |
| `A-3002` | `403` | Account or property is banned by Admin | Blocks login / mutation and shows suspended notice. |
| `A-3003` | `409` | Email already exists on sign-up | Maps to `email` field error ("อีเมลนี้ถูกใช้งานแล้ว"). |
| `A-3004` | `409` | Phone number already exists on sign-up/profile update | Maps to `phone` field error ("เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว"). |
| `A-3006` | `403` | Email not verified yet on sign-in | Prompts user to complete OTP verification. |
| `A-3007` | `403` | Forbidden / IDOR / RBAC violation | Rejects unauthorized cross-user or non-admin access. |
| `A-3008` | `400` | User is already verified on resend-otp | Prevents redundant OTP generation. |
| `A-3010` | `400` / `401` | Reset password token already used or expired | Triggers `onTokenExpired()` modal in `ResetPasswordForm.tsx`. |
| `A-3011` | `400` | Wrong `oldPassword` on change-password | Maps directly to `oldPassword` field error. |
| `A-3012` | `400` | `newPassword` is identical to `oldPassword` | Maps directly to `newPassword` field error (both change & reset). |
| `DB-1002` | `404` | Resource or email not found | Displays "ไม่พบข้อมูลในระบบ". |
| `FF-4101` | `409` | Property already saved in a favorite folder | Caught in `PropertyCard.tsx` to open the `FavoriteDrawer` for moving/removing folders. |
| `P-5001` | `400` | Cannot activate property with 0 room categories | Blocks `isActive: true` until at least 1 room category exists. |
| `B-4001` | `409` | Active booking exists (deletion guard) | Blocks deleting a pet profile, room category, or property with active/upcoming bookings. |
| `B-4002` | `400` | Self-booking attempt (`hostId === userId`) | Blocks a Host from booking their own property. |
| `B-4003` | `400` | Invalid booking date range or expired payment window | Rejects past dates, `checkOut <= checkIn`, or expired payment slip upload. |
| `B-4004` | `400` / `409` | Pet eligibility mismatch or pet double-booking | Rejects unowned pets, unsupported pet type/size, capacity overflow, or overlapping pet stays. |
| `RATE_LIMIT_EXCEEDED` | `429` | Too many requests on auth/OTP endpoints | Protects against brute-force login and OTP flooding. |

---

## 3. Complete Endpoint Checklist (`joodpakpaw-frontend/lib/api.ts` & `lib/authApi.ts`)

### 3.1 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/sign-in` -> returns `{ accessToken, refreshToken, user }`
- `POST /api/v1/auth/sign-up` -> registers user and triggers OTP email
- `POST /api/v1/auth/verify-otp` -> verifies 6-digit OTP
- `POST /api/v1/auth/resend-otp` -> generates new OTP & `refCode`
- `POST /api/v1/auth/forgot-password` -> sends reset link (`DB-1002` if email not found)
- `POST /api/v1/auth/reset-password` -> consumes reset token (`A-3010` if expired/used)
- `POST /api/v1/auth/refresh-token` -> rotates/issues `accessToken`
- `POST /api/v1/auth/sign-out` -> revokes active session/refresh token
- `GET /api/v1/auth/profile` -> returns authenticated user profile (`UserProfile`)

### 3.2 User & Pet Profiles (`/api/v1/users`, `/api/v1/profiles`)
- `PUT /api/v1/users/:userId` (`multipart/form-data` with profile image & user fields)
- `PATCH /api/v1/users/me/change-password` & `PATCH /api/v1/users/:userId/change-password` (`oldPassword`, `newPassword`, `confirmPassword`)
- `GET /api/v1/profiles/pet-profiles/all`
- `GET /api/v1/profiles/pet-profiles/:id`
- `POST /api/v1/profiles/pet-profiles` (`multipart/form-data` — pet info, weight, energy, breed, emergency contacts, image)
- `PUT /api/v1/profiles/pet-profiles/:id` (`multipart/form-data`)
- `DELETE /api/v1/profiles/pet-profiles/:id` (blocked with `409 B-4001` if pet is in an active/upcoming booking)

### 3.3 Master Lookups (`/api/v1/locations`, `/api/v1/hosts`, `/api/v1/pets`, etc.)
- `GET /api/v1/locations/provinces` (Returns all 77 official Thai provinces `{ id, code, nameEn, nameTh }`, optional `?search=` filter)
- `GET /api/v1/property-types/all`
- `GET /api/v1/hosts/facilities/all`
- `GET /api/v1/pets/all`
- `GET /api/v1/pets/:petTypeId/pet-breeds/all`
- `GET /api/v1/pet-size-categories/all`
- `GET /api/v1/report-categories?type=property|review|unban`

### 3.4 Properties, Airbnb-Grade Search, ML Recommendations & Host Management
- `GET /api/v1/properties`
  - **Supported Query Parameters**:
    - `page`, `limit` (up to `50`, default Home `PAGE_SIZE = 20`), `ids` (comma-separated batch lookup for Recently Viewed)
    - `search` (bilingual EN/TH province matching via `provinces` table + `title`/`province`/`district`/`subdistrict`)
    - `checkIn`, `checkOut` (validates date range `checkOut > checkIn`, verifies room availability across every night in `room_category_calendars`, and computes `stayNights` + `stayTotalPrice`)
    - `petTypes` (comma-separated pet type IDs)
    - `petSizeCategoryId` (**Up-to-Max-Size** logic: matches rooms whose `petSizeCategory.max >= selectedSize.max`)
    - `petProfileIds` (**IDOR-safe**: filters by `guestId: req.user.id`, enforces pet type & weight eligibility, and passes selected pets into ML ranking context)
    - `facilities` (comma-separated facility IDs, AND-matched)
    - `propertyType`, `propertyTypeId`, `minPrice`, `maxPrice`, `minRating`, `days`
    - `lat`, `lng` (computes Haversine `distanceKm`)
    - `sortBy`: `'recommended'` (Context-Aware ML Candidate Re-Ranking via `POST /ml/v1/rank/candidates` + 1.5s in-process fallback, returning `recommendationScore`, `matchReasons`, `matchTier`), `'popular'`, `'price_asc'`, `'price_desc'`, `'rating_desc'`, `'near_me'`, `'newest'`
  - Returns up to `5` images per property (`take: 5`) for multi-photo card carousels.
- `GET /api/v1/properties/:propertyId`
- `GET /api/v1/properties/hosts/:hostId/profile`
- `GET /api/v1/properties/hosts/:hostId/reviews` (`page`, `limit`, `propertyId`, `rating`)
- `GET /api/v1/properties/recommend` (Calls `joodpakpaw-ml` 3-Stage Hybrid Engine with 1500ms timeout and instant in-process fallback)
- `GET /api/v1/properties/recommend/property/:propertyId` (Similar properties from `joodpakpaw-ml` with fallback)
- `POST /api/v1/user-behaviors/view-property/:propertyId` (10-minute cooldown + self-view skip)
- `GET /api/v1/hosts/properties/all`
- `GET /api/v1/hosts/properties/:propertyId`
- `POST /api/v1/hosts/properties` (`multipart/form-data`)
- `PUT /api/v1/hosts/properties/:propertyId` (`multipart/form-data`)
- `DELETE /api/v1/hosts/properties/:propertyId` (`B-4001` active booking guard)
- `PATCH /api/v1/hosts/properties/:propertyId/is-active` (`P-5001` 0-room-category guard)
- `POST /api/v1/hosts/properties/:propertyId/room-categories` (`multipart/form-data`)
- `PUT /api/v1/hosts/properties/:propertyId/room-categories/:roomId` (`multipart/form-data`)
- `DELETE /api/v1/hosts/properties/:propertyId/room-categories/:roomCategoryId`
- `GET /api/v1/hosts/properties/:propertyId/room-categories/all`
- `GET /api/v1/properties/:propertyId/room-categories/search` (`checkIn`, `checkOut`, `petTypes`)
- `GET /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars?startDate=...&endDate=...`
- `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` (`unavailableRooms`, `priceAdjustment` with booked-room guard)

### 3.5 Bookings & Reviews
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/paginate`
- `GET /api/v1/bookings/:bookingId`
- `PATCH /api/v1/bookings/:bookingId/confirm-payment` (`multipart/form-data` with slip image)
- `PATCH /api/v1/bookings/:bookingId/cancel`
- `GET /api/v1/hosts/bookings/all`
- `GET /api/v1/hosts/bookings/paginate`
- `PATCH /api/v1/hosts/bookings/:bookingId/success`
- `GET /api/v1/hosts/bookings/:bookingId`
- `GET /api/v1/hosts/properties/:propertyId/bookings/paginate`
- `POST /api/v1/bookings/:bookingId/review` (`multipart/form-data`)
- `PATCH /api/v1/hosts/bookings/:bookingId/review-reply`

### 3.6 Favorites, Notifications & Chat
- `GET /api/v1/favorite-folders/all`
- `GET /api/v1/favorite-folders/:folderId`
- `POST /api/v1/favorite-folders` (Returns `FF-4101` if property is already in a folder)
- `PUT /api/v1/favorite-folders/:folderId`
- `DELETE /api/v1/favorite-folders/:folderId`
- `DELETE /api/v1/favorite-properties/:propertyId`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read` & `PATCH /api/v1/notifications/read-all`
- `DELETE /api/v1/notifications` & `DELETE /api/v1/notifications/:id`
- `POST /api/v1/chat-rooms`, `GET /api/v1/chat-rooms`, `GET /api/v1/chat-rooms/:id`, `DELETE /api/v1/chat-rooms/:roomId`
- `POST /api/v1/chat-rooms/:roomId/messages` (`multipart/form-data`)
- `PATCH /api/v1/chat-rooms/:roomId/messages/read`

### 3.7 KYC Verification, Reports, Admin Backoffice & ML Ops
- `GET /api/v1/user-verifications/me` & `POST /api/v1/user-verifications` (`multipart/form-data`)
- `POST /api/v1/reports/property`, `POST /api/v1/reports/review`, `POST /api/v1/reports/unban-property` (`multipart/form-data`)
- `GET /api/v1/reports/me/paginate` & `GET /api/v1/reports/me/:id`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/reports/paginate`, `GET /api/v1/admin/reports/:id`, `PATCH /api/v1/admin/reports/:id/action`
- `GET /api/v1/admin/user-verifications/paginate`, `GET /api/v1/admin/user-verifications/:id`, `PATCH /api/v1/admin/user-verifications/:id/approve`, `PATCH /api/v1/admin/user-verifications/:id/reject`
- `GET /api/v1/admin/action-logs/paginate`
- `GET /api/v1/admin/ml/status` & `POST /api/v1/admin/ml/refresh` (Admin RBAC protected `403 A-3007`)

---

## 4. Row-Level Locking Transaction for Bookings (Zero Double-Booking)
When `POST /api/v1/bookings` is called:
1. Begin a database transaction (`BEGIN`).
2. Lock requested `room_categories` rows (`SELECT * FROM room_categories WHERE id IN (...) FOR UPDATE`).
3. Ensure calendar rows exist for every night in `[check_in_date, check_out_date)` (`INSERT INTO room_category_calendars ... ON CONFLICT (room_category_id, date) DO NOTHING`).
4. Lock all calendar rows in the range (`SELECT * FROM room_category_calendars WHERE room_category_id = $1 AND date >= $2 AND date < $3 FOR UPDATE`).
5. Verify for every night: `total_rooms - booked_rooms - unavailable_rooms >= requested_room_amount`. If any night fails, `ROLLBACK` and return `409 Conflict` / `400 Bad Request`.
6. Verify every selected `pet_profile_id` belongs to `req.user.id`, matches the room category's allowed `pet_type_id` and `pet_size_category_id` weight range, and is not already booked in an overlapping active booking (`B-4004`).
7. Increment `booked_rooms = booked_rooms + requested_room_amount` for each night in `[check_in_date, check_out_date)`.
8. Insert `bookings`, `booking_orders`, and `booking_pet_profiles`, and `COMMIT`.
9. If cancelled or expired after 24h without payment slip, atomically decrement `booked_rooms` in `room_category_calendars`.

---

## 5. Admin Ban & Appeal State Machine (TC-151 to TC-155)
1. **Individual Property Ban (`ban_property`)**:
   - Sets `is_banned_by_admin = true`, `is_active = false` on the target property.
2. **Host Account Ban (`ban_user`)**:
   - Sets `users.is_banned_all_properties = true`, `banned_at = NOW()`.
   - For all properties owned by that host: copies current `is_banned_by_admin` into `is_banned_before_account_ban`, then sets `is_banned_by_admin = true`, `is_active = false`.
3. **Host Account Unban (`unban_user`)**:
   - Sets `users.is_banned_all_properties = false`.
   - For all properties owned by that host: restores `is_banned_by_admin = is_banned_before_account_ban`. Properties banned individually BEFORE the account ban (`is_banned_before_account_ban = true`) MUST remain banned!

---

## 6. Socket.IO v4 Real-Time Contract (`joodpakpaw-frontend/lib/socket.ts`)
- **Handshake Auth**: Extract JWT from `socket.handshake.query.token` (or `socket.handshake.auth.token`).
- **User Rooms**: Join authenticated user to room `user:${userId}`.
- **Events to Emit**: `connected`, `notification`, `new_message`, `messages_read`, `new_chat_room`.
