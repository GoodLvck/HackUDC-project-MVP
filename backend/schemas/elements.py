from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class MessageResponse(BaseModel):
    id: int
    content: str
    type: str
    tags: list[str]
    category_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    id: int
    name: str
    tags: list[str]
    description: Optional[str] = None
    parent_id: Optional[int] = None
    created_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class MessageCategoryResponse(BaseModel):
    message_id: int
    category: CategoryResponse
