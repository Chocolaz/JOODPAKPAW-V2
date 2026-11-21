from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


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
    match_tier: Literal["all_pets", "partial_pets", "cold_start", "similar"]
    match_reasons: list[str] = Field(default_factory=list, max_length=3)
    score_breakdown: Optional[ScoreBreakdown] = None


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
