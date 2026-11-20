from __future__ import annotations

import logging
import threading
from typing import Protocol

from psycopg_pool import ConnectionPool

from app.models import (
    PropertyData,
    RoomCategoryData,
    UserBehaviorData,
    UserContextData,
    UserPetData,
)

logger = logging.getLogger(__name__)


class CatalogDataSource(Protocol):
    def ping(self) -> bool: ...
    def fetch_catalog_properties(self) -> list[PropertyData]: ...
    def fetch_user_context(self, user_id: int) -> UserContextData: ...
    def close(self) -> None: ...


class DatabaseClient:
    """Read-only PostgreSQL access via PgBouncer-safe psycopg_pool."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._lock = threading.Lock()
        self._pool: ConnectionPool | None = None
        self._opened = False

    def _get_pool(self) -> ConnectionPool:
        if not self._database_url:
            raise RuntimeError("DATABASE_URL is not configured")

        with self._lock:
            if self._pool is None:
                self._pool = ConnectionPool(
                    conninfo=self._database_url,
                    min_size=1,
                    max_size=3,
                    timeout=5.0,
                    kwargs={"prepare_threshold": None},
                    open=False,
                )
            if not self._opened:
                self._pool.open(wait=True, timeout=5.0)
                self._opened = True
            return self._pool

    def open_if_configured(self) -> bool:
        if not self._database_url:
            return False
        try:
            self._get_pool()
            return True
        except Exception as exc:
            logger.warning("Database pool warm-up failed (will retry lazily): %s", exc)
            return False

    def close(self) -> None:
        with self._lock:
            if self._pool is not None and self._opened:
                try:
                    self._pool.close()
                finally:
                    self._opened = False

    def ping(self) -> bool:
        if not self._database_url:
            return False
        try:
            pool = self._get_pool()
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    row = cur.fetchone()
                    return bool(row and row[0] == 1)
        except Exception as exc:
            logger.warning("Database ping failed: %s", exc)
            return False

    def fetch_catalog_properties(self) -> list[PropertyData]:
        pool = self._get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      p.id,
                      p.host_id,
                      p.title,
                      COALESCE(p.description, '') AS description,
                      COALESCE(pt.name, '') AS property_type,
                      COALESCE(p.province, '') AS province,
                      COALESCE(p.district, '') AS district,
                      COALESCE(p.subdistrict, '') AS subdistrict,
                      p.latitude::float,
                      p.longitude::float,
                      COALESCE(p.min_price, 0)::float AS min_price,
                      COALESCE(p.avg_rating, 0)::float AS avg_rating,
                      COALESCE(p.review_count, 0)::int AS review_count,
                      COALESCE(p.booking_count, 0)::int AS booking_count
                    FROM properties p
                    INNER JOIN users u
                      ON u.id = p.host_id
                     AND u.deleted_at IS NULL
                     AND u.is_banned_all_properties = false
                    LEFT JOIN property_types pt
                      ON pt.id = p.property_type_id
                     AND pt.deleted_at IS NULL
                    WHERE p.is_active = true
                      AND p.is_banned_by_admin = false
                      AND p.deleted_at IS NULL
                    ORDER BY p.id ASC
                    """
                )
                prop_rows = cur.fetchall()

                props_by_id: dict[int, PropertyData] = {}
                for row in prop_rows:
                    prop = PropertyData(
                        id=int(row[0]),
                        host_id=int(row[1]),
                        title=str(row[2] or ""),
                        description=str(row[3] or ""),
                        property_type=str(row[4] or ""),
                        province=str(row[5] or ""),
                        district=str(row[6] or ""),
                        subdistrict=str(row[7] or ""),
                        latitude=float(row[8]) if row[8] is not None else None,
                        longitude=float(row[9]) if row[9] is not None else None,
                        min_price=float(row[10] or 0.0),
                        avg_rating=float(row[11] or 0.0),
                        review_count=int(row[12] or 0),
                        booking_count=int(row[13] or 0),
                    )
                    props_by_id[prop.id] = prop

                if not props_by_id:
                    return []

                # Room categories + pet sizes + accepted pet types
                cur.execute(
                    """
                    SELECT
                      rc.property_id,
                      rc.id AS room_category_id,
                      rc.pet_size_category_id,
                      psc.code::int AS size_code,
                      psc.name AS size_name,
                      psc.min::float AS min_weight,
                      psc.max::float AS max_weight,
                      COALESCE(rc.room_size_width * rc.room_size_length, 0)::float AS room_area,
                      COALESCE(
                        ARRAY_AGG(DISTINCT rhp.pet_id)
                          FILTER (WHERE rhp.pet_id IS NOT NULL AND pet.deleted_at IS NULL),
                        ARRAY[]::int[]
                      ) AS pet_type_ids,
                      COALESCE(
                        ARRAY_AGG(DISTINCT pet.name)
                          FILTER (WHERE pet.name IS NOT NULL AND pet.deleted_at IS NULL),
                        ARRAY[]::text[]
                      ) AS pet_type_names
                    FROM room_categories rc
                    INNER JOIN properties p
                      ON p.id = rc.property_id
                     AND p.is_active = true
                     AND p.is_banned_by_admin = false
                     AND p.deleted_at IS NULL
                    INNER JOIN users u
                      ON u.id = p.host_id
                     AND u.deleted_at IS NULL
                     AND u.is_banned_all_properties = false
                    LEFT JOIN pet_size_categories psc
                      ON psc.id = rc.pet_size_category_id
                     AND psc.deleted_at IS NULL
                    LEFT JOIN room_has_pets rhp
                      ON rhp.room_category_id = rc.id
                    LEFT JOIN pets pet
                      ON pet.id = rhp.pet_id
                     AND pet.deleted_at IS NULL
                    WHERE rc.deleted_at IS NULL
                    GROUP BY
                      rc.property_id,
                      rc.id,
                      rc.pet_size_category_id,
                      psc.code,
                      psc.name,
                      psc.min,
                      psc.max,
                      rc.room_size_width,
                      rc.room_size_length
                    ORDER BY rc.property_id ASC, rc.id ASC
                    """
                )
                pet_names_by_prop: dict[int, set[str]] = {pid: set() for pid in props_by_id}
                size_names_by_prop: dict[int, set[str]] = {pid: set() for pid in props_by_id}
                for row in cur.fetchall():
                    prop_id = int(row[0])
                    prop = props_by_id.get(prop_id)
                    if prop is None:
                        continue
                    pet_ids = frozenset(int(x) for x in (row[8] or []))
                    pet_names = [str(x) for x in (row[9] or []) if x]
                    size_code = int(row[3]) if row[3] is not None else None
                    size_name = str(row[4]) if row[4] else None
                    area = float(row[7] or 0.0)

                    rc = RoomCategoryData(
                        id=int(row[1]),
                        pet_size_category_id=int(row[2]) if row[2] is not None else None,
                        size_code=size_code,
                        size_name=size_name,
                        min_weight=float(row[5]) if row[5] is not None else None,
                        max_weight=float(row[6]) if row[6] is not None else None,
                        room_area_sqm=area,
                        pet_type_ids=pet_ids,
                    )
                    prop.room_categories.append(rc)
                    prop.allowed_pet_type_ids.update(pet_ids)
                    pet_names_by_prop[prop_id].update(pet_names)
                    if size_name:
                        size_names_by_prop[prop_id].add(size_name)
                    if area > prop.max_room_area_sqm:
                        prop.max_room_area_sqm = area

                for pid, prop in props_by_id.items():
                    prop.allowed_pet_type_names = sorted(pet_names_by_prop[pid])
                    prop.pet_size_names = sorted(size_names_by_prop[pid])

                # Property facilities
                cur.execute(
                    """
                    SELECT phf.property_id, f.name
                    FROM properties_has_facilities phf
                    INNER JOIN facilities f
                      ON f.id = phf.facility_id
                     AND f.deleted_at IS NULL
                    INNER JOIN properties p
                      ON p.id = phf.property_id
                     AND p.is_active = true
                     AND p.is_banned_by_admin = false
                     AND p.deleted_at IS NULL
                    INNER JOIN users u
                      ON u.id = p.host_id
                     AND u.deleted_at IS NULL
                     AND u.is_banned_all_properties = false
                    ORDER BY phf.property_id ASC, f.id ASC
                    """
                )
                for row in cur.fetchall():
                    prop = props_by_id.get(int(row[0]))
                    if prop is not None and row[1]:
                        prop.facilities.append(str(row[1]))

                # Live favorite counts (excluding soft-deleted folders)
                cur.execute(
                    """
                    SELECT fp.property_id, COUNT(DISTINCT ff.user_id)::int AS favorite_count
                    FROM favorite_properties fp
                    INNER JOIN favorite_folders ff
                      ON ff.id = fp.folder_id
                     AND ff.deleted_at IS NULL
                    GROUP BY fp.property_id
                    """
                )
                for row in cur.fetchall():
                    prop = props_by_id.get(int(row[0]))
                    if prop is not None:
                        prop.favorite_count = int(row[1] or 0)

                # Recent 30d view counts
                cur.execute(
                    """
                    SELECT ub.reference_record::int AS property_id, COUNT(*)::int AS view_count
                    FROM user_behaviors ub
                    INNER JOIN user_behavior_categories ubc
                      ON ubc.id = ub.behavior_category_id
                    WHERE ubc.name = 'view'
                      AND ub.reference_table = 'properties'
                      AND ub.reference_record ~ '^\\d+$'
                      AND ub.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY ub.reference_record::int
                    """
                )
                for row in cur.fetchall():
                    prop = props_by_id.get(int(row[0]))
                    if prop is not None:
                        prop.view_count_30d = int(row[1] or 0)

                return list(props_by_id.values())

    def fetch_user_context(self, user_id: int) -> UserContextData:
        pool = self._get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Active pets for user
                cur.execute(
                    """
                    SELECT
                      pp.id,
                      pp.name,
                      pp.pet_type_id,
                      pet.name AS pet_type_name,
                      pb.breed AS breed_name,
                      pp.weight::float AS weight,
                      pp.pet_size_category_id,
                      psc.code::int AS size_code,
                      psc.name AS size_name,
                      COALESCE(ppe.rating, 3)::int AS energy_rating
                    FROM pet_profiles pp
                    INNER JOIN pets pet
                      ON pet.id = pp.pet_type_id
                     AND pet.deleted_at IS NULL
                    LEFT JOIN pet_breeds pb
                      ON pb.id = pp.breed_id
                     AND pb.deleted_at IS NULL
                    LEFT JOIN pet_size_categories psc
                      ON psc.id = pp.pet_size_category_id
                     AND psc.deleted_at IS NULL
                    LEFT JOIN pet_profile_energies ppe
                      ON ppe.id = pp.pet_energy_id
                    WHERE pp.guest_id = %s
                      AND pp.deleted_at IS NULL
                    ORDER BY pp.id ASC
                    """,
                    (user_id,),
                )
                pets = [
                    UserPetData(
                        id=int(row[0]),
                        name=str(row[1] or ""),
                        pet_type_id=int(row[2]),
                        pet_type_name=str(row[3] or ""),
                        breed_name=str(row[4]) if row[4] else None,
                        weight=float(row[5]) if row[5] is not None else None,
                        pet_size_category_id=int(row[6]) if row[6] is not None else None,
                        size_code=int(row[7]) if row[7] is not None else None,
                        size_name=str(row[8]) if row[8] else None,
                        energy_rating=int(row[9]) if row[9] is not None else 3,
                    )
                    for row in cur.fetchall()
                ]

                # Reconciled user behaviors
                cur.execute(
                    """
                    SELECT
                      ub.reference_record::int AS property_id,
                      ubc.name AS action,
                      GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - ub.created_at)) / 86400.0)::float AS days_elapsed
                    FROM user_behaviors ub
                    INNER JOIN user_behavior_categories ubc
                      ON ubc.id = ub.behavior_category_id
                    WHERE ub.user_id = %s
                      AND ub.reference_table = 'properties'
                      AND ub.reference_record ~ '^\\d+$'
                      AND (
                        ubc.name = 'view'
                        OR (
                          ubc.name = 'favorite'
                          AND EXISTS (
                            SELECT 1
                            FROM favorite_properties fp
                            INNER JOIN favorite_folders ff
                              ON ff.id = fp.folder_id
                            WHERE ff.user_id = %s
                              AND ff.deleted_at IS NULL
                              AND fp.property_id = ub.reference_record::int
                          )
                        )
                        OR (
                          ubc.name = 'book'
                          AND EXISTS (
                            SELECT 1
                            FROM bookings b
                            WHERE b.guest_id = %s
                              AND b.deleted_at IS NULL
                              AND b.booking_status <> 'cancelled'
                              AND b.property_id = ub.reference_record::int
                          )
                        )
                      )
                    ORDER BY ub.created_at DESC
                    """,
                    (user_id, user_id, user_id),
                )
                behaviors = [
                    UserBehaviorData(
                        property_id=int(row[0]),
                        action=str(row[1]),
                        days_elapsed=float(row[2] or 0.0),
                    )
                    for row in cur.fetchall()
                ]

                return UserContextData(user_id=user_id, pets=pets, behaviors=behaviors)
