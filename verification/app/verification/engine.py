from __future__ import annotations

import hashlib
import json
from typing import Any, Iterable, Mapping

from app.connectors.base import SourceRecord, SourceRecordStatus, SourceSystem
from app.core.constants import EvidenceType, ReviewStatus, VerificationResult
from app.core.ids import new_id
from app.models.evidence import Evidence
from app.models.verification import Verification, VerificationSubject
from app.matching.matcher import compare_field
from app.matching.models import MatchMethod
from app.verification.models import VerificationRunResult
from app.verification.repository import EvidenceRepository, VerificationRepository


class VerificationEngine:
    """Create immutable, field-level verification facts backed by traceable evidence."""

    def __init__(self, verification_repository: VerificationRepository, evidence_repository: EvidenceRepository):
        self.verification_repository = verification_repository
        self.evidence_repository = evidence_repository

    @staticmethod
    def _stable_hash(value: Any) -> str:
        payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def _stringify(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return str(value)

    def _evidence(
        self,
        *,
        evidence_type: EvidenceType,
        source: str,
        reference: str,
        payload: Any,
        description: str,
    ) -> Evidence:
        evidence = Evidence(
            evidence_id=new_id("ev"),
            type=evidence_type,
            source=source,
            reference=reference,
            integrity_hash=self._stable_hash(payload),
            description=description,
        )
        return self.evidence_repository.save_evidence(evidence)

    def _source_status_result(self, status: SourceRecordStatus) -> VerificationResult:
        status = SourceRecordStatus(status)
        if status is SourceRecordStatus.UNAVAILABLE:
            return VerificationResult.SOURCE_UNAVAILABLE
        return VerificationResult.NOT_VERIFIABLE

    def verify(
        self,
        *,
        application_id: str,
        student_id: str,
        submitted_attributes: Mapping[str, Any],
        source_records: Iterable[SourceRecord],
        document_ids: Iterable[str] = (),
    ) -> VerificationRunResult:
        if not application_id.strip():
            raise ValueError("application_id is required")
        if not student_id.strip():
            raise ValueError("student_id is required")
        if not submitted_attributes:
            raise ValueError("submitted_attributes cannot be empty")

        records = list(source_records)
        if not records:
            raise ValueError("source_records cannot be empty")

        verification_ids: list[str] = []
        evidence_ids: list[str] = []
        source_references = [record.source_reference for record in records]
        checked_attributes = list(dict.fromkeys(submitted_attributes.keys()))
        confidences: list[float] = []
        results: list[VerificationResult] = []
        weight_total = 0.0
        weighted_confidence = 0.0

        # These document evidence references establish traceability to submitted artifacts.
        # The engine does not inspect binary content here; document parsing belongs to a later capability.
        for document_id in dict.fromkeys(document_ids):
            evidence = self._evidence(
                evidence_type=EvidenceType.DOCUMENT,
                source="DOCUMENT_SERVICE",
                reference=document_id,
                payload={"document_id": document_id},
                description="Document referenced by the verification request.",
            )
            evidence_ids.append(evidence.evidence_id)

        for source_record in records:
            source_status = SourceRecordStatus(source_record.status)
            source_system = SourceSystem(source_record.source_system)
            for field in checked_attributes:
                # A source record can be scoped to a subset of attributes.
                # Do not manufacture verification results for fields the source did not return.
                if source_status is SourceRecordStatus.FOUND and field not in source_record.attributes:
                    continue

                submitted_value = submitted_attributes.get(field)
                source_value = source_record.attributes.get(field)

                submitted_evidence = self._evidence(
                    evidence_type=EvidenceType.USER_SUBMISSION,
                    source="STUDENT_SUBMISSION",
                    reference=f"{application_id}:{field}",
                    payload={"field": field, "value": submitted_value},
                    description=f"Submitted value used to verify {field}.",
                )
                source_evidence = self._evidence(
                    evidence_type=EvidenceType.SOURCE_RECORD,
                    source=source_system.value,
                    reference=source_record.source_reference,
                    payload={"field": field, "value": source_value, "subject_id": source_record.subject_id},
                    description=f"Source value used to verify {field}.",
                )
                evidence_ids.extend([submitted_evidence.evidence_id, source_evidence.evidence_id])

                if source_status is not SourceRecordStatus.FOUND:
                    result = self._source_status_result(source_record.status)
                    confidence = 0.0
                    review_status = ReviewStatus.PENDING if result is VerificationResult.SOURCE_UNAVAILABLE else ReviewStatus.NOT_REQUIRED
                    explanation = "The source did not provide a usable record for verification."
                    if result is VerificationResult.SOURCE_UNAVAILABLE:
                        explanation = "The source was unavailable; verification cannot be completed from this source."
                else:
                    comparison = compare_field(field, submitted_value, source_value)
                    if not comparison.comparable:
                        result = VerificationResult.INSUFFICIENT_EVIDENCE
                        confidence = 0.0
                        review_status = ReviewStatus.NOT_REQUIRED
                        explanation = comparison.explanation
                    elif comparison.matched is True:
                        if comparison.method is MatchMethod.FUZZY and (comparison.similarity or 0.0) < 0.90:
                            result = VerificationResult.PARTIAL_MATCH
                        else:
                            result = VerificationResult.MATCH
                        confidence = comparison.similarity or 0.0
                        review_status = ReviewStatus.NOT_REQUIRED
                        explanation = comparison.explanation
                    else:
                        if comparison.field == "full_name" and (comparison.similarity or 0.0) >= 0.65:
                            result = VerificationResult.PARTIAL_MATCH
                        else:
                            result = VerificationResult.MISMATCH
                        confidence = comparison.similarity or 0.0
                        review_status = ReviewStatus.PENDING
                        explanation = comparison.explanation

                weight = (max(comparison.weight, 0.05) if comparison is not None else 0.05) if source_status is SourceRecordStatus.FOUND else 0.05
                if result not in {VerificationResult.SOURCE_UNAVAILABLE, VerificationResult.NOT_VERIFIABLE, VerificationResult.INSUFFICIENT_EVIDENCE}:
                    confidences.append(confidence)
                    weighted_confidence += weight * confidence
                    weight_total += weight

                verification = Verification(
                    verification_id=new_id("ver"),
                    application_id=application_id,
                    student_id=student_id,
                    subject=VerificationSubject(type="STUDENT_ATTRIBUTE", name=field),
                    submitted_value=self._stringify(submitted_value),
                    source_value=self._stringify(source_value),
                    result=result,
                    confidence=round(confidence, 4),
                    source_reference=source_record.source_reference,
                    evidence_ids=[submitted_evidence.evidence_id, source_evidence.evidence_id],
                    review_status=review_status,
                )
                self.verification_repository.save_verification(verification)
                verification_ids.append(verification.verification_id)
                results.append(result)

        unique_results = set(results)
        if not results or unique_results.issubset({VerificationResult.SOURCE_UNAVAILABLE}):
            overall = VerificationResult.SOURCE_UNAVAILABLE
        elif VerificationResult.MISMATCH in unique_results:
            overall = VerificationResult.MISMATCH
        elif VerificationResult.PENDING_REVIEW in unique_results:
            overall = VerificationResult.PENDING_REVIEW
        elif VerificationResult.INSUFFICIENT_EVIDENCE in unique_results and not any(
            result in {VerificationResult.MATCH, VerificationResult.PARTIAL_MATCH} for result in results
        ):
            overall = VerificationResult.INSUFFICIENT_EVIDENCE
        elif VerificationResult.NOT_VERIFIABLE in unique_results and not any(
            result in {VerificationResult.MATCH, VerificationResult.PARTIAL_MATCH} for result in results
        ):
            overall = VerificationResult.INSUFFICIENT_EVIDENCE
        elif VerificationResult.SOURCE_UNAVAILABLE in unique_results and len(unique_results) > 1:
            overall = VerificationResult.PARTIAL_MATCH
        elif VerificationResult.PARTIAL_MATCH in unique_results:
            overall = VerificationResult.PARTIAL_MATCH
        else:
            overall = VerificationResult.MATCH

        overall_confidence = 0.0
        if weight_total:
            overall_confidence = min(1.0, round(weighted_confidence / weight_total, 4))
        elif confidences:
            overall_confidence = round(sum(confidences) / len(confidences), 4)

        return VerificationRunResult(
            application_id=application_id,
            student_id=student_id,
            overall_result=overall.value,
            overall_confidence=overall_confidence,
            verification_ids=verification_ids,
            evidence_ids=list(dict.fromkeys(evidence_ids)),
            source_references=source_references,
            review_required=any(
                result in {
                    VerificationResult.MISMATCH,
                    VerificationResult.PENDING_REVIEW,
                    VerificationResult.SOURCE_UNAVAILABLE,
                    VerificationResult.NOT_VERIFIABLE,
                    VerificationResult.INSUFFICIENT_EVIDENCE,
                }
                for result in results
            ),
            checked_attributes=checked_attributes,
        )
