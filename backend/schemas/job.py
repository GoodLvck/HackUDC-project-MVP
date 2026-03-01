from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CategorizingJobBase(BaseModel):
    content: str
    type: Optional[str] = None


class CategorizingJobResponse(BaseModel):
    job_id: str
    status: str
    message_id: Optional[int] = None
    category_id: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True


class CategorizingJobCreate(CategorizingJobBase):
    pass


class CategorizingJobResult(BaseModel):
    job: CategorizingJobResponse
