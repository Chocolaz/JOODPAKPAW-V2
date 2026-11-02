---
name: joodpakpaw-db-schema
description: Comprehensive PostgreSQL 16 database schema runbook for JoodPakPaw V2 (41 tables across 8 domains), including exact column definitions from Capstone Appendix B, constraints, indexes, and required lookup seed data.
---

# JoodPakPaw V2 Database Schema & Seed Runbook (`joodpakpaw-db-schema`)

Use this skill whenever designing, migrating, or querying the PostgreSQL 16 database for **JoodPakPaw (จุดพักใจ/จุดพักพาว)**.

## 1. Golden Rules for Schema Design
1. **Strict 41-Table Parity**: Every table and column from Capstone Report Appendix B (`01_ID65_CapstoneProject_รูปเล่มโครงงานฉบับสมบูรณ์_V1.1.pdf`, pp. 90–103) must exist with exact semantics so that Backend APIs and ML pipelines operate without missing relations.
2. **Primary & Foreign Keys**: Use `SERIAL` / `INTEGER` primary keys (`id`) to match Frontend TypeScript interfaces (`number` IDs in `joodpakpaw/types/*.ts`, except where string/UUID is explicitly mapped) and enforce `ON DELETE CASCADE` or `ON DELETE RESTRICT` appropriately.
3. **Soft Delete & Ban Flags**:
   - Properties require `is_active` (`BOOLEAN DEFAULT true`), `is_banned_by_admin` (`BOOLEAN DEFAULT false`), `is_banned_all_properties` (`BOOLEAN DEFAULT false`), `is_banned_before_account_ban` (`BOOLEAN DEFAULT false`), and `deleted_at` (`TIMESTAMPTZ NULL`).
   - Users require `is_banned` (`BOOLEAN DEFAULT false`), `banned_at` (`TIMESTAMPTZ NULL`), and `ban_reason` (`TEXT NULL`).
4. **Concurrency & Inventory Safety**:
   - `room_category_calendars` MUST have a `UNIQUE (room_category_id, date)` constraint and a `CHECK (booked_rooms >= 0 AND unavailable_rooms >= 0)` constraint so row-level locking (`SELECT ... FOR UPDATE`) and atomic upserts (`ON CONFLICT (room_category_id, date) DO UPDATE`) cannot oversell rooms.

---

## 2. The 41 Tables by Domain (8 Domains)

### Domain 1: Users, Roles, Verification & Auth (8 Tables)
1. **`roles`**:
   - `id` (PK), `name` (`VARCHAR(50) UNIQUE` — `'user'`, `'host'`, `'admin'`), `description`, `created_at`, `updated_at`
2. **`users`**:
   - `id` (PK), `role_id` (FK -> `roles.id`), `first_name` (`VARCHAR(100)`), `last_name` (`VARCHAR(100)`), `email` (`VARCHAR(255) UNIQUE NOT NULL`), `password` (`VARCHAR(255) NOT NULL`), `phone` (`VARCHAR(20) UNIQUE NOT NULL`), `gender` (`VARCHAR(20)`), `birth_date` (`DATE`), `profile_image` (`TEXT`), `is_verified` (`BOOLEAN DEFAULT false`), `is_banned` (`BOOLEAN DEFAULT false`), `banned_at` (`TIMESTAMPTZ`), `ban_reason` (`TEXT`), `created_at`, `updated_at`, `deleted_at`
3. **`user_verifications`** (KYC & Host Onboarding):
   - `id` (PK), `user_id` (FK -> `users.id`), `national_id` (`VARCHAR(255)` — encrypted/hashed or masked), `laser_code` (`VARCHAR(100)`), `id_card_image` (`TEXT`), `selfie_id_card_image` (`TEXT`), `bank_name` (`VARCHAR(100)`), `bank_account_name` (`VARCHAR(150)`), `bank_account_number` (`VARCHAR(50)`), `bank_book_image` (`TEXT`), `promptpay_number` (`VARCHAR(50)`), `promptpay_qr_image` (`TEXT`), `status` (`VARCHAR(30)` — `'pending'`, `'approved'`, `'rejected'`), `reject_reason` (`TEXT`), `reviewed_by` (FK -> `users.id` NULL), `reviewed_at` (`TIMESTAMPTZ`), `created_at`, `updated_at`
4. **`user_otps`**:
   - `id` (PK), `email` (`VARCHAR(255)`), `otp_code` (`VARCHAR(10)`), `ref_code` (`VARCHAR(20)`), `expires_at` (`TIMESTAMPTZ`), `is_used` (`BOOLEAN DEFAULT false`), `created_at`
