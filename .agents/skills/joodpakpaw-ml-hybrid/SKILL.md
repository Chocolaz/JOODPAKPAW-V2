---
name: joodpakpaw-ml-hybrid
description: Specification for the JoodPakPaw V2 Hybrid Recommendation Microservice (joodpakpaw-ml using Python FastAPI, Scikit-Learn, Pandas) implementing the 3-Stage Pet-Aware Hybrid Filtering algorithm.
---

# JoodPakPaw V2 Hybrid ML Recommendation Engine (`joodpakpaw-ml-hybrid`)

Use this skill whenever building, tuning, or testing the `joodpakpaw-ml` Python FastAPI microservice (Port `5000`, compatible with Local Docker, Render Free Tier, and Hugging Face Spaces Docker Free Tier).

## 1. Architectural Overview
- **Service**: `joodpakpaw-ml` (Python 3.11+, FastAPI, Pandas, NumPy, Scikit-Learn, SQLAlchemy / psycopg2-binary).
- **Consumer**: `joodpakpaw-api` calls `joodpakpaw-ml` internally via HTTP (with a 1500ms timeout and automatic in-process fallback so the Frontend never stalls during free-tier cold start).
- **Frontend Endpoints Powered**:
  1. `GET /api/v1/properties/recommend?limit=8` -> Calls `joodpakpaw-ml` `GET /ml/v1/recommend/user/{user_id}?limit=8` (or `GET /ml/v1/recommend/cold-start?limit=8` for guests).
  2. `GET /api/v1/properties/recommend/property/:propertyId?limit=8` -> Calls `joodpakpaw-ml` `GET /ml/v1/recommend/similar/{property_id}?limit=8`.

---

## 2. Why V2 Upgrades the Original V1 Report Algorithm
In the Capstone V1 Report (Chapter 6, pp. 46–48):
- V1 used basic TF-IDF + One-Hot Encoding (`type`, `province`, `district`, `sub_district`, `pet_types`, `facilities`) and `MinMaxScaler(min_price)` with Cosine Similarity on static text/metadata.
- **V1 Limitation**: It did not filter out properties that cannot safely accept the user's actual pets (by weight/size or energy requirements), nor did it apply temporal decay to older views vs. recent bookings/favorites.

### The V2 3-Stage Pet-Aware Hybrid Recommendation Pipeline

#### Stage 1: Hard Pet-Safety Filter (Rule-Based Eligibility)
If the authenticated user has registered `pet_profiles`:
1. Extract the user's distinct `pet_type_id`s and each pet's `weight` (mapped to `pet_size_categories`).
2. Filter candidate active, non-banned properties (`is_active = true AND is_banned_by_admin = false AND deleted_at IS NULL`) to strongly prioritize properties whose `room_category_pet_types` accept the user's pet types and weight brackets.
3. If fewer than `limit` properties match all pets simultaneously, include partial matches ranked lower, followed by popular fallback properties so the response always returns up to `limit` items.

#### Stage 2: Feature Engineering & Pet-Property Compatibility Matrix
Construct feature vectors for candidate properties and user profiles:
1. **Location & Property Type Encoding**: One-Hot / TF-IDF on `province`, `district`, `sub_district`, and `property.type`.
2. **Facility & Energy Compatibility Score ($S_{\text{compat}}$)**:
   - Map user pet `energy_level` (1..5) and medical/care needs (`pet_chronic_diseases`, `pet_medications`, `social_with_pets`) against room category attributes (`walk_per_day`, `free_roam_hours`, `room_size_width * room_size_length`, `is_air_conditioned`) and property `facilities` (e.g., high-energy pets score higher on properties with Outdoor Play Area & high `walk_per_day`; pets with chronic conditions score higher on properties with CCTV & Nearby Vet Clinic; timid pets score higher on Separated Pet Zones).
3. **Price & Text Similarity ($S_{\text{content}}$)**:
   - Normalize `min_price` with `MinMaxScaler`.
   - Compute TF-IDF Cosine Similarity across property descriptions, highlights, facilities, and accepted pet types.

#### Stage 3: Behavioral Time-Decay & Bayesian Quality Prior
1. **User Behavior Weighting ($S_{\text{behavior}}$)**:
   - Query `user_behaviors` (views), `favorite_properties` (favorites), and `bookings` (completed/confirmed stays).
   - Apply exponential time-decay based on `days_elapsed` since `last_interacted_at`:
     $$w(t) = w_{\text{action}} \cdot e^{-\lambda \cdot \Delta t}$$
     where $w_{\text{book}} = 3.0$, $w_{\text{favorite}} = 2.0$, $w_{\text{view}} = 1.0 \times \ln(1 + \text{view\_count})$, and $\lambda = 0.05$ (half-life $\approx 14$ days).
   - Build the User Preference Vector as the weighted centroid of properties the user interacted with, and compute Cosine Similarity against all candidate properties.
2. **Bayesian Weighted Rating ($S_{\text{quality}}$ — Cold-Start & Quality Boost)**:
   - Compute IMDB-style Bayesian rating for every property:
     $$WR = \frac{v}{v + m} R + \frac{m}{v + m} C$$
     where $R$ = property `avg_rating`, $v$ = `review_count`, $m = 3$ (minimum review threshold), and $C$ = global mean rating across all properties.
3. **Final Hybrid Ranking Formula**:
   $$\text{Score}(u, p) = 0.40 \cdot S_{\text{content}}(u, p) + 0.30 \cdot S_{\text{compat}}(u, p) + 0.20 \cdot S_{\text{quality}}(p) + 0.10 \cdot S_{\text{popularity}}(p)$$
   - For **Cold-Start Users** (guests or new users with 0 behaviors and 0 pet profiles): rank by $0.70 \cdot S_{\text{quality}}(p) + 0.30 \cdot S_{\text{popularity}}(p)$.
   - For **Similar Properties (`/recommend/property/:propertyId`)**: rank by item-to-item Cosine Similarity ($0.75 \cdot S_{\text{content}}(p_i, p_j) + 0.25 \cdot S_{\text{quality}}(p_j)$), excluding `propertyId` itself.

---

## 3. Response Schema Contract
`joodpakpaw-ml` returns ranked property IDs and explainability scores:
```json
{
  "user_id": 12,
  "strategy": "hybrid_pet_aware_v2",
  "recommendations": [
    {
      "property_id": 5,
      "score": 0.914,
      "match_reasons": ["รองรับสุนัขขนาดกลาง", "มีพื้นที่วิ่งเล่นเหมาะกับพลังงานระดับ 4"]
    }
  ]
}
```
`joodpakpaw-api` then hydrates these `property_id`s into the exact `PropertyCardProps` / `Property` list expected by `joodpakpaw-frontend/lib/api.ts`.
