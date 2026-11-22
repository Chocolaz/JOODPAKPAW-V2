from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.engine.hybrid import HybridRecommender
from app.main import create_app
from app.models import (
    PropertyData,
    RoomCategoryData,
    UserBehaviorData,
    UserContextData,
    UserPetData,
)
from app.schemas import RankFilterContext


class _StubDataSource:
    def __init__(
        self,
        properties: list[PropertyData],
        user_contexts: dict[int, UserContextData] | None = None,
    ) -> None:
        self._properties = properties
        self._user_contexts = user_contexts or {}

    def ping(self) -> bool:
        return True

    def fetch_catalog_properties(self) -> list[PropertyData]:
        return list(self._properties)

    def fetch_user_context(self, user_id: int) -> UserContextData:
        return self._user_contexts.get(user_id, UserContextData(user_id=user_id))

    def close(self) -> None:
        return None


def _make_prop(
    pid: int,
    *,
    host_id: int = 10,
    title: str = "Pet Stay",
    description: str = "Cozy pet boarding stay",
    property_type: str = "Pet Hotel",
    province: str = "Bangkok",
    district: str = "Watthana",
    latitude: float | None = None,
    longitude: float | None = None,
    min_price: float = 450.0,
    avg_rating: float = 4.5,
    review_count: int = 5,
    booking_count: int = 4,
    favorite_count: int = 2,
    view_count_30d: int = 10,
    facilities: list[str] | None = None,
    room_categories: list[RoomCategoryData] | None = None,
    allowed_pet_type_ids: set[int] | None = None,
    allowed_pet_type_names: list[str] | None = None,
    pet_size_names: list[str] | None = None,
    max_room_area_sqm: float = 4.0,
) -> PropertyData:
    return PropertyData(
        id=pid,
        host_id=host_id,
        title=title,
        description=description,
        property_type=property_type,
        province=province,
        district=district,
        latitude=latitude,
        longitude=longitude,
        min_price=min_price,
        avg_rating=avg_rating,
        review_count=review_count,
        booking_count=booking_count,
        favorite_count=favorite_count,
        view_count_30d=view_count_30d,
        facilities=facilities or [],
        room_categories=room_categories or [],
        allowed_pet_type_ids=allowed_pet_type_ids or set(),
        allowed_pet_type_names=allowed_pet_type_names or [],
        pet_size_names=pet_size_names or [],
        max_room_area_sqm=max_room_area_sqm,
    )


def _create_test_client(
    properties: list[PropertyData],
    user_contexts: dict[int, UserContextData] | None = None,
) -> TestClient:
    ds = _StubDataSource(properties, user_contexts)
    settings = Settings(
        port=5000,
        database_url="",
        snapshot_ttl_seconds=60,
        time_decay_lambda=0.05,
        ml_internal_secret="",
    )
    app = create_app(settings=settings, data_source=ds)
    return TestClient(app)


