import json
from pathlib import Path

from app.connectors.base import SourceRecord
from app.verification import InMemoryEvidenceRepository, InMemoryVerificationRepository, VerificationEngine
from app.verification.models import VerificationRunRequest


ROOT = Path(__file__).parents[1]


def load_fixture(name):
    return json.loads((ROOT / "fixtures" / "verification" / name).read_text(encoding="utf-8"))


def source_records(payload):
    return [SourceRecord(**item) for item in payload["source_records"]]


def build_engine():
    return VerificationEngine(InMemoryVerificationRepository(), InMemoryEvidenceRepository())


def test_all_matching_attributes_produce_match_and_evidence():
    payload = load_fixture("verification_match.json")
    engine = build_engine()

    result = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
    )

    assert result.overall_result == "MATCH"
    assert result.overall_confidence > 0.9
    assert len(result.verification_ids) == 4
    assert len(result.evidence_ids) == 8
    assert result.review_required is False


def test_decisive_mismatch_requires_review():
    payload = load_fixture("verification_mismatch.json")
    engine = build_engine()

    result = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
    )

    assert result.overall_result == "MISMATCH"
    assert result.review_required is True


def test_unavailable_source_does_not_invent_confidence():
    payload = load_fixture("verification_unavailable.json")
    engine = build_engine()

    result = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
    )

    assert result.overall_result == "SOURCE_UNAVAILABLE"
    assert result.overall_confidence == 0.0
    assert result.review_required is True


def test_verification_history_is_append_only():
    payload = load_fixture("verification_match.json")
    repo = InMemoryVerificationRepository()
    evidence_repo = InMemoryEvidenceRepository()
    engine = VerificationEngine(repo, evidence_repo)

    first = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
    )
    second = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
    )

    assert first.verification_ids != second.verification_ids
    assert len(repo.list_for_application(payload["application_id"])) == 8


def test_document_reference_creates_traceable_document_evidence():
    payload = load_fixture("verification_match.json")
    engine = build_engine()
    result = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=source_records(payload),
        document_ids=["doc_001"],
    )

    assert len(result.evidence_ids) == 9


def test_not_found_source_is_not_verifiable_without_fake_review():
    payload = {
        "application_id": "app_004",
        "student_id": "stu_004",
        "submitted_attributes": {"full_name": "Mohan Das"},
        "source_records": [
            SourceRecord(
                source_system="APAAR",
                source_reference="apaar-not-found-004",
                status="NOT_FOUND",
                subject_id="unknown-004",
                attributes={},
            )
        ],
    }
    engine = build_engine()

    result = engine.verify(
        application_id=payload["application_id"],
        student_id=payload["student_id"],
        submitted_attributes=payload["submitted_attributes"],
        source_records=payload["source_records"],
    )

    assert result.overall_result == "INSUFFICIENT_EVIDENCE"
    assert result.overall_confidence == 0.0
    assert result.review_required is True