5. **`password_reset_tokens`**:
   - `id` (PK), `user_id` (FK -> `users.id`), `token` (`VARCHAR(255) UNIQUE`), `expires_at` (`TIMESTAMPTZ`), `is_used` (`BOOLEAN DEFAULT false`), `created_at`
6. **`refresh_tokens`**:
   - `id` (PK), `user_id` (FK -> `users.id`), `token` (`TEXT UNIQUE`), `expires_at` (`TIMESTAMPTZ`), `is_revoked` (`BOOLEAN DEFAULT false`), `created_at`
7. **`host_profiles`** (or extended host metadata view/table):
   - `id` (PK), `user_id` (FK -> `users.id` UNIQUE), `bio` (`TEXT`), `response_rate` (`NUMERIC(5,2)`), `joined_host_at` (`TIMESTAMPTZ`), `created_at`, `updated_at`
8. **`user_addresses`**:
   - `id` (PK), `user_id` (FK -> `users.id`), `address_line` (`TEXT`), `sub_district` (`VARCHAR(100)`), `district` (`VARCHAR(100)`), `province` (`VARCHAR(100)`), `postal_code` (`VARCHAR(10)`), `created_at`, `updated_at`

### Domain 2: Pet Lookups & Pet Profiles (11 Tables)
9. **`pet_types`**:
   - `id` (PK), `name` (`VARCHAR(100)` — e.g., สุนัข, แมว, กระต่าย, หนูแฮมสเตอร์, นก, สัตว์เลื้อยคลาน), `icon` (`TEXT`), `created_at`, `updated_at`
10. **`pet_breeds`**:
    - `id` (PK), `pet_type_id` (FK -> `pet_types.id`), `name` (`VARCHAR(150)`), `created_at`, `updated_at`
11. **`pet_size_categories`**:
    - `id` (PK), `name` (`VARCHAR(50)` — Small, Medium, Large, Giant), `min_weight` (`NUMERIC(5,2)`), `max_weight` (`NUMERIC(5,2)`), `description` (`TEXT`)
12. **`pet_energies`**:
    - `id` (PK), `level` (`INT UNIQUE` 1..5), `name` (`VARCHAR(100)`), `description` (`TEXT`)
13. **`pet_profiles`**:
    - `id` (PK), `user_id` (FK -> `users.id`), `pet_type_id` (FK -> `pet_types.id`), `pet_breed_id` (FK -> `pet_breeds.id` NULL), `custom_breed` (`VARCHAR(150)` NULL), `name` (`VARCHAR(100)`), `gender` (`VARCHAR(20)`), `weight` (`NUMERIC(5,2)`), `age_year` (`INT`), `age_month` (`INT`), `is_spayed_or_neutered` (`BOOLEAN`), `is_microchipped` (`BOOLEAN`), `microchip_number` (`VARCHAR(100)`), `energy_level` (`INT` 1..5), `social_with_pets` (`VARCHAR(100)`), `social_with_people` (`VARCHAR(100)`), `potty_training` (`VARCHAR(100)`), `feeding_schedule` (`TEXT`), `Additional_note` (`TEXT`), `profile_image` (`TEXT`), `created_at`, `updated_at`, `deleted_at`
14. **`pet_profile_images`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `image_url` (`TEXT`), `sort_order` (`INT`), `created_at`
15. **`pet_vaccinations`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `vaccine_name` (`VARCHAR(150)`), `vaccinated_date` (`DATE`), `expiry_date` (`DATE`), `certificate_image` (`TEXT`), `created_at`
16. **`pet_chronic_diseases`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `disease_name` (`VARCHAR(150)`), `symptom_and_care` (`TEXT`), `created_at`
17. **`pet_medications`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `medication_name` (`VARCHAR(150)`), `dosage_and_frequency` (`TEXT`), `created_at`
18. **`pet_allergies`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `allergen` (`VARCHAR(150)`), `reaction` (`TEXT`), `created_at`
19. **`pet_emergency_contacts`**:
    - `id` (PK), `pet_profile_id` (FK -> `pet_profiles.id`), `contact_name` (`VARCHAR(150)`), `phone` (`VARCHAR(20)`), `relationship` (`VARCHAR(100)`), `vet_clinic_name` (`VARCHAR(150)`), `vet_clinic_phone` (`VARCHAR(20)`), `created_at`

### Domain 3: Facilities & Property Configurations (3 Tables)
20. **`facilities`**:
    - `id` (PK), `name` (`VARCHAR(150)`), `category` (`VARCHAR(100)`), `icon` (`TEXT`), `created_at`, `updated_at`