def test_rank_candidates_budget_filter_ranks_by_personalized_pet_compat() -> None:
    # Budget properties (all <= 500 THB) with identical rating/popularity so pet compatibility drives rank
    p_basic_dog = _make_prop(
        101,
        host_id=21,
        title="Budget Basic Dog Stay",
        min_price=420.0,
        avg_rating=4.5,
        review_count=6,
        booking_count=4,
        favorite_count=2,
        view_count_30d=10,
        facilities=["Air Conditioning"],
        room_categories=[
            RoomCategoryData(
                id=1011,
                pet_size_category_id=3,
                size_code=3,
                size_name="Large (15-30 kg)",
                min_weight=15.0,
                max_weight=30.0,
                room_area_sqm=4.0,
                pet_type_ids=frozenset({1}),
            )
        ],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
        pet_size_names=["Large (15-30 kg)"],
        max_room_area_sqm=4.0,
    )
    p_active_dog = _make_prop(
        102,
        host_id=22,
        title="Budget Active Dog Resort",
        description="Outdoor garden play area and swimming pool for energetic dogs",
        property_type="Pet Resort",
        min_price=480.0,
        avg_rating=4.5,
        review_count=6,
        booking_count=4,
        favorite_count=2,
        view_count_30d=10,
        facilities=["Outdoor Play Area", "Swimming Pool", "Indoor Play Area", "CCTV 24h", "Daily Updates"],
        room_categories=[
            RoomCategoryData(
                id=1021,
                pet_size_category_id=3,
                size_code=3,
                size_name="Large (15-30 kg)",
                min_weight=15.0,
                max_weight=30.0,
                room_area_sqm=8.0,
                pet_type_ids=frozenset({1}),
            )
        ],
        allowed_pet_type_ids={1},
        allowed_pet_type_names=["สุนัข (Dog)"],
        pet_size_names=["Large (15-30 kg)"],
        max_room_area_sqm=8.0,
    )
    # Cat-only budget stay: does not fit user's dog, yet MUST NOT be dropped (context_fallback)
    p_cat_only = _make_prop(
        103,
        host_id=23,
        title="Budget Cat Corner",
        min_price=350.0,
        avg_rating=4.9,
        review_count=15,
        booking_count=20,
        favorite_count=10,
        view_count_30d=40,
        facilities=["Separated Zones"],
        room_categories=[
            RoomCategoryData(
                id=1031,
                pet_size_category_id=1,
                size_code=1,
                size_name="Small (0-5 kg)",
                min_weight=0.0,
                max_weight=5.0,
                room_area_sqm=3.0,
                pet_type_ids=frozenset({2}),
            )
        ],
        allowed_pet_type_ids={2},
        allowed_pet_type_names=["แมว (Cat)"],
        pet_size_names=["Small (0-5 kg)"],
        max_room_area_sqm=3.0,
    )

    user = UserContextData(
        user_id=7,
        pets=[
            UserPetData(
                id=11,
                name="Bolt",
                pet_type_id=1,
                pet_type_name="สุนัข (Dog)",
                breed_name="Golden Retriever",
                weight=24.0,
                pet_size_category_id=3,
                size_code=3,
                size_name="Large (15-30 kg)",
                energy_rating=5,
            )
        ],
    )
    engine = HybridRecommender(
        data_source=_StubDataSource([p_basic_dog, p_active_dog, p_cat_only], {7: user})
    )
    res = engine.rank_candidates(
        user_id=7,
        candidate_property_ids=[103, 101, 102],
        filter_context=RankFilterContext(max_price=500.0),
        debug=True,
    )

    assert res.strategy == "hybrid_filtered_personalized"
    assert res.total_candidates == 3
    ids = [item.property_id for item in res.recommendations]
    # All 3 candidates preserved: active all_pets (102) > basic all_pets (101) > context_fallback (103)
    assert ids == [102, 101, 103]
    assert res.recommendations[0].match_tier == "all_pets"
    assert res.recommendations[1].match_tier == "all_pets"
    assert res.recommendations[2].match_tier == "context_fallback"

    r_top, r_basic = res.recommendations[0], res.recommendations[1]
    assert r_top.score_breakdown is not None and r_basic.score_breakdown is not None
    assert r_top.score_breakdown.s_compat > r_basic.score_breakdown.s_compat
    expected_top = round(
        0.35 * r_top.score_breakdown.s_content
        + 0.35 * r_top.score_breakdown.s_compat
        + 0.20 * r_top.score_breakdown.s_quality
        + 0.10 * r_top.score_breakdown.s_popularity,
        4,
    )
    assert r_top.score == pytest.approx(expected_top, abs=1e-3)
    assert any("Great value under ฿500" in reason for reason in r_basic.match_reasons)
    assert all(1 <= len(item.match_reasons) <= 3 for item in res.recommendations)
    assert not any("0/1" in reason for reason in res.recommendations[2].match_reasons)


