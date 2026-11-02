---
name: joodpakpaw-db-schema
description: Comprehensive PostgreSQL 16 database schema runbook for JoodPakPaw V2 (41 tables across 8 domains), including exact column definitions, constraints, indexes, and required lookup seed data.
---

# JoodPakPaw V2 Database Schema & Seed Runbook (`joodpakpaw-db-schema`)

Use this skill whenever designing, migrating, or querying the PostgreSQL 16 database for **JoodPakPaw** (`joodpakpaw-postgres` locally or Supabase / Neon Free Tier in cloud).

## 1. Golden Rules for Schema Design
1. **Complete 41-Table Coverage across 8 Domains**: Implement all 41 tables with exact relational integrity, indexes, and support for all Frontend TypeScript contracts in `joodpakpaw-frontend/types/*.ts`.
2. **Free-Tier Cloud Compatibility**: Connect via standard `DATABASE_URL` (supporting both Local Docker Postgres 16 and Supabase / Neon Serverless Postgres with SSL).
3. **Concurrency & Inventory Safety**:
   - `room_category_calendars` MUST have a `UNIQUE (room_category_id, date)` constraint and `CHECK (available_rooms >= 0 AND booked_rooms >= 0 AND unavailable_rooms >= 0)` so row-level locking (`SELECT ... FOR UPDATE`) cannot oversell rooms.

---

## 2. The 41 Tables by Domain (8 Domains)

### Domain 1: Users, RBAC & Host Verification (7 Tables)
1. **`users`**:
   - `id` (PK), `email` (`VARCHAR(100) UNIQUE NOT NULL`), `first_name` (`VARCHAR(100)`), `last_name` (`VARCHAR(100)`), `avatar` (`TEXT`), `phone` (`VARCHAR(20) UNIQUE`), `password` (`TEXT NOT NULL`), `reset_password_token` (`TEXT`), `reset_password_expired_at` (`TIMESTAMPTZ`), `otp` (`VARCHAR(6)`), `otp_expired_at` (`TIMESTAMPTZ`), `is_verified` (`BOOLEAN DEFAULT false`), `is_become_to_host` (`BOOLEAN DEFAULT false`), `is_verified_host` (`BOOLEAN DEFAULT false`), `is_banned_review` (`BOOLEAN DEFAULT false`), `is_banned_all_properties` (`BOOLEAN DEFAULT false`), `banned_at` (`TIMESTAMPTZ`), `created_at`, `updated_at`, `deleted_at`
2. **`roles`**:
   - `id` (PK), `name` (`VARCHAR(100) UNIQUE NOT NULL` — `'guest'`, `'host'`, `'admin'`), `label` (`VARCHAR(100)`), `description` (`TEXT`), `created_at`, `updated_at`, `deleted_at`
3. **`user_roles`**:
   - `user_id` (FK -> `users.id`), `role_id` (FK -> `roles.id`), PK (`user_id`, `role_id`)
4. **`group_permissions`**:
   - `id` (PK), `name` (`VARCHAR(100) UNIQUE NOT NULL`), `created_at`, `updated_at`
5. **`permissions`**:
   - `id` (PK), `name` (`VARCHAR(100) UNIQUE NOT NULL`), `description` (`TEXT`), `group_permission_id` (FK -> `group_permissions.id`), `menu_id` (`INT`), `created_at`, `updated_at`
6. **`roles_permissions`**:
   - `role_id` (FK -> `roles.id`), `permission_id` (FK -> `permissions.id`), PK (`role_id`, `permission_id`)
7. **`user_verifications`**:
   - `id` (PK), `user_id` (FK -> `users.id`), `status` (`VARCHAR(30) DEFAULT 'pending'` — `'pending'`, `'approved'`, `'rejected'`), `is_resubmit` (`BOOLEAN DEFAULT false`), `submitted_at` (`TIMESTAMPTZ`), `reject_description` (`TEXT`), `previous_reject_description` (`TEXT`), `id_photo` (`TEXT NOT NULL`), `selfie_with_id` (`TEXT NOT NULL`), `created_at`, `updated_at`

