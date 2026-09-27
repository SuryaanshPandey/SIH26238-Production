from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ExternalReferenceStatus
from app.core.time import utc_now


class ExternalReference(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    external_reference_id: str = Field(min_length=1)
    system: str = Field(min_length=1)
    entity_type: str = Field(min_length=1)
    entity_id: str = Field(min_length=1)
    external_id: str = Field(min_length=1)
    status: ExternalReferenceStatus
    created_at: datetime = Field(default_factory=utc_now)
