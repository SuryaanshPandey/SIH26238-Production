from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.core.constants import DocumentSource, DocumentStatus, EvidenceType, ReviewStatus, VerificationResult
from app.models.document import Document
from app.models.evidence import Evidence
from app.models.verification import Verification, VerificationSubject


def test_document_matches_v1_contract_shape():
    doc = Document(
        document_id="doc_001",
        student_id="stu_001",
        application_id="app_001",
        document_type="INCOME_CERTIFICATE",
        status=DocumentStatus.AVAILABLE,
        source=DocumentSource.DIGITAL_SOURCE,
        version=1,
        issued_at=None,
        expires_at=None,
        issuer=None,
        storage_ref="secure://document/...",
        integrity={"hash": "sha256:test"},
    )
    assert doc.document_id == "doc_001"
    assert doc.status == "AVAILABLE"
    assert doc.version == 1


def test_verification_matches_v1_contract_shape():
    verification = Verification(
        verification_id="ver_001",
        application_id="app_001",
        student_id="stu_001",
        subject=VerificationSubject(type="STUDENT_ATTRIBUTE", name="date_of_birth"),
        submitted_value="2005-08-14",
        source_value="2005-08-14",
        result=VerificationResult.MATCH,
        confidence=0.99,
        source_reference="src_001",
        evidence_ids=["ev_001"],
        review_status=ReviewStatus.NOT_REQUIRED,
        verified_at=datetime(2026, 9, 23, 10, 30, tzinfo=timezone.utc),
    )
    assert verification.result == "MATCH"
    assert verification.confidence == 0.99
    assert verification.evidence_ids == ["ev_001"]


def test_evidence_is_traceable():
    evidence = Evidence(
        evidence_id="ev_001",
        type=EvidenceType.SOURCE_RECORD,
        source="DIGITAL_SOURCE",
        reference="source-record-123",
        integrity_hash="sha256:test",
        description="Source record used to verify date of birth",
    )
    assert evidence.reference == "source-record-123"
    assert evidence.integrity_hash


def test_confidence_is_bounded():
    with pytest.raises(ValidationError):
        Verification(
            verification_id="ver_001",
            application_id="app_001",
            student_id="stu_001",
            subject={"type": "STUDENT_ATTRIBUTE", "name": "date_of_birth"},
            result=VerificationResult.MATCH,
            confidence=1.5,
            review_status=ReviewStatus.NOT_REQUIRED,
        )
