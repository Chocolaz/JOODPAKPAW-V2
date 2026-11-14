import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillAggregates() {
  console.log('🐾 [JoodPakPaw] Starting backfill of property materialized aggregates...');

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      roomCategories: {
        where: { deletedAt: null },
        select: {
          basePrice: true,
        },
      },
      bookings: {
        where: { deletedAt: null },
        select: {
          id: true,
          rating: true,
        },
      },
    },
  });

  console.log(`Found ${properties.length} properties to process.`);

  let updatedCount = 0;

  for (const property of properties) {
    // 1. Min Price
    let minPrice = 0;
    if (property.roomCategories.length > 0) {
      minPrice = Math.min(...property.roomCategories.map((rc) => Number(rc.basePrice)));
      if (!isFinite(minPrice) || minPrice < 0) minPrice = 0;
    }

    // 2. Ratings & Review Count
    const ratedBookings = property.bookings.filter(
      (b) => typeof b.rating === 'number' && b.rating > 0
    );
    const reviewCount = ratedBookings.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / reviewCount
            ).toFixed(2)
          )
        : 0;

    // 3. Booking Count
    const bookingCount = property.bookings.length;

    await prisma.property.update({
      where: { id: property.id },
      data: {
        minPrice,
        avgRating,
        reviewCount,
        bookingCount,
      },
    });

    updatedCount++;
    console.log(
      `Updated Property #${property.id} (${property.title}): minPrice=${minPrice}, avgRating=${avgRating}, reviewCount=${reviewCount}, bookingCount=${bookingCount}`
    );
  }

  console.log(`✅ [JoodPakPaw] Successfully backfilled ${updatedCount} properties.`);
}

backfillAggregates()
  .catch((err) => {
    console.error('❌ Error during backfill:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
