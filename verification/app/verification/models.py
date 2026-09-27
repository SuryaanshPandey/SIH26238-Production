from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.connectors.base import SourceRecord, SourceRecordStatus, SourceSystem
from app.core.time import utc_now


class SourceRecordInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_system: SourceSystem
    source_reference: str = Field(min_length=1)
    status: SourceRecordStatus = SourceRecordStatus.FOUND
    subject_id: str = Field(min_length=1)
    attributes: dict[str, Any] = Field(default_factory=dict)
    retrieved_at: datetime | None = None
    response_hash: str | None = None
    document_type: str | None = None
    institution_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)

    def to_record(self) -> SourceRecord:
        return SourceRecord(
            source_system=self.source_system,
            source_reference=self.source_reference,
            status=self.status,
            subject_id=self.subject_id,
            attributes=self.attributes,
            retrieved_at=self.retrieved_at or utc_now(),
            response_hash=self.response_hash,
            document_type=self.document_type,
            institution_id=self.institution_id,
            metadata=self.metadata,
        )


class VerificationRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    submitted_attributes: dict[str, Any] = Field(min_length=1)
    source_records: list[SourceRecordInput] = Field(min_length=1)
    document_ids: list[str] = Field(default_factory=list)


class VerificationRunResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: str
    student_id: str
    overall_result: str
    overall_confidence: float = Field(ge=0.0, le=1.0)
    verification_ids: list[str]
    evidence_ids: list[str]
    source_references: list[str]
    review_required: bool
    checked_attributes: list[str]
