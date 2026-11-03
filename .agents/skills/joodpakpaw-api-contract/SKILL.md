---
name: joodpakpaw-api-contract
description: Complete Backend API, Error Code, Socket.IO v4, Row-Locking Booking Transaction, and Admin Ban Cascade specification required by the JoodPakPaw Next.js Frontend.
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
  - **Health & Cold-Start Fallback**: Exposes `GET /health` for Render/Koyeb healthchecks, and includes an in-process Hybrid Recommendation fallback if `joodpakpaw-ml` is waking up from free-tier sleep.
- **Standard Response Envelope (Enterprise V2 Standard — Single `data` Wrapper)**:
  - **Do NOT duplicate payload fields at the top level.** Always wrap payload inside `data` (and `pagination` for paginated lists), and update `joodpakpaw-frontend` callers to read from `res.data` cleanly:
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
        "limit": 10,
        "totalRows": 42,
        "totalPages": 5
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
  - **Strict `camelCase` DTOs**: Use `firstName`, `lastName`, `petProfileIds`, `petSizeCategoryId` consistently across Backend & Frontend.
  - **OTP & Password Security Hygiene**:
    - Block `resend-otp` if `user.isVerified === true` (`400 A-3008`).
    - Block `sign-in` if `user.isVerified === false` (`403 A-3006`).
    - Block setting a new password identical to the current password in both `change-password` and `reset-password` (`400 A-3012`).
    - Prefer context-aware `/api/v1/users/me/change-password` (reading `req.user.id` from JWT) and invalidate all active refresh tokens upon password change or `POST /api/v1/auth/sign-out`.
  - **Rate Limiting & S3 Garbage Collection**: Protect auth/OTP routes against brute-force/spam and clean up replaced/deleted `.webp` objects from S3 storage.
  - **Host Marketplace Governance**: Require at least 1 active Room Category (`roomCategories.length > 0`) and non-banned status before allowing a property to be published (`isActive: true`).

---

## 2. Mandatory Custom Error Codes (`joodpakpaw/lib/errorHandling.ts` & UI Components)
The Frontend checks specific `code` strings in HTTP 4xx responses. Returning generic error strings will break UI validation and modals!

| Error Code | HTTP Status | When to Return | Frontend Behavior |
| :--- | :--- | :--- | :--- |
| `T-2007` | `400` | Field validation error | Parses `errors: [{ field: string, tag: string, value: string }]`. Supported tags include `'email'`, `'min'`, `'phone'`, `'required'`. |
| `A-3001` | `401` | Invalid email or password on sign-in | Displays invalid credentials alert in `LoginForm.tsx`. |
| `A-3003` | `409` | Email already exists on sign-up | Maps to `email` field error ("อีเมลนี้ถูกใช้งานแล้ว"). |
| `A-3004` | `409` | Phone number already exists on sign-up/profile update | Maps to `phone` field error ("เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว"). |
| `A-3010` | `400` / `401` | Reset password token already used or expired | Triggers `onTokenExpired()` modal in `ResetPasswordForm.tsx`. |
| `A-3011` | `400` | Wrong `oldPassword` on change-password | Maps directly to `oldPassword` field error. |
| `A-3012` | `400` | `newPassword` is identical to `oldPassword` | Maps directly to `newPassword` field error. |
| `DB-1002` | `404` | Email is not registered (e.g., forgot-password) | Displays "ไม่พบอีเมลนี้ในระบบ". |
| `FF-4101` | `409` | Property already saved in a favorite folder | Caught in `PropertyCard.tsx` (`errorCode === 'FF-4101'`) to open the `FavoriteDrawer` for moving/removing folders. |

---

## 3. Complete Endpoint Checklist (`joodpakpaw/lib/api.ts` & `lib/authApi.ts`)

### 3.1 Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/sign-in` -> returns `{ accessToken, refreshToken, user }` (and sets cookies if applicable)
- `POST /api/v1/auth/sign-up` -> registers user and triggers OTP email
- `POST /api/v1/auth/verify-otp` -> verifies 6-digit OTP
- `POST /api/v1/auth/resend-otp` -> generates new OTP & `refCode`
- `POST /api/v1/auth/forgot-password` -> sends reset link (`DB-1002` if email not found)
- `POST /api/v1/auth/reset-password` -> consumes reset token (`A-3010` if expired/used)
- `POST /api/v1/auth/refresh-token` -> rotates/issues `accessToken`
- `GET /api/v1/auth/profile` -> returns authenticated user profile (`UserProfile`)

