from __future__ import annotations

import math
import re
import threading
import time
from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.database import CatalogDataSource
from app.models import PropertyData, RoomCategoryData, UserContextData, UserPetData
from app.schemas import RecommendationItem, ScoreBreakdown

ACTION_WEIGHTS: dict[str, float] = {
    "book": 5.0,
    "favorite": 3.0,
    "view": 1.0,
}

BAYESIAN_M = 3.0
FALLBACK_GLOBAL_MEAN_RATING = 4.2


def _extract_english_label(raw_name: str) -> str:
    """Extract English name from labels like 'สุนัข (Dog)' -> 'Dog'."""
    match = re.search(r"\(([^)]+)\)", raw_name)
    if match:
        inner = match.group(1).strip()
        if inner:
            return inner
    return raw_name.strip()


def _clean_token_text(raw: str) -> str:
    return re.sub(r"[()/,_-]+", " ", raw).strip()


def _price_tier(min_price: float) -> str:
    if min_price <= 700.0:
        return "budget"
    if min_price <= 1800.0:
        return "midrange"
    return "premium"


def build_property_document(prop: PropertyData) -> str:
    """Build normalized text document for TF-IDF vectorization."""
    pet_tokens = [_clean_token_text(name) for name in prop.allowed_pet_type_names]
    size_tokens = [_clean_token_text(name) for name in prop.pet_size_names]
    facility_tokens = [_clean_token_text(name) for name in prop.facilities]

    parts = [
        _clean_token_text(prop.property_type),
        _clean_token_text(prop.province),
        _clean_token_text(prop.district),
        " ".join(facility_tokens),
        " ".join(pet_tokens),
        " ".join(size_tokens),
        _price_tier(prop.min_price),
        prop.title,
        prop.description,
    ]
    return " ".join(part for part in parts if part).strip()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return 2.0 * r * math.asin(min(1.0, math.sqrt(a)))


def _has_valid_property_coords(prop: PropertyData) -> bool:
    return (
        prop.latitude is not None
        and prop.longitude is not None
        and math.isfinite(prop.latitude)
        and math.isfinite(prop.longitude)
        and prop.latitude != 0.0
        and prop.longitude != 0.0
        and -90.0 <= prop.latitude <= 90.0
        and -180.0 <= prop.longitude <= 180.0
    )


def _compute_geo_signal(
    prop: PropertyData,
    user_lat: float | None,
    user_lng: float | None,
) -> tuple[float | None, float | None]:
    """Return (s_geo, distance_km) when both user coordinates and property coordinates are valid."""
    if user_lat is None or user_lng is None or not _has_valid_property_coords(prop):
        return None, None
    assert prop.latitude is not None and prop.longitude is not None
    distance_km = _haversine_km(user_lat, user_lng, prop.latitude, prop.longitude)
    s_geo = math.exp(-distance_km / 50.0)
    return s_geo, distance_km


def _format_near_you_reason(distance_km: float) -> str:
    if distance_km < 1.0:
        return "Near you (<1 km)"
    return f"Near you ({distance_km:.1f} km)"


def pet_matches_room(pet: UserPetData, rc: RoomCategoryData) -> bool:
    """Stage 1 safety rule (aligned with Booking Engine <= max-size parity)."""
    if pet.pet_type_id not in rc.pet_type_ids:
        return False
    if rc.pet_size_category_id is None:
        return True
    if pet.weight is not None and rc.max_weight is not None:
        return pet.weight <= rc.max_weight
    if pet.pet_size_category_id is not None:
        if pet.size_code is not None and rc.size_code is not None:
            return pet.size_code <= rc.size_code
        return pet.pet_size_category_id <= rc.pet_size_category_id
    return False


def pet_matches_property(pet: UserPetData, prop: PropertyData) -> bool:
    """Stage 1 safety rule: at least one active room category accepts pet species + up-to-max size."""
    return any(pet_matches_room(pet, rc) for rc in prop.room_categories)