21. **`property_facilities`**:
    - `id` (PK), `property_id` (FK -> `properties.id`), `facility_id` (FK -> `facilities.id`), `UNIQUE (property_id, facility_id)`
22. **`property_rules`**:
    - `id` (PK), `property_id` (FK -> `properties.id`), `rule_text` (`TEXT`), `created_at`

### Domain 4: Properties, Room Categories & Calendars (6 Tables)
23. **`properties`**:
    - `id` (PK), `host_id` (FK -> `users.id`), `name` (`VARCHAR(200)`), `type` (`VARCHAR(100)`), `description` (`TEXT`), `highlight` (`TEXT`), `house_number` (`VARCHAR(50)`), `soi` (`VARCHAR(100)`), `road` (`VARCHAR(100)`), `sub_district` (`VARCHAR(100)`), `district` (`VARCHAR(100)`), `province` (`VARCHAR(100)`), `postal_code` (`VARCHAR(10)`), `latitude` (`NUMERIC(10,7)`), `longitude` (`NUMERIC(10,7)`), `check_in_start` (`VARCHAR(10)`), `check_in_end` (`VARCHAR(10)`), `check_out_time` (`VARCHAR(10)`), `min_price` (`NUMERIC(10,2)`), `avg_rating` (`NUMERIC(3,2) DEFAULT 0`), `review_count` (`INT DEFAULT 0`), `is_active` (`BOOLEAN DEFAULT true`), `is_banned_by_admin` (`BOOLEAN DEFAULT false`), `is_banned_all_properties` (`BOOLEAN DEFAULT false`), `is_banned_before_account_ban` (`BOOLEAN DEFAULT false`), `ban_reason` (`TEXT`), `created_at`, `updated_at`, `deleted_at`
24. **`property_images`**:
    - `id` (PK), `property_id` (FK -> `properties.id`), `image_url` (`TEXT`), `is_cover` (`BOOLEAN DEFAULT false`), `sort_order` (`INT`), `created_at`
25. **`room_categories`**:
    - `id` (PK), `property_id` (FK -> `properties.id`), `name` (`VARCHAR(150)`), `description` (`TEXT`), `room_size_width` (`NUMERIC(6,2)`), `room_size_length` (`NUMERIC(6,2)`), `room_size_height` (`NUMERIC(6,2)`), `max_pets` (`INT`), `total_rooms` (`INT NOT NULL CHECK (total_rooms > 0)`), `price_per_night` (`NUMERIC(10,2) NOT NULL`), `walk_per_day` (`INT DEFAULT 0`), `free_roam_hours` (`INT DEFAULT 0`), `update_frequency` (`VARCHAR(100)`), `is_air_conditioned` (`BOOLEAN DEFAULT false`), `created_at`, `updated_at`, `deleted_at`
26. **`room_category_images`**:
    - `id` (PK), `room_category_id` (FK -> `room_categories.id`), `image_url` (`TEXT`), `sort_order` (`INT`), `created_at`
27. **`room_category_pet_types`**:
    - `id` (PK), `room_category_id` (FK -> `room_categories.id`), `pet_type_id` (FK -> `pet_types.id`), `pet_size_category_id` (FK -> `pet_size_categories.id` NULL), `UNIQUE (room_category_id, pet_type_id, pet_size_category_id)`
28. **`room_category_calendars`**:
    - `id` (PK), `room_category_id` (FK -> `room_categories.id`), `date` (`DATE NOT NULL`), `booked_rooms` (`INT DEFAULT 0 CHECK (booked_rooms >= 0)`), `unavailable_rooms` (`INT DEFAULT 0 CHECK (unavailable_rooms >= 0)`), `price_adjustment` (`NUMERIC(10,2) NULL`), `note` (`TEXT NULL`), `UNIQUE (room_category_id, date)`

### Domain 5: Bookings, Orders, Payments & Reviews (5 Tables)
29. **`bookings`**:
    - `id` (PK), `booking_code` (`VARCHAR(30) UNIQUE`), `user_id` (FK -> `users.id`), `property_id` (FK -> `properties.id`), `check_in_date` (`DATE NOT NULL`), `check_out_date` (`DATE NOT NULL`), `nights` (`INT NOT NULL`), `total_price` (`NUMERIC(10,2) NOT NULL`), `status` (`VARCHAR(30)` — `'pending_payment'`, `'waiting_verification'`, `'confirmed'`, `'completed'`, `'cancelled'`), `payment_deadline` (`TIMESTAMPTZ`), `payment_slip_image` (`TEXT`), `paid_at` (`TIMESTAMPTZ`), `cancel_reason` (`TEXT`), `cancelled_by` (`VARCHAR(30)`), `cancelled_at` (`TIMESTAMPTZ`), `completed_at` (`TIMESTAMPTZ`), `special_request` (`TEXT`), `created_at`, `updated_at`
