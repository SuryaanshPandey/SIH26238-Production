from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ConsentStatus
from app.core.time import utc_now


class ConsentRecord(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    consent_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    status: ConsentStatus
    granted_at: datetime | None = None
    revoked_at: datetime | None = None
    source: str = Field(min_length=1)
    created_at: datetime = Field(default_factory=utc_now)
