---
name: joodpakpaw-ml-hybrid
description: Specification for the JoodPakPaw V2 Hybrid Recommendation Microservice (joodpakpaw-ml using Python FastAPI, Scikit-Learn, Pandas) implementing the 3-Stage Pet-Aware Hybrid Filtering algorithm and Context-Aware Candidate Re-Ranking API.
---

# JoodPakPaw V2 Hybrid ML Recommendation Engine (`joodpakpaw-ml-hybrid`)

Use this skill whenever building, tuning, or testing the `joodpakpaw-ml` Python FastAPI microservice (Port `5000`, compatible with Local Docker, Render Free Tier, and Hugging Face Spaces Docker Free Tier).

## 1. Architectural Overview
- **Service**: `joodpakpaw-ml` (Python 3.11+, FastAPI, Pandas, NumPy, Scikit-Learn, SQLAlchemy / psycopg2-binary).
- **Consumer**: `joodpakpaw-api` calls `joodpakpaw-ml` internally via HTTP (with a 1500ms timeout, 60s single-flight catalog cache, and automatic identical in-process fallback so the Frontend never stalls during free-tier cold start).
- **ML Endpoints Exposed (`app/main.py`)**:
  1. `GET /health` -> Returns `{ status: "ok", service: "joodpakpaw-ml" }`.
  2. `GET /ml/v1/status` & `POST /ml/v1/refresh` -> Exposes 60s in-memory catalog snapshot status, `db_connected` state, and manual cache refresh for Admin ML Inspector (`/api/v1/admin/ml/*`).
  3. `GET /ml/v1/recommend/user/{user_id}?limit=8` -> Personalized 3-Stage Pet-Aware Hybrid recommendations (`GET /api/v1/properties/recommend`).
  4. `GET /ml/v1/recommend/cold-start?limit=8` -> Guest / zero-history Bayesian quality + popularity recommendations.
  5. `GET /ml/v1/recommend/similar/{property_id}?limit=8` -> Item-to-item similar stays (`GET /api/v1/properties/recommend/property/:propertyId`).
  6. `POST /ml/v1/rank/candidates` -> **Context-Aware Candidate Re-Ranking API** (`GET /api/v1/properties?sortBy=recommended`) that re-ranks pre-filtered SQL candidate IDs using user profile + explicit active search filters.

---

## 2. The V2 3-Stage Pet-Aware Hybrid Recommendation Pipeline

### Stage 1: Hard Pet-Safety Filter & Tiered Eligibility (`all_pets` / `partial_pets` / `general`)
- Always exclude inactive, banned, soft-deleted, or self-owned properties (`is_active = true AND is_banned_by_admin = false AND deleted_at IS NULL AND host_id != user_id`).
- If the user has registered `pet_profiles` (or passed explicit `context.pet_profile_ids` in filtered search):
  1. Match each pet's `pet_type_id` and `weight` / `pet_size_category_id` against candidate properties' room categories (`room_has_pets` and `pet_size_categories` Up-to-Max-Size rule).
  2. Classify candidates into `all_pets` (accepts every traveling pet), `partial_pets` (accepts at least one pet), or `general` (fallback).
  3. Rank `all_pets` tier strictly above `partial_pets` and `general`.

### Stage 2: Feature Engineering & Pet-Property Compatibility Matrix ($S_{\text{compat}}$ & $S_{\text{content}}$)
1. **Location & Property Type Encoding**: One-Hot / TF-IDF on `province`, `district`, `subdistrict`, and `property_type`.
2. **Facility & Energy Compatibility Score ($S_{\text{compat}}$)**:
   - Map pet `energy_level` (1..5) against property facilities and room dimensions (`room_size_width * room_size_length`).
   - **Swimming Pool & Outdoor Play Affinity**: High-energy pets ($\text{energy} \ge 4$) receive an explicit compatibility boost on properties offering Swimming Pool (`สระว่ายน้ำสัตว์เลี้ยง` / `Swimming Pool`) and Outdoor Play / Yard facilities.
   - Medical/care safety facilities (`CCTV`, `Vet Care` / `ใกล้คลินิกสัตวแพทย์`, `Air Conditioning`) boost compatibility score.
