from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from db.database import Base


class CategorizingJob(Base):
    __tablename__ = "categorizing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, index=True, unique=True, nullable=False)
    message_id = Column(Integer, ForeignKey("messages.id"), index=True, nullable=True)
    status = Column(String, nullable=False)
    category_id = Column(Integer, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
