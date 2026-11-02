-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "avatar" TEXT,
    "phone" VARCHAR(20),
    "password" TEXT NOT NULL,
    "reset_password_token" TEXT,
    "reset_password_expired_at" TIMESTAMPTZ,
    "otp" VARCHAR(6),
    "otp_expired_at" TIMESTAMPTZ,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_become_to_host" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_host" BOOLEAN NOT NULL DEFAULT false,
    "is_banned_review" BOOLEAN NOT NULL DEFAULT false,
    "is_banned_all_properties" BOOLEAN NOT NULL DEFAULT false,
    "banned_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "group_permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "group_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "group_permission_id" INTEGER,
    "menu_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "roles_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "is_resubmit" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ,
    "reject_description" TEXT,
    "previous_reject_description" TEXT,
    "id_photo" TEXT NOT NULL,
    "selfie_with_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "property_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "province" VARCHAR(100),
    "district" VARCHAR(100),
    "subdistrict" VARCHAR(100),
    "country" VARCHAR(100) DEFAULT 'Thailand',
    "zipcode" VARCHAR(10),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_banned_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_banned_before_account_ban" BOOLEAN NOT NULL DEFAULT false,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ,
    "host_id" INTEGER NOT NULL,
    "property_type_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255),
    "file_path" TEXT NOT NULL,
    "file_content_type" VARCHAR(100),
    "file_extension_name" VARCHAR(50),
    "file_size" INTEGER,
    "property_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "total_room" INTEGER NOT NULL,
    "number_of_pets" INTEGER NOT NULL,
    "base_price" DECIMAL(13,2) NOT NULL,
    "room_size_width" DECIMAL(8,2),
    "room_size_length" DECIMAL(8,2),
    "room_size_height" DECIMAL(8,2),
    "property_id" INTEGER NOT NULL,
    "pet_size_category_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_category_has_facilities" (
    "room_category_id" INTEGER NOT NULL,
    "facility_id" INTEGER NOT NULL,

    CONSTRAINT "room_category_has_facilities_pkey" PRIMARY KEY ("room_category_id","facility_id")
);

-- CreateTable
CREATE TABLE "room_has_pets" (
    "room_category_id" INTEGER NOT NULL,
    "pet_id" INTEGER NOT NULL,

    CONSTRAINT "room_has_pets_pkey" PRIMARY KEY ("room_category_id","pet_id")
);

-- CreateTable
CREATE TABLE "room_category_images" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255),
    "file_path" TEXT NOT NULL,
    "file_content_type" VARCHAR(100),
    "file_extension_name" VARCHAR(50),
    "file_size" INTEGER,
    "room_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "room_category_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_category_calendars" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "available_rooms" INTEGER NOT NULL,
    "booked_rooms" INTEGER NOT NULL DEFAULT 0,
    "unavailable_rooms" INTEGER NOT NULL DEFAULT 0,
    "price_adjustment" DECIMAL(13,2) NOT NULL DEFAULT 0,
    "room_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "room_category_calendars_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_room_category_calendars_non_negative" CHECK ("available_rooms" >= 0 AND "booked_rooms" >= 0 AND "unavailable_rooms" >= 0)
);