### Domain 2: Properties, Room Categories & Calendars (8 Tables)
8. **`property_types`**:
   - `id` (PK), `name` (`VARCHAR(100) NOT NULL`), `label` (`VARCHAR(100)`), `created_at`, `updated_at`, `deleted_at`
9. **`properties`**:
   - `id` (PK), `title` (`VARCHAR(255) NOT NULL`), `description` (`TEXT`), `address` (`TEXT`), `province` (`VARCHAR(100)`), `district` (`VARCHAR(100)`), `subdistrict` (`VARCHAR(100)`), `country` (`VARCHAR(100) DEFAULT 'Thailand'`), `zipcode` (`VARCHAR(10)`), `latitude` (`DOUBLE PRECISION`), `longitude` (`DOUBLE PRECISION`), `is_active` (`BOOLEAN DEFAULT false`), `is_banned_by_admin` (`BOOLEAN DEFAULT false`), `is_banned_before_account_ban` (`BOOLEAN DEFAULT false`), `report_count` (`INT DEFAULT 0`), `published_at` (`TIMESTAMPTZ`), `host_id` (FK -> `users.id`), `property_type_id` (FK -> `property_types.id`), `created_at`, `updated_at`, `deleted_at`
10. **`property_images`**:
    - `id` (PK), `file_name` (`VARCHAR(255)`), `file_path` (`TEXT`), `file_content_type` (`VARCHAR(100)`), `file_extension_name` (`VARCHAR(50)`), `file_size` (`INT`), `property_id` (FK -> `properties.id`), `created_at`, `updated_at`, `deleted_at`
11. **`room_categories`**:
    - `id` (PK), `name` (`VARCHAR(255)`), `total_room` (`INT NOT NULL`), `number_of_pets` (`INT NOT NULL`), `base_price` (`DECIMAL(13,2) NOT NULL`), `room_size_width` (`DECIMAL(8,2)`), `room_size_length` (`DECIMAL(8,2)`), `room_size_height` (`DECIMAL(8,2)`), `property_id` (FK -> `properties.id`), `pet_size_category_id` (FK -> `pet_size_categories.id`), `created_at`, `updated_at`, `deleted_at`
12. **`room_category_has_facilities`**:
    - `room_category_id` (FK -> `room_categories.id`), `facility_id` (FK -> `facilities.id`), PK (`room_category_id`, `facility_id`)
13. **`room_has_pets`**:
    - `room_category_id` (FK -> `room_categories.id`), `pet_id` (FK -> `pets.id`), PK (`room_category_id`, `pet_id`)
14. **`room_category_images`**:
    - `id` (PK), `file_name` (`VARCHAR(255)`), `file_path` (`TEXT`), `file_content_type` (`VARCHAR(100)`), `file_extension_name` (`VARCHAR(50)`), `file_size` (`INT`), `room_category_id` (FK -> `room_categories.id`), `created_at`, `updated_at`, `deleted_at`
15. **`room_category_calendars`**:
    - `id` (PK), `date` (`DATE NOT NULL`), `available_rooms` (`INT NOT NULL`), `booked_rooms` (`INT DEFAULT 0`), `unavailable_rooms` (`INT DEFAULT 0`), `price_adjustment` (`DECIMAL(13,2) DEFAULT 0`), `room_category_id` (FK -> `room_categories.id`), `created_at`, `updated_at`, `deleted_at`, `UNIQUE (room_category_id, date)`

### Domain 3: Facilities (3 Tables)
16. **`facility_categories`**:
    - `id` (PK), `name` (`VARCHAR(255) NOT NULL`), `created_at`, `updated_at`, `deleted_at`
17. **`facilities`**:
    - `id` (PK), `name` (`VARCHAR(100) NOT NULL`), `category_id` (FK -> `facility_categories.id`), `created_at`, `updated_at`, `deleted_at`
18. **`properties_has_facilities`**:
    - `property_id` (FK -> `properties.id`), `facility_id` (FK -> `facilities.id`), PK (`property_id`, `facility_id`)

