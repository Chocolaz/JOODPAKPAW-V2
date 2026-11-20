from __future__ import annotations

import math
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, sanitize_database_url
from app.engine.hybrid import (
    CatalogSnapshot,
    HybridRecommender,
    compute_pet_energy_facility_score,
    compute_pet_size_fit,
    pet_matches_property,
)
from app.main import create_app
from app.models import (
    PropertyData,
    RoomCategoryData,
    UserBehaviorData,
    UserContextData,
    UserPetData,
)


class FakeDataSource:
    def __init__(
        self,
        properties: list[PropertyData],
        user_contexts: dict[int, UserContextData] | None = None,
        db_ok: bool = True,
    ) -> None:
        self.properties = properties
        self.user_contexts = user_contexts or {}
        self.db_ok = db_ok
        self.catalog_fetches = 0

    def ping(self) -> bool:
        return self.db_ok

    def fetch_catalog_properties(self) -> list[PropertyData]:
        self.catalog_fetches += 1
        return list(self.properties)

    def fetch_user_context(self, user_id: int) -> UserContextData:
        return self.user_contexts.get(user_id, UserContextData(user_id=user_id))

    def close(self) -> None:
        return None


def _make_sample_catalog() -> list[PropertyData]:
    # 1: Dog + Cat, Large & Small, Chiang Mai, Outdoor Play Area + Indoor Play Area + 8 sqm
    p1 = PropertyData(
        id=1,
        host_id=2,
        title="Chiang Mai Happy Paws Resort",
        description="Spacious garden resort with outdoor play area for active dogs and cozy cat rooms",
        property_type="Pet Resort",
        province="Chiang Mai",
        district="Mueang",
        latitude=18.7883,
        longitude=98.9853,
        min_price=950.0,
        avg_rating=4.9,
        review_count=12,
        booking_count=15,
        favorite_count=8,
        view_count_30d=40,
        facilities=["Outdoor Play Area", "Indoor Play Area", "CCTV 24h", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=101,
                pet_size_category_id=3,
                size_name="Large (15-30 kg)",
                min_weight=15.0,
                max_weight=30.0,
                room_area_sqm=8.0,
                pet_type_ids=frozenset({1}),
            ),
            RoomCategoryData(
                id=102,
                pet_size_category_id=1,
                size_name="Small (0-5 kg)",
                min_weight=0.0,
                max_weight=5.0,
                room_area_sqm=4.0,
                pet_type_ids=frozenset({1, 2}),
            ),
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
        pet_size_names=["Large (15-30 kg)", "Small (0-5 kg)"],
        max_room_area_sqm=8.0,
    )

    # 2: Calm Cat & Small Dog condo, Bangkok, Separated Zones + Air Conditioning + Nearby Vet + CCTV 24h
    p2 = PropertyData(
        id=2,
        host_id=3,
        title="Bangkok Quiet Cat Condo",
        description="Quiet climate-controlled suites with separated zones and nearby vet clinic",
        property_type="Pet Condo",
        province="Bangkok",
        district="Watthana",
        latitude=13.7367,
        longitude=100.5608,
        min_price=800.0,
        avg_rating=4.7,
        review_count=8,
        booking_count=10,
        favorite_count=6,
        view_count_30d=25,
        facilities=["Separated Zones", "Air Conditioning", "Nearby Vet", "CCTV 24h", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=201,
                pet_size_category_id=1,
                size_name="Small (0-5 kg)",
                min_weight=0.0,
                max_weight=5.0,
                room_area_sqm=3.5,
                pet_type_ids=frozenset({1, 2}),
            ),
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
        pet_size_names=["Small (0-5 kg)"],
        max_room_area_sqm=3.5,
    )

    # 3: Giant Dog Villa, Bangkok, ONLY Giant Dog (id=1, 30-100 kg), Outdoor Play Area
    p3 = PropertyData(
        id=3,
        host_id=16,
        title="Giant Breed Villa",
        description="Extra large fenced outdoor yard for giant dogs",
        property_type="Pet Resort",
        province="Bangkok",
        district="Bang Na",
        latitude=13.6682,
        longitude=100.6048,
        min_price=1600.0,
        avg_rating=4.5,
        review_count=4,
        booking_count=5,
        favorite_count=2,
        view_count_30d=12,
        facilities=["Outdoor Play Area", "CCTV 24h", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=301,
                pet_size_category_id=4,
                size_name="Giant (30-100 kg)",
                min_weight=30.0,
                max_weight=100.0,
                room_area_sqm=12.0,
                pet_type_ids=frozenset({1}),
            ),
        ],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
        pet_size_names=["Giant (30-100 kg)"],
        max_room_area_sqm=12.0,
    )

    # 4: Exotic Rabbit & Bird Homestay, Phuket (0-match for Dog/Cat)
    p4 = PropertyData(
        id=4,
        host_id=17,
        title="Phuket Bunny & Bird Sanctuary",
        description="Safe cozy cages for rabbits and birds in Phuket",
        property_type="Pet Homestay",
        province="Phuket",
        district="Mueang Phuket",
        latitude=7.8804,
        longitude=98.3923,
        min_price=450.0,
        avg_rating=4.8,
        review_count=6,
        booking_count=7,
        favorite_count=4,
        view_count_30d=18,
        facilities=["Air Conditioning", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=401,
                pet_size_category_id=1,
                size_name="Small (0-5 kg)",
                min_weight=0.0,
                max_weight=5.0,
                room_area_sqm=2.5,
                pet_type_ids=frozenset({3, 5}),
            ),
        ],
        allowed_pet_type_ids={3, 5},
        allowed_pet_type_names=["กระต่าย (Rabbit)", "นก (Bird)"],
        pet_size_names=["Small (0-5 kg)"],
        max_room_area_sqm=2.5,
    )

    # 5: Self-owned by user 4 (should be excluded for user 4)
    p5 = PropertyData(
        id=5,
        host_id=4,
        title="User 4 Own Pet Hotel",
        description="Owned by user 4",
        property_type="Pet Hotel",
        province="Chiang Mai",
        district="Mueang",
        min_price=600.0,
        avg_rating=5.0,
        review_count=20,
        booking_count=30,
        facilities=["Outdoor Play Area", "Indoor Play Area"],
        room_categories=[
            RoomCategoryData(
                id=501,
                pet_size_category_id=None,
                room_area_sqm=10.0,
                pet_type_ids=frozenset({1, 2}),
            )
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
        max_room_area_sqm=10.0,
    )

    # 6: Inactive / Banned / Soft-deleted properties (must never appear in snapshot)
    p6_inactive = PropertyData(
        id=6,
        host_id=18,
        title="Inactive Stay",
        is_active=False,
        room_categories=[RoomCategoryData(id=601, pet_type_ids=frozenset({1, 2}))],
        allowed_pet_type_ids={1, 2},
    )
    p7_banned = PropertyData(
        id=7,
        host_id=18,
        title="Banned Stay",
        is_banned_by_admin=True,
        room_categories=[RoomCategoryData(id=701, pet_type_ids=frozenset({1, 2}))],
        allowed_pet_type_ids={1, 2},
    )
    p8_deleted = PropertyData(
        id=8,
        host_id=18,
        title="Deleted Stay",
        is_deleted=True,
        room_categories=[RoomCategoryData(id=801, pet_type_ids=frozenset({1, 2}))],
        allowed_pet_type_ids={1, 2},
    )

    return [p1, p2, p3, p4, p5, p6_inactive, p7_banned, p8_deleted]


def test_sanitize_database_url_strips_prisma_params() -> None:
    raw = (
        "postgresql://user:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/"
        "postgres?sslmode=require&connection_limit=10&connect_timeout=30&pgbouncer=true&schema=public"
    )
    cleaned = sanitize_database_url(raw)
    assert "connection_limit" not in cleaned
    assert "pgbouncer" not in cleaned
    assert "schema=" not in cleaned
    assert "sslmode=require" in cleaned
    assert "connect_timeout=30" in cleaned
    assert sanitize_database_url("") == ""
    assert sanitize_database_url(None) == ""


def test_stage1_safety_and_tier_a_vs_tier_b_backfill() -> None:
    catalog = _make_sample_catalog()
    # User 4: Large Dog (28.5kg) + Small Cat (4.2kg) -> p1 fits BOTH (Tier A), p2 fits only Cat (Tier B), p4 fits 0 (excluded), p5 self-owned (excluded)
    user4 = UserContextData(
        user_id=4,
        pets=[
            UserPetData(
                id=1,
                name="Milo",
                pet_type_id=1,
                pet_type_name="สุนัข (Dog)",
                breed_name="Golden Retriever",
                weight=28.5,
                pet_size_category_id=3,
                size_name="Large (15-30 kg)",
                energy_rating=4,
            ),
            UserPetData(
                id=2,
                name="Luna",
                pet_type_id=2,
                pet_type_name="แมว (Cat)",
                breed_name="Scottish Fold",
                weight=4.2,
                pet_size_category_id=1,
                size_name="Small (0-5 kg)",
                energy_rating=2,
            ),
        ],
    )
    ds = FakeDataSource(catalog, {4: user4})
    engine = HybridRecommender(data_source=ds)

    res = engine.recommend_for_user(user_id=4, limit=5, debug=True)
    rec_ids = [r.property_id for r in res.recommendations]

    # Self-owned p5, inactive p6, banned p7, deleted p8, and 0-match p4 must NOT appear
    assert 5 not in rec_ids
    assert 6 not in rec_ids
    assert 7 not in rec_ids
    assert 8 not in rec_ids
    assert 4 not in rec_ids

    # Tier A (p1: fits both Milo & Luna) must come BEFORE Tier B (p2: Luna only, p3: Milo <= 100kg only)
    assert rec_ids[0] == 1
    assert set(rec_ids[1:]) == {2, 3}
    assert res.recommendations[0].match_tier == "all_pets"
    assert all(r.match_tier == "partial_pets" for r in res.recommendations[1:])
    assert "Fits all your pets" in res.recommendations[0].match_reasons
    assert all("1/2" in r.match_reasons[0] for r in res.recommendations[1:])

    # When limit=1, only Tier A is returned (no Tier B backfill needed)
    res_lim1 = engine.recommend_for_user(user_id=4, limit=1)
    assert [r.property_id for r in res_lim1.recommendations] == [1]


def test_stage1_weight_null_fallback_and_unrestricted_size() -> None:
    prop_unrestricted = PropertyData(
        id=10,
        host_id=2,
        title="All Size Dog Stay",
        room_categories=[
            RoomCategoryData(id=1, pet_size_category_id=None, pet_type_ids=frozenset({1}))
        ],
        allowed_pet_type_ids={1},
    )
    prop_small = PropertyData(
        id=11,
        host_id=2,
        title="Small Dog Stay",
        room_categories=[
            RoomCategoryData(
                id=2,
                pet_size_category_id=1,
                min_weight=0.0,
                max_weight=5.0,
                pet_type_ids=frozenset({1}),
            )
        ],
        allowed_pet_type_ids={1},
    )
    pet_no_weight_small = UserPetData(
        id=1,
        name="Tiny",
        pet_type_id=1,
        pet_type_name="สุนัข (Dog)",
        weight=None,
        pet_size_category_id=1,
    )
    pet_large = UserPetData(
        id=2,
        name="Big",
        pet_type_id=1,
        pet_type_name="สุนัข (Dog)",
        weight=25.0,
        pet_size_category_id=3,
    )
    assert pet_matches_property(pet_no_weight_small, prop_small) is True
    assert pet_matches_property(pet_large, prop_small) is False
    assert pet_matches_property(pet_large, prop_unrestricted) is True


def test_stage2_energy_facility_compatibility() -> None:
    catalog = _make_sample_catalog()
    p_active = catalog[0]  # Outdoor + Indoor Play Area + 8sqm + CCTV + Daily Updates
    p_calm = catalog[1]    # Separated Zones + Air Conditioning + Nearby Vet + CCTV + Daily Updates

    high_energy_dog = UserPetData(
        id=1, name="Bolt", pet_type_id=1, pet_type_name="Dog", weight=20.0, energy_rating=5
    )
    low_energy_cat = UserPetData(
        id=2, name="Misty", pet_type_id=2, pet_type_name="Cat", weight=3.5, energy_rating=1
    )

    high_on_active, _ = compute_pet_energy_facility_score(high_energy_dog, p_active)
    high_on_calm, _ = compute_pet_energy_facility_score(high_energy_dog, p_calm)
    assert high_on_active == pytest.approx(1.0)
    assert high_on_active > high_on_calm

    low_on_calm, _ = compute_pet_energy_facility_score(low_energy_cat, p_calm)
    low_on_active, _ = compute_pet_energy_facility_score(low_energy_cat, p_active)
    assert low_on_calm == pytest.approx(1.0)
    assert low_on_calm > low_on_active


def test_multi_pet_energy_reason_uses_matched_pet_bucket() -> None:
    prop = PropertyData(
        id=20,
        host_id=99,
        title="AC Pet Stay",
        facilities=["Air Conditioning"],
        room_categories=[
            RoomCategoryData(id=1, pet_size_category_id=None, pet_type_ids=frozenset({1, 2}))
        ],
        allowed_pet_type_ids={1, 2},
    )
    user = UserContextData(
        user_id=10,
        pets=[
            UserPetData(id=1, name="Milo", pet_type_id=1, pet_type_name="Dog", weight=10.0, energy_rating=5),
            UserPetData(id=2, name="Luna", pet_type_id=2, pet_type_name="Cat", weight=4.0, energy_rating=1),
        ],
    )
    engine = HybridRecommender(data_source=FakeDataSource([prop], {10: user}))
    res = engine.recommend_for_user(user_id=10, limit=5)
    reasons = res.recommendations[0].match_reasons
    assert any("Air Conditioning · Calm-pet friendly" in r for r in reasons)
    assert not any("Air Conditioning · High-energy match" in r for r in reasons)


def test_stage2_and_3_time_decay_and_content_similarity() -> None:
    # Two identical dog-friendly properties except location/description/facilities
    p_cm = PropertyData(
        id=10,
        host_id=2,
        title="Chiang Mai Mountain Dog Villa",
        description="Chiang Mai highland garden boarding with outdoor play area",
        property_type="Pet Resort",
        province="Chiang Mai",
        district="Mae Rim",
        min_price=1000.0,
        avg_rating=4.5,
        review_count=5,
        booking_count=4,
        facilities=["Outdoor Play Area"],
        room_categories=[RoomCategoryData(id=1, pet_type_ids=frozenset({1}))],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
    )
    p_bkk = PropertyData(
        id=11,
        host_id=3,
        title="Bangkok Urban Dog Hotel",
        description="Bangkok indoor suites with air conditioning in Sathorn",
        property_type="Pet Hotel",
        province="Bangkok",
        district="Sathorn",
        min_price=1000.0,
        avg_rating=4.5,
        review_count=5,
        booking_count=4,
        facilities=["Air Conditioning"],
        room_categories=[RoomCategoryData(id=2, pet_type_ids=frozenset({1}))],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
    )
    p_target_cm = PropertyData(
        id=12,
        host_id=5,
        title="Chiang Mai Cozy Dog Retreat",
        description="Chiang Mai Mae Rim garden stay with outdoor play area",
        property_type="Pet Resort",
        province="Chiang Mai",
        district="Mae Rim",
        min_price=1000.0,
        avg_rating=4.5,
        review_count=5,
        booking_count=4,
        facilities=["Outdoor Play Area"],
        room_categories=[RoomCategoryData(id=3, pet_type_ids=frozenset({1}))],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
    )

    # Recent booking on p_cm (5.0 * exp(0) = 5.0) should vastly outweigh 90-day-old view on p_bkk (1.0 * exp(-4.5) ~ 0.011)
    user_ctx = UserContextData(
        user_id=99,
        pets=[
            UserPetData(id=1, name="Rex", pet_type_id=1, pet_type_name="Dog", weight=10.0, energy_rating=3)
        ],
        behaviors=[
            UserBehaviorData(property_id=10, action="book", days_elapsed=0.0),
            UserBehaviorData(property_id=11, action="view", days_elapsed=90.0),
        ],
    )
    ds = FakeDataSource([p_cm, p_bkk, p_target_cm], {99: user_ctx})
    engine = HybridRecommender(data_source=ds, time_decay_lambda=0.05)

    res = engine.recommend_for_user(user_id=99, limit=3, debug=True)
    by_id = {r.property_id: r for r in res.recommendations}
    assert by_id[12].score_breakdown is not None
    assert by_id[12].score_breakdown.s_content > by_id[11].score_breakdown.s_content


def test_stage3_bayesian_quality_and_popularity_math() -> None:
    p_few = PropertyData(
        id=1,
        host_id=2,
        title="New 5-star",
        avg_rating=5.0,
        review_count=1,
        booking_count=0,
        favorite_count=0,
        view_count_30d=0,
    )
    p_many = PropertyData(
        id=2,
        host_id=3,
        title="Established 4.8-star",
        avg_rating=4.8,
        review_count=15,
        booking_count=10,
        favorite_count=5,
        view_count_30d=20,
    )
    p_mid = PropertyData(
        id=3,
        host_id=4,
        title="Average 3.6-star",
        avg_rating=3.6,
        review_count=5,
        booking_count=2,
        favorite_count=1,
        view_count_30d=5,
    )
    snap = CatalogSnapshot.from_properties([p_few, p_many, p_mid])
    expected_c = (5.0 + 4.8 + 3.6) / 3.0
    assert snap.global_mean_rating == pytest.approx(expected_c)

    wr_few = (1 / 4) * 5.0 + (3 / 4) * expected_c
    wr_many = (15 / 18) * 4.8 + (3 / 18) * expected_c
    assert snap.quality_scores[1] == pytest.approx(min(1.0, wr_few / 5.0))
    assert snap.quality_scores[2] == pytest.approx(min(1.0, wr_many / 5.0))
    # Established 4.8-star property (15 reviews) beats 1-review 5.0-star under Bayesian smoothing
    assert snap.quality_scores[2] > snap.quality_scores[1]
    assert snap.popularity_scores[2] == pytest.approx(1.0)
    assert snap.popularity_scores[1] == pytest.approx(0.0)

    # Zero-rated catalog falls back to C = 4.2
    snap_unrated = CatalogSnapshot.from_properties(
        [PropertyData(id=10, host_id=1, title="Unrated", avg_rating=0.0, review_count=0)]
    )
    assert snap_unrated.global_mean_rating == pytest.approx(4.2)
    assert snap_unrated.quality_scores[10] == pytest.approx(4.2 / 5.0)


def test_zero_pets_user_falls_back_gracefully() -> None:
    catalog = _make_sample_catalog()
    user_no_pets = UserContextData(user_id=50, pets=[], behaviors=[])
    ds = FakeDataSource(catalog, {50: user_no_pets})
    engine = HybridRecommender(data_source=ds)

    res = engine.recommend_for_user(user_id=50, limit=5, debug=True)
    assert res.strategy == "cold_start"
    assert len(res.recommendations) == 5
    assert all(r.match_tier == "cold_start" for r in res.recommendations)
    assert all(len(r.match_reasons) <= 3 and len(r.match_reasons) >= 1 for r in res.recommendations)


def test_cold_start_and_province_diversity_tie_break() -> None:
    props = [
        PropertyData(id=1, host_id=10, title="BKK 1", province="Bangkok", avg_rating=4.5, review_count=5, booking_count=4),
        PropertyData(id=2, host_id=11, title="BKK 2", province="Bangkok", avg_rating=4.5, review_count=5, booking_count=4),
        PropertyData(id=3, host_id=12, title="CNX 1", province="Chiang Mai", avg_rating=4.5, review_count=5, booking_count=4),
    ]
    ds = FakeDataSource(props)
    engine = HybridRecommender(data_source=ds)
    res = engine.recommend_cold_start(limit=3, debug=True)
    ids = [r.property_id for r in res.recommendations]
    # First pick id=1 (Bangkok), second pick must break tie in favor of Chiang Mai (id=3) before second Bangkok (id=2)
    assert ids == [1, 3, 2]


def test_similar_properties_and_viewer_exclusion() -> None:
    catalog = _make_sample_catalog()
    ds = FakeDataSource(catalog)
    engine = HybridRecommender(data_source=ds)

    # Without viewer_id: p1 should not include itself, and p2 (Dog+Cat) should outrank p4 (Rabbit+Bird)
    res = engine.recommend_similar(property_id=1, limit=5, debug=True)
    assert res is not None
    rec_ids = [r.property_id for r in res.recommendations]
    assert 1 not in rec_ids
    assert rec_ids.index(2) < rec_ids.index(4)
    assert all(r.match_tier == "similar" for r in res.recommendations)
    assert all(1 <= len(r.match_reasons) <= 3 for r in res.recommendations)

    # Viewer is host of p2 (host_id=3) -> p2 must be excluded
    res_viewer = engine.recommend_similar(property_id=1, limit=5, viewer_id=3)
    assert res_viewer is not None
    assert 2 not in [r.property_id for r in res_viewer.recommendations]

    # Non-existent / inactive property -> None (404 at API layer)
    assert engine.recommend_similar(property_id=6) is None
    assert engine.recommend_similar(property_id=999) is None


def test_snapshot_ttl_and_manual_refresh() -> None:
    catalog = _make_sample_catalog()
    ds = FakeDataSource(catalog)
    engine = HybridRecommender(data_source=ds, snapshot_ttl_seconds=60)

    engine.recommend_cold_start(limit=3)
    engine.recommend_cold_start(limit=3)
    assert ds.catalog_fetches == 1

    size, age = engine.refresh_snapshot()
    assert size == 5  # 5 active (p1..p5), 3 inactive/banned/deleted filtered out
    assert age >= 0.0
    assert ds.catalog_fetches == 2


def test_fastapi_endpoints_and_refresh_secret_guard() -> None:
    catalog = _make_sample_catalog()
    user4 = UserContextData(
        user_id=4,
        pets=[
            UserPetData(
                id=1, name="Milo", pet_type_id=1, pet_type_name="สุนัข (Dog)", weight=28.5, energy_rating=4
            )
        ],
    )
    ds = FakeDataSource(catalog, {4: user4}, db_ok=True)
    settings = Settings(
        port=5000,
        database_url="",
        snapshot_ttl_seconds=60,
        time_decay_lambda=0.05,
        ml_internal_secret="super-secret-ml-token",
    )
    app = create_app(settings=settings, data_source=ds)
    client = TestClient(app)

    # /health
    r_health = client.get("/health")
    assert r_health.status_code == 200
    body_h = r_health.json()
    assert body_h["status"] == "ok"
    assert body_h["service"] == "joodpakpaw-ml"
    assert body_h["catalog_size"] == 5
    assert body_h["db_connected"] is True

    # /ml/v1/recommend/user/4 (debug=false omits score_breakdown)
    r_user = client.get("/ml/v1/recommend/user/4?limit=3&debug=false")
    assert r_user.status_code == 200
    body_u = r_user.json()
    assert body_u["strategy"] == "hybrid_pet_aware_v2"
    assert len(body_u["recommendations"]) >= 1
    assert "score_breakdown" not in body_u["recommendations"][0]
    assert len(body_u["recommendations"][0]["match_reasons"]) <= 3

    # /ml/v1/recommend/user/4?debug=true includes score_breakdown
    r_user_dbg = client.get("/ml/v1/recommend/user/4?limit=3&debug=true")
    assert r_user_dbg.status_code == 200
    assert set(r_user_dbg.json()["recommendations"][0]["score_breakdown"].keys()) == {
        "s_content",
        "s_compat",
        "s_quality",
        "s_popularity",
    }

    # /ml/v1/recommend/cold-start
    r_cs = client.get("/ml/v1/recommend/cold-start?limit=4&debug=false")
    assert r_cs.status_code == 200
    assert r_cs.json()["strategy"] == "cold_start"
    assert len(r_cs.json()["recommendations"]) == 4

    # /ml/v1/recommend/similar/1 with empty viewer_id=&debug=false
    r_sim = client.get("/ml/v1/recommend/similar/1?limit=8&viewer_id=&debug=false")
    assert r_sim.status_code == 200
    assert r_sim.json()["strategy"] == "similar_properties"

    # /ml/v1/recommend/similar/999 -> 404
    r_sim_404 = client.get("/ml/v1/recommend/similar/999")
    assert r_sim_404.status_code == 404

    # /ml/v1/refresh protected by ML_INTERNAL_SECRET
    r_ref_unauth = client.post("/ml/v1/refresh")
    assert r_ref_unauth.status_code == 403

    r_ref_ok = client.post(
        "/ml/v1/refresh",
        headers={"X-ML-Secret": "super-secret-ml-token"},
    )
    assert r_ref_ok.status_code == 200
    assert r_ref_ok.json()["refreshed"] is True
    assert r_ref_ok.json()["catalog_size"] == 5


def test_database_reconciliation_sql_contains_live_checks() -> None:
    """Verify DatabaseClient SQL enforces reconciliation against favorite_properties & non-cancelled bookings."""
    import inspect
    from app.database import DatabaseClient

    src = inspect.getsource(DatabaseClient.fetch_user_context)
    assert "favorite_properties" in src
    assert "favorite_folders" in src
    assert "deleted_at IS NULL" in src
    assert "booking_status <> 'cancelled'" in src
    assert "reference_record ~" in src
    assert "psc.code" in src

    cat_src = inspect.getsource(DatabaseClient.fetch_catalog_properties)
    assert "psc.code" in cat_src


def test_pf1_pet_size_up_to_max_and_size_fit_micro_bonus() -> None:
    def _dog_prop(
        pid: int,
        title: str,
        size_id: int | None,
        size_code: int | None,
        size_name: str | None,
        min_w: float | None,
        max_w: float | None,
    ) -> PropertyData:
        return PropertyData(
            id=pid,
            host_id=100 + pid,
            title=title,
            description="Cozy dog boarding stay with care",
            property_type="Pet Hotel",
            province="Bangkok",
            district="Watthana",
            min_price=800.0,
            avg_rating=4.6,
            review_count=6,
            booking_count=5,
            favorite_count=3,
            view_count_30d=15,
            facilities=["Air Conditioning", "CCTV 24h", "Daily Updates"],
            room_categories=[
                RoomCategoryData(
                    id=pid * 10,
                    pet_size_category_id=size_id,
                    size_code=size_code,
                    size_name=size_name,
                    min_weight=min_w,
                    max_weight=max_w,
                    room_area_sqm=5.0,
                    pet_type_ids=frozenset({1}),
                )
            ],
            allowed_pet_type_ids={1},
            allowed_pet_type_names=["สุนัข (Dog)"],
            pet_size_names=[size_name] if size_name else [],
            max_room_area_sqm=5.0,
        )

    p_small = _dog_prop(1, "Dog Stay Alpha", 1, 1, "Small (0-5 kg)", 0.0, 5.0)
    p_medium = _dog_prop(2, "Dog Stay Alpha", 2, 2, "Medium (5-15 kg)", 5.0, 15.0)
    p_large = _dog_prop(3, "Dog Stay Alpha", 3, 3, "Large (15-30 kg)", 15.0, 30.0)
    p_giant = _dog_prop(4, "Dog Stay Alpha", 4, 4, "Giant (30-100 kg)", 30.0, 100.0)
    p_any = _dog_prop(5, "Dog Stay Alpha", None, None, None, None, None)

    small_pom = UserPetData(
        id=1,
        name="Mochi",
        pet_type_id=1,
        pet_type_name="สุนัข (Dog)",
        breed_name="Pomeranian",
        weight=3.5,
        pet_size_category_id=1,
        size_code=1,
        size_name="Small (0-5 kg)",
        energy_rating=3,
    )
    large_golden = UserPetData(
        id=2,
        name="Milo",
        pet_type_id=1,
        pet_type_name="สุนัข (Dog)",
        breed_name="Golden Retriever",
        weight=28.5,
        pet_size_category_id=3,
        size_code=3,
        size_name="Large (15-30 kg)",
        energy_rating=3,
    )

    # Small dog (3.5 kg) matches Small, Medium, Large, Giant, and Unrestricted (<= max_weight)
    assert pet_matches_property(small_pom, p_small) is True
    assert pet_matches_property(small_pom, p_medium) is True
    assert pet_matches_property(small_pom, p_large) is True
    assert pet_matches_property(small_pom, p_giant) is True
    assert pet_matches_property(small_pom, p_any) is True

    # Large dog (28.5 kg) is STRICTLY excluded from Small (<=5) and Medium (<=15), but fits Large/Giant/Any
    assert pet_matches_property(large_golden, p_small) is False
    assert pet_matches_property(large_golden, p_medium) is False
    assert pet_matches_property(large_golden, p_large) is True
    assert pet_matches_property(large_golden, p_giant) is True
    assert pet_matches_property(large_golden, p_any) is True

    # Weight-null fallback respects size_code <= rc.size_code
    small_no_weight = UserPetData(
        id=3,
        name="Tiny",
        pet_type_id=1,
        pet_type_name="Dog",
        weight=None,
        pet_size_category_id=1,
        size_code=1,
    )
    large_no_weight = UserPetData(
        id=4,
        name="Rex",
        pet_type_id=1,
        pet_type_name="Dog",
        weight=None,
        pet_size_category_id=3,
        size_code=3,
    )
    assert pet_matches_property(small_no_weight, p_medium) is True
    assert pet_matches_property(large_no_weight, p_medium) is False
    assert pet_matches_property(large_no_weight, p_giant) is True

    # Size-fit micro-bonus values
    assert compute_pet_size_fit(small_pom, p_small) == pytest.approx(1.0)
    assert compute_pet_size_fit(small_pom, p_any) == pytest.approx(1.0)
    assert compute_pet_size_fit(small_pom, p_medium) == pytest.approx(0.75)
    assert compute_pet_size_fit(small_pom, p_large) == pytest.approx(0.55)
    assert compute_pet_size_fit(small_pom, p_giant) == pytest.approx(0.55)

    # Exact-fit Small room outranks oversized Giant room for 3.5 kg Small dog
    user_small = UserContextData(user_id=77, pets=[small_pom])
    engine = HybridRecommender(data_source=FakeDataSource([p_giant, p_small], {77: user_small}))
    res = engine.recommend_for_user(user_id=77, limit=5, debug=True)
    rec_ids = [r.property_id for r in res.recommendations]
    assert rec_ids == [1, 4]
    assert res.recommendations[0].score > res.recommendations[1].score
    assert res.recommendations[0].score_breakdown is not None
    assert res.recommendations[1].score_breakdown is not None
    assert res.recommendations[0].score_breakdown.s_compat > res.recommendations[1].score_breakdown.s_compat


def test_pf3_location_aware_soft_geo_boost_unit_and_api() -> None:
    catalog = _make_sample_catalog()
    # Add an ultra-nearby (<1 km) Bangkok property to verify "<1 km" formatting too
    p_ultra_near = PropertyData(
        id=9,
        host_id=19,
        title="Bangkok Central Paw Lounge",
        description="Quiet suites right in central Bangkok with air conditioning and CCTV",
        property_type="Pet Condo",
        province="Bangkok",
        district="Phra Nakhon",
        latitude=13.7580,
        longitude=100.5030,
        min_price=850.0,
        avg_rating=4.6,
        review_count=6,
        booking_count=8,
        favorite_count=4,
        view_count_30d=20,
        facilities=["Separated Zones", "Air Conditioning", "CCTV 24h", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=901,
                pet_size_category_id=1,
                size_code=1,
                size_name="Small (0-5 kg)",
                min_weight=0.0,
                max_weight=5.0,
                room_area_sqm=4.0,
                pet_type_ids=frozenset({1, 2}),
            )
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
        pet_size_names=["Small (0-5 kg)"],
        max_room_area_sqm=4.0,
    )
    full_catalog = catalog + [p_ultra_near]

    bkk_user = UserContextData(
        user_id=88,
        pets=[
            UserPetData(
                id=1,
                name="Puff",
                pet_type_id=1,
                pet_type_name="สุนัข (Dog)",
                breed_name="Pomeranian",
                weight=3.5,
                pet_size_category_id=1,
                size_code=1,
                size_name="Small (0-5 kg)",
                energy_rating=2,
            )
        ],
    )
    ds = FakeDataSource(full_catalog, {88: bkk_user}, db_ok=True)
    engine = HybridRecommender(data_source=ds)

    # 1. Cold-Start WITHOUT location: Chiang Mai p1 outranks Bangkok p2 (higher rating & engagement)
    cs_no_loc = engine.recommend_cold_start(limit=6, debug=True)
    cs_no_loc_ids = [r.property_id for r in cs_no_loc.recommendations]
    assert cs_no_loc_ids.index(1) < cs_no_loc_ids.index(2)
    assert cs_no_loc.recommendations[0].score_breakdown is not None
    assert cs_no_loc.recommendations[0].score_breakdown.s_geo is None
    assert cs_no_loc.recommendations[0].score_breakdown.distance_km is None

    # 2. Cold-Start WITH Bangkok location (13.7563, 100.5018): Bangkok properties outrank Chiang Mai p1,
    #    and Chiang Mai p1 is NEVER hard-excluded!
    cs_bkk = engine.recommend_cold_start(
        limit=6, debug=True, user_lat=13.7563, user_lng=100.5018
    )
    cs_bkk_ids = [r.property_id for r in cs_bkk.recommendations]
    assert 1 in cs_bkk_ids  # Distant Chiang Mai stay is NEVER hard-excluded
    assert cs_bkk_ids.index(2) < cs_bkk_ids.index(1)  # Bangkok p2 boosted above Chiang Mai p1
    by_id_cs = {r.property_id: r for r in cs_bkk.recommendations}
    assert any(reason.startswith("Near you (") and reason.endswith(" km)") for reason in by_id_cs[2].match_reasons)
    assert "Near you (<1 km)" in by_id_cs[9].match_reasons
    assert not any(reason.startswith("Near you") for reason in by_id_cs[1].match_reasons)
    assert by_id_cs[2].score_breakdown is not None
    assert by_id_cs[2].score_breakdown.distance_km is not None
    assert by_id_cs[2].score_breakdown.distance_km < 15.0
    assert by_id_cs[2].score_breakdown.s_geo is not None
    assert by_id_cs[2].score_breakdown.s_geo > 0.7

    # 3. Personalized WITH Bangkok location via FastAPI TestClient
    settings = Settings(
        port=5000,
        database_url="",
        snapshot_ttl_seconds=60,
        time_decay_lambda=0.05,
        ml_internal_secret="",
    )
    app = create_app(settings=settings, data_source=ds)
    client = TestClient(app)

    r_user_geo = client.get(
        "/ml/v1/recommend/user/88?limit=6&debug=true&lat=13.7563&lng=100.5018"
    )
    assert r_user_geo.status_code == 200
    u_recs = r_user_geo.json()["recommendations"]
    u_ids = [r["property_id"] for r in u_recs]
    assert 1 in u_ids  # Distant Chiang Mai still included
    assert u_ids.index(2) < u_ids.index(1)  # Bangkok p2 boosted above Chiang Mai p1
    u_by_id = {r["property_id"]: r for r in u_recs}
    assert any(reason.startswith("Near you (") for reason in u_by_id[2]["match_reasons"])
    assert "Near you (<1 km)" in u_by_id[9]["match_reasons"]
    assert len(u_by_id[2]["match_reasons"]) <= 3
    assert u_by_id[2]["score_breakdown"]["distance_km"] is not None
    assert u_by_id[2]["score_breakdown"]["s_geo"] is not None

    # Cold-start endpoint with lat/lng
    r_cs_geo = client.get(
        "/ml/v1/recommend/cold-start?limit=6&debug=true&lat=13.7563&lng=100.5018"
    )
    assert r_cs_geo.status_code == 200
    cs_api_ids = [r["property_id"] for r in r_cs_geo.json()["recommendations"]]
    assert 1 in cs_api_ids
    assert cs_api_ids.index(2) < cs_api_ids.index(1)

    # Validation check: out-of-range lat rejected with 422
    r_bad_lat = client.get("/ml/v1/recommend/cold-start?lat=95.0&lng=100.5")
    assert r_bad_lat.status_code == 422