### 3.2 User & Pet Profiles (`/api/v1/users`, `/api/v1/profiles`)
- `PUT /api/v1/users/:userId` (`multipart/form-data` with profile image & user fields)
- `PATCH /api/v1/users/:userId/change-password` (`oldPassword`, `newPassword`, `confirmPassword`)
- `GET /api/v1/profiles/pet-profiles/all`
- `GET /api/v1/profiles/pet-profiles/:id`
- `POST /api/v1/profiles/pet-profiles` (`multipart/form-data` — pet info, vaccinations, chronic diseases, medications, allergies, emergency contacts, images)
- `PUT /api/v1/profiles/pet-profiles/:id` (`multipart/form-data`)
- `DELETE /api/v1/profiles/pet-profiles/:id` (block deletion if pet is in an active/upcoming booking!)

### 3.3 Master Lookups
- `GET /api/v1/hosts/facilities/all`
- `GET /api/v1/pets/all`
- `GET /api/v1/pets/:petTypeId/pet-breeds/all`
- `GET /api/v1/pet-size-categories/all`
- `GET /api/v1/report-categories?type=property|review|unban`

### 3.4 Properties, Search, Recommendations & Host Management
- `GET /api/v1/properties` (Query params: `page`, `limit`, `minRating`, `sortBy`, `days`, `search`, `petTypes`, `maxPrice`)
- `GET /api/v1/properties/:propertyId`
- `GET /api/v1/properties/hosts/:hostId/profile`
- `GET /api/v1/properties/hosts/:hostId/reviews` (Query params: `page`, `limit`, `propertyId`, `rating`)
- `GET /api/v1/properties/recommend` (Calls `joodpakpaw-ml` Hybrid Engine with 1500ms timeout and instant in-process fallback)
- `GET /api/v1/properties/recommend/property/:propertyId` (Similar properties from `joodpakpaw-ml` with fallback)
- `POST /api/v1/user-behaviors/view-property/:propertyId` (Upserts `user_behaviors` with `view_count + 1` and `last_interacted_at = NOW()`)
- `GET /api/v1/hosts/properties/all`
- `GET /api/v1/hosts/properties/:propertyId`
- `POST /api/v1/hosts/properties` (`multipart/form-data`)
- `PUT /api/v1/hosts/properties/:propertyId` (`multipart/form-data`)
- `DELETE /api/v1/hosts/properties/:propertyId` (Block if active/upcoming bookings exist!)
- `PATCH /api/v1/hosts/properties/:propertyId/is-active`
- `POST /api/v1/hosts/properties/:propertyId/room-categories` (`multipart/form-data`)
- `PUT /api/v1/hosts/properties/:propertyId/room-categories/:roomId` (`multipart/form-data`)
- `DELETE /api/v1/hosts/properties/:propertyId/room-categories/:roomCategoryId`
- `GET /api/v1/hosts/properties/:propertyId/room-categories/all`
- `GET /api/v1/properties/:propertyId/room-categories/search` (Query params: `checkIn`, `checkOut`, `petTypes` -> calculates `available_rooms = total_rooms - booked_rooms - unavailable_rooms` across the date range)
- **V2 Host Calendar Upgrade Endpoint**:
  - `GET /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars?startDate=...&endDate=...`
  - `PATCH /api/v1/hosts/properties/:propertyId/room-categories/:roomId/calendars` (Allows host to set `unavailable_rooms` and `price_adjustment` per date)

### 3.5 Bookings & Reviews
- `POST /api/v1/bookings` (`multipart/form-data` or JSON as sent by `lib/api.ts`)
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

