import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/database/prisma';

async function main() {
  console.log('🐾 [JoodPakPaw] Starting rich dataset enrichment...');

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const hostRole = await prisma.role.findFirst({ where: { name: 'host', deletedAt: null } });
  const guestRole = await prisma.role.findFirst({ where: { name: 'guest', deletedAt: null } });

  if (!hostRole || !guestRole) {
    throw new Error('Core roles missing. Run `npx prisma db seed` first.');
  }

  // Lookups
  const propTypes = await prisma.propertyType.findMany();
  const propTypeByName = Object.fromEntries(propTypes.map((t) => [t.name, t.id]));

  const facilities = await prisma.facility.findMany();
  const facByName = Object.fromEntries(facilities.map((f) => [f.name, f.id]));

  const pets = await prisma.pet.findMany();
  const findPetId = (keyword: string) =>
    pets.find((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))?.id ?? pets[0]?.id;

  const dogId = findPetId('dog');
  const catId = findPetId('cat');
  const rabbitId = findPetId('rabbit');
  const hamsterId = findPetId('hamster');
  const birdId = findPetId('bird');
  const reptileId = findPetId('reptile');

  const petSizes = await prisma.petSizeCategory.findMany({ orderBy: { id: 'asc' } });
  const sizeSmall = petSizes[0]?.id ?? 1;
  const sizeMedium = petSizes[1]?.id ?? 2;
  const sizeLarge = petSizes[2]?.id ?? 3;
  const sizeGiant = petSizes[3]?.id ?? 4;

  const energies = await prisma.petProfileEnergy.findMany({ orderBy: { rating: 'asc' } });
  const energyByLevel = Object.fromEntries(energies.map((e) => [e.rating, e.id]));

  const behaviorCats = await prisma.userBehaviorCategory.findMany();
  const behaviorByName = Object.fromEntries(behaviorCats.map((b) => [b.name, b.id]));

  // Helper: upsert user
  async function ensureUser(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    isHost: boolean;
    avatar: string;
  }) {
    let user = await prisma.user.findUnique({ where: { email: params.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          password: passwordHash,
          isVerified: true,
          isBecomeToHost: params.isHost,
          isVerifiedHost: params.isHost,
          avatar: params.avatar,
        },
      });
    }
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: params.isHost ? hostRole!.id : guestRole!.id } },
      update: {},
      create: { userId: user.id, roleId: params.isHost ? hostRole!.id : guestRole!.id },
    });
    return user;
  }

  // 1. Additional Hosts & Guests
  const host3 = await ensureUser({
    email: 'host3@joodpakpaw.com',
    firstName: 'Nattapong',
    lastName: 'VetCare',
    phone: '0810000011',
    isHost: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  });
  const host4 = await ensureUser({
    email: 'host4@joodpakpaw.com',
    firstName: 'Kanya',
    lastName: 'PawsHome',
    phone: '0810000012',
    isHost: true,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  });
  const host5 = await ensureUser({
    email: 'host5@joodpakpaw.com',
    firstName: 'Pattara',
    lastName: 'Resort',
    phone: '0810000013',
    isHost: true,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  });
  const guest3 = await ensureUser({
    email: 'user3@joodpakpaw.com',
    firstName: 'Arisa',
    lastName: 'BunnyMom',
    phone: '0810000014',
    isHost: false,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
  });
  const guest4 = await ensureUser({
    email: 'user4@joodpakpaw.com',
    firstName: 'Kittipong',
    lastName: 'DogDad',
    phone: '0810000015',
    isHost: false,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
  });

  const guest1 = await prisma.user.findUnique({ where: { email: 'user1@joodpakpaw.com' } });
  const guest2 = await prisma.user.findUnique({ where: { email: 'user2@joodpakpaw.com' } });

  // 2. Diverse Pet Profiles
  async function ensurePet(params: {
    guestId: number;
    name: string;
    petTypeId: number;
    petSex: string;
    weight: number;
    sizeId: number;
    energyLevel: number;
    note: string;
    image: string;
  }) {
    const existing = await prisma.petProfile.findFirst({
      where: { guestId: params.guestId, name: params.name },
    });
    if (existing) return existing;
    return prisma.petProfile.create({
      data: {
        guestId: params.guestId,
        name: params.name,
        petTypeId: params.petTypeId,
        petSex: params.petSex,
        birthDate: new Date('2023-05-10T00:00:00.000Z'),
        weight: params.weight,
        petSizeCategoryId: params.sizeId,
        petEnergyId: energyByLevel[params.energyLevel] ?? null,
        contactName: 'Owner',
        contactPhone: '0810000014',
        note: params.note,
        image: params.image,
      },
    });
  }

  const mochi = await ensurePet({
    guestId: guest3.id,
    name: 'Mochi',
    petTypeId: rabbitId,
    petSex: 'female',
    weight: 1.8,
    sizeId: sizeSmall,
    energyLevel: 2,
    note: 'Quiet Holland Lop rabbit, prefers calm indoor rooms with fresh hay.',
    image: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=600&q=80',
  });
  const kiwi = await ensurePet({
    guestId: guest3.id,
    name: 'Kiwi',
    petTypeId: birdId,
    petSex: 'male',
    weight: 0.12,
    sizeId: sizeSmall,
    energyLevel: 3,
    note: 'Friendly Sun Conure, enjoys morning sunlight in a secure aviary.',
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=600&q=80',
  });
  const titan = await ensurePet({
    guestId: guest4.id,
    name: 'Titan',
    petTypeId: dogId,
    petSex: 'male',
    weight: 38.0,
    sizeId: sizeGiant,
    energyLevel: 5,
    note: 'Energetic Husky who needs daily outdoor runs and cool air conditioning.',
    image: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?auto=format&fit=crop&w=600&q=80',
  });
  const bella = await ensurePet({
    guestId: guest4.id,
    name: 'Bella',
    petTypeId: catId,
    petSex: 'female',
    weight: 3.6,
    sizeId: sizeSmall,
    energyLevel: 1,
    note: 'Senior British Shorthair, requires quiet cat-only zone and daily medication.',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=600&q=80',
  });

  // 3. 10 Diverse Properties across Thailand
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const propertySpecs = [
    {
      title: 'Thonglor Luxury Pet Hotel',
      description: 'Boutique pet hotel in Thonglor featuring private suites, 24/7 CCTV, and daily photo updates.',
      address: '88 Thonglor Soi 13',
      subdistrict: 'Khlong Tan Nuea',
      district: 'Watthana',
      province: 'Bangkok',
      zipcode: '10110',
      lat: 13.7335,
      lng: 100.5812,
      hostId: host3.id,
      typeName: 'Pet Hotel',
      facilities: ['CCTV 24h', 'Air Conditioning', 'Grooming', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Thonglor Executive Dog Suite', price: 1450, totalRoom: 4, petsCount: 2, sizeId: sizeLarge, w: 3.0, l: 3.5, h: 2.8, petIds: [dogId] },
        { name: 'Thonglor Cat Sky Condo', price: 790, totalRoom: 6, petsCount: 2, sizeId: sizeSmall, w: 1.5, l: 1.8, h: 2.4, petIds: [catId] },
      ],
    },
    {
      title: 'Ari Cozy Cat & Bunny Home',
      description: 'Quiet home boarding in Ari designed exclusively for cats, rabbits, and small gentle pets.',
      address: '24 Phahonyothin Soi 7',
      subdistrict: 'Phaya Thai',
      district: 'Phaya Thai',
      province: 'Bangkok',
      zipcode: '10400',
      lat: 13.7796,
      lng: 100.5446,
      hostId: host4.id,
      typeName: 'Home Boarding',
      facilities: ['Air Conditioning', 'Separated Pet Zones', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1533738363-b7f5aef12965?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Quiet Purr Loft', price: 520, totalRoom: 5, petsCount: 2, sizeId: sizeSmall, w: 1.6, l: 2.0, h: 2.2, petIds: [catId] },
        { name: 'Bunny & Small Pet Garden Room', price: 380, totalRoom: 4, petsCount: 2, sizeId: sizeSmall, w: 1.4, l: 1.6, h: 2.0, petIds: [rabbitId, hamsterId] },
      ],
    },
    {
      title: 'Bangna Active Dog Park Resort',
      description: 'Spacious suburban resort with large fenced agility lawns for energetic medium, large, and giant breeds.',
      address: '412 Bangna-Trat Km 10',
      subdistrict: 'Bang Phli Yai',
      district: 'Bang Phli',
      province: 'Samut Prakan',
      zipcode: '10540',
      lat: 13.6435,
      lng: 100.6987,
      hostId: host5.id,
      typeName: 'Pet Resort',
      facilities: ['Outdoor Play Area', 'Air Conditioning', 'CCTV 24h', 'Swimming Pool'],
      images: [
        'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Giant Breed Villa', price: 1850, totalRoom: 3, petsCount: 2, sizeId: sizeGiant, w: 4.0, l: 4.5, h: 3.0, petIds: [dogId] },
        { name: 'Active Runner Cabin', price: 950, totalRoom: 6, petsCount: 2, sizeId: sizeLarge, w: 2.8, l: 3.2, h: 2.6, petIds: [dogId] },
      ],
    },
    {
      title: 'Rama 9 Vet & Senior Pet Care',
      description: 'Veterinarian-supervised boarding for senior pets, post-surgery recovery, and pets needing daily medication.',
      address: '99 Rama 9 Road',
      subdistrict: 'Huai Khwang',
      district: 'Huai Khwang',
      province: 'Bangkok',
      zipcode: '10310',
      lat: 13.7568,
      lng: 100.5699,
      hostId: host3.id,
      typeName: 'Vet Care & Boarding',
      facilities: ['Nearby Vet Clinic', 'CCTV 24h', 'Air Conditioning', 'Separated Pet Zones', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Medical Care Dog Room', price: 1600, totalRoom: 4, petsCount: 1, sizeId: sizeLarge, w: 2.4, l: 2.8, h: 2.5, petIds: [dogId] },
        { name: 'Senior Cat Quiet Ward', price: 1100, totalRoom: 4, petsCount: 1, sizeId: sizeSmall, w: 1.5, l: 2.0, h: 2.3, petIds: [catId] },
      ],
    },
    {
      title: 'Nimman Exotic & Avian Sanctuary',
      description: 'Specialized indoor sanctuary in Chiang Mai for birds, rabbits, hamsters, and reptiles with climate control.',
      address: '15 Nimmanhaemin Soi 9',
      subdistrict: 'Suthep',
      district: 'Mueang Chiang Mai',
      province: 'Chiang Mai',
      zipcode: '50200',
      lat: 18.7971,
      lng: 98.9675,
      hostId: host4.id,
      typeName: 'Home Boarding',
      facilities: ['Air Conditioning', 'Separated Pet Zones', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Sunlit Aviary Suite', price: 480, totalRoom: 5, petsCount: 2, sizeId: sizeSmall, w: 1.4, l: 1.8, h: 2.4, petIds: [birdId] },
        { name: 'Exotic Climate Terrarium Bay', price: 550, totalRoom: 4, petsCount: 2, sizeId: sizeSmall, w: 1.2, l: 1.5, h: 2.0, petIds: [rabbitId, hamsterId, reptileId] },
      ],
    },
    {
      title: 'Hang Dong Mountain Pet Camp',
      description: 'Peaceful countryside pet resort in Chiang Mai surrounded by greenery and shaded walking trails.',
      address: '77 Moo 4 Hang Dong',
      subdistrict: 'Ban Waen',
      district: 'Hang Dong',
      province: 'Chiang Mai',
      zipcode: '50230',
      lat: 18.6865,
      lng: 98.9182,
      hostId: host5.id,
      typeName: 'Pet Resort',
      facilities: ['Outdoor Play Area', 'Grooming', 'Daily Updates', 'CCTV 24h'],
      images: [
        'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Meadow Dog Bungalow', price: 780, totalRoom: 5, petsCount: 2, sizeId: sizeLarge, w: 3.0, l: 3.2, h: 2.7, petIds: [dogId] },
      ],
    },
    {
      title: 'Phuket Rawai Tropical Pet Villa',
      description: 'Breezy tropical pet boarding near Rawai Beach with indoor AC rooms and supervised pool sessions.',
      address: '54/2 Viset Road',
      subdistrict: 'Rawai',
      district: 'Mueang Phuket',
      province: 'Phuket',
      zipcode: '83130',
      lat: 7.7796,
      lng: 98.3256,
      hostId: host5.id,
      typeName: 'Pet Resort',
      facilities: ['Swimming Pool', 'Air Conditioning', 'Outdoor Play Area', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Tropical Poolside Dog Suite', price: 1350, totalRoom: 4, petsCount: 2, sizeId: sizeLarge, w: 2.8, l: 3.0, h: 2.6, petIds: [dogId] },
        { name: 'Island Cat Bungalow', price: 690, totalRoom: 4, petsCount: 2, sizeId: sizeSmall, w: 1.6, l: 1.8, h: 2.2, petIds: [catId] },
      ],
    },
    {
      title: 'Pattaya Seaside Paws Inn',
      description: 'Clean, modern pet hotel in North Pattaya ideal for weekend travelers with dogs or cats.',
      address: '108 Pattaya Klang',
      subdistrict: 'Nong Prue',
      district: 'Bang Lamung',
      province: 'Chonburi',
      zipcode: '20150',
      lat: 12.9367,
      lng: 100.8925,
      hostId: host3.id,
      typeName: 'Pet Hotel',
      facilities: ['CCTV 24h', 'Air Conditioning', 'Grooming'],
      images: [
        'https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Standard Small Dog Room', price: 590, totalRoom: 6, petsCount: 2, sizeId: sizeMedium, w: 1.8, l: 2.2, h: 2.4, petIds: [dogId] },
        { name: 'Cozy Cat Cabin', price: 490, totalRoom: 6, petsCount: 2, sizeId: sizeSmall, w: 1.4, l: 1.6, h: 2.2, petIds: [catId] },
      ],
    },
    {
      title: 'Hua Hin Breeze Pet Retreat',
      description: 'Calm beachfront-style home boarding in Hua Hin with fenced garden and gentle caregiver attention.',
      address: '33 Phetkasem Soi 75',
      subdistrict: 'Hua Hin',
      district: 'Hua Hin',
      province: 'Prachuap Khiri Khan',
      zipcode: '77110',
      lat: 12.5684,
      lng: 99.9577,
      hostId: host4.id,
      typeName: 'Home Boarding',
      facilities: ['Outdoor Play Area', 'Air Conditioning', 'Daily Updates'],
      images: [
        'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Garden Veranda Room', price: 890, totalRoom: 3, petsCount: 2, sizeId: sizeMedium, w: 2.2, l: 2.6, h: 2.5, petIds: [dogId, catId] },
      ],
    },
    {
      title: 'Pak Kret Budget Friendly Pet Stay',
      description: 'Affordable, spotless family-run pet boarding in Nonthaburi welcoming dogs, cats, and rabbits.',
      address: '61 Chaeng Watthana Soi 28',
      subdistrict: 'Bang Talat',
      district: 'Pak Kret',
      province: 'Nonthaburi',
      zipcode: '11120',
      lat: 13.9041,
      lng: 100.5284,
      hostId: host4.id,
      typeName: 'Home Boarding',
      facilities: ['Air Conditioning', 'Separated Pet Zones'],
      images: [
        'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80',
      ],
      rooms: [
        { name: 'Value Small Pet Room', price: 420, totalRoom: 5, petsCount: 2, sizeId: sizeSmall, w: 1.5, l: 1.8, h: 2.2, petIds: [dogId, catId, rabbitId] },
      ],
    },
  ];

  const createdProps: Array<{ id: number; title: string; minRoomId: number; minPrice: number }> = [];

  for (const spec of propertySpecs) {
    let prop = await prisma.property.findFirst({ where: { title: spec.title } });
    if (!prop) {
      prop = await prisma.property.create({
        data: {
          title: spec.title,
          description: spec.description,
          address: spec.address,
          subdistrict: spec.subdistrict,
          district: spec.district,
          province: spec.province,
          country: 'Thailand',
          zipcode: spec.zipcode,
          latitude: spec.lat,
          longitude: spec.lng,
          isActive: true,
          isBannedByAdmin: false,
          hostId: spec.hostId,
          propertyTypeId: propTypeByName[spec.typeName] ?? null,
          publishedAt: new Date(),
        },
      });
    }

    for (const [idx, url] of spec.images.entries()) {
      const exists = await prisma.propertyImage.findFirst({ where: { propertyId: prop.id, filePath: url } });
      if (!exists) {
        await prisma.propertyImage.create({
          data: {
            propertyId: prop.id,
            filePath: url,
            fileName: `prop_${prop.id}_${idx + 1}.webp`,
            fileContentType: 'image/webp',
            fileExtensionName: '.webp',
            fileSize: 120000,
          },
        });
      }
    }

    for (const fName of spec.facilities) {
      const fId = facByName[fName];
      if (fId) {
        await prisma.propertyFacility.upsert({
          where: { propertyId_facilityId: { propertyId: prop.id, facilityId: fId } },
          update: {},
          create: { propertyId: prop.id, facilityId: fId },
        });
      }
    }

    let firstRoomId = 0;
    let minPrice = Number.MAX_SAFE_INTEGER;

    for (const rSpec of spec.rooms) {
      let room = await prisma.roomCategory.findFirst({
        where: { propertyId: prop.id, name: rSpec.name },
      });
      if (!room) {
        room = await prisma.roomCategory.create({
          data: {
            propertyId: prop.id,
            name: rSpec.name,
            totalRoom: rSpec.totalRoom,
            numberOfPets: rSpec.petsCount,
            basePrice: rSpec.price,
            roomSizeWidth: rSpec.w,
            roomSizeLength: rSpec.l,
            roomSizeHeight: rSpec.h,
            petSizeCategoryId: rSpec.sizeId,
          },
        });
      }
      if (!firstRoomId) firstRoomId = room.id;
      if (rSpec.price < minPrice) minPrice = rSpec.price;

      for (const pId of rSpec.petIds) {
        if (pId) {
          await prisma.roomCategoryPet.upsert({
            where: { roomCategoryId_petId: { roomCategoryId: room.id, petId: pId } },
            update: {},
            create: { roomCategoryId: room.id, petId: pId },
          });
        }
      }

      // 60-day calendar (single batch query with skipDuplicates)
      const calendarRows = Array.from({ length: 60 }, (_, d) => ({
        roomCategoryId: room.id,
        date: new Date(today.getTime() + d * 86400000),
        availableRooms: rSpec.totalRoom,
        bookedRooms: 0,
        unavailableRooms: 0,
        priceAdjustment: 0,
      }));
      await prisma.roomCategoryCalendar.createMany({
        data: calendarRows,
        skipDuplicates: true,
      });
    }

    await prisma.property.update({
      where: { id: prop.id },
      data: { minPrice: minPrice === Number.MAX_SAFE_INTEGER ? null : minPrice },
    });

    createdProps.push({ id: prop.id, title: prop.title, minRoomId: firstRoomId, minPrice });
  }

  // 4. Reviewed Successful Bookings (diverse ratings for Bayesian & Discovery)
  const reviewSamples = [
    { idx: 0, guest: guest4, pet: titan, rating: 5, comment: 'Spotless suites and live CCTV gave me total peace of mind!', daysAgo: 5 },
    { idx: 0, guest: guest1, pet: bella, rating: 5, comment: 'Super attentive staff and daily video updates.', daysAgo: 12 },
    { idx: 1, guest: guest3, pet: mochi, rating: 5, comment: 'Mochi was so relaxed in the quiet room. Best rabbit sitter in Bangkok!', daysAgo: 4 },
    { idx: 2, guest: guest4, pet: titan, rating: 5, comment: 'Huge outdoor field! Titan came home happily exhausted.', daysAgo: 8 },
    { idx: 3, guest: guest4, pet: bella, rating: 5, comment: 'Having vet supervision for Bella’s daily meds was priceless.', daysAgo: 6 },
    { idx: 4, guest: guest3, pet: kiwi, rating: 4.5, comment: 'Great climate control and safe aviary setup for Kiwi.', daysAgo: 10 },
    { idx: 5, guest: guest2, pet: null, rating: 4.5, comment: 'Peaceful mountain air and lovely walking trails.', daysAgo: 15 },
    { idx: 6, guest: guest4, pet: titan, rating: 5, comment: 'Supervised pool time was the highlight of our Phuket trip!', daysAgo: 9 },
    { idx: 7, guest: guest1, pet: null, rating: 4, comment: 'Convenient Pattaya location and clean AC rooms.', daysAgo: 18 },
    { idx: 8, guest: guest2, pet: null, rating: 4.5, comment: 'Cozy garden veranda and very warm hospitality.', daysAgo: 7 },
    { idx: 9, guest: guest3, pet: mochi, rating: 4, comment: 'Great value for money and friendly hosts.', daysAgo: 20 },
  ];

  for (const rs of reviewSamples) {
    const p = createdProps[rs.idx];
    if (!p || !rs.guest) continue;
    const existing = await prisma.booking.findFirst({
      where: { guestId: rs.guest.id, propertyId: p.id, bookingStatus: 'successful' },
    });
    if (!existing) {
      const checkIn = new Date(today.getTime() - (rs.daysAgo + 2) * 86400000);
      const checkOut = new Date(today.getTime() - rs.daysAgo * 86400000);
      const created = await prisma.booking.create({
        data: {
          guestId: rs.guest.id,
          propertyId: p.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfPets: 1,
          totalPrice: p.minPrice * 2,
          bookingStatus: 'successful',
          rating: rs.rating,
          comment: rs.comment,
          confirmedAt: new Date(checkIn.getTime() - 86400000),
          successedAt: checkOut,
          reviewedAt: new Date(checkOut.getTime() + 3600000),
        },
      });
      await prisma.bookingOrder.create({
        data: {
          bookingId: created.id,
          propertyId: p.id,
          roomCategoryId: p.minRoomId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          roomsBooked: 1,
          pricePerRoom: p.minPrice,
          totalPrice: p.minPrice * 2,
        },
      });
      if (rs.pet) {
        await prisma.bookingPetProfile.upsert({
          where: { bookingId_petProfileId: { bookingId: created.id, petProfileId: rs.pet.id } },
          update: {},
          create: { bookingId: created.id, petProfileId: rs.pet.id },
        });
      }
    }
  }

  // Sync property aggregates (avgRating, reviewCount, bookingCount)
  for (const p of createdProps) {
    const agg = await prisma.booking.aggregate({
      where: { propertyId: p.id, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const bCount = await prisma.booking.count({
      where: { propertyId: p.id, bookingStatus: { in: ['confirmed', 'successful'] } },
    });
    await prisma.property.update({
      where: { id: p.id },
      data: {
        avgRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
        reviewCount: agg._count.rating,
        bookingCount: bCount,
      },
    });
  }

  // 5. Rich User Behaviors (views, favorites, books) for ML Time-Decay
  const viewId = behaviorByName['view'];
  const favId = behaviorByName['favorite'];
  const bookId = behaviorByName['book'];

  const behaviorSeeds = [
    { user: guest1, propIdx: 0, catId: viewId },
    { user: guest1, propIdx: 2, catId: viewId },
    { user: guest1, propIdx: 3, catId: favId },
    { user: guest3, propIdx: 1, catId: bookId },
    { user: guest3, propIdx: 4, catId: favId },
    { user: guest3, propIdx: 9, catId: viewId },
    { user: guest4, propIdx: 2, catId: bookId },
    { user: guest4, propIdx: 6, catId: bookId },
    { user: guest4, propIdx: 0, catId: favId },
  ];

  for (const bs of behaviorSeeds) {
    const p = createdProps[bs.propIdx];
    if (!bs.user || !p || !bs.catId) continue;
    const exists = await prisma.userBehavior.findFirst({
      where: { userId: bs.user.id, behaviorCategoryId: bs.catId, referenceRecord: String(p.id) },
    });
    if (!exists) {
      await prisma.userBehavior.create({
        data: {
          userId: bs.user.id,
          behaviorCategoryId: bs.catId,
          referenceTable: 'properties',
          referenceRecord: String(p.id),
        },
      });
    }
  }

  console.log(`✅ Rich dataset seeded: +${createdProps.length} diverse properties across Thailand, pets, bookings, reviews, and ML behavior signals.`);
}

main()
  .catch((err) => {
    console.error('❌ Error seeding rich data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
