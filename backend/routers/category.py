from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from models.elements import Category, Message
from schemas.elements import CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.parent_id.asc(), Category.id.asc()).all()
    return [
        CategoryResponse(
            id=category.id,
            name=category.name,
            tags=category.tags or [],
            description=category.description,
            parent_id=category.parent_id,
            created_at=category.created_at,
            message_count=db.query(Message).filter(Message.category_id == category.id).count(),
        )
        for category in categories
    ]


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    return CategoryResponse(
        id=category.id,
        name=category.name,
        tags=category.tags or [],
        description=category.description,
        parent_id=category.parent_id,
        created_at=category.created_at,
        message_count=db.query(Message).filter(Message.category_id == category.id).count(),
    )
