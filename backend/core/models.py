from pydantic import BaseModel, Field


class OllamaTagResponse(BaseModel):
    tags: list[str] = Field(default_factory=list)
