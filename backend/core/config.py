from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_PREFIX: str = "/api"
    DEBUG: bool = False

    DATABASE_URL: str

    ALLOWED_ORIGINS: str = ""

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_TAGGER_MODEL: str = "brainch-model"
    OLLAMA_EMBED_MODEL: str = "brainch-model"
    OLLAMA_TIMEOUT_SECONDS: float = 8.0

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