30. **`booking_orders`**:
    - `id` (PK), `booking_id` (FK -> `bookings.id`), `room_category_id` (FK -> `room_categories.id`), `room_amount` (`INT NOT NULL CHECK (room_amount > 0)`), `price_per_night` (`NUMERIC(10,2)`), `subtotal_price` (`NUMERIC(10,2)`), `created_at`
31. **`booking_order_pets`**:
    - `id` (PK), `booking_order_id` (FK -> `booking_orders.id`), `pet_profile_id` (FK -> `pet_profiles.id`), `pet_snapshot` (`JSONB` — stores frozen health/vaccine/profile data at time of booking), `created_at`
32. **`reviews`**:
    - `id` (PK), `booking_id` (FK -> `bookings.id UNIQUE`), `user_id` (FK -> `users.id`), `property_id` (FK -> `properties.id`), `rating` (`INT NOT NULL CHECK (rating BETWEEN 1 AND 5)`), `comment` (`TEXT`), `is_hidden_by_admin` (`BOOLEAN DEFAULT false`), `created_at`, `updated_at`, `deleted_at`
33. **`review_images`**:
    - `id` (PK), `review_id` (FK -> `reviews.id`), `image_url` (`TEXT`), `created_at`

### Domain 6: Real-Time Chat (2 Tables)
34. **`chat_rooms`**:
    - `id` (PK), `user_id` (FK -> `users.id`), `host_id` (FK -> `users.id`), `property_id` (FK -> `properties.id` NULL), `last_message_at` (`TIMESTAMPTZ`), `user_deleted_at` (`TIMESTAMPTZ NULL`), `host_deleted_at` (`TIMESTAMPTZ NULL`), `created_at`, `updated_at`, `UNIQUE (user_id, host_id)`
35. **`chat_messages`**:
    - `id` (PK), `chat_room_id` (FK -> `chat_rooms.id`), `sender_id` (FK -> `users.id`), `message_type` (`VARCHAR(20)` — `'text'`, `'image'`, `'property_card'`), `content` (`TEXT`), `image_url` (`TEXT NULL`), `property_id` (FK -> `properties.id` NULL), `is_read` (`BOOLEAN DEFAULT false`), `read_at` (`TIMESTAMPTZ NULL`), `created_at`

### Domain 7: Reports, Appeals & Admin Action Logs (3 Tables)
36. **`report_categories`**:
    - `id` (PK), `type` (`VARCHAR(30)` — `'property'`, `'review'`, `'unban'`), `name` (`VARCHAR(150)`), `description` (`TEXT`), `created_at`
37. **`reports`**:
    - `id` (PK), `reporter_id` (FK -> `users.id`), `report_category_id` (FK -> `report_categories.id`), `target_type` (`VARCHAR(30)` — `'property'`, `'review'`, `'unban_property'`), `property_id` (FK -> `properties.id` NULL), `review_id` (FK -> `reviews.id` NULL), `target_user_id` (FK -> `users.id` NULL), `description` (`TEXT`), `evidence_images` (`JSONB` / companion array), `status` (`VARCHAR(30)` — `'pending'`, `'resolved'`, `'rejected'`), `admin_action` (`VARCHAR(50)` — `'none'`, `'ban_property'`, `'delete_review'`, `'ban_user'`, `'unban_property'`), `admin_note` (`TEXT`), `handled_by` (FK -> `users.id` NULL), `handled_at` (`TIMESTAMPTZ NULL`), `created_at`, `updated_at`
38. **`admin_action_logs`**:
    - `id` (PK), `admin_id` (FK -> `users.id`), `action_type` (`VARCHAR(50)` — `'approve_kyc'`, `'reject_kyc'`, `'ban_property'`, `'unban_property'`, `'ban_user'`, `'unban_user'`, `'delete_review'`, `'reject_report'`), `target_type` (`VARCHAR(30)`), `target_id` (`INT`), `reason` (`TEXT`), `metadata` (`JSONB`), `created_at`

### Domain 8: Favorites, Notifications & ML Behavior Logs (3 Tables)
39. **`favorite_folders`**:
    - `id` (PK), `user_id` (FK -> `users.id`), `name` (`VARCHAR(100)`), `created_at`, `updated_at`
