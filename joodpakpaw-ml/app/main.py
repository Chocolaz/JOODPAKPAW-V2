from __future__ import annotations

import hmac
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query, Request

from app.config import Settings, load_settings
from app.database import DatabaseClient
from app.engine.hybrid import HybridRecommender
from app.schemas import (
    HealthResponse,
    RankCandidatesRequest,
    RecommendationResponse,
    RefreshResponse,
)


def create_app(
    settings: Settings | None = None,
    data_source: DatabaseClient | None = None,
    recommender: HybridRecommender | None = None,
) -> FastAPI:
    active_settings = settings or load_settings()
    active_db = data_source or DatabaseClient(active_settings.database_url)
    active_recommender = recommender or HybridRecommender(
        data_source=active_db,
        snapshot_ttl_seconds=active_settings.snapshot_ttl_seconds,
        time_decay_lambda=active_settings.time_decay_lambda,
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        if data_source is None and active_settings.database_url:
            if active_db.open_if_configured():
                try:
                    active_recommender.get_snapshot()
                except Exception:
                    pass
        yield
        if data_source is None:
            active_db.close()

    application = FastAPI(
        title="JoodPakPaw V2 Hybrid ML Service",
        version="2.0.0",
        lifespan=lifespan,
    )

    application.state.settings = active_settings
    application.state.db = active_db
    application.state.recommender = active_recommender

    @application.get("/health", response_model=HealthResponse)
    def health(request: Request) -> HealthResponse:
        db: DatabaseClient = request.app.state.db
        rec: HybridRecommender = request.app.state.recommender
        db_connected = db.ping()
        if db_connected and rec.catalog_size() == 0:
            try:
                rec.get_snapshot()
            except Exception:
                pass
        return HealthResponse(
            status="ok",
            service="joodpakpaw-ml",
            catalog_size=rec.catalog_size(),
            snapshot_age_seconds=rec.snapshot_age_seconds(),
            db_connected=db_connected,
        )

    @application.get(
        "/ml/v1/recommend/user/{user_id}",
        response_model=RecommendationResponse,
        response_model_exclude_none=True,
    )
    def recommend_for_user(
        request: Request,
        user_id: int,
        limit: int = Query(default=10, ge=1, le=50),
        debug: bool = Query(default=False),
        lat: Optional[float] = Query(default=None, ge=-90.0, le=90.0),
        lng: Optional[float] = Query(default=None, ge=-180.0, le=180.0),
    ) -> RecommendationResponse:
        rec: HybridRecommender = request.app.state.recommender
        result = rec.recommend_for_user(
            user_id=user_id,
            limit=limit,
            debug=debug,
            user_lat=lat,
            user_lng=lng,
        )
        return RecommendationResponse(
            strategy=result.strategy,
            snapshot_age_seconds=result.snapshot_age_seconds,
            total_candidates=result.total_candidates,
            recommendations=result.recommendations,
        )

    @application.get(
        "/ml/v1/recommend/cold-start",
        response_model=RecommendationResponse,
        response_model_exclude_none=True,
    )
    def recommend_cold_start(
        request: Request,
        limit: int = Query(default=10, ge=1, le=50),
        debug: bool = Query(default=False),
        lat: Optional[float] = Query(default=None, ge=-90.0, le=90.0),
        lng: Optional[float] = Query(default=None, ge=-180.0, le=180.0),
    ) -> RecommendationResponse:
        rec: HybridRecommender = request.app.state.recommender
        result = rec.recommend_cold_start(
            limit=limit,
            debug=debug,
            user_lat=lat,
            user_lng=lng,
        )
        return RecommendationResponse(
            strategy=result.strategy,
            snapshot_age_seconds=result.snapshot_age_seconds,
            total_candidates=result.total_candidates,
            recommendations=result.recommendations,
        )

    @application.get(
        "/ml/v1/recommend/similar/{property_id}",
        response_model=RecommendationResponse,
        response_model_exclude_none=True,
    )
    def recommend_similar(
        request: Request,
        property_id: int,
        limit: int = Query(default=8, ge=1, le=50),
        viewer_id: Optional[str] = Query(default=None),
        debug: bool = Query(default=False),
    ) -> RecommendationResponse:
        parsed_viewer_id: int | None = None
        if viewer_id is not None and viewer_id.strip() != "":
            try:
                parsed_viewer_id = int(viewer_id.strip())
            except ValueError as exc:
                raise HTTPException(status_code=422, detail="viewer_id must be an integer") from exc

        rec: HybridRecommender = request.app.state.recommender
        result = rec.recommend_similar(
            property_id=property_id,
            limit=limit,
            viewer_id=parsed_viewer_id,
            debug=debug,
        )
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Property {property_id} not found in active catalog",
            )
        return RecommendationResponse(
            strategy=result.strategy,
            snapshot_age_seconds=result.snapshot_age_seconds,
            total_candidates=result.total_candidates,
            recommendations=result.recommendations,
        )

    @application.post(
        "/ml/v1/rank/candidates",
        response_model=RecommendationResponse,
        response_model_exclude_none=True,
    )
    def rank_candidates(
        request: Request,
        payload: RankCandidatesRequest,
    ) -> RecommendationResponse:
        rec: HybridRecommender = request.app.state.recommender
        result = rec.rank_candidates(
            user_id=payload.user_id,
            candidate_property_ids=payload.candidate_property_ids,
            filter_context=payload.filter_context,
            user_lat=payload.lat,
            user_lng=payload.lng,
            debug=payload.debug,
        )
        return RecommendationResponse(
            strategy=result.strategy,
            snapshot_age_seconds=result.snapshot_age_seconds,
            total_candidates=result.total_candidates,
            recommendations=result.recommendations,
        )

    @application.post("/ml/v1/refresh", response_model=RefreshResponse)
    def refresh_catalog(
        request: Request,
        x_ml_secret: Optional[str] = Header(default=None, alias="X-ML-Secret"),
    ) -> RefreshResponse:
        cfg: Settings = request.app.state.settings
        if cfg.ml_internal_secret:
            if not x_ml_secret or not hmac.compare_digest(x_ml_secret, cfg.ml_internal_secret):
                raise HTTPException(status_code=403, detail="Invalid or missing X-ML-Secret")

        rec: HybridRecommender = request.app.state.recommender
        catalog_size, snapshot_age = rec.refresh_snapshot()
        return RefreshResponse(
            refreshed=True,
            catalog_size=catalog_size,
            snapshot_age_seconds=snapshot_age,
        )

    return application


app = create_app()
