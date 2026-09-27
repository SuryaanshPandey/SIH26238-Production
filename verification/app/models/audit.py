from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ActorType
from app.core.time import utc_now


class AuditEvent(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    audit_event_id: str = Field(min_length=1)
    actor_type: ActorType
    actor_id: str = Field(min_length=1)
    action: str = Field(min_length=1)
    entity_type: str = Field(min_length=1)
    entity_id: str = Field(min_length=1)
    timestamp: datetime = Field(default_factory=utc_now)
    reason: str | None = None
    correlation_id: str = Field(min_length=1)
