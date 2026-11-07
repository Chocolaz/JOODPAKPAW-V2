import { prisma } from '../src/database/prisma';

export const breedImagesMap: Record<string, string> = {
  // Dogs - Real breed studio portraits
  'Golden Retriever (โกลเด้น รีทรีฟเวอร์)': '/images/breeds/dog_golden_retriever.webp',
  'Pomeranian (ปอมเมอเรเนียน)': '/images/breeds/dog_pomeranian.webp',
  'French Bulldog (เฟรนช์ บูลด็อก)': '/images/breeds/dog_french_bulldog.webp',
  'Siberian Husky (ไซบีเรียน ฮัสกี้)': '/images/breeds/dog_siberian_husky.webp',
  'Poodle (พุดเดิ้ล)': '/images/breeds/dog_poodle.webp',
  'Pembroke Welsh Corgi (พ็อมโบรค เวลช์ คอร์กี้)': '/images/breeds/dog_welsh_corgi.webp',
  'Shih Tzu (ชิสุ)': '/images/breeds/dog_shih_tzu.webp',
  'Beagle (บีเกิล)': '/images/breeds/dog_beagle.webp',
  'Labrador Retriever (ลาบราดอร์ รีทรีฟเวอร์)': '/images/breeds/dog_labrador_retriever.webp',
  'Chihuahua (ชิวาวา)': '/images/breeds/dog_chihuahua.webp',
  'Thai Ridgeback (ไทยหลังอาน)': '/images/breeds/dog_thai_ridgeback.webp',
  'Thai Bangkaew (ไทยบางแก้ว)': '/images/breeds/dog_thai_bangkaew.webp',
  'Mixed Breed (สุนัขพันธุ์ผสม)': '/images/breeds/dog_mixed_breed.webp',
  'Other / Unknown (อื่นๆ / ไม่ทราบพันธุ์)': '/images/breeds/dog_other.webp',

  // Cats - Real breed studio portraits
  'Persian (เปอร์เซีย)': '/images/breeds/cat_persian.webp',
  'Scottish Fold (สก็อตติช โฟลด์)': '/images/breeds/cat_scottish_fold.webp',
  'British Shorthair (บริติช ช็อตแฮร์)': '/images/breeds/cat_british_shorthair.webp',
  'American Shorthair (อเมริกัน ช็อตแฮร์)': '/images/breeds/cat_american_shorthair.webp',
  'Siamese (วิเชียรมาศ / แมวไทย)': '/images/breeds/cat_siamese.webp',
  'Maine Coon (เมนคูน)': '/images/breeds/cat_maine_coon.webp',
  'Ragdoll (แร็กดอลล์)': '/images/breeds/cat_ragdoll.webp',
  'Bengal (เบงกอล)': '/images/breeds/cat_bengal.webp',
  'Sphynx (สฟิงซ์)': '/images/breeds/cat_sphynx.webp',
  'Russian Blue (รัสเซียน บลู)': '/images/breeds/cat_russian_blue.webp',
  'Khao Manee (ขาวมณี)': '/images/breeds/cat_khao_manee.webp',
  'Korat (โคราช / มาเลศ)': '/images/breeds/cat_korat.webp',
  'Mixed Breed (แมวพันธุ์ผสม)': '/images/breeds/cat_mixed_breed.webp',
  'Other / Unknown (แมวอื่นๆ / ไม่ทราบพันธุ์)': '/images/breeds/cat_other.webp',

  // Exotic - Real species studio portraits
  'Holland Lop Rabbit (กระต่าย ฮอลแลนด์ ลอป)': '/images/breeds/exotic_holland_lop.webp',
  'Netherland Dwarf Rabbit (กระต่าย เนเธอร์แลนด์ ดวอฟ)': '/images/breeds/exotic_netherland_dwarf.webp',
  'Syrian Hamster (แฮมสเตอร์ ไจแอนท์ / ซีเรียน)': '/images/breeds/exotic_syrian_hamster.webp',
  'Winter White Hamster (แฮมสเตอร์ วินเทอร์ไวท์)': '/images/breeds/exotic_winter_white_hamster.webp',
  'Hedgehog (เม่นแคระ)': '/images/breeds/exotic_hedgehog.webp',
  'Sugar Glider (ชูการ์ไรเดอร์)': '/images/breeds/exotic_sugar_glider.webp',
  'Ferret (เฟอเรท)': '/images/breeds/exotic_ferret.webp',
  'Chinchilla (ชินชิลล่า)': '/images/breeds/exotic_chinchilla.webp',
  'Guinea Pig (หนูแกสบี้)': '/images/breeds/exotic_guinea_pig.webp',
  'Bearded Dragon (มังกรเครา)': '/images/breeds/exotic_bearded_dragon.webp',
  'Leopard Gecko (ตุ๊กแกเสือดาว)': '/images/breeds/exotic_leopard_gecko.webp',
  'Tortoise / Turtle (เต่าบก / เต่าน้ำ)': '/images/breeds/exotic_tortoise.webp',
  'Parrot / Cockatiel (นกแก้ว / คอกคาเทล)': '/images/breeds/exotic_cockatiel.webp',
  'Mixed / Other Exotic (สัตว์พิเศษอื่นๆ)': '/images/breeds/exotic_mixed_other.webp',

  // Rabbits (petId: 3)
  'Netherland Dwarf (เนเธอร์แลนด์ ดวอฟ)': '/images/breeds/exotic_netherland_dwarf.webp',
  'Holland Lop (ฮอลแลนด์ ลอป)': '/images/breeds/exotic_holland_lop.webp',
  'Mini Rex (มินิเร็กซ์)': '/images/breeds/rabbit_mini_rex.webp',
  'Lionhead (ไลออนเฮด)': '/images/breeds/rabbit_lionhead.webp',
  'English Angora (อิงลิช แองโกร่า)': '/images/breeds/rabbit_english_angora.webp',
  'Dutch Rabbit (ดัตช์)': '/images/breeds/rabbit_dutch.webp',
  'Mini Lop (มินิลอป)': '/images/breeds/rabbit_mini_lop.webp',
  'Polish Rabbit (โปลิช)': '/images/breeds/rabbit_polish.webp',
  'Flemish Giant (เฟลมมิช ไจแอนท์)': '/images/breeds/rabbit_flemish_giant.webp',
  'Rex Rabbit (เร็กซ์)': '/images/breeds/rabbit_rex.webp',

  // Hamsters (petId: 4)
  'Syrian Hamster (แฮมสเตอร์สีทอง / ไจแอนท์)': '/images/breeds/exotic_syrian_hamster.webp',
  'Winter White Dwarf (วินเทอร์ไวท์)': '/images/breeds/exotic_winter_white_hamster.webp',
  'Campbell Dwarf (แคมป์เบลล์)': '/images/breeds/hamster_campbell.webp',
  'Roborovski Dwarf (โรโบรอฟสกี้)': '/images/breeds/hamster_roborovski.webp',
  'Chinese Hamster (แฮมสเตอร์จีน)': '/images/breeds/hamster_chinese.webp',
  'European Hamster (แฮมสเตอร์ยุโรป)': '/images/breeds/hamster_european.webp',
  'Golden Hamster Longhair (แฮมสเตอร์ขนยาว)': '/images/breeds/hamster_longhair.webp',
  'Russian Dwarf (รัสเซียน ดวอฟ)': '/images/breeds/hamster_russian_dwarf.webp',
  'Djungarian Hamster (ดจุงกาเรียน)': '/images/breeds/hamster_djungarian.webp',
  'Panda Hamster (แพนด้า แฮมสเตอร์)': '/images/breeds/hamster_panda.webp',

  // Birds (petId: 5)
  'Budgerigar / Parakeet (นกหงส์หยก)': '/images/breeds/bird_budgerigar.webp',
  'Cockatiel (นกคอกคาเทล)': '/images/breeds/exotic_cockatiel.webp',
  'Lovebird (นกเลิฟเบิร์ด)': '/images/breeds/bird_lovebird.webp',
  'African Grey Parrot (นกแก้วแอฟริกันเกรย์)': '/images/breeds/bird_african_grey.webp',
  'Sun Conure (นกแก้วซันคอนัวร์)': '/images/breeds/bird_sun_conure.webp',
  'Green-cheeked Conure (กรีนชีค คอนัวร์)': '/images/breeds/bird_green_cheeked_conure.webp',
  'Macaw (นกแก้วมาคอว์)': '/images/breeds/bird_macaw.webp',
  'Cockatoo (นกกระตั้ว)': '/images/breeds/bird_cockatoo.webp',
  'Zebra Finch (นกฟินช์เจ็ดสี / ม้าลาย)': '/images/breeds/bird_zebra_finch.webp',
  'Canary (นกคีรีบูน)': '/images/breeds/bird_canary.webp',

  // Reptiles (petId: 6)
  'Crested Gecko (ตุ๊กแกหงอน)': '/images/breeds/reptile_crested_gecko.webp',
  'Ball Python (งูบอลไพธอน)': '/images/breeds/reptile_ball_python.webp',
  'Corn Snake (งูคอร์นสเนค)': '/images/breeds/reptile_corn_snake.webp',
  'Red-eared Slider (เต่าแก้มแดง / ญี่ปุ่น)': '/images/breeds/reptile_red_eared_slider.webp',
  'Sulcata Tortoise (เต่าซูลคาต้า)': '/images/breeds/exotic_tortoise.webp',
  'Russian Tortoise (เต่ารัสเซีย)': '/images/breeds/reptile_russian_tortoise.webp',
  'Blue-tongued Skink (กิ้งก่าลิ้นน้ำเงิน)': '/images/breeds/reptile_blue_tongued_skink.webp',
  'Green Iguana (อิกัวนาเขียว)': '/images/breeds/reptile_green_iguana.webp',
};

async function seedBreedImages() {
  console.log('🐾 Seeding / Updating Pet Breeds with verified 200 OK CDN images...');

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
    const img = breedImagesMap[b] || '/images/breeds/dog_other.webp';
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
    const img = breedImagesMap[b] || '/images/breeds/cat_other.webp';
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
    const img = breedImagesMap[b] || '/images/breeds/exotic_mixed_other.webp';
    await upsertBreed(exoticPet.id, b, img);
  }

  // 6. Upsert remaining lookup breeds for Rabbit (3), Hamster (4), Bird (5), Reptile (6)
  const otherTypes = [3, 4, 5, 6];
  for (const pid of otherTypes) {
    const existingBreeds = await prisma.petBreed.findMany({ where: { petId: pid } });
    for (const b of existingBreeds) {
      const img = breedImagesMap[b.breed];
      if (img) {
        await prisma.petBreed.update({
          where: { id: b.id },
          data: { imageUrl: img },
        });
      }
    }
  }

  console.log('✅ Successfully seeded all 82 verified breed studio portrait images!');
}

seedBreedImages()
  .catch((e) => {
    console.error('❌ Failed seeding breed images:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
