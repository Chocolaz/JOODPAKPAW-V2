from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ScoreBreakdown(BaseModel):
    s_content: float
    s_compat: float
    s_quality: float
    s_popularity: float
    s_geo: Optional[float] = None
    distance_km: Optional[float] = None


class RecommendationItem(BaseModel):
    property_id: int
    score: float
    match_tier: Literal["all_pets", "partial_pets", "cold_start", "similar", "context_fallback"]
    match_reasons: list[str] = Field(default_factory=list, max_length=3)
    score_breakdown: Optional[ScoreBreakdown] = None


class RankFilterContext(BaseModel):
    pet_types: list[str] = Field(default_factory=list)
    pet_profile_ids: list[int] = Field(default_factory=list)
    facilities: list[str] = Field(default_factory=list)
    max_price: Optional[float] = None
    province: Optional[str] = None


class RankCandidatesRequest(BaseModel):
    user_id: Optional[int] = None
    candidate_property_ids: list[int] = Field(min_length=1, max_length=500)
    filter_context: RankFilterContext = Field(default_factory=RankFilterContext)
    pet_types: list[str] = Field(default_factory=list)
    pet_profile_ids: list[int] = Field(default_factory=list)
    facilities: list[str] = Field(default_factory=list)
    max_price: Optional[float] = None
    province: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    debug: bool = False

    @model_validator(mode="after")
    def _merge_top_level_filters(self) -> "RankCandidatesRequest":
        """Accept both nested filter_context and top-level filter fields from API callers."""
        ctx = self.filter_context
        self.filter_context = RankFilterContext(
            pet_types=ctx.pet_types or self.pet_types,
            pet_profile_ids=ctx.pet_profile_ids or self.pet_profile_ids,
            facilities=ctx.facilities or self.facilities,
            max_price=ctx.max_price if ctx.max_price is not None else self.max_price,
            province=ctx.province if ctx.province is not None else self.province,
        )
        return self


class RecommendationResponse(BaseModel):
    strategy: str
    snapshot_age_seconds: float
    total_candidates: int
    recommendations: list[RecommendationItem]


class HealthResponse(BaseModel):
    status: str
    service: str
    catalog_size: int
    snapshot_age_seconds: float
    db_connected: bool


class RefreshResponse(BaseModel):
    refreshed: bool
    catalog_size: int
    snapshot_age_seconds: float