def test_rank_candidates_dog_owner_filtering_cats_keeps_all_and_uses_behavior_quality_geo() -> None:
    # Cat candidates across Bangkok & Chiang Mai
    p_bkk_quiet_cat = _make_prop(
        201,
        host_id=31,
        title="Bangkok Quiet Cat Condo",
        description="Quiet air conditioned condo with separated zones for cats in Watthana",
        property_type="Pet Condo",
        province="Bangkok",
        district="Watthana",
        latitude=13.7367,
        longitude=100.5608,
        min_price=750.0,
        avg_rating=4.8,
        review_count=10,
        booking_count=10,
        favorite_count=5,
        view_count_30d=25,
        facilities=["Separated Zones", "Air Conditioning", "CCTV 24h"],
        room_categories=[
            RoomCategoryData(id=2011, pet_size_category_id=1, pet_type_ids=frozenset({2}))
        ],
        allowed_pet_type_ids={2},
        allowed_pet_type_names=["แมว (Cat)"],
    )
    p_bkk_plain_cat = _make_prop(
        202,
        host_id=32,
        title="Bangkok Simple Cat Room",
        description="Simple urban boarding room",
        property_type="Pet Homestay",
        province="Bangkok",
        district="Bang Na",
        latitude=13.6682,
        longitude=100.6048,
        min_price=600.0,
        avg_rating=4.2,
        review_count=4,
        booking_count=3,
        favorite_count=1,
        view_count_30d=8,
        facilities=["Daily Updates"],
        room_categories=[
            RoomCategoryData(id=2021, pet_size_category_id=1, pet_type_ids=frozenset({2}))
        ],
        allowed_pet_type_ids={2},
        allowed_pet_type_names=["แมว (Cat)"],
    )
    p_cnx_cat = _make_prop(
        203,
        host_id=33,
        title="Chiang Mai Garden Cat House",
        description="Peaceful garden stay in Chiang Mai",
        property_type="Pet Homestay",
        province="Chiang Mai",
        district="Mueang",
        latitude=18.7883,
        longitude=98.9853,
        min_price=650.0,
        avg_rating=4.7,
        review_count=8,
        booking_count=6,
        favorite_count=3,
        view_count_30d=15,
        facilities=["Air Conditioning"],
        room_categories=[
            RoomCategoryData(id=2031, pet_size_category_id=1, pet_type_ids=frozenset({2}))
        ],
        allowed_pet_type_ids={2},
        allowed_pet_type_names=["แมว (Cat)"],
    )
    # Historical reference property the dog owner recently booked (matches Bangkok Condo + Separated Zones + AC)
    p_history_ref = _make_prop(
        204,
        host_id=34,
        title="Bangkok Luxury Pet Condo",
        description="Air conditioned separated zones suite in Bangkok Watthana",
        property_type="Pet Condo",
        province="Bangkok",
        district="Watthana",
        facilities=["Separated Zones", "Air Conditioning", "CCTV 24h"],
        room_categories=[
            RoomCategoryData(id=2041, pet_size_category_id=1, pet_type_ids=frozenset({1, 2}))
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
    )

    dog_owner = UserContextData(
        user_id=15,
        pets=[
            UserPetData(
                id=55,
                name="Rex",
                pet_type_id=1,
                pet_type_name="สุนัข (Dog)",
                weight=22.0,
                energy_rating=5,
            )
        ],
        behaviors=[
            UserBehaviorData(property_id=204, action="book", days_elapsed=1.0),
        ],
    )

    engine = HybridRecommender(
        data_source=_StubDataSource(
            [p_bkk_quiet_cat, p_bkk_plain_cat, p_cnx_cat, p_history_ref],
            {15: dog_owner},
        )
    )
    res = engine.rank_candidates(
        user_id=15,
        candidate_property_ids=[203, 202, 201],
        filter_context=RankFilterContext(pet_types=["cat"]),
        user_lat=13.7563,
        user_lng=100.5018,
        debug=True,
    )

    assert res.strategy == "hybrid_filtered_behavioral"
    assert res.total_candidates == 3
    ids = [r.property_id for r in res.recommendations]
    # Zero drops: all 3 cat candidates preserved; Bangkok quiet condo ranked #1 by behavior + quality + geo
    assert set(ids) == {201, 202, 203}
    assert ids[0] == 201
    assert all(r.match_tier == "cold_start" for r in res.recommendations)
    assert all(r.score_breakdown is not None and r.score_breakdown.s_compat == 0.0 for r in res.recommendations)
    by_id = {r.property_id: r for r in res.recommendations}
    assert by_id[201].score_breakdown is not None and by_id[201].score_breakdown.s_geo is not None
    assert any(reason.startswith("Near you (") for reason in by_id[201].match_reasons)
    assert not any(reason.startswith("Near you") for reason in by_id[203].match_reasons)

    # Also verify plural bilingual pet_types filter ("Cats") and pet_profile_ids scoping
    res_plural = engine.rank_candidates(
        user_id=15,
        candidate_property_ids=[203, 202, 201],
        filter_context=RankFilterContext(pet_types=["Cats"]),
        debug=False,
    )
    assert res_plural.strategy == "hybrid_filtered_behavioral"
    assert len(res_plural.recommendations) == 3


def test_rank_candidates_guest_cold_start_quality_popularity_and_geo() -> None:
    p_top_far = _make_prop(
        301,
        host_id=41,
        title="Chiang Mai Top Rated Resort",
        province="Chiang Mai",
        latitude=18.7883,
        longitude=98.9853,
        avg_rating=4.9,
        review_count=20,
        booking_count=25,
        favorite_count=10,
        view_count_30d=50,
        facilities=["Air Conditioning", "CCTV 24h"],
    )
    p_good_near = _make_prop(
        302,
        host_id=42,
        title="Bangkok Central Pet Lounge",
        province="Bangkok",
        latitude=13.7580,
        longitude=100.5030,
        avg_rating=4.6,
        review_count=10,
        booking_count=12,
        favorite_count=6,
        view_count_30d=30,
        facilities=["Air Conditioning", "Daily Updates"],
    )
    p_low = _make_prop(
        303,
        host_id=43,
        title="Bangkok Starter Stay",
        province="Bangkok",
        latitude=13.7200,
        longitude=100.5200,
        avg_rating=3.2,
        review_count=2,
        booking_count=0,
        favorite_count=0,
        view_count_30d=2,
        facilities=["Daily Updates"],
    )

    engine = HybridRecommender(data_source=_StubDataSource([p_top_far, p_good_near, p_low]))

    # Without geo: sorted strictly by 0.60 * s_quality + 0.40 * s_popularity
    res_no_geo = engine.rank_candidates(
        user_id=None,
        candidate_property_ids=[303, 302, 301],
        filter_context=RankFilterContext(facilities=["Air Conditioning"]),
        debug=True,
    )
    assert res_no_geo.strategy == "hybrid_filtered_cold_start"
    assert [r.property_id for r in res_no_geo.recommendations] == [301, 302, 303]
    assert all(r.match_tier == "cold_start" for r in res_no_geo.recommendations)
    first_bd = res_no_geo.recommendations[0].score_breakdown
    assert first_bd is not None
    assert res_no_geo.recommendations[0].score == pytest.approx(
        round(0.60 * first_bd.s_quality + 0.40 * first_bd.s_popularity, 4),
        abs=1e-4,
    )
    assert any("Includes Air Conditioning" in r for r in res_no_geo.recommendations[0].match_reasons)

    # With Bangkok geo (13.7563, 100.5018): ultra-near 302 is boosted above distant 301
    res_geo = engine.rank_candidates(
        user_id=None,
        candidate_property_ids=[303, 301, 302],
        filter_context=RankFilterContext(province="Bangkok", facilities=["Air Conditioning"]),
        user_lat=13.7563,
        user_lng=100.5018,
        debug=True,
    )
    assert res_geo.strategy == "hybrid_filtered_cold_start"
    assert [r.property_id for r in res_geo.recommendations] == [302, 301, 303]
    assert "Near you (<1 km)" in res_geo.recommendations[0].match_reasons


def test_rank_candidates_preserves_unknown_ids_at_tail_via_api() -> None:
    p1 = _make_prop(
        401,
        host_id=51,
        title="Established Bangkok Stay",
        avg_rating=4.9,
        review_count=14,
        booking_count=16,
        favorite_count=8,
        view_count_30d=30,
    )
    p2 = _make_prop(
        402,
        host_id=52,
        title="Newer Bangkok Stay",
        avg_rating=4.1,
        review_count=2,
        booking_count=1,
        favorite_count=0,
        view_count_30d=4,
    )
    client = _create_test_client([p1, p2])

    # Include duplicates and unknown IDs not present in snapshot (9991, 9992)
    resp = client.post(
        "/ml/v1/rank/candidates",
        json={
            "user_id": None,
            "candidate_property_ids": [402, 9991, 401, 402, 9992, 9991],
            "filter_context": {"province": "Bangkok"},
            "debug": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["strategy"] == "hybrid_filtered_cold_start"
    assert body["total_candidates"] == 4
    recs = body["recommendations"]
    assert [r["property_id"] for r in recs] == [401, 402, 9991, 9992]

    # debug=false omits score_breakdown
    assert all("score_breakdown" not in r for r in recs)

    # Unknown tail items preserve exact contract
    for unk in recs[2:]:
        assert unk["score"] == 0.0
        assert unk["match_tier"] == "cold_start"
        assert unk["match_reasons"] == ["Matches your filter"]

    # debug=true exposes score_breakdown and validates request bounds
    resp_dbg = client.post(
        "/ml/v1/rank/candidates",
        json={
            "candidate_property_ids": [401, 9991],
            "debug": True,
        },
    )
    assert resp_dbg.status_code == 200
    assert "score_breakdown" in resp_dbg.json()["recommendations"][0]

    resp_empty = client.post(
        "/ml/v1/rank/candidates",
        json={"candidate_property_ids": []},
    )
    assert resp_empty.status_code == 422

    resp_bad_lat = client.post(
        "/ml/v1/rank/candidates",
        json={"candidate_property_ids": [401], "lat": 95.0, "lng": 100.5},
    )
    assert resp_bad_lat.status_code == 422


def test_rank_candidates_pet_profile_ids_and_tier_priority() -> None:
    p_dog_and_cat = _make_prop(
        501,
        host_id=61,
        title="Dog & Cat Stay",
        avg_rating=4.3,
        review_count=4,
        room_categories=[
            RoomCategoryData(id=5011, pet_size_category_id=3, max_weight=30.0, pet_type_ids=frozenset({1, 2}))
        ],
        allowed_pet_type_ids={1, 2},
        allowed_pet_type_names=["สุนัข (Dog)", "แมว (Cat)"],
    )
    p_cat_only = _make_prop(
        502,
        host_id=62,
        title="Cat Paradise",
        avg_rating=4.9,
        review_count=15,
        booking_count=20,
        facilities=["Air Conditioning", "Separated Zones"],
        room_categories=[
            RoomCategoryData(id=5021, pet_size_category_id=1, max_weight=5.0, pet_type_ids=frozenset({2}))
        ],
        allowed_pet_type_ids={2},
        allowed_pet_type_names=["แมว (Cat)"],
    )
    p_rabbit_only = _make_prop(
        503,
        host_id=63,
        title="Rabbit Burrow",
        avg_rating=5.0,
        review_count=10,
        room_categories=[
            RoomCategoryData(id=5031, pet_size_category_id=1, max_weight=5.0, pet_type_ids=frozenset({3}))
        ],
        allowed_pet_type_ids={3},
        allowed_pet_type_names=["กระต่าย (Rabbit)"],
    )

    user = UserContextData(
        user_id=25,
        pets=[
            UserPetData(
                id=1,
                name="Milo",
                pet_type_id=1,
                pet_type_name="สุนัข (Dog)",
                weight=25.0,
                pet_size_category_id=3,
                energy_rating=4,
            ),
            UserPetData(
                id=2,
                name="Luna",
                pet_type_id=2,
                pet_type_name="แมว (Cat)",
                weight=4.0,
                pet_size_category_id=1,
                energy_rating=2,
            ),
        ],
    )
    client = _create_test_client([p_dog_and_cat, p_cat_only, p_rabbit_only], {25: user})

    # Without pet filter: p_dog_and_cat is all_pets (2/2), p_cat_only is partial_pets (1/2), p_rabbit_only is context_fallback (0/2)
    resp_all = client.post(
        "/ml/v1/rank/candidates",
        json={"user_id": 25, "candidate_property_ids": [503, 502, 501]},
    )
    assert resp_all.status_code == 200
    recs_all = resp_all.json()["recommendations"]
    assert [r["property_id"] for r in recs_all] == [501, 502, 503]
    assert [r["match_tier"] for r in recs_all] == ["all_pets", "partial_pets", "context_fallback"]

    # Filtering by pet_profile_ids=[2] (Luna the Cat only): p_cat_only becomes all_pets and outranks p_dog_and_cat
    resp_cat = client.post(
        "/ml/v1/rank/candidates",
        json={
            "user_id": 25,
            "candidate_property_ids": [503, 501, 502],
            "filter_context": {"pet_profile_ids": [2]},
        },
    )
    assert resp_cat.status_code == 200
    recs_cat = resp_cat.json()["recommendations"]
    assert [r["property_id"] for r in recs_cat] == [502, 501, 503]
    assert [r["match_tier"] for r in recs_cat] == ["all_pets", "all_pets", "context_fallback"]

    # Top-level flat filter payload (as sent by joodpakpaw-api) works identically
    resp_cat_flat = client.post(
        "/ml/v1/rank/candidates",
        json={
            "user_id": 25,
            "candidate_property_ids": [503, 501, 502],
            "pet_profile_ids": [2],
        },
    )
    assert resp_cat_flat.status_code == 200
    assert [r["property_id"] for r in resp_cat_flat.json()["recommendations"]] == [502, 501, 503]
    assert [r["match_tier"] for r in resp_cat_flat.json()["recommendations"]] == [
        "all_pets",
        "all_pets",
        "context_fallback",
    ]
