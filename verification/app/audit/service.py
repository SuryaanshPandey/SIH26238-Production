from __future__ import annotations

from app.core.ids import new_id
from app.core.constants import ActorType
from app.core.time import utc_now
from app.models.audit import AuditEvent


class AuditService:
    def __init__(self, repository):
        self.repository = repository

    def record(self, *, actor_type: ActorType, actor_id: str, action: str, entity_type: str, entity_id: str, reason: str | None = None, correlation_id: str) -> AuditEvent:
        event = AuditEvent(
            audit_event_id=new_id("audit"),
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            timestamp=utc_now(),
            reason=reason,
            correlation_id=correlation_id,
        )
        return self.repository.save(event)
