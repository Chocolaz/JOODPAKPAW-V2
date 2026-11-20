from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RoomCategoryData:
    id: int
    pet_size_category_id: int | None = None
    size_name: str | None = None
    min_weight: float | None = None
    max_weight: float | None = None
    room_area_sqm: float = 0.0
    pet_type_ids: frozenset[int] = field(default_factory=frozenset)


@dataclass
class PropertyData:
    id: int
    host_id: int
    title: str
    description: str = ""
    property_type: str = ""
    province: str = ""
    district: str = ""
    subdistrict: str = ""
    latitude: float | None = None
    longitude: float | None = None
    min_price: float = 0.0
    avg_rating: float = 0.0
    review_count: int = 0
    booking_count: int = 0
    favorite_count: int = 0
    view_count_30d: int = 0
    facilities: list[str] = field(default_factory=list)
    room_categories: list[RoomCategoryData] = field(default_factory=list)
    allowed_pet_type_ids: set[int] = field(default_factory=set)
    allowed_pet_type_names: list[str] = field(default_factory=list)
    pet_size_names: list[str] = field(default_factory=list)
    max_room_area_sqm: float = 0.0
    is_active: bool = True
    is_banned_by_admin: bool = False
    is_deleted: bool = False
    host_banned: bool = False


@dataclass(frozen=True)
class UserPetData:
    id: int
    name: str
    pet_type_id: int
    pet_type_name: str
    breed_name: str | None = None
    weight: float | None = None
    pet_size_category_id: int | None = None
    size_name: str | None = None
    energy_rating: int = 3


@dataclass(frozen=True)
class UserBehaviorData:
    property_id: int
    action: str  # 'view' | 'favorite' | 'book'
    days_elapsed: float = 0.0


@dataclass
class UserContextData:
    user_id: int
    pets: list[UserPetData] = field(default_factory=list)
    behaviors: list[UserBehaviorData] = field(default_factory=list)
