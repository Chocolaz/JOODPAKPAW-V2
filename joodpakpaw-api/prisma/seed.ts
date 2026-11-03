import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🐾 [JoodPakPaw] Starting database seeding...');

  // ==============================================================================
  // 1. Roles
  // ==============================================================================
  console.log('➡️ Seeding Roles...');
  const roleData = [
    {
      name: 'guest',
      label: 'ผู้ใช้ทั่วไป / ผู้ฝากเลี้ยง',
      description: 'Guest / Pet Owner role',
    },
    {
      name: 'host',
      label: 'ผู้รับฝากเลี้ยง / โฮสต์',
      description: 'Host / Pet Boarding Provider role',
    },
    {
      name: 'admin',
      label: 'ผู้ดูแลระบบ',
      description: 'Platform Administrator role',
    },
  ];

  const roles: Record<string, any> = {};
  for (const r of roleData) {
    roles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: { label: r.label, description: r.description },
      create: r,
    });
  }
  console.log(`✅ Roles seeded (${Object.keys(roles).length} roles).`);

  // ==============================================================================
  // 2. Group Permissions, Permissions & Roles Permissions
  // ==============================================================================
  console.log('➡️ Seeding Group Permissions and Permissions...');
  const groups = [
    { name: 'user_management' },
    { name: 'property_management' },
    { name: 'booking_management' },
    { name: 'report_management' },
    { name: 'verification_management' },
    { name: 'system_settings' },
  ];

  const groupMap: Record<string, any> = {};
  for (const g of groups) {
    groupMap[g.name] = await prisma.groupPermission.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });
  }

  const permissionDefs = [
    { name: 'users.view', description: 'View user list and profiles', group: 'user_management' },
    { name: 'users.edit', description: 'Edit user profiles and credentials', group: 'user_management' },
    { name: 'users.ban', description: 'Ban or suspend user accounts', group: 'user_management' },
    { name: 'properties.view', description: 'View published properties', group: 'property_management' },
    { name: 'properties.create', description: 'Create and list properties', group: 'property_management' },
    { name: 'properties.edit', description: 'Edit existing properties and rooms', group: 'property_management' },
    { name: 'properties.delete', description: 'Delete property listings', group: 'property_management' },
    { name: 'properties.ban', description: 'Deactivate or ban reported properties', group: 'property_management' },
    { name: 'bookings.view', description: 'View bookings and reservation details', group: 'booking_management' },
    { name: 'bookings.create', description: 'Create room reservations', group: 'booking_management' },
    { name: 'bookings.update_status', description: 'Confirm or cancel bookings', group: 'booking_management' },
    { name: 'reports.view', description: 'View reported properties and reviews', group: 'report_management' },
    { name: 'reports.resolve', description: 'Take action on reports', group: 'report_management' },
    { name: 'verifications.view', description: 'View host KYC submissions', group: 'verification_management' },
    { name: 'verifications.review', description: 'Approve or reject host KYC', group: 'verification_management' },
    { name: 'system.settings', description: 'Manage platform settings', group: 'system_settings' },
  ];

  const permMap: Record<string, any> = {};
  for (const p of permissionDefs) {
    permMap[p.name] = await prisma.permission.upsert({
      where: { name: p.name },
      update: {
        description: p.description,
        groupPermissionId: groupMap[p.group].id,
      },
      create: {
        name: p.name,
        description: p.description,
        groupPermissionId: groupMap[p.group].id,
      },
    });
  }

  // Assign permissions to roles
  // Admin gets all
  for (const perm of Object.values(permMap)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roles['admin'].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: roles['admin'].id,
        permissionId: perm.id,
      },
    });
  }

  // Host gets property & booking management
  const hostPerms = [
    'properties.view',
    'properties.create',
    'properties.edit',
    'properties.delete',
    'bookings.view',
    'bookings.update_status',
  ];
  for (const pName of hostPerms) {
    if (permMap[pName]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['host'].id,
            permissionId: permMap[pName].id,
          },
        },
        update: {},
        create: {
          roleId: roles['host'].id,
          permissionId: permMap[pName].id,
        },
      });
    }
  }

  // Guest gets browse & booking creation
  const guestPerms = ['properties.view', 'bookings.view', 'bookings.create'];
  for (const pName of guestPerms) {
    if (permMap[pName]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['guest'].id,
            permissionId: permMap[pName].id,
          },
        },
        update: {},
        create: {
          roleId: roles['guest'].id,
          permissionId: permMap[pName].id,
        },
      });
    }
  }
  console.log(`✅ Permissions and Roles-Permissions seeded (${permissionDefs.length} permissions).`);

  // ==============================================================================
  // 3. Property Types
  // ==============================================================================
  console.log('➡️ Seeding Property Types...');
  const propertyTypesData = [
    { name: 'Pet Hotel', label: 'โรงแรมสัตว์เลี้ยง' },
    { name: 'Pet Homestay', label: 'บ้านพัก/โฮมสเตย์' },
    { name: 'Pet Condo', label: 'คอนโดสัตว์เลี้ยง' },
    { name: 'Pet Resort', label: 'รีสอร์ตสัตว์เลี้ยง' },
  ];

  const propTypeMap: Record<string, any> = {};
  for (const pt of propertyTypesData) {
    let existing = await prisma.propertyType.findFirst({
      where: { name: pt.name },
    });
    if (!existing) {
      existing = await prisma.propertyType.create({
        data: pt,
      });
    } else {
      existing = await prisma.propertyType.update({
        where: { id: existing.id },
        data: { label: pt.label },
      });
    }
    propTypeMap[pt.name] = existing;
  }
  console.log(`✅ Property Types seeded (${propertyTypesData.length} types).`);

  // ==============================================================================
  // 4. Facility Categories & Facilities
  // ==============================================================================
  console.log('➡️ Seeding Facility Categories & Facilities...');
  const facilityCategoriesData = [
    {
      name: 'Safety & Security',
      facilities: [
        'CCTV 24h',
        'Separated Zones',
        'Nearby Vet',
      ],
    },
    {
      name: 'Comfort & Environment',
      facilities: [
        'Air Conditioning',
        'Daily Updates',
      ],
    },
    {
      name: 'Services & Care',
      facilities: [
        'Grooming',
        'Pet Taxi',
      ],
    },
    {
      name: 'Play & Exercise',
      facilities: [
        'Outdoor Play Area',
        'Indoor Play Area',
      ],
    },
  ];

  const facilityMap: Record<string, any> = {};
  for (const cat of facilityCategoriesData) {
    let category = await prisma.facilityCategory.findFirst({
      where: { name: cat.name },
    });
    if (!category) {
      category = await prisma.facilityCategory.create({
        data: { name: cat.name },
      });
    }

    for (const facName of cat.facilities) {
      let fac = await prisma.facility.findFirst({
        where: { name: facName },
      });
      if (!fac) {
        fac = await prisma.facility.create({
          data: {
            name: facName,
            categoryId: category.id,
          },
        });
      } else {
        fac = await prisma.facility.update({
          where: { id: fac.id },
          data: { categoryId: category.id },
        });
      }
      facilityMap[facName] = fac;
    }
  }
  console.log(`✅ Facilities seeded (${Object.keys(facilityMap).length} facilities).`);

  // ==============================================================================
  // 5. Pet Size Categories
  // ==============================================================================
  console.log('➡️ Seeding Pet Size Categories...');
  const petSizeCategoriesData = [
    { name: 'Small (0-5 kg)', code: 1, min: 0, max: 5 },
    { name: 'Medium (5-15 kg)', code: 2, min: 5, max: 15 },
    { name: 'Large (15-30 kg)', code: 3, min: 15, max: 30 },
    { name: 'Giant (30-100 kg)', code: 4, min: 30, max: 100 },
  ];

  const petSizeMap: Record<number, any> = {};
  for (const psc of petSizeCategoriesData) {
    petSizeMap[psc.code] = await prisma.petSizeCategory.upsert({
      where: { code: psc.code },
      update: { name: psc.name, min: psc.min, max: psc.max },
      create: psc,
    });
  }
  console.log(`✅ Pet Size Categories seeded (${petSizeCategoriesData.length} sizes).`);

  // ==============================================================================
  // 6. Pets & 7. Pet Breeds (10-15 popular breeds per pet type)
  // ==============================================================================
  console.log('➡️ Seeding Pets and Pet Breeds...');
  const petsWithBreeds = [
    {
      name: 'สุนัข (Dog)',
      breeds: [
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
      ],
    },
    {
      name: 'แมว (Cat)',
      breeds: [
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
      ],
    },
    {
      name: 'กระต่าย (Rabbit)',
      breeds: [
        'Netherland Dwarf (เนเธอร์แลนด์ ดวอฟ)',
        'Holland Lop (ฮอลแลนด์ ลอป)',
        'Mini Rex (มินิเร็กซ์)',
        'Lionhead (ไลออนเฮด)',
        'English Angora (อิงลิช แองโกร่า)',
        'Dutch Rabbit (ดัตช์)',
        'Mini Lop (มินิลอป)',
        'Polish Rabbit (โปลิช)',
        'Flemish Giant (เฟลมมิช ไจแอนท์)',
        'Rex Rabbit (เร็กซ์)',
      ],
    },
    {
      name: 'หนูแฮมสเตอร์ (Hamster)',
      breeds: [
        'Syrian Hamster (แฮมสเตอร์สีทอง / ไจแอนท์)',
        'Winter White Dwarf (วินเทอร์ไวท์)',
        'Campbell Dwarf (แคมป์เบลล์)',
        'Roborovski Dwarf (โรโบรอฟสกี้)',
        'Chinese Hamster (แฮมสเตอร์จีน)',
        'European Hamster (แฮมสเตอร์ยุโรป)',
        'Golden Hamster Longhair (แฮมสเตอร์ขนยาว)',
        'Russian Dwarf (รัสเซียน ดวอฟ)',
        'Djungarian Hamster (ดจุงกาเรียน)',
        'Panda Hamster (แพนด้า แฮมสเตอร์)',
      ],
    },
    {
      name: 'นก (Bird)',
      breeds: [
        'Budgerigar / Parakeet (นกหงส์หยก)',
        'Cockatiel (นกคอกคาเทล)',
        'Lovebird (นกเลิฟเบิร์ด)',
        'African Grey Parrot (นกแก้วแอฟริกันเกรย์)',
        'Sun Conure (นกแก้วซันคอนัวร์)',
        'Green-cheeked Conure (กรีนชีค คอนัวร์)',
        'Macaw (นกแก้วมาคอว์)',
        'Cockatoo (นกกระตั้ว)',
        'Zebra Finch (นกฟินช์เจ็ดสี / ม้าลาย)',
        'Canary (นกคีรีบูน)',
      ],
    },
    {
      name: 'สัตว์เลื้อยคลาน (Reptile)',
      breeds: [
        'Bearded Dragon (มังกรเครา)',
        'Leopard Gecko (ตุ๊กแกเสือดาว)',
        'Crested Gecko (ตุ๊กแกหงอน)',
        'Ball Python (งูบอลไพธอน)',
        'Corn Snake (งูคอร์นสเนค)',
        'Red-eared Slider (เต่าแก้มแดง / ญี่ปุ่น)',
        'Sulcata Tortoise (เต่าซูลคาต้า)',
        'Russian Tortoise (เต่ารัสเซีย)',
        'Blue-tongued Skink (กิ้งก่าลิ้นน้ำเงิน)',
        'Green Iguana (อิกัวนาเขียว)',
      ],
    },
  ];

  const petMap: Record<string, any> = {};
  const breedMap: Record<string, any> = {};
  let totalBreeds = 0;

  for (const p of petsWithBreeds) {
    let pet = await prisma.pet.findFirst({
      where: { name: p.name },
    });
    if (!pet) {
      pet = await prisma.pet.create({
        data: { name: p.name },
      });
    }
    petMap[p.name] = pet;

    for (const bName of p.breeds) {
      let breed = await prisma.petBreed.findFirst({
        where: { breed: bName, petId: pet.id },
      });
      if (!breed) {
        breed = await prisma.petBreed.create({
          data: {
            breed: bName,
            petId: pet.id,
            imageUrl: null,
          },
        });
      }
      breedMap[bName] = breed;
      totalBreeds++;
    }
  }
  console.log(`✅ Pets seeded (${petsWithBreeds.length} pets) and Breeds seeded (${totalBreeds} breeds).`);

  // ==============================================================================
  // 8. Pet Profile Energies
  // ==============================================================================
  console.log('➡️ Seeding Pet Profile Energies...');
  const petEnergiesData = [
    {
      rating: 1,
      description: 'Level 1 (ชอบนอนพักผ่อน - นิ่งสงบ ต้องการการพักผ่อนเป็นส่วนใหญ่)',
    },
    {
      rating: 2,
      description: 'Level 2 (ใช้พลังงานน้อย - เดินเล่นเบาๆ ไม่ชอบกิจกรรมโลดโผน)',
    },
    {
      rating: 3,
      description: 'Level 3 (ปานกลาง - ร่าเริง ชอบเดินเล่นและเล่นของเล่นตามเวลาปกติ)',
    },
    {
      rating: 4,
      description: 'Level 4 (พลังงานสูง/ชอบวิ่งเล่น - ตื่นตัว วิ่งเล่นในสนามหญ้าบ่อยครั้ง)',
    },
    {
      rating: 5,
      description: 'Level 5 (ต้องการกิจกรรมตลอดวัน - ไฮเปอร์ แอคทีฟสูงมาก ต้องการออกกำลังกายหนัก)',
    },
  ];

  const energyMap: Record<number, any> = {};
  for (const pe of petEnergiesData) {
    let energy = await prisma.petProfileEnergy.findFirst({
      where: { rating: pe.rating },
    });
    if (!energy) {
      energy = await prisma.petProfileEnergy.create({
        data: pe,
      });
    } else {
      energy = await prisma.petProfileEnergy.update({
        where: { id: energy.id },
        data: { description: pe.description },
      });
    }
    energyMap[pe.rating] = energy;
  }
  console.log(`✅ Pet Profile Energies seeded (${petEnergiesData.length} levels).`);

  // ==============================================================================
  // 9. Report Categories
  // ==============================================================================
  console.log('➡️ Seeding Report Categories...');
  const reportCategoriesData = [
    // Property reports
    { name: 'property_hygiene', label: 'สถานที่สกปรก ไม่ถูกสุขอนามัย', type: 'property' },
    { name: 'property_fraud', label: 'ข้อมูลเท็จหรือหลอกลวง', type: 'property' },
    { name: 'property_abuse', label: 'สัตว์เลี้ยงได้รับการดูแลไม่เหมาะสมหรือทารุณกรรม', type: 'property' },
    { name: 'property_unsafe', label: 'สถานที่ไม่มีความปลอดภัยต่อสัตว์เลี้ยง', type: 'property' },
    { name: 'property_other', label: 'อื่นๆ', type: 'property' },
    // Review reports
    { name: 'review_inappropriate', label: 'ข้อความหยาบคายหรือไม่สุภาพ', type: 'review' },
    { name: 'review_defamation', label: 'ข้อมูลใส่ร้ายป้ายสี เป็นเท็จ', type: 'review' },
    { name: 'review_spam', label: 'สแปมหรือโฆษณาสินค้า', type: 'review' },
    { name: 'review_other', label: 'อื่นๆ', type: 'review' },
    // Unban appeals
    { name: 'unban_appeal_rectified', label: 'ปรับปรุงสถานที่และแก้ไขข้อบกพร่องเรียบร้อยแล้ว', type: 'unban_property' },
    { name: 'unban_appeal_misunderstanding', label: 'ข้อร้องเรียนเกิดจากความเข้าใจผิด พร้อมหลักฐาน', type: 'unban_property' },
    { name: 'unban_appeal_policy_compliance', label: 'ยินดีปฏิบัติตามกฎระเบียบของแพลตฟอร์มอย่างเคร่งครัด', type: 'unban_property' },
    { name: 'unban_appeal_other', label: 'เหตุผลอื่นๆ', type: 'unban_property' },
  ];

  const reportCategoryMap: Record<string, any> = {};
  for (const rc of reportCategoriesData) {
    let cat = await prisma.reportCategory.findFirst({
      where: { name: rc.name, type: rc.type },
    });
    if (!cat) {
      cat = await prisma.reportCategory.create({
        data: rc,
      });
    } else {
      cat = await prisma.reportCategory.update({
        where: { id: cat.id },
        data: { label: rc.label },
      });
    }
    reportCategoryMap[rc.name] = cat;
  }
  console.log(`✅ Report Categories seeded (${reportCategoriesData.length} categories).`);

  // ==============================================================================
  // 10. Notification Actions
  // ==============================================================================
  console.log('➡️ Seeding Notification Actions...');
  const notificationActions = [
    'booking_created',
    'payment_confirmed',
    'check_in_reminder',
    'check_out',
    'booking_cancelled',
    'kyc_approved',
    'kyc_rejected',
  ];

  const notifActionMap: Record<string, any> = {};
  for (const na of notificationActions) {
    notifActionMap[na] = await prisma.notificationAction.upsert({
      where: { name: na },
      update: {},
      create: { name: na },
    });
  }
  console.log(`✅ Notification Actions seeded (${notificationActions.length} actions).`);

  // ==============================================================================
  // 11. User Behavior Categories
  // ==============================================================================
  console.log('➡️ Seeding User Behavior Categories...');
  const userBehaviorCategories = ['view', 'favorite', 'book'];

  const behaviorCategoryMap: Record<string, any> = {};
  for (const ubc of userBehaviorCategories) {
    behaviorCategoryMap[ubc] = await prisma.userBehaviorCategory.upsert({
      where: { name: ubc },
      update: {},
      create: { name: ubc },
    });
  }
  console.log(`✅ User Behavior Categories seeded (${userBehaviorCategories.length} categories).`);

  // ==============================================================================
  // 12. Realistic Demo Accounts (Admin, Hosts, Guests)
  // ==============================================================================
  console.log('➡️ Seeding Realistic Demo Users...');
  const saltRounds = 10;
  const defaultPasswordHash = await bcrypt.hash('Password123!', saltRounds);

  // Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@joodpakpaw.com' },
    update: {
      firstName: 'System',
      lastName: 'Admin',
      phone: '0810000001',
      password: defaultPasswordHash,
      isVerified: true,
      isVerifiedHost: false,
    },
    create: {
      email: 'admin@joodpakpaw.com',
      firstName: 'System',
      lastName: 'Admin',
      phone: '0810000001',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      isVerified: true,
      isVerifiedHost: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: roles['admin'].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roles['admin'].id,
    },
  });

  // Host 1: Somchai PawLover
  const host1 = await prisma.user.upsert({
    where: { email: 'host1@joodpakpaw.com' },
    update: {
      firstName: 'Somchai',
      lastName: 'PawLover',
      phone: '0810000002',
      password: defaultPasswordHash,
      isVerified: true,
      isBecomeToHost: true,
      isVerifiedHost: true,
    },
    create: {
      email: 'host1@joodpakpaw.com',
      firstName: 'Somchai',
      lastName: 'PawLover',
      phone: '0810000002',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      isVerified: true,
      isBecomeToHost: true,
      isVerifiedHost: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: host1.id,
        roleId: roles['host'].id,
      },
    },
    update: {},
    create: {
      userId: host1.id,
      roleId: roles['host'].id,
    },
  });

  // Host 2: Natcha PetCare
  const host2 = await prisma.user.upsert({
    where: { email: 'host2@joodpakpaw.com' },
    update: {
      firstName: 'Natcha',
      lastName: 'PetCare',
      phone: '0810000003',
      password: defaultPasswordHash,
      isVerified: true,
      isBecomeToHost: true,
      isVerifiedHost: true,
    },
    create: {
      email: 'host2@joodpakpaw.com',
      firstName: 'Natcha',
      lastName: 'PetCare',
      phone: '0810000003',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
      isVerified: true,
      isBecomeToHost: true,
      isVerifiedHost: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: host2.id,
        roleId: roles['host'].id,
      },
    },
    update: {},
    create: {
      userId: host2.id,
      roleId: roles['host'].id,
    },
  });

  // Guest 1: Thanakorn PetFriend
  const guest1 = await prisma.user.upsert({
    where: { email: 'user1@joodpakpaw.com' },
    update: {
      firstName: 'Thanakorn',
      lastName: 'PetFriend',
      phone: '0810000004',
      password: defaultPasswordHash,
      isVerified: true,
      isVerifiedHost: false,
    },
    create: {
      email: 'user1@joodpakpaw.com',
      firstName: 'Thanakorn',
      lastName: 'PetFriend',
      phone: '0810000004',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      isVerified: true,
      isVerifiedHost: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: guest1.id,
        roleId: roles['guest'].id,
      },
    },
    update: {},
    create: {
      userId: guest1.id,
      roleId: roles['guest'].id,
    },
  });

  // Guest 2: Ploy Supaporn
  const guest2 = await prisma.user.upsert({
    where: { email: 'user2@joodpakpaw.com' },
    update: {
      firstName: 'Ploy',
      lastName: 'Supaporn',
      phone: '0810000005',
      password: defaultPasswordHash,
      isVerified: true,
      isVerifiedHost: false,
    },
    create: {
      email: 'user2@joodpakpaw.com',
      firstName: 'Ploy',
      lastName: 'Supaporn',
      phone: '0810000005',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80',
      isVerified: true,
      isVerifiedHost: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: guest2.id,
        roleId: roles['guest'].id,
      },
    },
    update: {},
    create: {
      userId: guest2.id,
      roleId: roles['guest'].id,
    },
  });

  console.log('✅ Demo Users seeded (1 Admin, 2 Verified Hosts, 2 Guests).');

  // ==============================================================================
  // 13. Pet Profiles for Guests
  // ==============================================================================
  console.log('➡️ Seeding Pet Profiles for Guests...');
  const dogPet = petMap['สุนัข (Dog)'];
  const catPet = petMap['แมว (Cat)'];
  const goldenBreed = breedMap['Golden Retriever (โกลเด้น รีทรีฟเวอร์)'];
  const scottishBreed = breedMap['Scottish Fold (สก็อตติช โฟลด์)'];
  const pomBreed = breedMap['Pomeranian (ปอมเมอเรเนียน)'];

  // Guest 1: Milo (Golden Retriever)
  let milo = await prisma.petProfile.findFirst({
    where: { name: 'Milo', guestId: guest1.id },
  });
  if (!milo) {
    milo = await prisma.petProfile.create({
      data: {
        name: 'Milo',
        guestId: guest1.id,
        petTypeId: dogPet.id,
        breedId: goldenBreed?.id ?? null,
        petSex: 'male',
        birthDate: new Date('2022-04-15T00:00:00.000Z'),
        weight: 28.5,
        petSizeCategoryId: petSizeMap[3]?.id ?? null, // Large
        petEnergyId: energyMap[4]?.id ?? null, // Level 4
        contactName: 'Thanakorn PetFriend',
        contactPhone: '0810000004',
        note: 'ชอบวิ่งเล่นลูกบอลในสนาม ทานอาหารเม็ดสูตรแซลมอน',
        image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
      },
    });
  }

  // Guest 1: Luna (Scottish Fold)
  let luna = await prisma.petProfile.findFirst({
    where: { name: 'Luna', guestId: guest1.id },
  });
  if (!luna) {
    luna = await prisma.petProfile.create({
      data: {
        name: 'Luna',
        guestId: guest1.id,
        petTypeId: catPet.id,
        breedId: scottishBreed?.id ?? null,
        petSex: 'female',
        birthDate: new Date('2023-01-10T00:00:00.000Z'),
        weight: 4.2,
        petSizeCategoryId: petSizeMap[1]?.id ?? null, // Small
        petEnergyId: energyMap[2]?.id ?? null, // Level 2
        contactName: 'Thanakorn PetFriend',
        contactPhone: '0810000004',
        note: 'ค่อนข้างขี้อาย ชอบนอนในคอนโดแมวมุมสงบ',
        image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
      },
    });
  }

  // Guest 2: Choco (Pomeranian)
  let choco = await prisma.petProfile.findFirst({
    where: { name: 'Choco', guestId: guest2.id },
  });
  if (!choco) {
    choco = await prisma.petProfile.create({
      data: {
        name: 'Choco',
        guestId: guest2.id,
        petTypeId: dogPet.id,
        breedId: pomBreed?.id ?? null,
        petSex: 'male',
        birthDate: new Date('2023-06-20T00:00:00.000Z'),
        weight: 3.5,
        petSizeCategoryId: petSizeMap[1]?.id ?? null, // Small
        petEnergyId: energyMap[3]?.id ?? null, // Level 3
        contactName: 'Ploy Supaporn',
        contactPhone: '0810000005',
        note: 'ร่าเริง ขี้อ้อน ชอบให้อุ้มและเกาคาง',
        image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
      },
    });
  }
  console.log('✅ Pet Profiles seeded (Milo, Luna, Choco).');

  // ==============================================================================
  // 14. Properties, Facilities & Room Categories for Hosts
  // ==============================================================================
  console.log('➡️ Seeding Properties, Room Categories and 60-day Calendar...');

  // Property 1: Happy Paws Resort Bangkok (Host 1)
  let prop1 = await prisma.property.findFirst({
    where: { title: 'Happy Paws Resort Bangkok', hostId: host1.id },
  });

  if (!prop1) {
    prop1 = await prisma.property.create({
      data: {
        title: 'Happy Paws Resort Bangkok',
        description: 'โรงแรมสัตว์เลี้ยงระดับพรีเมียมใจกลางสุขุมวิท พร้อมสนามหญ้าและห้องปรับอากาศ 24 ชม. ดูแลโดยผู้เชี่ยวชาญตลอดเวลา มีกล้องวงจรปิดถ่ายทอดสดให้อุ่นใจ',
        address: '128/9 สุขุมวิท ซอย 39 แขวงคลองตันเหนือ',
        subdistrict: 'คลองตันเหนือ',
        district: 'วัฒนา',
        province: 'กรุงเทพมหานคร',
        country: 'Thailand',
        zipcode: '10110',
        latitude: 13.736717,
        longitude: 100.560731,
        isActive: true,
        isBannedByAdmin: false,
        hostId: host1.id,
        propertyTypeId: propTypeMap['Pet Hotel']?.id ?? null,
        publishedAt: new Date(),
      },
    });
  }

  // Add images for Property 1
  const prop1Images = [
    'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
  ];
  for (const [idx, imgUrl] of prop1Images.entries()) {
    const existingImg = await prisma.propertyImage.findFirst({
      where: { propertyId: prop1.id, filePath: imgUrl },
    });
    if (!existingImg) {
      await prisma.propertyImage.create({
        data: {
          propertyId: prop1.id,
          filePath: imgUrl,
          fileName: `prop1_img_${idx + 1}.webp`,
          fileContentType: 'image/webp',
          fileExtensionName: '.webp',
          fileSize: 154200,
        },
      });
    }
  }

  // Attach facilities to Property 1
  const prop1Facilities = [
    'CCTV 24h',
    'Air Conditioning',
    'Outdoor Play Area',
    'Grooming',
    'Daily Updates',
  ];
  for (const fName of prop1Facilities) {
    if (facilityMap[fName]) {
      await prisma.propertyFacility.upsert({
        where: {
          propertyId_facilityId: {
            propertyId: prop1.id,
            facilityId: facilityMap[fName].id,
          },
        },
        update: {},
        create: {
          propertyId: prop1.id,
          facilityId: facilityMap[fName].id,
        },
      });
    }
  }

  // Room Category 1 for Property 1: Deluxe Dog Suite
  let room1Prop1 = await prisma.roomCategory.findFirst({
    where: { propertyId: prop1.id, name: 'Deluxe Dog Suite' },
  });
  if (!room1Prop1) {
    room1Prop1 = await prisma.roomCategory.create({
      data: {
        propertyId: prop1.id,
        name: 'Deluxe Dog Suite',
        totalRoom: 5,
        numberOfPets: 2,
        basePrice: 650.0,
        roomSizeWidth: 2.5,
        roomSizeLength: 3.0,
        roomSizeHeight: 2.5,
        petSizeCategoryId: petSizeMap[3]?.id ?? null, // Large
      },
    });
  }

  // Attach dog to room1
  await prisma.roomCategoryPet.upsert({
    where: {
      roomCategoryId_petId: {
        roomCategoryId: room1Prop1.id,
        petId: dogPet.id,
      },
    },
    update: {},
    create: {
      roomCategoryId: room1Prop1.id,
      petId: dogPet.id,
    },
  });

  // Attach facilities to room1
  for (const facName of ['Air Conditioning', 'CCTV 24h', 'Daily Updates']) {
    if (facilityMap[facName]) {
      await prisma.roomCategoryFacility.upsert({
        where: {
          roomCategoryId_facilityId: {
            roomCategoryId: room1Prop1.id,
            facilityId: facilityMap[facName].id,
          },
        },
        update: {},
        create: {
          roomCategoryId: room1Prop1.id,
          facilityId: facilityMap[facName].id,
        },
      });
    }
  }

  // Room Category 2 for Property 1: Cozy Cat Condo
  let room2Prop1 = await prisma.roomCategory.findFirst({
    where: { propertyId: prop1.id, name: 'Cozy Cat Condo' },
  });
  if (!room2Prop1) {
    room2Prop1 = await prisma.roomCategory.create({
      data: {
        propertyId: prop1.id,
        name: 'Cozy Cat Condo',
        totalRoom: 8,
        numberOfPets: 1,
        basePrice: 450.0,
        roomSizeWidth: 1.8,
        roomSizeLength: 2.0,
        roomSizeHeight: 2.4,
        petSizeCategoryId: petSizeMap[1]?.id ?? null, // Small
      },
    });
  }

  // Attach cat to room2
  await prisma.roomCategoryPet.upsert({
    where: {
      roomCategoryId_petId: {
        roomCategoryId: room2Prop1.id,
        petId: catPet.id,
      },
    },
    update: {},
    create: {
      roomCategoryId: room2Prop1.id,
      petId: catPet.id,
    },
  });

  // Attach facilities to room2
  for (const facName of ['Air Conditioning', 'Daily Updates']) {
    if (facilityMap[facName]) {
      await prisma.roomCategoryFacility.upsert({
        where: {
          roomCategoryId_facilityId: {
            roomCategoryId: room2Prop1.id,
            facilityId: facilityMap[facName].id,
          },
        },
        update: {},
        create: {
          roomCategoryId: room2Prop1.id,
          facilityId: facilityMap[facName].id,
        },
      });
    }
  }

  // Property 2: Chiang Mai Green Pet Homestay (Host 2)
  let prop2 = await prisma.property.findFirst({
    where: { title: 'Chiang Mai Green Pet Homestay', hostId: host2.id },
  });

  if (!prop2) {
    prop2 = await prisma.property.create({
      data: {
        title: 'Chiang Mai Green Pet Homestay',
        description: 'โฮมสเตย์สัตว์เลี้ยงท่ามกลางธรรมชาติเมืองเชียงใหม่ ใกล้นิมมาน สนามหญ้ากว้างขวาง บรรยากาศร่มรื่น อบอุ่นเหมือนอยู่บ้าน พร้อมผู้ดูแลตลอด 24 ชั่วโมง',
        address: '45/2 ถนนนิมมานเหมินท์ ซอย 9 ตำบลสุเทพ',
        subdistrict: 'สุเทพ',
        district: 'เมืองเชียงใหม่',
        province: 'เชียงใหม่',
        country: 'Thailand',
        zipcode: '50200',
        latitude: 18.796143,
        longitude: 98.979263,
        isActive: true,
        isBannedByAdmin: false,
        hostId: host2.id,
        propertyTypeId: propTypeMap['Pet Homestay']?.id ?? null,
        publishedAt: new Date(),
      },
    });
  }

  // Add images for Property 2
  const prop2Images = [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
  ];
  for (const [idx, imgUrl] of prop2Images.entries()) {
    const existingImg = await prisma.propertyImage.findFirst({
      where: { propertyId: prop2.id, filePath: imgUrl },
    });
    if (!existingImg) {
      await prisma.propertyImage.create({
        data: {
          propertyId: prop2.id,
          filePath: imgUrl,
          fileName: `prop2_img_${idx + 1}.webp`,
          fileContentType: 'image/webp',
          fileExtensionName: '.webp',
          fileSize: 162100,
        },
      });
    }
  }

  // Attach facilities to Property 2
  const prop2Facilities = [
    'CCTV 24h',
    'Indoor Play Area',
    'Outdoor Play Area',
    'Nearby Vet',
    'Separated Zones',
  ];
  for (const fName of prop2Facilities) {
    if (facilityMap[fName]) {
      await prisma.propertyFacility.upsert({
        where: {
          propertyId_facilityId: {
            propertyId: prop2.id,
            facilityId: facilityMap[fName].id,
          },
        },
        update: {},
        create: {
          propertyId: prop2.id,
          facilityId: facilityMap[fName].id,
        },
      });
    }
  }

  // Room Category 1 for Property 2: Garden Villa for Dogs & Cats
  let room1Prop2 = await prisma.roomCategory.findFirst({
    where: { propertyId: prop2.id, name: 'Garden Villa for Dogs & Cats' },
  });
  if (!room1Prop2) {
    room1Prop2 = await prisma.roomCategory.create({
      data: {
        propertyId: prop2.id,
        name: 'Garden Villa for Dogs & Cats',
        totalRoom: 4,
        numberOfPets: 3,
        basePrice: 850.0,
        roomSizeWidth: 3.5,
        roomSizeLength: 4.0,
        roomSizeHeight: 2.8,
        petSizeCategoryId: petSizeMap[3]?.id ?? null, // Large
      },
    });
  }

  await prisma.roomCategoryPet.upsert({
    where: {
      roomCategoryId_petId: {
        roomCategoryId: room1Prop2.id,
        petId: dogPet.id,
      },
    },
    update: {},
    create: {
      roomCategoryId: room1Prop2.id,
      petId: dogPet.id,
    },
  });

  await prisma.roomCategoryPet.upsert({
    where: {
      roomCategoryId_petId: {
        roomCategoryId: room1Prop2.id,
        petId: catPet.id,
      },
    },
    update: {},
    create: {
      roomCategoryId: room1Prop2.id,
      petId: catPet.id,
    },
  });

  for (const facName of ['CCTV 24h', 'Outdoor Play Area', 'Indoor Play Area']) {
    if (facilityMap[facName]) {
      await prisma.roomCategoryFacility.upsert({
        where: {
          roomCategoryId_facilityId: {
            roomCategoryId: room1Prop2.id,
            facilityId: facilityMap[facName].id,
          },
        },
        update: {},
        create: {
          roomCategoryId: room1Prop2.id,
          facilityId: facilityMap[facName].id,
        },
      });
    }
  }

  // Room Category 2 for Property 2: Small Pets Paradise
  let room2Prop2 = await prisma.roomCategory.findFirst({
    where: { propertyId: prop2.id, name: 'Small Pets Paradise' },
  });
  if (!room2Prop2) {
    room2Prop2 = await prisma.roomCategory.create({
      data: {
        propertyId: prop2.id,
        name: 'Small Pets Paradise',
        totalRoom: 6,
        numberOfPets: 2,
        basePrice: 300.0,
        roomSizeWidth: 1.5,
        roomSizeLength: 1.5,
        roomSizeHeight: 1.5,
        petSizeCategoryId: petSizeMap[1]?.id ?? null, // Small
      },
    });
  }

  const rabbitPet = petMap['กระต่าย (Rabbit)'];
  const hamsterPet = petMap['หนูแฮมสเตอร์ (Hamster)'];
  if (rabbitPet) {
    await prisma.roomCategoryPet.upsert({
      where: {
        roomCategoryId_petId: {
          roomCategoryId: room2Prop2.id,
          petId: rabbitPet.id,
        },
      },
      update: {},
      create: {
        roomCategoryId: room2Prop2.id,
        petId: rabbitPet.id,
      },
    });
  }
  if (hamsterPet) {
    await prisma.roomCategoryPet.upsert({
      where: {
        roomCategoryId_petId: {
          roomCategoryId: room2Prop2.id,
          petId: hamsterPet.id,
        },
      },
      update: {},
      create: {
        roomCategoryId: room2Prop2.id,
        petId: hamsterPet.id,
      },
    });
  }

  // 60-Day Calendar Availability for all 4 room categories
  console.log('📅 Generating 60-day calendar availability for all room categories...');
  const roomsToSchedule = [room1Prop1, room2Prop1, room1Prop2, room2Prop2];
  const now = new Date();
  const baseToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let totalCalendarDaysCreated = 0;
  for (const rc of roomsToSchedule) {
    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const calDate = new Date(baseToday.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      calDate.setUTCHours(0, 0, 0, 0);

      await prisma.roomCategoryCalendar.upsert({
        where: {
          roomCategoryId_date: {
            roomCategoryId: rc.id,
            date: calDate,
          },
        },
        update: {
          availableRooms: rc.totalRoom,
          unavailableRooms: 0,
        },
        create: {
          roomCategoryId: rc.id,
          date: calDate,
          availableRooms: rc.totalRoom,
          bookedRooms: 0,
          unavailableRooms: 0,
          priceAdjustment: 0,
        },
      });
      totalCalendarDaysCreated++;
    }
  }
  console.log(`✅ 60-day calendar initialized (${totalCalendarDaysCreated} date entries).`);

  // ==============================================================================
  // 15. Sample Bookings, Orders & Reviews
  // ==============================================================================
  console.log('➡️ Seeding Sample Bookings and Reviews...');

  // Booking 1: Guest 1 (Thanakorn) at Property 1 (Happy Paws Resort) with Milo
  const pastCheckIn = new Date(baseToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pastCheckOut = new Date(baseToday.getTime() - 4 * 24 * 60 * 60 * 1000);

  let booking1 = await prisma.booking.findFirst({
    where: { guestId: guest1.id, propertyId: prop1.id },
  });

  if (!booking1) {
    booking1 = await prisma.booking.create({
      data: {
        guestId: guest1.id,
        propertyId: prop1.id,
        checkInDate: pastCheckIn,
        checkOutDate: pastCheckOut,
        numberOfPets: 1,
        totalPrice: 1950.0, // 3 nights * 650
        bookingStatus: 'confirmed',
        guestNote: 'น้องไมโลชอบวิ่งเล่นตอนเช้า รบกวนพาไปเดินเล่นด้วยนะครับ',
        rating: 5,
        comment: 'ยอดเยี่ยมมากครับ ที่พักสะอาดและพี่เลี้ยงดูแลน้องดีมาก มีคลิปส่งให้ดูทุกวัน แนะนำเลยครับ!',
        successedAt: new Date(pastCheckOut.getTime() + 2 * 60 * 60 * 1000),
        confirmedAt: new Date(pastCheckIn.getTime() - 24 * 60 * 60 * 1000),
        reviewedAt: new Date(pastCheckOut.getTime() + 4 * 60 * 60 * 1000),
      },
    });

    await prisma.bookingOrder.create({
      data: {
        bookingId: booking1.id,
        propertyId: prop1.id,
        roomCategoryId: room1Prop1.id,
        checkInDate: pastCheckIn,
        checkOutDate: pastCheckOut,
        roomsBooked: 1,
        pricePerRoom: 650.0,
        totalPrice: 1950.0,
      },
    });

    await prisma.bookingPetProfile.upsert({
      where: {
        bookingId_petProfileId: {
          bookingId: booking1.id,
          petProfileId: milo.id,
        },
      },
      update: {},
      create: {
        bookingId: booking1.id,
        petProfileId: milo.id,
      },
    });
  }

  // Booking 2: Guest 2 (Ploy) at Property 2 (Chiang Mai Green Pet Homestay) with Choco
  const pastCheckIn2 = new Date(baseToday.getTime() - 10 * 24 * 60 * 60 * 1000);
  const pastCheckOut2 = new Date(baseToday.getTime() - 8 * 24 * 60 * 60 * 1000);

  let booking2 = await prisma.booking.findFirst({
    where: { guestId: guest2.id, propertyId: prop2.id },
  });

  if (!booking2) {
    booking2 = await prisma.booking.create({
      data: {
        guestId: guest2.id,
        propertyId: prop2.id,
        checkInDate: pastCheckIn2,
        checkOutDate: pastCheckOut2,
        numberOfPets: 1,
        totalPrice: 1700.0, // 2 nights * 850
        bookingStatus: 'confirmed',
        guestNote: 'น้องช็อคโก้ตัวเล็ก ขี้กลัวคนแปลกหน้านิดหน่อยค่ะ',
        rating: 5,
        comment: 'บรรยากาศดีมากๆ น้องหมาชอบวิ่งเล่นในสนามหญ้า พี่เจ้าของใจดีและอบอุ่นมากค่ะ',
        successedAt: new Date(pastCheckOut2.getTime() + 2 * 60 * 60 * 1000),
        confirmedAt: new Date(pastCheckIn2.getTime() - 24 * 60 * 60 * 1000),
        reviewedAt: new Date(pastCheckOut2.getTime() + 3 * 60 * 60 * 1000),
      },
    });

    await prisma.bookingOrder.create({
      data: {
        bookingId: booking2.id,
        propertyId: prop2.id,
        roomCategoryId: room1Prop2.id,
        checkInDate: pastCheckIn2,
        checkOutDate: pastCheckOut2,
        roomsBooked: 1,
        pricePerRoom: 850.0,
        totalPrice: 1700.0,
      },
    });

    await prisma.bookingPetProfile.upsert({
      where: {
        bookingId_petProfileId: {
          bookingId: booking2.id,
          petProfileId: choco.id,
        },
      },
      update: {},
      create: {
        bookingId: booking2.id,
        petProfileId: choco.id,
      },
    });
  }
  console.log('✅ Sample Bookings and Reviews seeded.');

  // ==============================================================================
  // 16. Favorites & ML Behaviors for Demo Users
  // ==============================================================================
  console.log('➡️ Seeding Favorites and User Behaviors...');

  // Guest 1 Favorite Folder
  let favFolder = await prisma.favoriteFolder.findFirst({
    where: { userId: guest1.id, name: 'ที่พักโปรดในกรุงเทพฯ' },
  });
  if (!favFolder) {
    favFolder = await prisma.favoriteFolder.create({
      data: {
        name: 'ที่พักโปรดในกรุงเทพฯ',
        userId: guest1.id,
      },
    });
  }

  await prisma.favoriteProperty.upsert({
    where: {
      folderId_propertyId: {
        folderId: favFolder.id,
        propertyId: prop1.id,
      },
    },
    update: {},
    create: {
      folderId: favFolder.id,
      propertyId: prop1.id,
    },
  });

  // User Behaviors for ML
  const viewBehavior = behaviorCategoryMap['view'];
  const favBehavior = behaviorCategoryMap['favorite'];
  const bookBehavior = behaviorCategoryMap['book'];

  if (viewBehavior) {
    const existingView = await prisma.userBehavior.findFirst({
      where: {
        userId: guest1.id,
        behaviorCategoryId: viewBehavior.id,
        referenceRecord: String(prop1.id),
      },
    });
    if (!existingView) {
      await prisma.userBehavior.create({
        data: {
          userId: guest1.id,
          behaviorCategoryId: viewBehavior.id,
          referenceTable: 'properties',
          referenceRecord: String(prop1.id),
        },
      });
    }
  }

  if (favBehavior) {
    const existingFav = await prisma.userBehavior.findFirst({
      where: {
        userId: guest1.id,
        behaviorCategoryId: favBehavior.id,
        referenceRecord: String(prop1.id),
      },
    });
    if (!existingFav) {
      await prisma.userBehavior.create({
        data: {
          userId: guest1.id,
          behaviorCategoryId: favBehavior.id,
          referenceTable: 'properties',
          referenceRecord: String(prop1.id),
        },
      });
    }
  }

  if (bookBehavior) {
    const existingBook = await prisma.userBehavior.findFirst({
      where: {
        userId: guest1.id,
        behaviorCategoryId: bookBehavior.id,
        referenceRecord: String(prop1.id),
      },
    });
    if (!existingBook) {
      await prisma.userBehavior.create({
        data: {
          userId: guest1.id,
          behaviorCategoryId: bookBehavior.id,
          referenceTable: 'properties',
          referenceRecord: String(prop1.id),
        },
      });
    }
  }

  // ==============================================================================
  // 17. Sample Notifications
  // ==============================================================================
  console.log('➡️ Seeding Sample Notifications...');
  const existingNotif = await prisma.notification.findFirst({
    where: { userId: guest1.id, title: 'ยินดีต้อนรับสู่ JoodPakPaw' },
  });
  if (!existingNotif) {
    await prisma.notification.create({
      data: {
        userId: guest1.id,
        roleId: roles['guest'].id,
        title: 'ยินดีต้อนรับสู่ JoodPakPaw',
        message: 'เริ่มต้นค้นหาที่พักที่อบอุ่นและปลอดภัยสำหรับสัตว์เลี้ยงที่คุณรักได้แล้ววันนี้!',
        category: 'general',
        type: 'info',
        isRead: false,
        notificationActionId: notifActionMap['booking_created']?.id ?? null,
      },
    });
  }

  console.log('🎉 [JoodPakPaw] Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ [JoodPakPaw] Error during seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
