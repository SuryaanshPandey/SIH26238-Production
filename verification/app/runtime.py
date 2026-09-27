from __future__ import annotations

import os

from app.audit.service import AuditService
from app.consent.service import ConsentService
from app.exceptions import ExceptionIntelligenceService, InMemoryExceptionRepository
from app.persistence.sqlite import (
    AuditRepository,
    ConsentRepository,
    SQLiteDatabase,
    SQLiteDocumentRepository,
    SQLiteExceptionRepository,
    SQLiteEvidenceRepository,
    SQLiteVerificationRepository,
    SourceObservationRepository,
)
from app.repositories.document_repository import InMemoryDocumentRepository
from app.services.document_service import DocumentService
from app.services.source_service import SourceService
from app.connectors.registry import build_default_registry
from app.verification import InMemoryEvidenceRepository, InMemoryVerificationRepository, VerificationEngine


class InMemoryConsentRepository:
    def __init__(self) -> None:
        self._items: dict[str, object] = {}

    def save(self, record):
        if record.consent_id in self._items:
            raise ValueError("consent_id already exists")
        self._items[record.consent_id] = record.model_copy(deep=True)
        return record.model_copy(deep=True)

    def update(self, record):
        if record.consent_id not in self._items:
            raise KeyError(record.consent_id)
        self._items[record.consent_id] = record.model_copy(deep=True)
        return record.model_copy(deep=True)

    def get(self, consent_id: str):
        record = self._items.get(consent_id)
        return record.model_copy(deep=True) if record else None

    def latest_granted(self, student_id: str, purpose: str):
        matches = [r for r in self._items.values() if r.student_id == student_id and r.purpose == purpose and str(r.status) == "GRANTED"]
        return max(matches, key=lambda item: item.created_at) if matches else None


class InMemoryAuditRepository:
    def __init__(self) -> None:
        self._items = []

    def save(self, event):
        self._items.append(event.model_copy(deep=True))
        return event.model_copy(deep=True)

    def list_for_entity(self, entity_type: str, entity_id: str):
        return [e.model_copy(deep=True) for e in self._items if e.entity_type == entity_type and e.entity_id == entity_id]


class InMemorySourceObservationRepository:
    def __init__(self) -> None:
        self._items: list[dict] = []

    def save(self, *, observation_id: str, source_record: dict, application_id: str | None = None) -> None:
        self._items.append({"observation_id": observation_id, "application_id": application_id, **source_record})

    def list_for_reference(self, source_reference: str) -> list[dict]:
        return [item for item in self._items if item.get("source_reference") == source_reference]


class Runtime:
    """Central dependency composition root.

    Default is in-memory for deterministic development/tests. Set
    SIH_STORAGE_BACKEND=sqlite for persistent local/demo operation.
    """

    def __init__(self) -> None:
        backend = os.getenv("SIH_STORAGE_BACKEND", "inmemory").lower()
        self.backend = backend
        if backend == "sqlite":
            self.db = SQLiteDatabase(os.getenv("SIH_STORAGE_PATH", "./data/sih26238.db"))
            self.document_repository = SQLiteDocumentRepository(self.db)
            self.verification_repository = SQLiteVerificationRepository(self.db)
            self.evidence_repository = SQLiteEvidenceRepository(self.db)
            self.exception_repository = SQLiteExceptionRepository(self.db)
            self.audit_repository = AuditRepository(self.db)
            self.consent_repository = ConsentRepository(self.db)
            self.source_observation_repository = SourceObservationRepository(self.db)
        elif backend == "postgres":
            from app.persistence.postgres import (
                PostgresAuditRepository,
                PostgresConsentRepository,
                PostgresDatabase,
                PostgresDocumentRepository,
                PostgresEvidenceRepository,
                PostgresExceptionRepository,
                PostgresSourceObservationRepository,
                PostgresVerificationRepository,
            )
            self.db = PostgresDatabase(os.getenv("DATABASE_URL"))
            self.document_repository = PostgresDocumentRepository(self.db)
            self.verification_repository = PostgresVerificationRepository(self.db)
            self.evidence_repository = PostgresEvidenceRepository(self.db)
            self.exception_repository = PostgresExceptionRepository(self.db)
            self.audit_repository = PostgresAuditRepository(self.db)
            self.consent_repository = PostgresConsentRepository(self.db)
            self.source_observation_repository = PostgresSourceObservationRepository(self.db)
        else:
            self.db = None
            self.document_repository = InMemoryDocumentRepository()
            self.verification_repository = InMemoryVerificationRepository()
            self.evidence_repository = InMemoryEvidenceRepository()
            self.exception_repository = InMemoryExceptionRepository()
            self.audit_repository = InMemoryAuditRepository()
            self.consent_repository = InMemoryConsentRepository()
            self.source_observation_repository = InMemorySourceObservationRepository()

        self.document_service = DocumentService(self.document_repository)
        self.consent_service = ConsentService(self.consent_repository) if self.consent_repository else None
        self.source_service = SourceService(
            build_default_registry(),
            consent_service=self.consent_service,
            observation_repository=self.source_observation_repository,
            require_consent=os.getenv("SIH_REQUIRE_CONSENT", "false").lower() == "true",
        )
        self.verification_engine = VerificationEngine(self.verification_repository, self.evidence_repository)
        self.exception_service = ExceptionIntelligenceService(self.exception_repository)
        self.audit_service = AuditService(self.audit_repository) if self.audit_repository else None


runtime = Runtime()
