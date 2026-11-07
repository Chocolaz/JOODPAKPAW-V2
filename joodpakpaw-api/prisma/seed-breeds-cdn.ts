import { prisma } from '../src/database/prisma';

export const breedImagesMap: Record<string, string> = {
  // Dogs
  'Golden Retriever (โกลเด้น รีทรีฟเวอร์)': 'https://images.dog.ceo/breeds/retriever-golden/n02099601_100.jpg',
  'Pomeranian (ปอมเมอเรเนียน)': 'https://images.dog.ceo/breeds/pomeranian/n02112020_1180.jpg',
  'French Bulldog (เฟรนช์ บูลด็อก)': 'https://images.dog.ceo/breeds/bulldog-french/n02108915_1275.jpg',
  'Siberian Husky (ไซบีเรียน ฮัสกี้)': 'https://images.dog.ceo/breeds/husky/n02110185_10047.jpg',
  'Poodle (พุดเดิ้ล)': 'https://images.dog.ceo/breeds/poodle-standard/n02113799_2280.jpg',
  'Pembroke Welsh Corgi (พ็อมโบรค เวลช์ คอร์กี้)': 'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_1007.jpg',
  'Shih Tzu (ชิสุ)': 'https://images.dog.ceo/breeds/shihtzu/n02086240_1001.jpg',
  'Beagle (บีเกิล)': 'https://images.dog.ceo/breeds/beagle/n02088364_11100.jpg',
  'Labrador Retriever (ลาบราดอร์ รีทรีฟเวอร์)': 'https://images.dog.ceo/breeds/labrador/n02099712_1150.jpg',
  'Chihuahua (ชิวาวา)': 'https://images.dog.ceo/breeds/chihuahua/n02085620_10074.jpg',
  'Thai Ridgeback (ไทยหลังอาน)': 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
  'Thai Bangkaew (ไทยบางแก้ว)': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80',
  'Mixed Breed (สุนัขพันธุ์ผสม)': 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&auto=format&fit=crop&q=80',
  'Other / Unknown (อื่นๆ / ไม่ทราบพันธุ์)': 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&auto=format&fit=crop&q=80',

  // Cats
  'Persian (เปอร์เซีย)': 'https://cdn2.thecatapi.com/images/3-9F9zN6G.jpg',
  'Scottish Fold (สก็อตติช โฟลด์)': 'https://cdn2.thecatapi.com/images/6f8.jpg',
  'British Shorthair (บริติช ช็อตแฮร์)': 'https://cdn2.thecatapi.com/images/0XYvRd7oD.jpg',
  'American Shorthair (อเมริกัน ช็อตแฮร์)': 'https://cdn2.thecatapi.com/images/8_d.jpg',
  'Siamese (วิเชียรมาศ / แมวไทย)': 'https://cdn2.thecatapi.com/images/ai6.jpg',
  'Maine Coon (เมนคูน)': 'https://cdn2.thecatapi.com/images/OOD3BtflZ.png',
  'Ragdoll (แร็กดอลล์)': 'https://cdn2.thecatapi.com/images/oGef4wfEb.jpg',
  'Bengal (เบงกอล)': 'https://cdn2.thecatapi.com/images/O3btzLlsO.png',
  'Sphynx (สฟิงซ์)': 'https://cdn2.thecatapi.com/images/BDb8lubpH.jpg',
  'Russian Blue (รัสเซียน บลู)': 'https://cdn2.thecatapi.com/images/Rhw-epGZw.jpg',
  'Khao Manee (ขาวมณี)': 'https://cdn2.thecatapi.com/images/B1ERTmgph.jpg',
  'Korat (โคราช / มาเลศ)': 'https://cdn2.thecatapi.com/images/DbwiefiaY.png',
  'Mixed Breed (แมวพันธุ์ผสม)': 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80',
  'Other / Unknown (แมวอื่นๆ / ไม่ทราบพันธุ์)': 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&auto=format&fit=crop&q=80',

  // Exotic
  'Holland Lop Rabbit (กระต่าย ฮอลแลนด์ ลอป)': 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400&auto=format&fit=crop&q=80',
  'Netherland Dwarf Rabbit (กระต่าย เนเธอร์แลนด์ ดวอฟ)': 'https://images.unsplash.com/photo-1591382364683-b280a677ba42?w=400&auto=format&fit=crop&q=80',
  'Syrian Hamster (แฮมสเตอร์ ไจแอนท์ / ซีเรียน)': 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400&auto=format&fit=crop&q=80',
  'Winter White Hamster (แฮมสเตอร์ วินเทอร์ไวท์)': 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400&auto=format&fit=crop&q=80',
  'Hedgehog (เม่นแคระ)': 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=400&auto=format&fit=crop&q=80',
  'Sugar Glider (ชูการ์ไรเดอร์)': 'https://images.unsplash.com/photo-1612024782955-49fae721a1d1?w=400&auto=format&fit=crop&q=80',
  'Ferret (เฟอเรท)': 'https://images.unsplash.com/photo-1615087240969-eedfa4fa6377?w=400&auto=format&fit=crop&q=80',
  'Chinchilla (ชินชิลล่า)': 'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=400&auto=format&fit=crop&q=80',
  'Guinea Pig (หนูแกสบี้)': 'https://images.unsplash.com/photo-1533514114760-4389f572ae26?w=400&auto=format&fit=crop&q=80',
  'Bearded Dragon (มังกรเครา)': 'https://images.unsplash.com/photo-1533514114760-4389f572ae26?w=400&auto=format&fit=crop&q=80',
  'Leopard Gecko (ตุ๊กแกเสือดาว)': 'https://images.unsplash.com/photo-1574063413132-355dbfd83e25?w=400&auto=format&fit=crop&q=80',
  'Tortoise / Turtle (เต่าบก / เต่าน้ำ)': 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=400&auto=format&fit=crop&q=80',
  'Parrot / Cockatiel (นกแก้ว / คอกคาเทล)': 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&auto=format&fit=crop&q=80',
  'Mixed / Other Exotic (สัตว์พิเศษอื่นๆ)': 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&auto=format&fit=crop&q=80',
};