def compute_room_size_fit(pet: UserPetData, rc: RoomCategoryData) -> float:
    """Size-fit micro-bonus in (0, 1] favoring exact-band or unrestricted rooms over oversized rooms."""
    if rc.pet_size_category_id is None:
        return 1.0
    if (
        pet.weight is not None
        and rc.min_weight is not None
        and rc.max_weight is not None
        and rc.min_weight <= pet.weight <= rc.max_weight
    ):
        return 1.0
    if pet.pet_size_category_id is not None and pet.pet_size_category_id == rc.pet_size_category_id:
        return 1.0
    if pet.size_code is not None and rc.size_code is not None:
        if rc.size_code == pet.size_code:
            return 1.0
        if rc.size_code - pet.size_code == 1:
            return 0.75
    if pet.weight is not None and rc.max_weight is not None and rc.max_weight <= pet.weight * 4.0:
        return 0.75
    if (
        pet.size_code is None
        and rc.size_code is None
        and pet.pet_size_category_id is not None
        and rc.pet_size_category_id is not None
        and rc.pet_size_category_id - pet.pet_size_category_id == 1
    ):
        return 0.75
    return 0.55


def compute_pet_size_fit(pet: UserPetData, prop: PropertyData) -> float:
    """Best size-fit score across all compatible rooms on a property for a matched pet."""
    best = 0.0
    for rc in prop.room_categories:
        if pet_matches_room(pet, rc):
            fit = compute_room_size_fit(pet, rc)
            if fit > best:
                best = fit
    return best


def _energy_bucket(rating: int) -> str:
    if rating >= 4:
        return "high"
    if rating == 3:
        return "medium"
    return "low"


def compute_pet_energy_facility_score(
    pet: UserPetData,
    prop: PropertyData,
) -> tuple[float, list[tuple[float, str, str]]]:
    """Compute energy-facility affinity score in [0, 1] and (weight, bucket, label) matches."""
    facilities_lower = {f.strip().lower() for f in prop.facilities}
    bucket = _energy_bucket(pet.energy_rating)
    matched: list[tuple[float, str, str]] = []
    score = 0.0

    if bucket == "high":
        checks = [
            ("outdoor play area", 0.30, "Outdoor Play Area"),
            ("swimming pool", 0.20, "Swimming Pool"),
            ("indoor play area", 0.20, "Indoor Play Area"),
            ("__room_area_6__", 0.15, "Spacious Room"),
            ("cctv 24h", 0.10, "CCTV 24h"),
            ("daily updates", 0.05, "Daily Updates"),
        ]
    elif bucket == "medium":
        checks = [
            ("indoor play area", 0.25, "Indoor Play Area"),
            ("air conditioning", 0.25, "Air Conditioning"),
            ("daily updates", 0.20, "Daily Updates"),
            ("cctv 24h", 0.15, "CCTV 24h"),
            ("outdoor play area", 0.15, "Outdoor Play Area"),
        ]
    else:
        checks = [
            ("separated zones", 0.30, "Separated Zones"),
            ("air conditioning", 0.25, "Air Conditioning"),
            ("cctv 24h", 0.20, "CCTV 24h"),
            ("nearby vet", 0.15, "Nearby Vet"),
            ("daily updates", 0.10, "Daily Updates"),
        ]

    for key, weight, label in checks:
        if key == "__room_area_6__":
            if prop.max_room_area_sqm >= 6.0:
                score += weight
                matched.append((weight, bucket, label))
        elif key in facilities_lower:
            score += weight
            matched.append((weight, bucket, label))

    return min(1.0, score), matched


def _build_synthetic_pet_query(pets: list[UserPetData]) -> str:
    tokens: list[str] = []
    for pet in pets:
        if pet.pet_type_name:
            tokens.append(_clean_token_text(pet.pet_type_name))
        if pet.size_name:
            tokens.append(_clean_token_text(pet.size_name))
        bucket = _energy_bucket(pet.energy_rating)
        if bucket == "high":
            tokens.append("Outdoor Play Area Swimming Pool Indoor Play Area CCTV 24h Daily Updates")
        elif bucket == "medium":
            tokens.append("Indoor Play Area Air Conditioning Daily Updates CCTV 24h Outdoor Play Area")
        else:
            tokens.append("Separated Zones Air Conditioning CCTV 24h Nearby Vet Daily Updates")
    return " ".join(tokens).strip()


def _l2_normalize_vector(vec: np.ndarray) -> np.ndarray | None:
    norm = float(np.linalg.norm(vec))
    if norm <= 1e-12:
        return None
    return vec / norm