3. **Price & Text Similarity ($S_{\text{content}}$)**:
   - Normalize `min_price` with `MinMaxScaler` and compute TF-IDF Cosine Similarity across property titles, descriptions, facilities, and accepted pet types.

### Stage 3: Behavioral Time-Decay & Bayesian Quality Prior ($S_{\text{behavior}}$ & $S_{\text{quality}}$)
1. **User Behavior Weighting ($S_{\text{behavior}}$)**:
   - Query `user_behaviors` (views), `favorite_properties` (favorites), and `bookings` (completed/confirmed stays).
   - Apply exponential time-decay based on `days_elapsed`:
     $$w(t) = w_{\text{action}} \cdot e^{-\lambda \cdot \Delta t}$$
     where $w_{\text{book}} = 3.0$, $w_{\text{favorite}} = 2.0$, $w_{\text{view}} = 1.0 \times \ln(1 + \text{view\_count})$, and $\lambda = 0.05$ (half-life $\approx 14$ days).
2. **Bayesian Weighted Rating ($S_{\text{quality}}$)**:
   $$WR = \frac{v}{v + m} R + \frac{m}{v + m} C$$
   where $R$ = property `avg_rating`, $v$ = `review_count`, $m = 3$, and $C$ = global mean rating.
3. **Global Feed Hybrid Formula**:
   $$\text{Score}(u, p) = 0.40 \cdot S_{\text{content}}(u, p) + 0.30 \cdot S_{\text{compat}}(u, p) + 0.20 \cdot S_{\text{quality}}(p) + 0.10 \cdot S_{\text{popularity}}(p)$$

---

## 3. Context-Aware Filtered Candidate Re-Ranking (`POST /ml/v1/rank/candidates`)

When a user filters properties on the Home page (e.g., `Under ฿800`, `Cats`, `Pool & Play`, `Chiang Mai`, specific dates, or specific traveling pets) and sorts by **Recommended (`sortBy=recommended`)**:
1. `joodpakpaw-api` executes the exact SQL availability & filter query first, then sends the matching `candidate_property_ids` (up to 200 IDs) and filter `context` to `POST /ml/v1/rank/candidates`:
   ```json
   {
     "user_id": 1,
     "candidate_property_ids": [1, 4, 7, 12],
     "context": {
       "pet_types": [1],
       "pet_size_category_id": 2,
       "pet_profile_ids": [3],
       "facilities": [5],
       "min_price": null,
       "max_price": 800,
       "check_in": "2026-12-01",
       "check_out": "2026-12-03",
       "lat": 13.7563,
       "lng": 100.5018,
       "search": "Bangkok"
     }
   }
   ```
2. **Context-Aware Scoring Adjustments**:
   - **Traveling Pet Scope (`pet_profile_ids`)**: Restricts pet compatibility evaluation strictly to the selected pet profiles rather than all pets owned by the user.
   - **Guest Filter Context (`pet_types`, `pet_size_category_id`, `facilities`)**: Evaluates pet type/size and requested facility affinity even for unauthenticated guests.
   - **Price Value Affinity ($S_{\text{budget}}$)**: When `max_price` is set, properties offering greater value headroom below `max_price` with high Bayesian quality score higher and emit explainable reason `"คุ้มค่าในงบ ฿..."`.
   - **Geo-Proximity Decay ($S_{\text{geo}}$)**: When `lat` and `lng` are provided, applies Haversine distance decay $\exp(-d / 25\text{ km})$ and emits `"ห่างจากคุณ X.X กม."`.

---

## 4. Verification & Testing
- Run the automated test suite in `d:\Project\joodpakpaw\joodpakpaw-ml`:
  ```powershell
  .\.venv\Scripts\python.exe -m pytest -v
  ```
- All 21+ unit and integration tests in `tests/test_hybrid.py` (covering 3-stage ranking, self-host exclusion, swimming pool energy affinity, and `POST /ml/v1/rank/candidates` context-aware re-ranking) must pass before handoff to `qa-auditor`.
