from pathlib import Path
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
PIPELINE = "evidence-review-1.2"
PARSER = "pdf-lines-1.0"
BUCKET = "evidence"
JOB_FIELDS = "id,case_id,kind,version_id,run_id,state,stage,completed,total,attempts,error,created_at,available_at"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / ".env", ".env"), extra="ignore")
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = Field(default="", repr=False)
    supabase_service_role_key: str = Field(default="", repr=False)
    gemini_api_key: str = Field(default="", repr=False)
    llm_model: str = "gemini-3.5-flash-lite"
    embedding_model: str = "gemini-embedding-001"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    tessdata_prefix: str = str(ROOT / ".local/tessdata")
    worker_enabled: bool = True
    min_request_interval: float = Field(default=1, ge=0)
    sample_dir: Path = ROOT / "fixtures" / "demo"

    def provenance(self):
        return {
            "pipeline": PIPELINE,
            "llm": self.llm_model,
            "embedding": self.embedding_model,
            "dimensions": 768,
            "second_opinion": "blind_same_model",
            "parser": PARSER,
        }


@lru_cache
def settings():
    return Settings()