@dataclass
class CatalogSnapshot:
    properties: list[PropertyData]
    prop_by_id: dict[int, PropertyData]
    prop_idx_by_id: dict[int, int]
    vectorizer: TfidfVectorizer | None
    tfidf_matrix: Any
    global_mean_rating: float
    max_log_engagement: float
    quality_scores: dict[int, float]
    popularity_scores: dict[int, float]
    built_at: float

    @classmethod
    def from_properties(
        cls,
        raw_properties: list[PropertyData],
        built_at: float | None = None,
    ) -> "CatalogSnapshot":
        # Defensive active/non-deleted/non-banned filter
        properties = [
            p
            for p in raw_properties
            if p.is_active and not p.is_banned_by_admin and not p.is_deleted and not p.host_banned
        ]
        properties.sort(key=lambda p: p.id)

        prop_by_id = {p.id: p for p in properties}
        prop_idx_by_id = {p.id: idx for idx, p in enumerate(properties)}

        rated = [p.avg_rating for p in properties if p.review_count > 0 and p.avg_rating > 0]
        global_mean_rating = (
            float(sum(rated) / len(rated)) if rated else FALLBACK_GLOBAL_MEAN_RATING
        )

        raw_logs: dict[int, float] = {}
        for p in properties:
            eng = 3 * max(0, p.booking_count) + 2 * max(0, p.favorite_count) + max(0, p.view_count_30d)
            raw_logs[p.id] = math.log(1.0 + eng)

        max_log_engagement = max(raw_logs.values(), default=0.0)

        quality_scores: dict[int, float] = {}
        popularity_scores: dict[int, float] = {}
        for p in properties:
            v = float(max(0, p.review_count))
            r = float(max(0.0, p.avg_rating))
            wr = (v / (v + BAYESIAN_M)) * r + (BAYESIAN_M / (v + BAYESIAN_M)) * global_mean_rating
            quality_scores[p.id] = min(1.0, max(0.0, wr / 5.0))
            popularity_scores[p.id] = (
                raw_logs[p.id] / max_log_engagement if max_log_engagement > 0.0 else 0.0
            )

        vectorizer: TfidfVectorizer | None = None
        tfidf_matrix: Any = None
        if properties:
            corpus = [build_property_document(p) for p in properties]
            if any(doc for doc in corpus):
                try:
                    vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
                    tfidf_matrix = vec.fit_transform(corpus)
                    vectorizer = vec
                except ValueError:
                    vectorizer = None
                    tfidf_matrix = None

        return cls(
            properties=properties,
            prop_by_id=prop_by_id,
            prop_idx_by_id=prop_idx_by_id,
            vectorizer=vectorizer,
            tfidf_matrix=tfidf_matrix,
            global_mean_rating=global_mean_rating,
            max_log_engagement=max_log_engagement,
            quality_scores=quality_scores,
            popularity_scores=popularity_scores,
            built_at=built_at if built_at is not None else time.monotonic(),
        )


@dataclass
class RecommendationResult:
    strategy: str
    snapshot_age_seconds: float
    total_candidates: int
    recommendations: list[RecommendationItem]


