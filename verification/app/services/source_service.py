from __future__ import annotations

from app.connectors.base import (
    ConnectorAuthorization,
    SourceNotFoundError,
    SourceQuery,
    SourceRecord,
    SourceResponseError,
    SourceSystem,
    SourceUnavailableError,
)
from app.connectors.registry import ConnectorRegistry


class SourceService:
    """Application-facing orchestration layer over pluggable source connectors."""

    def __init__(self, registry: ConnectorRegistry, *, consent_service=None, observation_repository=None, require_consent: bool = False) -> None:
        self.registry = registry
        self.consent_service = consent_service
        self.observation_repository = observation_repository
        self.require_consent = require_consent

    def list_connectors(self) -> list[dict]:
        return self.registry.health()

    def query(
        self,
        *,
        system: SourceSystem,
        student_id: str,
        attributes: list[str] | None = None,
        external_id: str | None = None,
        document_type: str | None = None,
        institution_id: str | None = None,
        state: str | None = None,
        authorized: bool = False,
        purpose: str = "",
        consent_id: str | None = None,
        application_id: str | None = None,
    ) -> SourceRecord:
        connector = self.registry.get(system)
        if self.require_consent:
            if self.consent_service is None:
                raise PermissionError("consent enforcement is enabled but no consent service is configured")
            self.consent_service.assert_granted(consent_id=consent_id, student_id=student_id, purpose=purpose)
        query = SourceQuery(
            student_id=student_id,
            attributes=tuple(attributes or []),
            external_id=external_id,
            document_type=document_type,
            institution_id=institution_id,
            state=state,
            authorization=ConnectorAuthorization(
                authorized=authorized,
                purpose=purpose,
                consent_id=consent_id,
            ),
        )
        query.validate()
        record = connector.fetch_record(query)
        if self.observation_repository is not None:
            from app.core.ids import new_id
            payload = {
                "source_system": record.source_system.value if hasattr(record.source_system, "value") else str(record.source_system),
                "source_reference": record.source_reference,
                "status": record.status.value if hasattr(record.status, "value") else str(record.status),
                "subject_id": record.subject_id,
                "attributes": dict(record.attributes),
                "retrieved_at": record.retrieved_at.isoformat(),
                "response_hash": record.response_hash,
                "document_type": record.document_type,
                "institution_id": record.institution_id,
                "metadata": dict(record.metadata),
            }
            self.observation_repository.save(observation_id=new_id("obs"), source_record=payload, application_id=application_id)
        return record

    def query_many(
        self,
        *,
        systems: list[SourceSystem],
        student_id: str,
        attributes: list[str] | None = None,
        institution_id: str | None = None,
        authorized: bool = False,
        purpose: str = "",
        consent_id: str | None = None,
    ) -> list[SourceRecord]:
        records: list[SourceRecord] = []
        for system in systems:
            try:
                records.append(
                    self.query(
                        system=system,
                        student_id=student_id,
                        attributes=attributes,
                        institution_id=institution_id,
                        authorized=authorized,
                        purpose=purpose,
                        consent_id=consent_id,
                    )
                )
            except SourceNotFoundError:
                continue
        return records
