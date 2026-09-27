from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping

from app.connectors.base import SourceRecord, SourceRecordStatus
from app.core.constants import DocumentStatus
from app.core.ids import new_id
from app.core.time import utc_now
from app.exceptions.models import (
    ExceptionAnalysisResult,
    ExceptionSeverity,
    ExceptionType,
    VerificationException,
)
from app.exceptions.repository import ExceptionRepository
from app.matching.matcher import compare_field
from app.matching.normalization import normalize_attribute
from app.models.document import Document


class ExceptionIntelligenceService:
    """Detect verification exceptions and prepare review-ready signals.

    It does not change Application, Deficiency, Payment or Scholarship state.
    """

    _SEVERITY = {
        ExceptionType.DATA_MISMATCH: ExceptionSeverity.HIGH,
        ExceptionType.CROSS_SOURCE_CONFLICT: ExceptionSeverity.HIGH,
        ExceptionType.EXPIRED_DOCUMENT: ExceptionSeverity.HIGH,
        ExceptionType.SOURCE_UNAVAILABLE: ExceptionSeverity.MEDIUM,
        ExceptionType.MISSING_EVIDENCE: ExceptionSeverity.MEDIUM,
        ExceptionType.STALE_SOURCE_RECORD: ExceptionSeverity.MEDIUM,
        ExceptionType.PARTIAL_IDENTITY_MATCH: ExceptionSeverity.LOW,
        ExceptionType.INSUFFICIENT_INFORMATION: ExceptionSeverity.LOW,
    }

    def __init__(self, repository: ExceptionRepository) -> None:
        self.repository = repository

    @staticmethod
    def _source_system_value(record: SourceRecord) -> str:
        value = record.source_system
        return getattr(value, "value", str(value))

    @staticmethod
    def _ensure_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @classmethod
    def _distinct_source_values(cls, records: Iterable[SourceRecord], field: str) -> list[dict[str, Any]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            if SourceRecordStatus(record.status) is not SourceRecordStatus.FOUND:
                continue
            raw = record.attributes.get(field)
            normalized = normalize_attribute(field, raw)
            if not normalized:
                continue
            grouped[normalized].append(
                {
                    "source": cls._source_system_value(record),
                    "source_reference": record.source_reference,
                    "value": raw,
                }
            )
        return list(grouped.values())

    def _save(
        self,
        *,
        application_id: str,
        student_id: str,
        kind: ExceptionType,
        title: str,
        description: str,
        field: str | None = None,
        submitted_value: Any | None = None,
        source_values: list[dict[str, Any]] | None = None,
        source_references: list[str] | None = None,
        verification_ids: Iterable[str] = (),
        evidence_ids: Iterable[str] = (),
        detection_method: str,
        detected_at: datetime,
    ) -> VerificationException:
        item = VerificationException(
            exception_id=new_id("exc"),
            application_id=application_id,
            student_id=student_id,
            type=kind,
            severity=self._SEVERITY[kind],
            title=title,
            description=description,
            field=field,
            submitted_value=submitted_value,
            source_values=source_values or [],
            source_references=list(dict.fromkeys(source_references or [])),
            verification_ids=list(dict.fromkeys(verification_ids)),
            evidence_ids=list(dict.fromkeys(evidence_ids)),
            detection_method=detection_method,
            detected_at=detected_at,
        )
        return self.repository.save(item)

    def analyze(
        self,
        *,
        application_id: str,
        student_id: str,
        submitted_attributes: Mapping[str, Any],
        source_records: Iterable[SourceRecord],
        documents: Iterable[Document] = (),
        verification_ids: Iterable[str] = (),
        evidence_ids: Iterable[str] = (),
        freshness_days: Mapping[str, int] | None = None,
        as_of: datetime | None = None,
    ) -> ExceptionAnalysisResult:
        if not application_id.strip():
            raise ValueError("application_id is required")
        if not student_id.strip():
            raise ValueError("student_id is required")
        if not submitted_attributes:
            raise ValueError("submitted_attributes cannot be empty")

        records = list(source_records)
        docs = list(documents)
        analysis_time = self._ensure_utc(as_of or utc_now())
        freshness_policy = dict(freshness_days or {})
        for field, days in freshness_policy.items():
            if days < 0:
                raise ValueError(f"freshness_days for {field} must be >= 0")

        shared_verification_ids = list(dict.fromkeys(verification_ids))
        shared_evidence_ids = list(dict.fromkeys(evidence_ids))
        created: list[VerificationException] = []

        # Source availability / reachable-but-missing record.
        for record in records:
            source_status = SourceRecordStatus(record.status)
            if source_status is SourceRecordStatus.UNAVAILABLE:
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.SOURCE_UNAVAILABLE,
                        title=f"{self._source_system_value(record)} unavailable",
                        description="The source could not provide a usable record; verification from this source requires human follow-up or a later retry.",
                        source_references=[record.source_reference],
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="SOURCE_STATUS",
                        detected_at=analysis_time,
                    )
                )
            elif source_status is SourceRecordStatus.NOT_FOUND:
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.MISSING_EVIDENCE,
                        title=f"No record returned by {self._source_system_value(record)}",
                        description="The source is reachable but did not return a matching record for the requested student.",
                        source_references=[record.source_reference],
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="SOURCE_STATUS",
                        detected_at=analysis_time,
                    )
                )

        found_records = [r for r in records if SourceRecordStatus(r.status) is SourceRecordStatus.FOUND]

        # Attribute-level problems.
        for field, submitted_value in submitted_attributes.items():
            mismatch_records: list[dict[str, Any]] = []
            comparable_count = 0
            for record in found_records:
                comparison = compare_field(field, submitted_value, record.attributes.get(field))
                if comparison.comparable:
                    comparable_count += 1
                if comparison.comparable and comparison.matched is False:
                    mismatch_records.append(
                        {
                            "source": self._source_system_value(record),
                            "source_reference": record.source_reference,
                            "value": record.attributes.get(field),
                            "similarity": comparison.similarity,
                        }
                    )

            missing_records = [
                record.source_reference
                for record in found_records
                if not normalize_attribute(field, record.attributes.get(field))
            ]
            if missing_records:
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.MISSING_EVIDENCE,
                        title=f"Missing evidence for {field}",
                        description=f"One or more available source records do not contain a usable value for {field}.",
                        field=field,
                        submitted_value=submitted_value,
                        source_references=missing_records,
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="ATTRIBUTE_PRESENCE_CHECK",
                        detected_at=analysis_time,
                    )
                )

            if mismatch_records:
                only_name_partial = (
                    field == "full_name"
                    and len(mismatch_records) == 1
                    and 0.65 <= (mismatch_records[0]["similarity"] or 0.0) < 0.90
                )
                kind = ExceptionType.PARTIAL_IDENTITY_MATCH if only_name_partial else ExceptionType.DATA_MISMATCH
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=kind,
                        title=f"Partial match for {field}" if only_name_partial else f"Mismatch detected for {field}",
                        description=(
                            "The submitted name is similar to the available source value but below the strong-match threshold; corroborating attributes should be reviewed."
                            if only_name_partial
                            else f"At least one available source value conflicts with the submitted {field}."
                        ),
                        field=field,
                        submitted_value=submitted_value,
                        source_values=mismatch_records,
                        source_references=[item["source_reference"] for item in mismatch_records],
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="FIELD_COMPARISON",
                        detected_at=analysis_time,
                    )
                )
            elif found_records and comparable_count == 0:
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.INSUFFICIENT_INFORMATION,
                        title=f"Insufficient information for {field}",
                        description=f"Available source records did not provide a comparable value for {field}.",
                        field=field,
                        submitted_value=submitted_value,
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="COMPARABILITY_CHECK",
                        detected_at=analysis_time,
                    )
                )

            # Cross-source conflict deliberately does not pick a winning source.
            source_groups = self._distinct_source_values(found_records, field)
            if len(source_groups) > 1:
                flattened = [entry for group in source_groups for entry in group]
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.CROSS_SOURCE_CONFLICT,
                        title=f"Conflicting source values for {field}",
                        description="Multiple available sources provide different normalized values; no source is selected as the winner automatically.",
                        field=field,
                        submitted_value=submitted_value,
                        source_values=flattened,
                        source_references=[entry["source_reference"] for entry in flattened],
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="CROSS_SOURCE_COMPARISON",
                        detected_at=analysis_time,
                    )
                )

            # Stale only when an explicit freshness policy exists.
            if field in freshness_policy:
                cutoff = analysis_time - timedelta(days=freshness_policy[field])
                stale_records = [
                    r for r in found_records
                    if self._ensure_utc(r.retrieved_at) < cutoff and normalize_attribute(field, r.attributes.get(field))
                ]
                if stale_records:
                    created.append(
                        self._save(
                            application_id=application_id,
                            student_id=student_id,
                            kind=ExceptionType.STALE_SOURCE_RECORD,
                            title=f"Stale source evidence for {field}",
                            description=f"One or more source records are older than the explicitly configured freshness window of {freshness_policy[field]} day(s).",
                            field=field,
                            submitted_value=submitted_value,
                            source_values=[
                                {
                                    "source": self._source_system_value(r),
                                    "source_reference": r.source_reference,
                                    "retrieved_at": self._ensure_utc(r.retrieved_at).isoformat(),
                                    "value": r.attributes.get(field),
                                }
                                for r in stale_records
                            ],
                            source_references=[r.source_reference for r in stale_records],
                            verification_ids=shared_verification_ids,
                            evidence_ids=shared_evidence_ids,
                            detection_method="FRESHNESS_POLICY",
                            detected_at=analysis_time,
                        )
                    )

        # Document expiry is a verification signal only; document status remains owned by the document service.
        for document in docs:
            if (
                document.expires_at is not None
                and self._ensure_utc(document.expires_at) < analysis_time
                and document.status != DocumentStatus.REPLACED
            ):
                created.append(
                    self._save(
                        application_id=application_id,
                        student_id=student_id,
                        kind=ExceptionType.EXPIRED_DOCUMENT,
                        title=f"Expired document: {document.document_type}",
                        description="The document expiry date has passed as of the analysis timestamp.",
                        source_references=[document.storage_ref or document.document_id],
                        verification_ids=shared_verification_ids,
                        evidence_ids=shared_evidence_ids,
                        detection_method="DOCUMENT_EXPIRY_CHECK",
                        detected_at=analysis_time,
                    )
                )

        # Collapse duplicate signals generated by multiple observations of the same condition.
        unique: list[VerificationException] = []
        seen: set[tuple[Any, ...]] = set()
        for item in created:
            fingerprint = (
                item.type.value if isinstance(item.type, ExceptionType) else item.type,
                item.field,
                tuple(sorted(item.source_references)),
                item.description,
            )
            if fingerprint not in seen:
                seen.add(fingerprint)
                unique.append(item)

        severity_counts = {ExceptionSeverity.HIGH: 0, ExceptionSeverity.MEDIUM: 0, ExceptionSeverity.LOW: 0}
        affected_fields: set[str] = set()
        affected_sources: set[str] = set()
        all_evidence = set(shared_evidence_ids)
        all_source_refs: set[str] = set()
        for item in unique:
            severity_counts[item.severity] += 1
            if item.field:
                affected_fields.add(item.field)
            affected_sources.update(item.source_references)
            all_evidence.update(item.evidence_ids)
            all_source_refs.update(item.source_references)

        highest = next(
            (severity for severity in (ExceptionSeverity.HIGH, ExceptionSeverity.MEDIUM, ExceptionSeverity.LOW) if severity_counts[severity]),
            None,
        )

        return ExceptionAnalysisResult(
            application_id=application_id,
            student_id=student_id,
            exception_ids=[item.exception_id for item in unique],
            review_required=bool(unique),
            exception_count=len(unique),
            high_count=severity_counts[ExceptionSeverity.HIGH],
            medium_count=severity_counts[ExceptionSeverity.MEDIUM],
            low_count=severity_counts[ExceptionSeverity.LOW],
            affected_fields=sorted(affected_fields),
            affected_sources=sorted(affected_sources),
            evidence_ids=sorted(all_evidence),
            source_references=sorted(all_source_refs),
            highest_severity=highest,
            analysis_as_of=analysis_time,
        )
