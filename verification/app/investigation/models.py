from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.core.time import utc_now


class InvestigationFieldView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    submitted_value: Any | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    verification_results: list[dict[str, Any]] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    exception_ids: list[str] = Field(default_factory=list)
    overall_result: str = "NOT_VERIFIABLE"
    confidence: float = Field(ge=0.0, le=1.0)


class InvestigationTimelineEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime
    event_type: str
    entity_id: str
    title: str
    description: str
    severity: str | None = None


class InvestigationCase(BaseModel):
    """Read-only operational projection; not a shared cross-module entity."""

    model_config = ConfigDict(extra="forbid")

    case_id: str
    application_id: str
    student_id: str
    review_required: bool
    overall_result: str
    highest_severity: str | None = None
    summary: dict[str, int]
    fields: list[InvestigationFieldView]
    documents: list[dict[str, Any]]
    verifications: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    exceptions: list[dict[str, Any]]
    source_references: list[str]
    timeline: list[InvestigationTimelineEvent]
    generated_at: datetime = Field(default_factory=utc_now)


class InvestigationIndexItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str
    application_id: str
    student_id: str
    review_required: bool
    overall_result: str
    highest_severity: str | None = None
    exception_count: int
    verification_count: int
    document_count: int
    updated_at: datetime