### Domain 4: Bookings, Orders & Reviews (4 Tables)
19. **`bookings`**:
    - `id` (PK), `check_in_date` (`DATE NOT NULL`), `check_out_date` (`DATE NOT NULL`), `number_of_pets` (`INT DEFAULT 0`), `total_price` (`DECIMAL(13,2)`), `booking_status` (`VARCHAR(30) DEFAULT 'pending'`), `guest_note` (`VARCHAR(255)`), `payment_slip_url` (`TEXT`), `rating` (`INT`), `comment` (`VARCHAR(500)`), `successed_at` (`TIMESTAMPTZ`), `confirmed_at` (`TIMESTAMPTZ`), `reviewed_at` (`TIMESTAMPTZ`), `guest_id` (FK -> `users.id`), `property_id` (FK -> `properties.id`), `created_at`, `updated_at`, `deleted_at`
20. **`booking_orders`**:
    - `id` (PK), `check_in_date` (`DATE NOT NULL`), `check_out_date` (`DATE NOT NULL`), `rooms_booked` (`INT NOT NULL`), `price_per_room` (`DECIMAL(13,2) NOT NULL`), `total_price` (`DECIMAL(13,2) NOT NULL`), `room_category_id` (FK -> `room_categories.id`), `property_id` (FK -> `properties.id`), `room_category_calendar_id` (FK -> `room_category_calendars.id` NULL), `booking_id` (FK -> `bookings.id`), `created_at`, `updated_at`, `deleted_at`
21. **`booking_pet_profiles`**:
    - `booking_id` (FK -> `bookings.id`), `pet_profile_id` (FK -> `pet_profiles.id`), PK (`booking_id`, `pet_profile_id`)
22. **`booking_review_images`**:
    - `id` (PK), `file_name` (`VARCHAR(255)`), `file_path` (`TEXT`), `file_content_type` (`VARCHAR(100)`), `file_extension_name` (`VARCHAR(50)`), `file_size` (`INT`), `booking_id` (FK -> `bookings.id`), `created_at`, `updated_at`, `deleted_at`

### Domain 5: Pets, Breeds, Sizes, Energies & Pet Profiles (5 Tables)
23. **`pet_size_categories`**:
    - `id` (PK), `name` (`VARCHAR(100) NOT NULL`), `code` (`INT UNIQUE NOT NULL`), `min` (`INT NOT NULL`), `max` (`INT NOT NULL`), `created_at`, `updated_at`, `deleted_at`
24. **`pets`**:
    - `id` (PK), `name` (`VARCHAR(50) NOT NULL`), `created_at`, `updated_at`, `deleted_at`
25. **`pet_breeds`**:
    - `id` (PK), `breed` (`VARCHAR(100) NOT NULL`), `image_url` (`TEXT`), `pet_id` (FK -> `pets.id`), `created_at`, `updated_at`, `deleted_at`
26. **`pet_profile_energies`**:
    - `id` (PK), `rating` (`INT NOT NULL` 1..5), `description` (`TEXT`), `created_at`, `updated_at`
27. **`pet_profiles`**:
    - `id` (PK), `name` (`VARCHAR(100) NOT NULL`), `image` (`TEXT`), `pet_sex` (`VARCHAR(20)`), `birth_date` (`DATE`), `weight` (`DECIMAL(5,2)`), `contact_name` (`VARCHAR(100) NOT NULL`), `contact_phone` (`VARCHAR(20) NOT NULL`), `note` (`TEXT`), `guest_id` (FK -> `users.id`), `breed_id` (FK -> `pet_breeds.id`), `pet_type_id` (FK -> `pets.id`), `pet_size_category_id` (FK -> `pet_size_categories.id`), `pet_energy_id` (FK -> `pet_profile_energies.id`), `created_at`, `updated_at`, `deleted_at`

### Domain 6: Real-Time Chat (3 Tables)
28. **`chat_rooms`**:
    - `id` (PK), `last_message_at` (`TIMESTAMPTZ`), `participant_1_id` (FK -> `users.id`), `participant_2_id` (FK -> `users.id`), `last_message_id` (`INT NULL`), `created_at`, `updated_at`
29. **`chat_messages`**:
    - `id` (PK), `content` (`TEXT NOT NULL`), `is_deleted` (`BOOLEAN DEFAULT false`), `read_at` (`TIMESTAMPTZ`), `room_id` (FK -> `chat_rooms.id`), `sender_id` (FK -> `users.id`), `created_at`, `updated_at`
