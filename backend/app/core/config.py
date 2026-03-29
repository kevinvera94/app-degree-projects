from pydantic import SecretStr, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Base de datos
    database_url: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_storage_bucket: str = "degree-projects-docs"

    # App
    app_env: str = "development"
    secret_key: SecretStr
    # CSV en el .env: ALLOWED_ORIGINS=http://localhost:5173,https://app.vercel.app
    allowed_origins: str = "http://localhost:5173"

    # Plazos (días hábiles)
    juror_evaluation_deadline_days: int = 15
    juror_second_review_deadline_days: int = 10
    student_correction_deadline_days: int = 10
    juror_expiry_alert_days: int = 3

    # Festivos
    usc_holidays_file: str = "config/usc_holidays.json"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_secret_key_in_production(self) -> "Settings":
        if self.app_env == "production":
            known_bad = {"change-me-in-production", "secret", ""}
            value = self.secret_key.get_secret_value()
            if value in known_bad or len(value) < 32:
                raise ValueError(
                    "SECRET_KEY inseguro en producción: "
                    "debe tener al menos 32 caracteres y ser único."
                )
        return self


settings = Settings()
