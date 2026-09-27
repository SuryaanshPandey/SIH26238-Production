from datetime import datetime, timedelta, timezone

import pytest

from app.connectors.base import SourceRecord, SourceRecordStatus, SourceSystem
from app.core.constants import DocumentSource, DocumentStatus
from app.exceptions.models import ExceptionSeverity, ExceptionType
from app.exceptions.repository import InMemoryExceptionRepository
from app.exceptions.service import ExceptionIntelligenceService
from app.models.document import Document


AS_OF = datetime(2026, 9, 23, tzinfo=timezone.utc)


def record(system, reference, attrs, *, status=SourceRecordStatus.FOUND, retrieved_at=None):
    return SourceRecord(
        source_system=system,
        source_reference=reference,
        status=status,
        subject_id="stu_001",
        attributes=attrs,
        retrieved_at=retrieved_at or AS_OF,
    )


def test_clean_case_has_no_exceptions():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"},
        source_records=[
            record(SourceSystem.DIGILOCKER, "dl:1", {"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"}),
            record(SourceSystem.APAAR, "ap:1", {"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"}),
        ], as_of=AS_OF,
    )
    assert result.exception_count == 0
    assert result.review_required is False


def test_detects_decisive_data_mismatch():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-15"})], as_of=AS_OF,
    )
    item = repo.get(result.exception_ids[0])
    assert result.exception_count == 1
    assert item.type == ExceptionType.DATA_MISMATCH
    assert item.severity == ExceptionSeverity.HIGH
    assert item.review_required is True


def test_cross_source_conflict_preserves_both_values():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[
            record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-14"}),
            record(SourceSystem.INSTITUTION, "inst:1", {"date_of_birth": "2005-08-15"}),
        ], as_of=AS_OF,
    )
    items = repo.list_for_application("app_001")
    conflict = next(i for i in items if i.type == ExceptionType.CROSS_SOURCE_CONFLICT)
    assert len(conflict.source_values) == 2
    assert result.review_required is True
    assert result.high_count == 2  # data mismatch + cross-source conflict


def test_source_unavailable_is_distinct():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar"},
        source_records=[record(SourceSystem.UIDAI, "uidai:1", {}, status=SourceRecordStatus.UNAVAILABLE)],
        as_of=AS_OF,
    )
    assert result.exception_count == 1
    assert repo.get(result.exception_ids[0]).type == ExceptionType.SOURCE_UNAVAILABLE


def test_source_not_found_is_missing_evidence():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar"},
        source_records=[record(SourceSystem.AISHE, "aishe:missing", {}, status=SourceRecordStatus.NOT_FOUND)],
        as_of=AS_OF,
    )
    assert repo.get(result.exception_ids[0]).type == ExceptionType.MISSING_EVIDENCE


def test_missing_attribute_from_found_record():
    repo = InMemoryExceptionRepository()
    ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar", "email": "asha@example.com"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"full_name": "Asha Kumar"})], as_of=AS_OF,
    )
    missing = [i for i in repo.list_for_application("app_001") if i.type == ExceptionType.MISSING_EVIDENCE]
    assert any(i.field == "email" for i in missing)


def test_expired_document():
    doc = Document(
        document_id="doc_001", student_id="stu_001", application_id="app_001",
        document_type="INCOME_CERTIFICATE", status=DocumentStatus.AVAILABLE,
        source=DocumentSource.USER_UPLOAD, version=1,
        expires_at=AS_OF - timedelta(days=1), storage_ref="secure://documents/doc_001",
    )
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"full_name": "Asha Kumar"})],
        documents=[doc], as_of=AS_OF,
    )
    assert any(i.type == ExceptionType.EXPIRED_DOCUMENT for i in repo.list_for_application("app_001"))
    assert result.high_count == 1
    assert doc.status == DocumentStatus.AVAILABLE


def test_replaced_expired_document_is_ignored():
    doc = Document(
        document_id="doc_001", student_id="stu_001", application_id="app_001",
        document_type="INCOME_CERTIFICATE", status=DocumentStatus.REPLACED,
        source=DocumentSource.USER_UPLOAD, version=1,
        expires_at=AS_OF - timedelta(days=1), storage_ref="secure://documents/doc_001",
    )
    repo = InMemoryExceptionRepository()
    ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"full_name": "Asha Kumar"})],
        documents=[doc], as_of=AS_OF,
    )
    assert not repo.list_for_application("app_001")


def test_stale_requires_explicit_policy():
    repo = InMemoryExceptionRepository()
    old = AS_OF - timedelta(days=100)
    ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-14"}, retrieved_at=old)],
        freshness_days={"date_of_birth": 30}, as_of=AS_OF,
    )
    assert any(i.type == ExceptionType.STALE_SOURCE_RECORD for i in repo.list_for_application("app_001"))


def test_no_stale_claim_without_policy():
    repo = InMemoryExceptionRepository()
    old = AS_OF - timedelta(days=1000)
    ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-14"}, retrieved_at=old)],
        as_of=AS_OF,
    )
    assert not any(i.type == ExceptionType.STALE_SOURCE_RECORD for i in repo.list_for_application("app_001"))


def test_partial_name_signal_is_low():
    repo = InMemoryExceptionRepository()
    ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kmr"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"full_name": "Asha Kumar"})], as_of=AS_OF,
    )
    partial = [i for i in repo.list_for_application("app_001") if i.type == ExceptionType.PARTIAL_IDENTITY_MATCH]
    assert partial
    assert partial[0].severity == ExceptionSeverity.LOW


def test_shared_ids_are_attached_to_exceptions():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-15"})],
        verification_ids=["ver_1"], evidence_ids=["ev_1", "ev_2"], as_of=AS_OF,
    )
    item = repo.get(result.exception_ids[0])
    assert item.verification_ids == ["ver_1"]
    assert item.evidence_ids == ["ev_1", "ev_2"]


def test_empty_sources_produces_no_false_exception():
    repo = InMemoryExceptionRepository()
    result = ExceptionIntelligenceService(repo).analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar"},
        source_records=[], as_of=AS_OF,
    )
    assert result.exception_count == 0
    assert result.review_required is False


def test_invalid_freshness_policy_is_rejected():
    with pytest.raises(ValueError):
        service = ExceptionIntelligenceService(InMemoryExceptionRepository())
        service.analyze(
            application_id="app_001", student_id="stu_001",
            submitted_attributes={"full_name": "Asha Kumar"}, source_records=[],
            freshness_days={"full_name": -1}, as_of=AS_OF,
        )


def test_repository_prevents_overwrite():
    repo = InMemoryExceptionRepository()
    svc = ExceptionIntelligenceService(repo)
    result = svc.analyze(
        application_id="app_001", student_id="stu_001",
        submitted_attributes={"date_of_birth": "2005-08-14"},
        source_records=[record(SourceSystem.APAAR, "ap:1", {"date_of_birth": "2005-08-15"})], as_of=AS_OF,
    )
    item = repo.get(result.exception_ids[0])
    with pytest.raises(ValueError):
        repo.save(item)


def service():
    return ExceptionIntelligenceService(InMemoryExceptionRepository())
