from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from core.categorizer import Categorizer
from db.database import SessionLocal, get_db
from models.job import CategorizingJob
from schemas.job import CategorizingJobCreate, CategorizingJobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/categorize-message", response_model=CategorizingJobResponse, status_code=202)
def create_categorizing_job(
    request: CategorizingJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = CategorizingJob(
        job_id=str(uuid4()),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        process_categorizing_job,
        job_id=job.job_id,
        content=request.content,
        forced_type=request.type,
    )
    return job


@router.get("/{job_id}", response_model=CategorizingJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(CategorizingJob).filter(CategorizingJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def process_categorizing_job(job_id: str, content: str, forced_type: str | None) -> None:
    db = SessionLocal()
    try:
        job = db.query(CategorizingJob).filter(CategorizingJob.job_id == job_id).first()
        if not job:
            return

        try:
            job.status = "processing"
            db.commit()

            message = Categorizer.ingest_message(db, content=content, forced_type=forced_type)

            job.status = "completed"
            job.message_id = message.id
            job.category_id = message.category_id
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()
