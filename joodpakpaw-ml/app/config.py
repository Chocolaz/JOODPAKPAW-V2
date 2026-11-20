from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_ENV_PATH = _SERVICE_ROOT / ".env"

if _DEFAULT_ENV_PATH.exists():
    load_dotenv(dotenv_path=_DEFAULT_ENV_PATH, override=False)

PRISMA_UNSUPPORTED_QUERY_PARAMS = frozenset({"schema", "pgbouncer", "connection_limit"})


def sanitize_database_url(raw_url: str | None) -> str:
    """Strip Prisma-only query params while preserving libpq params like sslmode."""
    if not raw_url:
        return ""
    cleaned = raw_url.strip()
    if not cleaned:
        return ""

    parts = urlsplit(cleaned)
    if not parts.query:
        return cleaned

    filtered_pairs = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in PRISMA_UNSUPPORTED_QUERY_PARAMS
    ]
    new_query = urlencode(filtered_pairs, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


@dataclass(frozen=True)
class Settings:
    port: int
    database_url: str
    snapshot_ttl_seconds: int
    time_decay_lambda: float
    ml_internal_secret: str


def load_settings() -> Settings:
    if _DEFAULT_ENV_PATH.exists():
        load_dotenv(dotenv_path=_DEFAULT_ENV_PATH, override=False)

    return Settings(
        port=int(os.getenv("PORT", "5000")),
        database_url=sanitize_database_url(os.getenv("DATABASE_URL", "")),
        snapshot_ttl_seconds=max(1, int(os.getenv("SNAPSHOT_TTL_SECONDS", "60"))),
        time_decay_lambda=max(0.0, float(os.getenv("TIME_DECAY_LAMBDA", "0.05"))),
        ml_internal_secret=os.getenv("ML_INTERNAL_SECRET", "").strip(),
    )