-- CreateTable
CREATE TABLE "facility_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "facility_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties_has_facilities" (
    "property_id" INTEGER NOT NULL,
    "facility_id" INTEGER NOT NULL,

    CONSTRAINT "properties_has_facilities_pkey" PRIMARY KEY ("property_id","facility_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "number_of_pets" INTEGER DEFAULT 0,
    "total_price" DECIMAL(13,2),
    "booking_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "guest_note" VARCHAR(255),
    "payment_slip_url" TEXT,
    "rating" INTEGER,
    "comment" VARCHAR(500),
    "successed_at" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "reviewed_at" TIMESTAMPTZ,
    "guest_id" INTEGER NOT NULL,
    "property_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_orders" (
    "id" SERIAL NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "rooms_booked" INTEGER NOT NULL,
    "price_per_room" DECIMAL(13,2) NOT NULL,
    "total_price" DECIMAL(13,2) NOT NULL,
    "room_category_id" INTEGER NOT NULL,
    "property_id" INTEGER NOT NULL,
    "room_category_calendar_id" INTEGER,
    "booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "booking_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_pet_profiles" (
    "booking_id" INTEGER NOT NULL,
    "pet_profile_id" INTEGER NOT NULL,

    CONSTRAINT "booking_pet_profiles_pkey" PRIMARY KEY ("booking_id","pet_profile_id")
);

-- CreateTable
CREATE TABLE "booking_review_images" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255),
    "file_path" TEXT NOT NULL,
    "file_content_type" VARCHAR(100),
    "file_extension_name" VARCHAR(50),
    "file_size" INTEGER,
    "booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "booking_review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_size_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" INTEGER NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pet_size_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_breeds" (
    "id" SERIAL NOT NULL,
    "breed" VARCHAR(100) NOT NULL,
    "image_url" TEXT,
    "pet_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pet_breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_profile_energies" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pet_profile_energies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_profiles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "image" TEXT,
    "pet_sex" VARCHAR(20),
    "birth_date" DATE,
    "weight" DECIMAL(5,2),
    "contact_name" VARCHAR(100) NOT NULL,
    "contact_phone" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "guest_id" INTEGER NOT NULL,
    "breed_id" INTEGER,
    "pet_type_id" INTEGER NOT NULL,
    "pet_size_category_id" INTEGER,
    "pet_energy_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pet_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" SERIAL NOT NULL,
    "last_message_at" TIMESTAMPTZ,
    "participant_1_id" INTEGER NOT NULL,
    "participant_2_id" INTEGER NOT NULL,
    "last_message_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "room_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_attachments" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255),
    "file_path" TEXT NOT NULL,
    "file_content_type" VARCHAR(100),
    "file_extension_name" VARCHAR(50),
    "file_size" INTEGER,
    "message_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" VARCHAR(255) NOT NULL,
    "model_name" VARCHAR(255),
    "messages" TEXT,
    "record_id" VARCHAR(255),
    "action" VARCHAR(50),
    "old_value" TEXT,
    "new_value" TEXT,
    "edit_value" TEXT,
    "user_agent" VARCHAR(500),
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" SERIAL NOT NULL,
    "model_name" VARCHAR(255),
    "messages" TEXT,
    "record_id" VARCHAR(255),
    "action" VARCHAR(50),
    "actor_id" INTEGER,
    "target_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "label" VARCHAR(255),
    "type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "resolved_action" VARCHAR(50),
    "report_category_id" INTEGER NOT NULL,
    "property_id" INTEGER,
    "booking_id" INTEGER,
    "reporter_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_images" (
    "id" SERIAL NOT NULL,
    "file_name" VARCHAR(255),
    "file_path" TEXT NOT NULL,
    "file_content_type" VARCHAR(100),
    "file_extension_name" VARCHAR(50),
    "file_size" INTEGER,
    "report_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "report_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_folders" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "favorite_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_properties" (
    "folder_id" INTEGER NOT NULL,
    "property_id" INTEGER NOT NULL,

    CONSTRAINT "favorite_properties_pkey" PRIMARY KEY ("folder_id","property_id")
);

-- CreateTable
CREATE TABLE "notification_actions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "message" TEXT,
    "category" VARCHAR(50),
    "type" VARCHAR(50),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "reference_table" VARCHAR(100),
    "reference_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER,
    "notification_action_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_behavior_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_behavior_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_behaviors" (
    "id" SERIAL NOT NULL,
    "reference_table" VARCHAR(100) NOT NULL,
    "reference_record" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "behavior_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_behaviors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_is_verified_host_idx" ON "users"("is_verified_host");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "group_permissions_name_key" ON "group_permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "user_verifications_user_id_status_idx" ON "user_verifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "properties_host_id_idx" ON "properties"("host_id");

-- CreateIndex
CREATE INDEX "properties_property_type_id_idx" ON "properties"("property_type_id");

-- CreateIndex
CREATE INDEX "properties_province_idx" ON "properties"("province");

-- CreateIndex
CREATE INDEX "properties_district_idx" ON "properties"("district");

-- CreateIndex
CREATE INDEX "properties_is_active_idx" ON "properties"("is_active");

-- CreateIndex
CREATE INDEX "properties_is_banned_by_admin_idx" ON "properties"("is_banned_by_admin");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "properties"("deleted_at");

-- CreateIndex
CREATE INDEX "property_images_property_id_idx" ON "property_images"("property_id");

-- CreateIndex
CREATE INDEX "room_categories_property_id_idx" ON "room_categories"("property_id");

-- CreateIndex
CREATE INDEX "room_categories_pet_size_category_id_idx" ON "room_categories"("pet_size_category_id");

-- CreateIndex
CREATE INDEX "room_categories_deleted_at_idx" ON "room_categories"("deleted_at");

-- CreateIndex
CREATE INDEX "room_category_images_room_category_id_idx" ON "room_category_images"("room_category_id");

-- CreateIndex
CREATE INDEX "room_category_calendars_room_category_id_date_idx" ON "room_category_calendars"("room_category_id", "date");

-- CreateIndex
CREATE INDEX "room_category_calendars_deleted_at_idx" ON "room_category_calendars"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "room_category_calendars_room_category_id_date_key" ON "room_category_calendars"("room_category_id", "date");

-- CreateIndex
CREATE INDEX "facilities_category_id_idx" ON "facilities"("category_id");

-- CreateIndex
CREATE INDEX "bookings_guest_id_idx" ON "bookings"("guest_id");

-- CreateIndex
CREATE INDEX "bookings_property_id_idx" ON "bookings"("property_id");

-- CreateIndex
CREATE INDEX "bookings_booking_status_idx" ON "bookings"("booking_status");

-- CreateIndex
CREATE INDEX "bookings_check_in_date_check_out_date_idx" ON "bookings"("check_in_date", "check_out_date");

-- CreateIndex
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- CreateIndex
CREATE INDEX "booking_orders_booking_id_idx" ON "booking_orders"("booking_id");

-- CreateIndex
CREATE INDEX "booking_orders_room_category_id_idx" ON "booking_orders"("room_category_id");

-- CreateIndex
CREATE INDEX "booking_orders_property_id_idx" ON "booking_orders"("property_id");

-- CreateIndex
CREATE INDEX "booking_orders_deleted_at_idx" ON "booking_orders"("deleted_at");

-- CreateIndex
CREATE INDEX "booking_review_images_booking_id_idx" ON "booking_review_images"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_size_categories_code_key" ON "pet_size_categories"("code");

-- CreateIndex
CREATE INDEX "pet_breeds_pet_id_idx" ON "pet_breeds"("pet_id");

-- CreateIndex
CREATE INDEX "pet_profiles_guest_id_idx" ON "pet_profiles"("guest_id");

-- CreateIndex
CREATE INDEX "pet_profiles_pet_type_id_idx" ON "pet_profiles"("pet_type_id");

-- CreateIndex
CREATE INDEX "pet_profiles_breed_id_idx" ON "pet_profiles"("breed_id");

-- CreateIndex
CREATE INDEX "pet_profiles_pet_size_category_id_idx" ON "pet_profiles"("pet_size_category_id");

-- CreateIndex
CREATE INDEX "pet_profiles_deleted_at_idx" ON "pet_profiles"("deleted_at");

-- CreateIndex
CREATE INDEX "chat_rooms_participant_1_id_idx" ON "chat_rooms"("participant_1_id");

-- CreateIndex
CREATE INDEX "chat_rooms_participant_2_id_idx" ON "chat_rooms"("participant_2_id");

-- CreateIndex
CREATE INDEX "chat_rooms_last_message_at_idx" ON "chat_rooms"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_participant_1_id_participant_2_id_key" ON "chat_rooms"("participant_1_id", "participant_2_id");

-- CreateIndex
CREATE INDEX "chat_messages_room_id_idx" ON "chat_messages"("room_id");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "chat_message_attachments_message_id_idx" ON "chat_message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_model_name_record_id_idx" ON "audit_logs"("model_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "action_logs_actor_id_idx" ON "action_logs"("actor_id");

-- CreateIndex
CREATE INDEX "action_logs_target_id_idx" ON "action_logs"("target_id");

-- CreateIndex
CREATE INDEX "action_logs_created_at_idx" ON "action_logs"("created_at");

-- CreateIndex
CREATE INDEX "report_categories_type_idx" ON "report_categories"("type");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- CreateIndex
CREATE INDEX "reports_property_id_idx" ON "reports"("property_id");

-- CreateIndex
CREATE INDEX "reports_booking_id_idx" ON "reports"("booking_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_report_category_id_idx" ON "reports"("report_category_id");

-- CreateIndex
CREATE INDEX "reports_deleted_at_idx" ON "reports"("deleted_at");

-- CreateIndex
CREATE INDEX "report_images_report_id_idx" ON "report_images"("report_id");

-- CreateIndex
CREATE INDEX "favorite_folders_user_id_idx" ON "favorite_folders"("user_id");

-- CreateIndex
CREATE INDEX "favorite_folders_deleted_at_idx" ON "favorite_folders"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_actions_name_key" ON "notification_actions"("name");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_behavior_categories_name_key" ON "user_behavior_categories"("name");

-- CreateIndex
CREATE INDEX "user_behaviors_user_id_idx" ON "user_behaviors"("user_id");

-- CreateIndex
CREATE INDEX "user_behaviors_behavior_category_id_idx" ON "user_behaviors"("behavior_category_id");

-- CreateIndex
CREATE INDEX "user_behaviors_reference_table_idx" ON "user_behaviors"("reference_table");

-- CreateIndex
CREATE INDEX "user_behaviors_created_at_idx" ON "user_behaviors"("created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_group_permission_id_fkey" FOREIGN KEY ("group_permission_id") REFERENCES "group_permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "property_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_pet_size_category_id_fkey" FOREIGN KEY ("pet_size_category_id") REFERENCES "pet_size_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_category_has_facilities" ADD CONSTRAINT "room_category_has_facilities_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_category_has_facilities" ADD CONSTRAINT "room_category_has_facilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_has_pets" ADD CONSTRAINT "room_has_pets_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_has_pets" ADD CONSTRAINT "room_has_pets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_category_images" ADD CONSTRAINT "room_category_images_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_category_calendars" ADD CONSTRAINT "room_category_calendars_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "facility_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties_has_facilities" ADD CONSTRAINT "properties_has_facilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties_has_facilities" ADD CONSTRAINT "properties_has_facilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_room_category_id_fkey" FOREIGN KEY ("room_category_id") REFERENCES "room_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_room_category_calendar_id_fkey" FOREIGN KEY ("room_category_calendar_id") REFERENCES "room_category_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pet_profiles" ADD CONSTRAINT "booking_pet_profiles_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_pet_profiles" ADD CONSTRAINT "booking_pet_profiles_pet_profile_id_fkey" FOREIGN KEY ("pet_profile_id") REFERENCES "pet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_review_images" ADD CONSTRAINT "booking_review_images_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_breeds" ADD CONSTRAINT "pet_breeds_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_profiles" ADD CONSTRAINT "pet_profiles_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_profiles" ADD CONSTRAINT "pet_profiles_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "pet_breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_profiles" ADD CONSTRAINT "pet_profiles_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_profiles" ADD CONSTRAINT "pet_profiles_pet_size_category_id_fkey" FOREIGN KEY ("pet_size_category_id") REFERENCES "pet_size_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_profiles" ADD CONSTRAINT "pet_profiles_pet_energy_id_fkey" FOREIGN KEY ("pet_energy_id") REFERENCES "pet_profile_energies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_participant_1_id_fkey" FOREIGN KEY ("participant_1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_participant_2_id_fkey" FOREIGN KEY ("participant_2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_report_category_id_fkey" FOREIGN KEY ("report_category_id") REFERENCES "report_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_folders" ADD CONSTRAINT "favorite_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_properties" ADD CONSTRAINT "favorite_properties_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "favorite_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_properties" ADD CONSTRAINT "favorite_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_notification_action_id_fkey" FOREIGN KEY ("notification_action_id") REFERENCES "notification_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_behaviors" ADD CONSTRAINT "user_behaviors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_behaviors" ADD CONSTRAINT "user_behaviors_behavior_category_id_fkey" FOREIGN KEY ("behavior_category_id") REFERENCES "user_behavior_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

