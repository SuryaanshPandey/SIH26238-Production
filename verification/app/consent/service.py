from __future__ import annotations

from app.core.constants import ConsentStatus
from app.core.ids import new_id
from app.core.time import utc_now
from app.models.consent import ConsentRecord


class ConsentError(Exception):
    pass


class ConsentService:
    def __init__(self, repository):
        self.repository = repository

    def grant(self, *, student_id: str, purpose: str, source: str = "APP") -> ConsentRecord:
        if not student_id.strip() or not purpose.strip():
            raise ConsentError("student_id and purpose are required")
        record = ConsentRecord(consent_id=new_id("cons"), student_id=student_id, purpose=purpose, status=ConsentStatus.GRANTED, granted_at=utc_now(), source=source)
        return self.repository.save(record)

    def revoke(self, consent_id: str) -> ConsentRecord:
        record = self.repository.get(consent_id)
        if record is None:
            raise ConsentError("consent record not found")
        now = utc_now()
        return self.repository.update(record.model_copy(update={"status": ConsentStatus.REVOKED, "revoked_at": now}))

    def get(self, consent_id: str) -> ConsentRecord | None:
        return self.repository.get(consent_id)

    def assert_granted(self, *, consent_id: str | None, student_id: str, purpose: str) -> ConsentRecord:
        if not consent_id:
            raise ConsentError("consent_id is required")
        record = self.repository.get(consent_id)
        if record is None or record.student_id != student_id or record.purpose != purpose or record.status != ConsentStatus.GRANTED:
            raise ConsentError("valid granted consent is required")
        return record
