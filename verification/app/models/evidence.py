from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import EvidenceType
from app.core.time import utc_now


class Evidence(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    evidence_id: str = Field(min_length=1)
    type: EvidenceType
    source: str = Field(min_length=1)
    reference: str = Field(min_length=1)
    retrieved_at: datetime = Field(default_factory=utc_now)
    integrity_hash: str = Field(min_length=1)
    description: str = Field(min_length=1)
