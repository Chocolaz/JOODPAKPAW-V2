# JoodPakPaw Hybrid ML Service Rules (`joodpakpaw-ml/AGENTS.md`)

กฎเฉพาะสำหรับเซอร์วิส **`joodpakpaw-ml`** (Python 3.11+, FastAPI, Pandas, NumPy, Scikit-Learn, SQLAlchemy, พอร์ต `5000`) โหลดควบคู่กับ `d:\Project\joodpakpaw\AGENTS.md`

## 1. Mandatory ML Pipeline Architecture
1. **Skill Reference:** อ่าน `.agents/skills/joodpakpaw-ml-hybrid/SKILL.md` ก่อนแก้ไขโมเดลหรือ Endpoint เสมอ
2. **Core Endpoints:**
   - `GET /health`: ตรวจสอบสถานะเซอร์วิส (`status: "ok"`)
   - `GET /ml/v1/status` & `POST /ml/v1/refresh`: ตรวจสอบสถานะ Snapshot Cache (TTL 60 วินาที), การเชื่อมต่อฐานข้อมูล (`db_connected`), และสั่งรีเฟรชแคช
   - `GET /ml/v1/recommend/user/{user_id}?limit=8`: แนะนำที่พักเฉพาะบุคคลด้วย **3-Stage Pet-Aware Hybrid Pipeline**
   - `GET /ml/v1/recommend/cold-start?limit=8`: แนะนำที่พักสำหรับผู้เยี่ยมชมทั่วไป (Bayesian Quality + Popularity)
   - `GET /ml/v1/recommend/similar/{property_id}?limit=8`: แนะนำที่พักใกล้เคียงแบบ Item-to-Item Cosine Similarity + Quality Prior
   - `POST /ml/v1/rank/candidates`: **Context-Aware Candidate Re-Ranking API** สำหรับจัดลำดับรายการที่พักที่ผ่านตัวกรอง (`candidate_property_ids`) จาก `GET /api/v1/properties?sortBy=recommended`

## 2. 3-Stage Hybrid & Context-Aware Ranking Rules
1. **Marketplace Safety & Exclusion Invariants:**
   - ห้ามแนะนำที่พักที่ `is_active = false`, `is_banned_by_admin = true`, `deleted_at IS NOT NULL`, หรือที่พักที่ผู้ใช้เป็นเจ้าของเอง (`host_id == user_id`) โดยเด็ดขาด
2. **Context-Aware Signals (`POST /ml/v1/rank/candidates`):**
   - หากมี `context.pet_profile_ids` ให้ใช้เฉพาะสัตว์เลี้ยงที่ผู้ใช้เลือกเดินทางในการคำนวณ Stage 1 (Pet Safety Eligibility: `all_pets` vs `partial_pets`) และ Stage 2 (Energy & Facility Compatibility)
   - หากเป็น Guest ที่ระบุ `context.pet_types`, `context.pet_size_category_id`, หรือ `context.facilities` ให้คำนวณ Ad-hoc Compatibility Boost
   - คำนวณ **Price Value Affinity ($S_{\text{budget}}$)** เมื่อระบุ `max_price`, **Geo-Proximity Decay ($S_{\text{geo}} = \exp(-d/25)$)** เมื่อระบุ `lat`/`lng`, และ **Swimming Pool / Outdoor Play Affinity** สำหรับสัตว์เลี้ยงพลังงานสูง ($\text{energy} \ge 4$)
   - ส่งคืน `match_reasons` (เหตุผลภาษาไทยที่อธิบายได้จริงบนการ์ด UI) และ `score_breakdown` เสมอ
3. **Verification Commands:**
   - รันชุดทดสอบ `.\.venv\Scripts\python.exe -m pytest -v` ใน `d:\Project\joodpakpaw\joodpakpaw-ml` ให้ผ่านครบทุกข้อ (`21/21 passed`) ก่อนส่งมอบงานให้ `qa-auditor`
