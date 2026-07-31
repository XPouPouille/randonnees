from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

NOTES_MAX_LENGTH = 2000


class ExternalLinkBase(BaseModel):
    platform: str
    url: str
    label: str | None = None


class ExternalLinkCreate(ExternalLinkBase):
    pass


class ExternalLinkOut(ExternalLinkBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ElevationPoint(BaseModel):
    distance_km: float
    elevation_m: float
    lat: float
    lon: float


class HikeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    activity_type: str
    difficulty: str | None
    duration_hint: str | None
    distance_km: float | None
    elevation_gain_m: float | None
    start_lat: float | None
    start_lon: float | None
    track_geojson: dict | None = None


class HikeOut(HikeSummary):
    description: str | None
    notes: str | None
    elevation_loss_m: float | None
    elevation_profile: list[ElevationPoint] | None
    gpx_filename: str | None
    created_at: datetime
    links: list[ExternalLinkOut] = []


class HikeCreate(BaseModel):
    name: str
    description: str | None = None
    difficulty: str | None = None
    duration_hint: str | None = None
    activity_type: str = "rando"


class HikeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
    difficulty: str | None = None
    duration_hint: str | None = None
    activity_type: str | None = None


class LatLon(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ElevationRequest(BaseModel):
    points: list[LatLon]


class ElevationPointOut(BaseModel):
    lat: float
    lon: float
    elevation_m: float


class PoiOut(BaseModel):
    lat: float
    lon: float
    name: str | None = None
    category: str


class DrawHikeCreate(BaseModel):
    name: str
    activity_type: str = "rando"
    difficulty: str | None = None
    duration_hint: str | None = None
    description: str | None = None
    points: list[LatLon]
    pois: list[PoiOut] = []


class RouteRequest(BaseModel):
    points: list[LatLon]
    activity_type: str = "rando"


class PoiRequest(BaseModel):
    points: list[LatLon]
    radius_m: int = Field(default=1000, ge=50, le=5000)
    categories: list[str]