### 3.6 Favorites, Notifications & Chat
- `GET /api/v1/favorite-folders/all`
- `GET /api/v1/favorite-folders/:folderId`
- `POST /api/v1/favorite-folders` (Returns `FF-4101` if property is already in a folder when adding)
- `PUT /api/v1/favorite-folders/:folderId`
- `DELETE /api/v1/favorite-folders/:folderId`
- `DELETE /api/v1/favorite-properties/:propertyId`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read` & `PATCH /api/v1/notifications/read-all` (V2 upgrade for persistent read state)
- `DELETE /api/v1/notifications`
- `DELETE /api/v1/notifications/:id`
- `POST /api/v1/chat-rooms`
- `GET /api/v1/chat-rooms`
- `GET /api/v1/chat-rooms/:id`
- `POST /api/v1/chat-rooms/:roomId/messages` (`multipart/form-data` supporting text, image, or propertyId)
- `PATCH /api/v1/chat-rooms/:roomId/messages/read`
- `DELETE /api/v1/chat-rooms/:roomId`

### 3.7 KYC Verification, Reports & Admin Backoffice
- `GET /api/v1/user-verifications/me`
- `POST /api/v1/user-verifications` (`multipart/form-data`)
- `POST /api/v1/reports/property` (`multipart/form-data`)
- `POST /api/v1/reports/review` (`multipart/form-data`)
- `POST /api/v1/reports/unban-property` (`multipart/form-data`)
- `GET /api/v1/reports/me/paginate`
- `GET /api/v1/reports/me/:id`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/reports/paginate`
- `GET /api/v1/admin/reports/:id`
- `PATCH /api/v1/admin/reports/:id/action`
- `GET /api/v1/admin/user-verifications/paginate`
- `GET /api/v1/admin/user-verifications/:id`
- `PATCH /api/v1/admin/user-verifications/:id/approve`
- `PATCH /api/v1/admin/user-verifications/:id/reject`
- `GET /api/v1/admin/action-logs/paginate`

---

## 4. Row-Level Locking Transaction for Bookings (Zero Double-Booking)
When `POST /api/v1/bookings` is called:
1. Begin a database transaction (`BEGIN`).
2. Lock the requested `room_categories` rows (`SELECT * FROM room_categories WHERE id IN (...) FOR UPDATE`).
3. Ensure calendar rows exist for every night in `[check_in_date, check_out_date)` (`INSERT INTO room_category_calendars ... ON CONFLICT (room_category_id, date) DO NOTHING`).
4. Lock all calendar rows in the range (`SELECT * FROM room_category_calendars WHERE room_category_id = $1 AND date >= $2 AND date < $3 FOR UPDATE`).
5. Verify for every night: `total_rooms - booked_rooms - unavailable_rooms >= requested_room_amount`. If any night fails, `ROLLBACK` and return `409 Conflict` / `400 Bad Request`.
6. Verify every selected `pet_profile_id` matches the room category's allowed `pet_type_id` and `pet_size_category_id` weight range, and is not already booked in an overlapping active booking.
7. Increment `booked_rooms = booked_rooms + requested_room_amount` for each night in `[check_in_date, check_out_date)`.
8. Insert `bookings`, `booking_orders`, and `booking_order_pets` (with `pet_snapshot`), set `payment_deadline = NOW() + INTERVAL '24 hours'`, and `COMMIT`.
9. If cancelled or expired after 24h without payment slip, atomically decrement `booked_rooms` in `room_category_calendars`.

---

## 5. Admin Ban & Appeal State Machine (TC-151 to TC-155)
1. **Individual Property Ban (`ban_property`)**:
   - Sets `is_banned_by_admin = true`, `is_active = false` on the target property.
2. **Host Account Ban (`ban_user`)**:
   - Sets `users.is_banned = true` on the host.
   - For all properties owned by that host:
     - Copies current `is_banned_by_admin` into `is_banned_before_account_ban`.
     - Sets `is_banned_all_properties = true`, `is_banned_by_admin = true`, `is_active = false`.
3. **Host Account Unban (`unban_user`)**:
   - Sets `users.is_banned = false`.
   - For all properties owned by that host:
     - Sets `is_banned_all_properties = false`.
     - Restores `is_banned_by_admin = is_banned_before_account_ban`.
     - Properties that were banned individually BEFORE the account ban (`is_banned_before_account_ban = true`) MUST remain banned!

---

## 6. Socket.IO v4 Real-Time Contract (`joodpakpaw/lib/socket.ts`)
- **Handshake Auth**: Extract JWT from `socket.handshake.query.token` (or `socket.handshake.auth.token`).
- **User Rooms**: Join authenticated user to room `user:${userId}`.
- **Events to Emit**:
  1. `connected`: Emit `{ status: 'ok', userId }` immediately upon connection (`NotificationContext.tsx` listens for this).
  2. `notification`: Emit `{ id, title, message, type, link, isRead, createdAt }` to `user:${recipientId}` whenever a notification is created.
  3. `new_message`: Emit message payload to `user:${recipientId}` and `user:${senderId}` when a chat message is sent (`ChatContext.tsx`).
  4. `messages_read`: Emit `{ chatRoomId, readerId, readAt }` when `PATCH /api/v1/chat-rooms/:roomId/messages/read` is called.
  5. `new_chat_room`: Emit room summary when a new chat room is created.
