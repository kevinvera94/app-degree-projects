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
    secret_key: str = "change-me-in-production"
    allowed_origins: list[str] = [
        "http://localhost:5173",
    ]

    # Plazos (días hábiles)
    juror_evaluation_deadline_days: int = 15
    juror_second_review_deadline_days: int = 10
    student_correction_deadline_days: int = 10
    juror_expiry_alert_days: int = 3

    # Festivos
    usc_holidays_file: str = "config/usc_holidays.json"


settings = Settings()
