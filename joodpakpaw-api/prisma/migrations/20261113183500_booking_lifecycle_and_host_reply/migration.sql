-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "host_reply" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "host_replied_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "cancelled_by" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "cancellation_reason" VARCHAR(255);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_booking_status_check_out_date_idx" ON "bookings"("booking_status", "check_out_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_booking_status_created_at_idx" ON "bookings"("booking_status", "created_at");
