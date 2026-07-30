from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Hike(Base):
    __tablename__ = "hikes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration_hint: Mapped[str | None] = mapped_column(String(50), nullable=True)

    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    elevation_gain_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    elevation_loss_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    start_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    start_lon: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Trace GPX en géométrie PostGIS (LineString, WGS84)
    geom = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=True)

    # Profil topologique: liste de {distance_km, elevation_m, lat, lon}
    elevation_profile: Mapped[list | None] = mapped_column(JSON, nullable=True)

    gpx_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    links: Mapped[list["ExternalLink"]] = relationship(
        back_populates="hike", cascade="all, delete-orphan"
    )


class ExternalLink(Base):
    __tablename__ = "external_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    hike_id: Mapped[int] = mapped_column(ForeignKey("hikes.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # komoot, alltrails, garmin, other...
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    hike: Mapped["Hike"] = relationship(back_populates="links")
