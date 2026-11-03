# JoodPakPaw V2 - Postman API Collection & Environment

คู่มือการใช้งาน Postman Collection สำหรับระบบ **JoodPakPaw V2 Core API**

---

## 📁 ไฟล์ที่เกี่ยวข้อง

1. **`JoodPakPaw_V2.postman_collection.json`**: Postman Collection (v2.1.0) รวม Endpoints ทั้งหมด พร้อม Test Scripts อัตโนมัติ
2. **`JoodPakPaw_Local.postman_environment.json`**: Postman Environment ตั้งค่าตัวแปร `baseUrl`, บัญชีทดสอบ Admin/Host/Guest และ Token อัตโนมัติ

---

## 🚀 วิธีนำเข้าและใช้งานใน Postman Desktop / Web

1. เปิดโปรแกรม **Postman**
2. กดปุ่ม **Import** (มุมซ้ายบน)
3. ลากไฟล์ทั้ง 2 ไฟล์นี้เข้าไป:
   - `postman/JoodPakPaw_V2.postman_collection.json`
   - `postman/JoodPakPaw_Local.postman_environment.json`
4. ที่มุมขวาบนของ Postman เลือก Environment เป็น **`JoodPakPaw V2 - Local Dev`**
5. ตรวจสอบให้แน่ใจว่า API Server ทำงานอยู่ (`cd joodpakpaw-api && npm run dev`)
6. เริ่มยิงทดสอบได้ทันที:
   - รันโฟลเดอร์ **`00 - Health & Discovery`** เพื่อเช็คระบบและฐานข้อมูล Supabase
   - รัน **`Login (Admin)`** เพื่อให้ระบบดึง `jwt_token` เก็บเข้า Environment อัตโนมัติ

---

## 🧪 การรันแบบ Command Line ด้วย Newman (ถ้าต้องการ)

หากติดตั้ง `newman` (`npm install -g newman`):
```bash
newman run postman/JoodPakPaw_V2.postman_collection.json -e postman/JoodPakPaw_Local.postman_environment.json
```
