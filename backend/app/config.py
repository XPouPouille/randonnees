from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://randonnees:randonnees@db:5432/randonnees"
    jwt_secret: str = "changeme-jwt-secret"
    jwt_expire_minutes: int = 60 * 24 * 30
    cors_origins: str = "http://localhost"
    uploads_dir: str = "/app/uploads"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
