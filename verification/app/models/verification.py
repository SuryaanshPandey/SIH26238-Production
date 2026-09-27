from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ReviewStatus, VerificationResult
from app.core.time import utc_now


class VerificationSubject(BaseModel):
    type: str = Field(min_length=1)
    name: str = Field(min_length=1)


class Verification(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    verification_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    subject: VerificationSubject
    submitted_value: str | None = None
    source_value: str | None = None
    result: VerificationResult
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    source_reference: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    review_status: ReviewStatus
    verified_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
