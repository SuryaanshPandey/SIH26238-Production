from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from app.exceptions.models import ExceptionSeverity, VerificationException
from app.investigation.models import (
    InvestigationCase,
    InvestigationFieldView,
    InvestigationIndexItem,
    InvestigationTimelineEvent,
)
from app.models.document import Document
from app.models.evidence import Evidence
from app.models.verification import Verification


class InvestigationNotFoundError(LookupError):
    pass


class InvestigationService:
    """Builds a read-only evidence-first investigation projection."""

    _SEVERITY_ORDER = {
        None: 0,
        ExceptionSeverity.LOW.value: 1,
        ExceptionSeverity.MEDIUM.value: 2,
        ExceptionSeverity.HIGH.value: 3,
    }

    def __init__(self, *, document_repository, verification_repository, evidence_repository, exception_repository):
        self.documents = document_repository
        self.verifications = verification_repository
        self.evidence = evidence_repository
        self.exceptions = exception_repository

    @staticmethod
    def _case_id(application_id: str) -> str:
        return f"case_{application_id}"

    @staticmethod
    def _dt(value: datetime | None) -> datetime:
        if value is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _json(model) -> dict[str, Any]:
        return model.model_dump(mode="json")

    @classmethod
    def _highest_severity(cls, exceptions: list[VerificationException]) -> str | None:
        if not exceptions:
            return None
        return max(
            (str(e.severity.value if hasattr(e.severity, "value") else e.severity) for e in exceptions),
            key=lambda value: cls._SEVERITY_ORDER.get(value, 0),
        )

    def _case_artifacts(self, application_id: str):
        documents = self.documents.list_by_application(application_id)
        verifications = self.verifications.list_for_application(application_id)
        exceptions = self.exceptions.list_for_application(application_id)
        evidence_ids: list[str] = []
        for verification in verifications:
            evidence_ids.extend(verification.evidence_ids)
        for exception in exceptions:
            evidence_ids.extend(exception.evidence_ids)
        evidence_ids = list(dict.fromkeys(evidence_ids))
        evidence = self.evidence.list_for_ids(evidence_ids)
        return documents, verifications, evidence, exceptions

    def get_case(self, application_id: str, student_id: str | None = None) -> InvestigationCase:
        if not application_id.strip():
            raise ValueError("application_id is required")
        documents, verifications, evidence, exceptions = self._case_artifacts(application_id)
        if not documents and not verifications and not exceptions:
            raise InvestigationNotFoundError(application_id)

        inferred_student = (
            student_id
            or (documents[0].student_id if documents else None)
            or (verifications[0].student_id if verifications else None)
            or (exceptions[0].student_id if exceptions else None)
        )
        if not inferred_student:
            raise ValueError("student_id could not be inferred from investigation artifacts")
        if any(getattr(item, "student_id", inferred_student) != inferred_student for item in verifications + exceptions):
            raise ValueError("investigation artifacts contain conflicting student_id values")

        evidence_by_id = {item.evidence_id: self._json(item) for item in evidence}
        exceptions_json = [self._json(item) for item in exceptions]
        verification_json = [self._json(item) for item in verifications]
        document_json = [self._json(item) for item in documents]

        field_map: dict[str, InvestigationFieldView] = {}
        source_refs: list[str] = []
        for verification in verifications:
            field = verification.subject.name
            existing = field_map.get(field)
            existing_sources = list(existing.sources) if existing else []
            if verification.source_reference:
                existing_sources.append(
                    {
                        "source_reference": verification.source_reference,
                        "source_value": verification.source_value,
                        "result": verification.result,
                        "confidence": verification.confidence,
                    }
                )
                source_refs.append(verification.source_reference)
            existing_results = list(existing.verification_results) if existing else []
            existing_results.append(
                {
                    "verification_id": verification.verification_id,
                    "result": verification.result,
                    "confidence": verification.confidence,
                    "review_status": verification.review_status,
                    "verified_at": verification.verified_at,
                }
            )
            evidence_for_field = list(existing.evidence_ids) if existing else []
            evidence_for_field.extend(verification.evidence_ids)
            exception_ids = [
                exception.exception_id
                for exception in exceptions
                if exception.field == field
            ]
            result_values = {item["result"] for item in existing_results}
            priority = ["MISMATCH", "PENDING_REVIEW", "PARTIAL_MATCH", "MATCH", "NOT_VERIFIABLE", "SOURCE_UNAVAILABLE", "INSUFFICIENT_EVIDENCE"]
            overall = next((candidate for candidate in priority if candidate in result_values), "NOT_VERIFIABLE")
            confidence = round(sum(item["confidence"] for item in existing_results) / len(existing_results), 4)
            field_map[field] = InvestigationFieldView(
                field=field,
                submitted_value=verification.submitted_value,
                sources=existing_sources,
                verification_results=existing_results,
                evidence_ids=list(dict.fromkeys(evidence_for_field)),
                exception_ids=list(dict.fromkeys(exception_ids)),
                overall_result=overall,
                confidence=confidence,
            )

        for exception in exceptions:
            if exception.field and exception.field not in field_map:
                field_map[exception.field] = InvestigationFieldView(
                    field=exception.field,
                    submitted_value=exception.submitted_value,
                    sources=exception.source_values,
                    verification_results=[],
                    evidence_ids=list(exception.evidence_ids),
                    exception_ids=[exception.exception_id],
                    overall_result="PENDING_REVIEW",
                    confidence=0.0,
                )
            source_refs.extend(exception.source_references)

        all_results = {v.overall_result for v in field_map.values()}
        if "MISMATCH" in all_results or "PENDING_REVIEW" in all_results:
            overall_result = "PENDING_REVIEW"
        elif all_results and all(r == "MATCH" for r in all_results):
            overall_result = "MATCH"
        elif "PARTIAL_MATCH" in all_results:
            overall_result = "PARTIAL_MATCH"
        elif all_results:
            overall_result = "INSUFFICIENT_EVIDENCE"
        else:
            overall_result = "NOT_VERIFIABLE"

        timeline: list[InvestigationTimelineEvent] = []
        for document in documents:
            timeline.append(
                InvestigationTimelineEvent(
                    timestamp=document.created_at,
                    event_type="DOCUMENT_CREATED",
                    entity_id=document.document_id,
                    title=f"Document added: {document.document_type}",
                    description=f"Version {document.version} created from {document.source}.",
                )
            )
            for entry in self.documents.history(document.document_id):
                if entry.action == "CREATED":
                    continue
                timeline.append(
                    InvestigationTimelineEvent(
                        timestamp=entry.occurred_at,
                        event_type=f"DOCUMENT_{entry.action}",
                        entity_id=document.document_id,
                        title=f"Document {entry.action.lower().replace('_', ' ')}",
                        description=f"Status changed from {entry.from_status} to {entry.to_status}.",
                    )
                )
        for verification in verifications:
            verification_timestamp = verification.verified_at or verification.created_at
            timeline.append(
                InvestigationTimelineEvent(
                    timestamp=verification_timestamp,
                    event_type="VERIFICATION_COMPLETED",
                    entity_id=verification.verification_id,
                    title=f"Verified {verification.subject.name}",
                    description=f"Result: {verification.result}; confidence {verification.confidence:.2f}.",
                    severity="HIGH" if verification.result in {"MISMATCH", "PENDING_REVIEW"} else None,
                )
            )
        for exception in exceptions:
            severity = exception.severity.value if hasattr(exception.severity, "value") else str(exception.severity)
            timeline.append(
                InvestigationTimelineEvent(
                    timestamp=exception.detected_at,
                    event_type="EXCEPTION_DETECTED",
                    entity_id=exception.exception_id,
                    title=exception.title,
                    description=exception.description,
                    severity=severity,
                )
            )

        timeline.sort(key=lambda item: self._dt(item.timestamp), reverse=True)
        unique_refs = list(dict.fromkeys(source_refs))
        investigation_evidence_ids = []
        for field_view in field_map.values():
            investigation_evidence_ids.extend(field_view.evidence_ids)
        for exception in exceptions:
            investigation_evidence_ids.extend(exception.evidence_ids)
        investigation_evidence_ids = list(dict.fromkeys(investigation_evidence_ids))
        linked_evidence = [evidence_by_id[eid] for eid in investigation_evidence_ids if eid in evidence_by_id]
        review_required = bool(exceptions) or any(
            result in {"MISMATCH", "PENDING_REVIEW", "SOURCE_UNAVAILABLE"} for result in all_results
        )
        summary = {
            "documents": len(documents),
            "verifications": len(verifications),
            "evidence": len(linked_evidence),
            "exceptions": len(exceptions),
            "high_exceptions": sum(1 for e in exceptions if str(e.severity.value if hasattr(e.severity, "value") else e.severity) == "HIGH"),
            "review_signals": sum(1 for e in exceptions if e.review_required),
        }
        return InvestigationCase(
            case_id=self._case_id(application_id),
            application_id=application_id,
            student_id=inferred_student,
            review_required=review_required,
            overall_result=overall_result,
            highest_severity=self._highest_severity(exceptions),
            summary=summary,
            fields=sorted(field_map.values(), key=lambda item: item.field),
            documents=document_json,
            verifications=verification_json,
            evidence=linked_evidence,
            exceptions=exceptions_json,
            source_references=unique_refs,
            timeline=timeline,
        )

    def list_cases(self, *, review_required: bool | None = None) -> list[InvestigationIndexItem]:
        application_ids: set[str] = set()
        for app_id in self.documents_application_ids():
            application_ids.add(app_id)
        # Verification and exception repositories are intentionally scanned because they may
        # exist before a document record is created.
        for item in self._all_verifications():
            application_ids.add(item.application_id)
        for item in self._all_exceptions():
            application_ids.add(item.application_id)

        items: list[InvestigationIndexItem] = []
        for application_id in sorted(application_ids):
            try:
                case = self.get_case(application_id)
            except (InvestigationNotFoundError, ValueError):
                continue
            if review_required is not None and case.review_required != review_required:
                continue
            updated = max(
                [self._dt(event.timestamp) for event in case.timeline],
                default=self._dt(case.generated_at),
            )
            items.append(
                InvestigationIndexItem(
                    case_id=case.case_id,
                    application_id=case.application_id,
                    student_id=case.student_id,
                    review_required=case.review_required,
                    overall_result=case.overall_result,
                    highest_severity=case.highest_severity,
                    exception_count=case.summary["exceptions"],
                    verification_count=case.summary["verifications"],
                    document_count=case.summary["documents"],
                    updated_at=updated,
                )
            )
        return sorted(items, key=lambda item: self._dt(item.updated_at), reverse=True)

    def documents_application_ids(self) -> list[str]:
        items = getattr(self.documents, "_documents", {})
        return list({doc.application_id for doc in items.values()})

    def _all_verifications(self) -> list[Verification]:
        items = getattr(self.verifications, "_items", {}) or {}
        return list(items.values())

    def _all_exceptions(self) -> list[VerificationException]:
        items = getattr(self.exceptions, "_items", {}) or {}
        return list(items.values())
