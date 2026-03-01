from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from pathlib import Path

from core.config import settings

database_url = settings.DATABASE_URL
if database_url.startswith("sqlite:///") and not database_url.startswith("sqlite:////"):
    sqlite_path = database_url.removeprefix("sqlite:///")
    if sqlite_path and sqlite_path != ":memory:" and not Path(sqlite_path).is_absolute():
        # Resolve relative sqlite paths against backend/ to avoid cwd-dependent DB files.
        backend_dir = Path(__file__).resolve().parent.parent
        database_url = f"sqlite:///{(backend_dir / sqlite_path).resolve()}"

engine_kwargs = {}
if database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(database_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)