class HybridRecommender:
    """3-Stage Pet-Aware Hybrid Filtering Engine with 60s catalog snapshot cache."""

    def __init__(
        self,
        data_source: CatalogDataSource | None = None,
        snapshot_ttl_seconds: int = 60,
        time_decay_lambda: float = 0.05,
        initial_snapshot: CatalogSnapshot | None = None,
    ) -> None:
        self._data_source = data_source
        self._ttl = max(1, snapshot_ttl_seconds)
        self._decay_lambda = max(0.0, time_decay_lambda)
        self._lock = threading.RLock()
        self._snapshot: CatalogSnapshot | None = initial_snapshot

    def snapshot_age_seconds(self) -> float:
        with self._lock:
            if self._snapshot is None:
                return 0.0
            return round(max(0.0, time.monotonic() - self._snapshot.built_at), 2)

    def catalog_size(self) -> int:
        with self._lock:
            if self._snapshot is None:
                return 0
            return len(self._snapshot.properties)

    def get_snapshot(self, force_refresh: bool = False) -> CatalogSnapshot:
        with self._lock:
            now = time.monotonic()
            if (
                not force_refresh
                and self._snapshot is not None
                and (now - self._snapshot.built_at) < self._ttl
            ):
                return self._snapshot

            if self._data_source is None:
                if self._snapshot is not None and not force_refresh:
                    return self._snapshot
                if self._snapshot is None:
                    self._snapshot = CatalogSnapshot.from_properties([])
                return self._snapshot

            props = self._data_source.fetch_catalog_properties()
            self._snapshot = CatalogSnapshot.from_properties(props)
            return self._snapshot

    def refresh_snapshot(self) -> tuple[int, float]:
        snap = self.get_snapshot(force_refresh=True)
        return len(snap.properties), round(max(0.0, time.monotonic() - snap.built_at), 2)

    def _compute_content_scores(
        self,
        snapshot: CatalogSnapshot,
        user_ctx: UserContextData,
    ) -> tuple[np.ndarray, set[str], set[str]]:
        n_props = len(snapshot.properties)
        if n_props == 0 or snapshot.vectorizer is None or snapshot.tfidf_matrix is None:
            return np.zeros(n_props, dtype=float), set(), set()

        n_features = snapshot.tfidf_matrix.shape[1]
        behavior_vec = np.zeros(n_features, dtype=float)
        interacted_provinces: set[str] = set()
        interacted_types: set[str] = set()
        total_weight = 0.0

        for beh in user_ctx.behaviors:
            idx = snapshot.prop_idx_by_id.get(beh.property_id)
            if idx is None:
                continue
            prop = snapshot.properties[idx]
            if prop.host_id == user_ctx.user_id:
                continue
            base_w = ACTION_WEIGHTS.get(beh.action, 1.0)
            decay_w = base_w * math.exp(-self._decay_lambda * max(0.0, beh.days_elapsed))
            if decay_w <= 0.0:
                continue
            row_dense = snapshot.tfidf_matrix[idx].toarray().ravel()
            behavior_vec += decay_w * row_dense
            total_weight += decay_w
            if prop.province:
                interacted_provinces.add(prop.province)
            if prop.property_type:
                interacted_types.add(prop.property_type)

        v_behavior = _l2_normalize_vector(behavior_vec) if total_weight > 0.0 else None

        v_pet: np.ndarray | None = None
        if user_ctx.pets:
            pet_query = _build_synthetic_pet_query(user_ctx.pets)
            if pet_query:
                pet_sparse = snapshot.vectorizer.transform([pet_query])
                v_pet = _l2_normalize_vector(pet_sparse.toarray().ravel())

        if v_behavior is not None and v_pet is not None:
            v_user = _l2_normalize_vector(0.80 * v_behavior + 0.20 * v_pet)
        elif v_behavior is not None:
            v_user = v_behavior
        elif v_pet is not None:
            v_user = v_pet
        else:
            v_user = None

        if v_user is None:
            return np.zeros(n_props, dtype=float), interacted_provinces, interacted_types

        sims = cosine_similarity(v_user.reshape(1, -1), snapshot.tfidf_matrix).ravel()
        sims = np.clip(sims, 0.0, 1.0)
        return sims, interacted_provinces, interacted_types

    def _build_personalized_reasons(
        self,
        prop: PropertyData,
        matched_pets: list[UserPetData],
        total_pets: int,
        match_tier: str,
        energy_matched_labels: list[tuple[float, str, str]],
        s_content: float,
        s_compat: float,
        s_quality: float,
        s_popularity: float,
        interacted_provinces: set[str],
        interacted_types: set[str],
        s_geo: float | None = None,
        distance_km: float | None = None,
    ) -> list[str]:
        candidates: list[tuple[float, str]] = []

        # 0. Location proximity (high-priority when <= 35 km)
        if distance_km is not None and distance_km <= 35.0:
            candidates.append((0.35 + 0.15 * (s_geo or 0.0), _format_near_you_reason(distance_km)))

        # 1. Pet safety & species/breed fit
        if total_pets > 0:
            if match_tier == "all_pets":
                if total_pets == 1:
                    pet = matched_pets[0]
                    if pet.breed_name:
                        pet_reason = f"Ideal for your {pet.breed_name}"
                    else:
                        pet_reason = f"Fits your {_extract_english_label(pet.pet_type_name)}"
                else:
                    pet_reason = "Fits all your pets"
            else:
                names = ", ".join(p.name for p in matched_pets[:2] if p.name)
                if len(matched_pets) > 2:
                    names = f"{names} +{len(matched_pets) - 2}"
                pet_reason = (
                    f"Fits {names} ({len(matched_pets)}/{total_pets} pets)"
                    if names
                    else f"Fits {len(matched_pets)}/{total_pets} of your pets"
                )
            candidates.append((0.30 * s_compat + 0.20, pet_reason))

        # 2. Energy-facility affinity (bucket comes from the pet that actually matched the facility)
        if energy_matched_labels and matched_pets:
            energy_matched_labels.sort(key=lambda item: item[0], reverse=True)
            top_weight, top_bucket, top_label = energy_matched_labels[0]
            if top_bucket == "high":
                if top_label == "Spacious Room":
                    energy_reason = (
                        f"Spacious {int(round(prop.max_room_area_sqm))}m² room · High-energy match"
                    )
                else:
                    energy_reason = f"{top_label} · High-energy match"
            elif top_bucket == "medium":
                energy_reason = f"{top_label} · Balanced care match"
            else:
                energy_reason = f"{top_label} · Calm-pet friendly"
            candidates.append((0.30 * s_compat * top_weight + 0.05, energy_reason))

        # 3. Behavior / content affinity
        if s_content >= 0.12:
            if prop.province and prop.province in interacted_provinces:
                content_reason = f"Matches your interest in {prop.province}"
            elif prop.property_type and prop.property_type in interacted_types:
                content_reason = f"Matches your {prop.property_type} preference"
            else:
                content_reason = "Matches your stay preferences"
            candidates.append((0.40 * s_content, content_reason))

        # 4. Bayesian quality
        if prop.review_count > 0 and prop.avg_rating >= 4.2:
            candidates.append((0.20 * s_quality, f"Top rated ({prop.avg_rating:.1f}★)"))

        # 5. Engagement popularity
        if prop.booking_count >= 2 or prop.favorite_count >= 1:
            candidates.append((0.10 * s_popularity, "Popular pet stay"))

        candidates.sort(key=lambda item: item[0], reverse=True)
        reasons: list[str] = []
        for _, text in candidates:
            if text not in reasons:
                reasons.append(text)
            if len(reasons) == 3:
                break

        if not reasons:
            reasons.append(f"Pet-friendly stay in {prop.province}" if prop.province else "Pet-friendly stay")
        return reasons

    def _build_cold_start_reasons(
        self,
        prop: PropertyData,
        s_quality: float,
        s_popularity: float,
        s_geo: float | None = None,
        distance_km: float | None = None,
    ) -> list[str]:
        candidates: list[tuple[float, str]] = []
        if distance_km is not None and distance_km <= 35.0:
            candidates.append((0.70 + 0.15 * (s_geo or 0.0), _format_near_you_reason(distance_km)))
        if prop.review_count > 0 and prop.avg_rating >= 4.0:
            review_word = "review" if prop.review_count == 1 else "reviews"
            candidates.append(
                (0.65 * s_quality, f"Top rated ({prop.avg_rating:.1f}★ · {prop.review_count} {review_word})")
            )
        elif prop.review_count > 0:
            candidates.append((0.65 * s_quality, f"Rated {prop.avg_rating:.1f}★"))

        if prop.booking_count > 0:
            booking_label = (
                "Booked 1 time" if prop.booking_count == 1 else f"Booked {prop.booking_count}+ times"
            )
            candidates.append((0.35 * s_popularity + 0.05, booking_label))
        elif prop.favorite_count > 0:
            candidates.append((0.35 * s_popularity, "Saved by pet owners"))

        if prop.province:
            candidates.append((0.10, f"Popular in {prop.province}"))
        if prop.facilities:
            candidates.append((0.05, f"Includes {prop.facilities[0]}"))

        candidates.sort(key=lambda item: item[0], reverse=True)
        reasons: list[str] = []
        for _, text in candidates:
            if text not in reasons:
                reasons.append(text)
            if len(reasons) == 3:
                break
        if not reasons:
            reasons.append("Verified pet boarding stay")
        return reasons

    def _cold_start_rank(
        self,
        snapshot: CatalogSnapshot,
        candidates: list[PropertyData],
        limit: int,
        debug: bool,
        content_scores: np.ndarray | None = None,
        interacted_provinces: set[str] | None = None,
        interacted_types: set[str] | None = None,
        user_lat: float | None = None,
        user_lng: float | None = None,
    ) -> list[RecommendationItem]:
        scored_pool: list[
            tuple[PropertyData, float, float, float, float, float | None, float | None]
        ] = []
        for prop in candidates:
            s_q = snapshot.quality_scores[prop.id]
            s_p = snapshot.popularity_scores[prop.id]
            s_geo, distance_km = _compute_geo_signal(prop, user_lat, user_lng)
            s_c = 0.0
            if content_scores is not None:
                idx = snapshot.prop_idx_by_id[prop.id]
                s_c = float(content_scores[idx])
                base_score = 0.40 * s_c + 0.40 * s_q + 0.20 * s_p
                final_score = (
                    0.88 * base_score + 0.12 * s_geo if s_geo is not None else base_score
                )
            else:
                base_score = 0.65 * s_q + 0.35 * s_p
                final_score = (
                    0.85 * base_score + 0.15 * s_geo if s_geo is not None else base_score
                )
            scored_pool.append((prop, round(final_score, 4), s_c, s_q, s_p, s_geo, distance_km))

        # Greedy selection with light province diversity tie-breaking on equal scores
        remaining = list(scored_pool)
        province_counts: dict[str, int] = {}
        selected: list[
            tuple[PropertyData, float, float, float, float, float | None, float | None]
        ] = []

        while remaining and len(selected) < limit:
            remaining.sort(
                key=lambda item: (
                    -item[1],
                    province_counts.get(item[0].province, 0),
                    item[0].id,
                )
            )
            chosen = remaining.pop(0)
            selected.append(chosen)
            if chosen[0].province:
                province_counts[chosen[0].province] = province_counts.get(chosen[0].province, 0) + 1

        items: list[RecommendationItem] = []
        for prop, score, s_c, s_q, s_p, s_geo, distance_km in selected:
            if content_scores is not None and s_c >= 0.12:
                reasons = self._build_personalized_reasons(
                    prop=prop,
                    matched_pets=[],
                    total_pets=0,
                    match_tier="cold_start",
                    energy_matched_labels=[],
                    s_content=s_c,
                    s_compat=0.0,
                    s_quality=s_q,
                    s_popularity=s_p,
                    interacted_provinces=interacted_provinces or set(),
                    interacted_types=interacted_types or set(),
                    s_geo=s_geo,
                    distance_km=distance_km,
                )
            else:
                reasons = self._build_cold_start_reasons(
                    prop, s_q, s_p, s_geo=s_geo, distance_km=distance_km
                )

            items.append(
                RecommendationItem(
                    property_id=prop.id,
                    score=score,
                    match_tier="cold_start",
                    match_reasons=reasons,
                    score_breakdown=(
                        ScoreBreakdown(
                            s_content=round(s_c, 4),
                            s_compat=0.0,
                            s_quality=round(s_q, 4),
                            s_popularity=round(s_p, 4),
                            s_geo=round(s_geo, 4) if s_geo is not None else None,
                            distance_km=round(distance_km, 1) if distance_km is not None else None,
                        )
                        if debug
                        else None
                    ),
                )
            )
        return items

    def recommend_cold_start(
        self,
        limit: int = 10,
        debug: bool = False,
        exclude_host_id: int | None = None,
        user_lat: float | None = None,
        user_lng: float | None = None,
    ) -> RecommendationResult:
        snapshot = self.get_snapshot()
        age = round(max(0.0, time.monotonic() - snapshot.built_at), 2)
        candidates = [
            p
            for p in snapshot.properties
            if exclude_host_id is None or p.host_id != exclude_host_id
        ]
        items = self._cold_start_rank(
            snapshot=snapshot,
            candidates=candidates,
            limit=limit,
            debug=debug,
            user_lat=user_lat,
            user_lng=user_lng,
        )
        return RecommendationResult(
            strategy="cold_start",
            snapshot_age_seconds=age,
            total_candidates=len(candidates),
            recommendations=items,
        )

    def recommend_for_user(
        self,
        user_id: int,
        limit: int = 10,
        debug: bool = False,
        user_context: UserContextData | None = None,
        user_lat: float | None = None,
        user_lng: float | None = None,
    ) -> RecommendationResult:
        snapshot = self.get_snapshot()
        age = round(max(0.0, time.monotonic() - snapshot.built_at), 2)

        if user_context is None:
            if self._data_source is None:
                user_context = UserContextData(user_id=user_id)
            else:
                user_context = self._data_source.fetch_user_context(user_id)

        candidates = [p for p in snapshot.properties if p.host_id != user_id]
        content_scores, interacted_provinces, interacted_types = self._compute_content_scores(
            snapshot, user_context
        )

        total_pets = len(user_context.pets)
        if total_pets == 0:
            has_usable_behavior = bool(np.any(content_scores > 0))
            items = self._cold_start_rank(
                snapshot=snapshot,
                candidates=candidates,
                limit=limit,
                debug=debug,
                content_scores=content_scores if has_usable_behavior else None,
                interacted_provinces=interacted_provinces,
                interacted_types=interacted_types,
                user_lat=user_lat,
                user_lng=user_lng,
            )
            return RecommendationResult(
                strategy="hybrid_behavior_v2" if has_usable_behavior else "cold_start",
                snapshot_age_seconds=age,
                total_candidates=len(candidates),
                recommendations=items,
            )

        tier_a: list[tuple[float, int, RecommendationItem]] = []
        tier_b: list[tuple[int, float, int, RecommendationItem]] = []

        for prop in candidates:
            matched_pets = [pet for pet in user_context.pets if pet_matches_property(pet, prop)]
            matched_count = len(matched_pets)
            if matched_count == 0:
                continue

            match_tier = "all_pets" if matched_count == total_pets else "partial_pets"

            energy_scores: list[float] = []
            energy_labels: list[tuple[float, str, str]] = []
            size_fit_scores: list[float] = []
            for pet in matched_pets:
                ef_score, labels = compute_pet_energy_facility_score(pet, prop)
                energy_scores.append(ef_score)
                energy_labels.extend(labels)
                size_fit_scores.append(compute_pet_size_fit(pet, prop))

            avg_energy_score = sum(energy_scores) / matched_count
            coverage = matched_count / total_pets
            avg_size_fit = sum(size_fit_scores) / matched_count
            s_compat = 0.55 * avg_energy_score + 0.30 * coverage + 0.15 * avg_size_fit

            idx = snapshot.prop_idx_by_id[prop.id]
            s_content = float(content_scores[idx])
            s_quality = snapshot.quality_scores[prop.id]
            s_popularity = snapshot.popularity_scores[prop.id]

            base_hybrid_score = (
                0.40 * s_content
                + 0.30 * s_compat
                + 0.20 * s_quality
                + 0.10 * s_popularity
            )
            s_geo, distance_km = _compute_geo_signal(prop, user_lat, user_lng)
            if s_geo is not None:
                final_score = 0.88 * base_hybrid_score + 0.12 * s_geo
            else:
                final_score = base_hybrid_score
            rounded_score = round(final_score, 4)

            reasons = self._build_personalized_reasons(
                prop=prop,
                matched_pets=matched_pets,
                total_pets=total_pets,
                match_tier=match_tier,
                energy_matched_labels=energy_labels,
                s_content=s_content,
                s_compat=s_compat,
                s_quality=s_quality,
                s_popularity=s_popularity,
                interacted_provinces=interacted_provinces,
                interacted_types=interacted_types,
                s_geo=s_geo,
                distance_km=distance_km,
            )

            item = RecommendationItem(
                property_id=prop.id,
                score=rounded_score,
                match_tier=match_tier,
                match_reasons=reasons,
                score_breakdown=(
                    ScoreBreakdown(
                        s_content=round(s_content, 4),
                        s_compat=round(s_compat, 4),
                        s_quality=round(s_quality, 4),
                        s_popularity=round(s_popularity, 4),
                        s_geo=round(s_geo, 4) if s_geo is not None else None,
                        distance_km=round(distance_km, 1) if distance_km is not None else None,
                    )
                    if debug
                    else None
                ),
            )

            if match_tier == "all_pets":
                tier_a.append((rounded_score, prop.id, item))
            else:
                tier_b.append((matched_count, rounded_score, prop.id, item))

        tier_a.sort(key=lambda row: (-row[0], row[1]))
        tier_b.sort(key=lambda row: (-row[0], -row[1], row[2]))

        total_eligible = len(tier_a) + len(tier_b)
        ordered = [row[2] for row in tier_a]
        if len(ordered) < limit:
            ordered.extend(row[3] for row in tier_b)

        return RecommendationResult(
            strategy="hybrid_pet_aware_v2",
            snapshot_age_seconds=age,
            total_candidates=total_eligible,
            recommendations=ordered[:limit],
        )

    def recommend_similar(
        self,
        property_id: int,
        limit: int = 8,
        viewer_id: int | None = None,
        debug: bool = False,
    ) -> RecommendationResult | None:
        snapshot = self.get_snapshot()
        age = round(max(0.0, time.monotonic() - snapshot.built_at), 2)

        target = snapshot.prop_by_id.get(property_id)
        if target is None:
            return None

        target_idx = snapshot.prop_idx_by_id[property_id]
        if snapshot.tfidf_matrix is not None:
            sims = cosine_similarity(
                snapshot.tfidf_matrix[target_idx], snapshot.tfidf_matrix
            ).ravel()
            sims = np.clip(sims, 0.0, 1.0)
        else:
            sims = np.zeros(len(snapshot.properties), dtype=float)

        target_pets = target.allowed_pet_type_ids
        target_pet_names = {_extract_english_label(n) for n in target.allowed_pet_type_names}
        target_facilities = set(target.facilities)

        scored: list[tuple[float, int, RecommendationItem]] = []
        candidates = [
            p
            for p in snapshot.properties
            if p.id != property_id and (viewer_id is None or p.host_id != viewer_id)
        ]

        for cand in candidates:
            cand_idx = snapshot.prop_idx_by_id[cand.id]
            tfidf_cos = float(sims[cand_idx])

            union_pets = target_pets | cand.allowed_pet_type_ids
            pet_jaccard = (
                len(target_pets & cand.allowed_pet_type_ids) / len(union_pets)
                if union_pets
                else 0.0
            )

            # Geo + Price proximity
            if (
                target.latitude is not None
                and target.longitude is not None
                and cand.latitude is not None
                and cand.longitude is not None
            ):
                dist_km = _haversine_km(
                    target.latitude, target.longitude, cand.latitude, cand.longitude
                )
                geo_sim = math.exp(-dist_km / 50.0)
            else:
                if target.province and cand.province and target.province == cand.province:
                    if target.district and cand.district and target.district == cand.district:
                        geo_sim = 1.0
                    else:
                        geo_sim = 0.7
                else:
                    geo_sim = 0.2

            price_denom = max(target.min_price, cand.min_price, 500.0)
            price_sim = 1.0 - min(1.0, abs(target.min_price - cand.min_price) / price_denom)
            geo_price_proximity = 0.5 * geo_sim + 0.5 * price_sim

            s_quality = snapshot.quality_scores[cand.id]
            s_popularity = snapshot.popularity_scores[cand.id]

            final_score = (
                0.55 * tfidf_cos
                + 0.20 * pet_jaccard
                + 0.15 * geo_price_proximity
                + 0.10 * s_quality
            )
            rounded_score = round(final_score, 4)

            reason_candidates: list[tuple[float, str]] = []
            if target.province and cand.province and target.province == cand.province:
                reason_candidates.append((0.15 * geo_price_proximity + 0.05, f"Same province ({cand.province})"))
            if target.property_type and cand.property_type and target.property_type == cand.property_type:
                reason_candidates.append((0.55 * tfidf_cos + 0.02, f"Similar {cand.property_type}"))

            shared_pets = sorted(
                target_pet_names & {_extract_english_label(n) for n in cand.allowed_pet_type_names}
            )
            if shared_pets and pet_jaccard > 0:
                reason_candidates.append(
                    (0.20 * pet_jaccard, f"Accepts {', '.join(shared_pets[:2])}")
                )

            if price_sim >= 0.75:
                reason_candidates.append((0.15 * price_sim * 0.5, "Similar price range"))

            shared_fac = [f for f in cand.facilities if f in target_facilities]
            if shared_fac:
                reason_candidates.append((0.20 * tfidf_cos, f"Both offer {shared_fac[0]}"))

            if cand.review_count > 0 and cand.avg_rating >= 4.2:
                reason_candidates.append((0.10 * s_quality, f"Top rated ({cand.avg_rating:.1f}★)"))

            reason_candidates.sort(key=lambda item: item[0], reverse=True)
            reasons: list[str] = []
            for _, text in reason_candidates:
                if text not in reasons:
                    reasons.append(text)
                if len(reasons) == 3:
                    break
            if not reasons:
                reasons.append("Similar pet boarding option")

            s_compat_equiv = round((0.20 * pet_jaccard + 0.15 * geo_price_proximity) / 0.35, 4)

            item = RecommendationItem(
                property_id=cand.id,
                score=rounded_score,
                match_tier="similar",
                match_reasons=reasons,
                score_breakdown=(
                    ScoreBreakdown(
                        s_content=round(tfidf_cos, 4),
                        s_compat=s_compat_equiv,
                        s_quality=round(s_quality, 4),
                        s_popularity=round(s_popularity, 4),
                    )
                    if debug
                    else None
                ),
            )
            scored.append((rounded_score, cand.id, item))

        scored.sort(key=lambda row: (-row[0], row[1]))
        return RecommendationResult(
            strategy="similar_properties",
            snapshot_age_seconds=age,
            total_candidates=len(candidates),
            recommendations=[row[2] for row in scored[:limit]],
        )