30. **`chat_message_attachments`**:
    - `id` (PK), `file_name` (`VARCHAR(255)`), `file_path` (`TEXT`), `file_content_type` (`VARCHAR(100)`), `file_extension_name` (`VARCHAR(50)`), `file_size` (`INT`), `message_id` (FK -> `chat_messages.id`), `created_at`, `updated_at`

### Domain 7: Reports, Audit Logs & Action Logs (5 Tables)
31. **`audit_logs`**:
    - `id` (`VARCHAR(255)` PK), `model_name` (`VARCHAR(255)`), `messages` (`TEXT`), `record_id` (`VARCHAR(255)`), `action` (`VARCHAR(50)`), `old_value` (`TEXT`), `new_value` (`TEXT`), `edit_value` (`TEXT`), `user_agent` (`VARCHAR(500)`), `user_id` (FK -> `users.id`), `created_at`, `deleted_at`
32. **`action_logs`**:
    - `id` (PK), `model_name` (`VARCHAR(255)`), `messages` (`TEXT`), `record_id` (`VARCHAR(255)`), `action` (`VARCHAR(50)`), `actor_id` (FK -> `users.id`), `target_id` (FK -> `users.id`), `created_at`, `updated_at`
33. **`report_categories`**:
    - `id` (PK), `name` (`VARCHAR(255) NOT NULL`), `label` (`VARCHAR(255)`), `type` (`VARCHAR(50) NOT NULL`), `created_at`, `updated_at`
34. **`reports`**:
    - `id` (PK), `description` (`TEXT`), `status` (`VARCHAR(30) DEFAULT 'pending'`), `admin_note` (`TEXT`), `resolved_action` (`VARCHAR(50)`), `report_category_id` (FK -> `report_categories.id`), `property_id` (FK -> `properties.id` NULL), `booking_id` (FK -> `bookings.id` NULL), `reporter_id` (FK -> `users.id`), `created_at`, `updated_at`, `deleted_at`
35. **`report_images`**:
    - `id` (PK), `file_name` (`VARCHAR(255)`), `file_path` (`TEXT`), `file_content_type` (`VARCHAR(100)`), `file_extension_name` (`VARCHAR(50)`), `file_size` (`INT`), `report_id` (FK -> `reports.id`), `created_at`, `updated_at`, `deleted_at`

### Domain 8: Favorites, Notifications & ML Behavior Logs (6 Tables)
36. **`favorite_folders`**:
    - `id` (PK), `name` (`VARCHAR(255) NOT NULL`), `user_id` (FK -> `users.id`), `created_at`, `updated_at`, `deleted_at`
37. **`favorite_properties`**:
    - `folder_id` (FK -> `favorite_folders.id`), `property_id` (FK -> `properties.id`), PK (`folder_id`, `property_id`)
38. **`notification_actions`**:
    - `id` (PK), `name` (`VARCHAR(100) UNIQUE NOT NULL`), `created_at`, `updated_at`
39. **`notifications`**:
    - `id` (PK), `title` (`VARCHAR(100) NOT NULL`), `message` (`TEXT`), `category` (`VARCHAR(50)`), `type` (`VARCHAR(50)`), `is_read` (`BOOLEAN DEFAULT false`), `reference_table` (`VARCHAR(100)`), `reference_id` (`INT`), `user_id` (FK -> `users.id`), `role_id` (FK -> `roles.id`), `notification_action_id` (FK -> `notification_actions.id`), `created_at`, `updated_at`, `deleted_at`
40. **`user_behavior_categories`**:
    - `id` (PK), `name` (`VARCHAR(100) UNIQUE NOT NULL`), `created_at`, `updated_at`
41. **`user_behaviors`**:
    - `id` (PK), `reference_table` (`VARCHAR(100) NOT NULL`), `reference_record` (`VARCHAR(255) NOT NULL`), `user_id` (FK -> `users.id`), `behavior_category_id` (FK -> `user_behavior_categories.id`), `created_at`, `updated_at`