async function seedBreedImages() {
  console.log('🐾 Seeding / Updating Pet Breeds with CDN images...');

  // 1. Ensure Exotic pet type exists in `pets` table
  let exoticPet = await prisma.pet.findFirst({
    where: {
      OR: [
        { name: { contains: 'Exotic', mode: 'insensitive' } },
        { name: { contains: 'สัตว์พิเศษ', mode: 'insensitive' } },
      ],
    },
  });

  if (!exoticPet) {
    exoticPet = await prisma.pet.create({
      data: {
        name: 'สัตว์พิเศษ (Exotic)',
      },
    });
    console.log(`Created Exotic pet type with id: ${exoticPet.id}`);
  } else {
    console.log(`Exotic pet type already exists with id: ${exoticPet.id}`);
  }

  // 2. Fetch Dog and Cat pet records
  const dogPet = await prisma.pet.findFirst({
    where: {
      OR: [
        { name: { contains: 'Dog', mode: 'insensitive' } },
        { name: { contains: 'สุนัข', mode: 'insensitive' } },
      ],
    },
  });

  const catPet = await prisma.pet.findFirst({
    where: {
      OR: [
        { name: { contains: 'Cat', mode: 'insensitive' } },
        { name: { contains: 'แมว', mode: 'insensitive' } },
      ],
    },
  });

  if (!dogPet || !catPet) {
    throw new Error('Dog or Cat pet type not found in database.');
  }

  // Helper upsert breed
  const upsertBreed = async (petId: number, breedName: string, imageUrl: string) => {
    const existing = await prisma.petBreed.findFirst({
      where: {
        petId,
        breed: breedName,
      },
    });

    if (existing) {
      await prisma.petBreed.update({
        where: { id: existing.id },
        data: { imageUrl },
      });
    } else {
      await prisma.petBreed.create({
        data: {
          breed: breedName,
          petId,
          imageUrl,
        },
      });
    }
  };

  // 3. Upsert Dog breeds
  const dogBreeds = [
    'Golden Retriever (โกลเด้น รีทรีฟเวอร์)',
    'Pomeranian (ปอมเมอเรเนียน)',
    'French Bulldog (เฟรนช์ บูลด็อก)',
    'Siberian Husky (ไซบีเรียน ฮัสกี้)',
    'Poodle (พุดเดิ้ล)',
    'Pembroke Welsh Corgi (พ็อมโบรค เวลช์ คอร์กี้)',
    'Shih Tzu (ชิสุ)',
    'Beagle (บีเกิล)',
    'Labrador Retriever (ลาบราดอร์ รีทรีฟเวอร์)',
    'Chihuahua (ชิวาวา)',
    'Thai Ridgeback (ไทยหลังอาน)',
    'Thai Bangkaew (ไทยบางแก้ว)',
    'Mixed Breed (สุนัขพันธุ์ผสม)',
    'Other / Unknown (อื่นๆ / ไม่ทราบพันธุ์)',
  ];

  for (const b of dogBreeds) {
    const img = breedImagesMap[b] || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&auto=format&fit=crop&q=80';
    await upsertBreed(dogPet.id, b, img);
  }

  // 4. Upsert Cat breeds
  const catBreeds = [
    'Persian (เปอร์เซีย)',
    'Scottish Fold (สก็อตติช โฟลด์)',
    'British Shorthair (บริติช ช็อตแฮร์)',
    'American Shorthair (อเมริกัน ช็อตแฮร์)',
    'Siamese (วิเชียรมาศ / แมวไทย)',
    'Maine Coon (เมนคูน)',
    'Ragdoll (แร็กดอลล์)',
    'Bengal (เบงกอล)',
    'Sphynx (สฟิงซ์)',
    'Russian Blue (รัสเซียน บลู)',
    'Khao Manee (ขาวมณี)',
    'Korat (โคราช / มาเลศ)',
    'Mixed Breed (แมวพันธุ์ผสม)',
    'Other / Unknown (แมวอื่นๆ / ไม่ทราบพันธุ์)',
  ];

  for (const b of catBreeds) {
    const img = breedImagesMap[b] || 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&auto=format&fit=crop&q=80';
    await upsertBreed(catPet.id, b, img);
  }

  // 5. Upsert Exotic breeds
  const exoticBreeds = [
    'Holland Lop Rabbit (กระต่าย ฮอลแลนด์ ลอป)',
    'Netherland Dwarf Rabbit (กระต่าย เนเธอร์แลนด์ ดวอฟ)',
    'Syrian Hamster (แฮมสเตอร์ ไจแอนท์ / ซีเรียน)',
    'Winter White Hamster (แฮมสเตอร์ วินเทอร์ไวท์)',
    'Hedgehog (เม่นแคระ)',
    'Sugar Glider (ชูการ์ไรเดอร์)',
    'Ferret (เฟอเรท)',
    'Chinchilla (ชินชิลล่า)',
    'Guinea Pig (หนูแกสบี้)',
    'Bearded Dragon (มังกรเครา)',
    'Leopard Gecko (ตุ๊กแกเสือดาว)',
    'Tortoise / Turtle (เต่าบก / เต่าน้ำ)',
    'Parrot / Cockatiel (นกแก้ว / คอกคาเทล)',
    'Mixed / Other Exotic (สัตว์พิเศษอื่นๆ)',
  ];

  for (const b of exoticBreeds) {
    const img = breedImagesMap[b] || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&auto=format&fit=crop&q=80';
    await upsertBreed(exoticPet.id, b, img);
  }

  console.log('✅ Successfully seeded CDN images and Exotic breeds!');
}

seedBreedImages()
  .catch((e) => {
    console.error('❌ Failed seeding breed images:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
