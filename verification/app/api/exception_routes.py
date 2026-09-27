from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.routes import envelope, fail
from app.connectors.base import SourceRecord
from app.exceptions import ExceptionIntelligenceService
from app.runtime import runtime
from app.models.document import Document

router = APIRouter()
exception_repository = runtime.exception_repository
exception_service = runtime.exception_service


class ExceptionAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    submitted_attributes: dict = Field(min_length=1)
    source_records: list[dict] = Field(default_factory=list)
    documents: list[Document] = Field(default_factory=list)
    verification_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    freshness_days: dict[str, int] = Field(default_factory=dict)
    as_of: datetime | None = None


@router.post("/exceptions/analyze")
def analyze_exceptions(request: ExceptionAnalyzeRequest):
    try:
        records = [SourceRecord(**item) for item in request.source_records]
        result = exception_service.analyze(
            application_id=request.application_id,
            student_id=request.student_id,
            submitted_attributes=request.submitted_attributes,
            source_records=records,
            documents=request.documents,
            verification_ids=request.verification_ids,
            evidence_ids=request.evidence_ids,
            freshness_days=request.freshness_days,
            as_of=request.as_of,
        )
        return envelope(result.model_dump(mode="json"))
    except (TypeError, ValueError) as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.get("/exceptions/{exception_id}")
def get_exception(exception_id: str):
    item = exception_repository.get(exception_id)
    if item is None:
        raise fail("EXCEPTION_NOT_FOUND", "Verification exception not found", status.HTTP_404_NOT_FOUND)
    return envelope(item.model_dump(mode="json"))


@router.get("/applications/{application_id}/exceptions")
def list_exceptions(application_id: str):
    if not application_id.strip():
        raise fail("VALIDATION_ERROR", "application_id is required", status.HTTP_422_UNPROCESSABLE_ENTITY)
    items = exception_repository.list_for_application(application_id)
    return envelope([item.model_dump(mode="json") for item in items])
