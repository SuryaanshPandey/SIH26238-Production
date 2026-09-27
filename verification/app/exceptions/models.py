from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.connectors.base import SourceRecord
from app.core.time import utc_now
from app.models.document import Document


class ExceptionType(str, Enum):
    DATA_MISMATCH = "DATA_MISMATCH"
    CROSS_SOURCE_CONFLICT = "CROSS_SOURCE_CONFLICT"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    MISSING_EVIDENCE = "MISSING_EVIDENCE"
    EXPIRED_DOCUMENT = "EXPIRED_DOCUMENT"
    STALE_SOURCE_RECORD = "STALE_SOURCE_RECORD"
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"
    PARTIAL_IDENTITY_MATCH = "PARTIAL_IDENTITY_MATCH"


class ExceptionSeverity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VerificationException(BaseModel):
    """Immutable verification signal; never mutates application workflow."""

    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    exception_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    type: ExceptionType
    severity: ExceptionSeverity
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    field: str | None = None
    submitted_value: Any | None = None
    source_values: list[dict[str, Any]] = Field(default_factory=list)
    source_references: list[str] = Field(default_factory=list)
    verification_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    detection_method: str = Field(min_length=1)
    review_required: bool = True
    routing: str = "MANUAL_REVIEW_SIGNAL"
    detected_at: datetime = Field(default_factory=utc_now)


class ExceptionAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    submitted_attributes: dict[str, Any] = Field(min_length=1)
    source_records: list[dict[str, Any]] = Field(default_factory=list)
    documents: list[Document] = Field(default_factory=list)
    verification_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    freshness_days: dict[str, int] = Field(default_factory=dict)
    as_of: datetime | None = None

    def to_source_records(self) -> list[SourceRecord]:
        return [SourceRecord(**item) for item in self.source_records]


class ExceptionAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: str
    student_id: str
    exception_ids: list[str]
    review_required: bool
    exception_count: int
    high_count: int
    medium_count: int
    low_count: int
    affected_fields: list[str]
    affected_sources: list[str]
    evidence_ids: list[str]
    source_references: list[str]
    highest_severity: ExceptionSeverity | None = None
    analysis_as_of: datetime
