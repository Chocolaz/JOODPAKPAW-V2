import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export interface ThaiProvinceSeed {
  code: number;
  nameEn: string;
  nameTh: string;
}

/**
 * All 77 official Thai provinces (derived from geothai / DOPA standard codes).
 */
export const THAI_PROVINCES: ThaiProvinceSeed[] = [
  { code: 10, nameEn: 'Bangkok', nameTh: 'กรุงเทพมหานคร' },
  { code: 11, nameEn: 'Samut Prakan', nameTh: 'สมุทรปราการ' },
  { code: 12, nameEn: 'Nonthaburi', nameTh: 'นนทบุรี' },
  { code: 13, nameEn: 'Pathum Thani', nameTh: 'ปทุมธานี' },
  { code: 14, nameEn: 'Phra Nakhon Si Ayutthaya', nameTh: 'พระนครศรีอยุธยา' },
  { code: 15, nameEn: 'Ang Thong', nameTh: 'อ่างทอง' },
  { code: 16, nameEn: 'Loburi', nameTh: 'ลพบุรี' },
  { code: 17, nameEn: 'Sing Buri', nameTh: 'สิงห์บุรี' },
  { code: 18, nameEn: 'Chai Nat', nameTh: 'ชัยนาท' },
  { code: 19, nameEn: 'Saraburi', nameTh: 'สระบุรี' },
  { code: 20, nameEn: 'Chon Buri', nameTh: 'ชลบุรี' },
  { code: 21, nameEn: 'Rayong', nameTh: 'ระยอง' },
  { code: 22, nameEn: 'Chanthaburi', nameTh: 'จันทบุรี' },
  { code: 23, nameEn: 'Trat', nameTh: 'ตราด' },
  { code: 24, nameEn: 'Chachoengsao', nameTh: 'ฉะเชิงเทรา' },
  { code: 25, nameEn: 'Prachin Buri', nameTh: 'ปราจีนบุรี' },
  { code: 26, nameEn: 'Nakhon Nayok', nameTh: 'นครนายก' },
  { code: 27, nameEn: 'Sa Kaeo', nameTh: 'สระแก้ว' },
  { code: 30, nameEn: 'Nakhon Ratchasima', nameTh: 'นครราชสีมา' },
  { code: 31, nameEn: 'Buri Ram', nameTh: 'บุรีรัมย์' },
  { code: 32, nameEn: 'Surin', nameTh: 'สุรินทร์' },
  { code: 33, nameEn: 'Si Sa Ket', nameTh: 'ศรีสะเกษ' },
  { code: 34, nameEn: 'Ubon Ratchathani', nameTh: 'อุบลราชธานี' },
  { code: 35, nameEn: 'Yasothon', nameTh: 'ยโสธร' },
  { code: 36, nameEn: 'Chaiyaphum', nameTh: 'ชัยภูมิ' },
  { code: 37, nameEn: 'Amnat Charoen', nameTh: 'อำนาจเจริญ' },
  { code: 38, nameEn: 'Bueng Kan', nameTh: 'บึงกาฬ' },
  { code: 39, nameEn: 'Nong Bua Lam Phu', nameTh: 'หนองบัวลำภู' },
  { code: 40, nameEn: 'Khon Kaen', nameTh: 'ขอนแก่น' },
  { code: 41, nameEn: 'Udon Thani', nameTh: 'อุดรธานี' },
  { code: 42, nameEn: 'Loei', nameTh: 'เลย' },
  { code: 43, nameEn: 'Nong Khai', nameTh: 'หนองคาย' },
  { code: 44, nameEn: 'Maha Sarakham', nameTh: 'มหาสารคาม' },
  { code: 45, nameEn: 'Roi Et', nameTh: 'ร้อยเอ็ด' },
  { code: 46, nameEn: 'Kalasin', nameTh: 'กาฬสินธุ์' },
  { code: 47, nameEn: 'Sakon Nakhon', nameTh: 'สกลนคร' },
  { code: 48, nameEn: 'Nakhon Phanom', nameTh: 'นครพนม' },
  { code: 49, nameEn: 'Mukdahan', nameTh: 'มุกดาหาร' },
  { code: 50, nameEn: 'Chiang Mai', nameTh: 'เชียงใหม่' },
  { code: 51, nameEn: 'Lamphun', nameTh: 'ลำพูน' },
  { code: 52, nameEn: 'Lampang', nameTh: 'ลำปาง' },
  { code: 53, nameEn: 'Uttaradit', nameTh: 'อุตรดิตถ์' },
  { code: 54, nameEn: 'Phrae', nameTh: 'แพร่' },
  { code: 55, nameEn: 'Nan', nameTh: 'น่าน' },
  { code: 56, nameEn: 'Phayao', nameTh: 'พะเยา' },
  { code: 57, nameEn: 'Chiang Rai', nameTh: 'เชียงราย' },
  { code: 58, nameEn: 'Mae Hong Son', nameTh: 'แม่ฮ่องสอน' },
  { code: 60, nameEn: 'Nakhon Sawan', nameTh: 'นครสวรรค์' },
  { code: 61, nameEn: 'Uthai Thani', nameTh: 'อุทัยธานี' },
  { code: 62, nameEn: 'Kamphaeng Phet', nameTh: 'กำแพงเพชร' },
  { code: 63, nameEn: 'Tak', nameTh: 'ตาก' },
  { code: 64, nameEn: 'Sukhothai', nameTh: 'สุโขทัย' },
  { code: 65, nameEn: 'Phitsanulok', nameTh: 'พิษณุโลก' },
  { code: 66, nameEn: 'Phichit', nameTh: 'พิจิตร' },
  { code: 67, nameEn: 'Phetchabun', nameTh: 'เพชรบูรณ์' },
  { code: 70, nameEn: 'Ratchaburi', nameTh: 'ราชบุรี' },
  { code: 71, nameEn: 'Kanchanaburi', nameTh: 'กาญจนบุรี' },
  { code: 72, nameEn: 'Suphan Buri', nameTh: 'สุพรรณบุรี' },
  { code: 73, nameEn: 'Nakhon Pathom', nameTh: 'นครปฐม' },
  { code: 74, nameEn: 'Samut Sakhon', nameTh: 'สมุทรสาคร' },
  { code: 75, nameEn: 'Samut Songkhram', nameTh: 'สมุทรสงคราม' },
  { code: 76, nameEn: 'Phetchaburi', nameTh: 'เพชรบุรี' },
  { code: 77, nameEn: 'Prachuap Khiri Khan', nameTh: 'ประจวบคีรีขันธ์' },
  { code: 80, nameEn: 'Nakhon Si Thammarat', nameTh: 'นครศรีธรรมราช' },
  { code: 81, nameEn: 'Krabi', nameTh: 'กระบี่' },
  { code: 82, nameEn: 'Phangnga', nameTh: 'พังงา' },
  { code: 83, nameEn: 'Phuket', nameTh: 'ภูเก็ต' },
  { code: 84, nameEn: 'Surat Thani', nameTh: 'สุราษฎร์ธานี' },
  { code: 85, nameEn: 'Ranong', nameTh: 'ระนอง' },
  { code: 86, nameEn: 'Chumphon', nameTh: 'ชุมพร' },
  { code: 90, nameEn: 'Songkhla', nameTh: 'สงขลา' },
  { code: 91, nameEn: 'Satun', nameTh: 'สตูล' },
  { code: 92, nameEn: 'Trang', nameTh: 'ตรัง' },
  { code: 93, nameEn: 'Phatthalung', nameTh: 'พัทลุง' },
  { code: 94, nameEn: 'Pattani', nameTh: 'ปัตตานี' },
  { code: 95, nameEn: 'Yala', nameTh: 'ยะลา' },
  { code: 96, nameEn: 'Narathiwat', nameTh: 'นราธิวาส' },
];

export async function seedProvinces(prismaClient: PrismaClient): Promise<number> {
  for (const prov of THAI_PROVINCES) {
    await prismaClient.province.upsert({
      where: { code: prov.code },
      update: {
        nameEn: prov.nameEn,
        nameTh: prov.nameTh,
      },
      create: {
        code: prov.code,
        nameEn: prov.nameEn,
        nameTh: prov.nameTh,
      },
    });
  }
  return prismaClient.province.count();
}

// Allow direct CLI execution: `npx tsx prisma/seed-provinces.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  console.log('➡️ Seeding all 77 Thai provinces...');
  seedProvinces(prisma)
    .then((count) => {
      console.log(`✅ Provinces seeded successfully! Total in DB: ${count}`);
    })
    .catch((err) => {
      console.error('❌ Failed to seed provinces:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
