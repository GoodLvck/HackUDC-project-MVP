import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.categorizer import Categorizer
from db.database import get_db
from models.elements import Category, Message
from schemas.elements import CategoryResponse, MessageCategoryResponse, MessageCreate, MessageResponse

router = APIRouter(prefix="/messages", tags=["messages"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


@router.post("/text", response_model=MessageResponse)
def create_message(request: MessageCreate, db: Session = Depends(get_db)):
    message = Categorizer.ingest_message(db, request.content, forced_type="text", obtained_text=request.content)
    return message


@router.post("/image", response_model=MessageResponse)
def create_image_message(file: UploadFile = File(...), db: Session = Depends(get_db)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "image").suffix.lower()
    if extension and extension not in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".heic", ".svg"}:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    filename = f"{uuid.uuid4().hex}{extension or '.jpg'}"
    destination = UPLOAD_DIR / filename

    with destination.open("wb") as buffer:
        buffer.write(file.file.read())
    file.file.close()

    stored_content = f"/uploads/{filename}"
    message = Categorizer.ingest_message(db, stored_content, forced_type="image", obtained_text=stored_content)
    return message


@router.get("/", response_model=list[MessageResponse])
def list_messages(limit: int = 100, db: Session = Depends(get_db)):
    safe_limit = min(max(limit, 1), 500)
    messages = (
        db.query(Message)
        .order_by(Message.created_at.desc())
        .limit(safe_limit)
        .all()
    )
    return list(reversed(messages))


@router.get("/{message_id}/category", response_model=MessageCategoryResponse)
def get_message_category(message_id: int, db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    category = db.query(Category).filter(Category.id == message.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category_payload = CategoryResponse(
        id=category.id,
        name=category.name,
        tags=category.tags or [],
        description=category.description,
        parent_id=category.parent_id,
        created_at=category.created_at,
        message_count=db.query(Message).filter(Message.category_id == category.id).count(),
    )
    return MessageCategoryResponse(message_id=message.id, category=category_payload)