40. **`favorite_properties`**:
    - `id` (PK), `favorite_folder_id` (FK -> `favorite_folders.id`), `user_id` (FK -> `users.id`), `property_id` (FK -> `properties.id`), `created_at`, `UNIQUE (favorite_folder_id, property_id)`
41. **`notifications`** & **`user_behaviors`** (Wait: in the 41-table count, if `report_images` or `notifications` + `user_behaviors` are counted, ensure both `notifications` and `user_behaviors` are created!):
    - **`notifications`**: `id` (PK), `user_id` (FK -> `users.id`), `type` (`VARCHAR(50)`), `title` (`VARCHAR(200)`), `message` (`TEXT`), `link` (`TEXT`), `metadata` (`JSONB`), `is_read` (`BOOLEAN DEFAULT false`), `created_at`
    - **`user_behaviors`**: `id` (PK), `user_id` (FK -> `users.id`), `property_id` (FK -> `properties.id`), `action_type` (`VARCHAR(30)` — `'view'`, `'favorite'`, `'book'`), `view_count` (`INT DEFAULT 1`), `last_interacted_at` (`TIMESTAMPTZ DEFAULT NOW()`), `created_at`, `UNIQUE (user_id, property_id, action_type)`

---

## 3. Mandatory Seed Data Checklist
Every migration/seed run must populate:
1. **`roles`**: `user`, `host`, `admin`
2. **`pet_types`**: สุนัข (Dog), แมว (Cat), กระต่าย (Rabbit), หนูแฮมสเตอร์ (Hamster), นก (Bird), สัตว์เลื้อยคลาน (Reptile)
3. **`pet_breeds`**: At least 15–20 common breeds per `pet_type` (Golden Retriever, Pomeranian, Chihuahua, French Bulldog, Shiba Inu, Persian, Scottish Fold, British Shorthair, Siamese, Maine Coon, Holland Lop, Netherland Dwarf, etc.)
4. **`pet_size_categories`**:
   - Small (`0.1` – `5.0` kg)
   - Medium (`5.1` – `15.0` kg)
   - Large (`15.1` – `30.0` kg)
   - Giant (`30.1` – `100.0` kg)
5. **`pet_energies`**: Levels 1 to 5 (1 = ชอบนอนพักผ่อน/นิ่งสงบ, 2 = ใช้พลังงานน้อย, 3 = ปานกลาง/ชอบเดินเล่นปกติ, 4 = พลังงานสูง/ชอบวิ่งเล่น, 5 = พลังงานสูงมาก/ต้องการพื้นที่กว้างและกิจกรรมตลอดวัน)
6. **`facilities`**:
   - เครื่องปรับอากาศ (Air Conditioner), กล้องวงจรปิด 24 ชม. (CCTV), พื้นที่วิ่งเล่นกลางแจ้ง (Outdoor Play Area), พื้นที่วิ่งเล่นในร่ม (Indoor Play Area), บริการอาบน้ำ-ตัดขน (Grooming), บริการรับ-ส่งสัตว์เลี้ยง (Pet Taxi), สัตวแพทย์ใกล้เคียง/คลินิกในเครือ (Nearby Vet Clinic), แยกโซนสัตว์เลี้ยงตามชนิด (Separated Pet Zones), น้ำพุแมว/น้ำกรองสะอาด (Filtered Water Fountain), รายงานรูป/วิดีโอประจำวัน (Daily Photo/Video Updates)
7. **`report_categories`**:
   - `type = 'property'`: ข้อมูลที่พักไม่ตรงปก, สถานที่ไม่ปลอดภัยต่อสัตว์เลี้ยง, พฤติกรรมเจ้าของที่พักไม่เหมาะสม, สแปมหรือหลอกลวง
   - `type = 'review'`: คำพูดหยาบคาย/คุกคาม, รีวิวเท็จ/กลั่นแกล้ง, สแปมโฆษณา
   - `type = 'unban'`: แก้ไขปัญหาตามที่ได้รับแจ้งแล้ว, ขออุทธรณ์เนื่องจากความเข้าใจผิด
8. **Demo Accounts & Realistic Thailand Properties**:
   - Admin (`admin@joodpakpaw.com`), Verified Hosts (`host1@joodpakpaw.com`, `host2@joodpakpaw.com`), Pet Owners (`user1@joodpakpaw.com`, `user2@joodpakpaw.com`) with pre-populated Pet Profiles, Properties across Bangkok/Chiang Mai/Phuket/Chonburi, Room Categories, and Reviews.
