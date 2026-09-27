from app.connectors.base import SourceRecord, SourceRecordStatus, SourceSystem
from app.matching.duplicates import detect_duplicate_candidates
from app.matching.matcher import compare_field, match_identity
from app.matching.models import MatchDecision, MatchMethod
from app.matching.normalization import normalize_attribute


def record(system=SourceSystem.DIGILOCKER, ref="src:001", attrs=None, subject="stu_001"):
    return SourceRecord(
        source_system=system,
        source_reference=ref,
        status=SourceRecordStatus.FOUND,
        subject_id=subject,
        attributes=attrs or {},
    )


def test_name_normalization_is_case_and_whitespace_insensitive():
    assert normalize_attribute("full_name", "  Asha   Kumar ") == "asha kumar"


def test_date_normalization_handles_indian_format():
    assert normalize_attribute("date_of_birth", "14/08/2005") == "2005-08-14"


def test_phone_normalization_keeps_last_ten_digits():
    assert normalize_attribute("mobile", "+91 98765 43210") == "9876543210"


def test_exact_date_match():
    result = compare_field("date_of_birth", "14/08/2005", "2005-08-14")
    assert result.matched is True
    assert result.method == MatchMethod.DATE_EXACT
    assert result.similarity == 1.0


def test_fuzzy_name_match():
    result = compare_field("full_name", "Asha Kumr", "Asha Kumar")
    assert result.comparable is True
    assert result.method == MatchMethod.FUZZY
    assert result.similarity >= 0.90


def test_name_near_match_is_not_auto_match_without_corroboration():
    result = match_identity(
        student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumr"},
        source_record=record(attrs={"full_name": "Asha Kumar"}),
    )
    assert result.decision == MatchDecision.PARTIAL_MATCH


def test_strong_identity_match():
    result = match_identity(
        student_id="stu_001",
        submitted_attributes={
            "full_name": " Asha Kumar ",
            "date_of_birth": "14/08/2005",
            "category": "ST",
            "institution_id": "inst_001",
        },
        source_record=record(attrs={
            "full_name": "asha kumar",
            "date_of_birth": "2005-08-14",
            "category": "ST",
            "institution_id": "INST-001",
        }),
    )
    assert result.decision == MatchDecision.MATCH
    assert result.confidence >= 0.90
    assert result.fields_mismatched == 0


def test_decisive_date_conflict_forces_mismatch():
    result = match_identity(
        student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"},
        source_record=record(attrs={"full_name": "Asha Kumar", "date_of_birth": "2006-08-14"}),
    )
    assert result.decision == MatchDecision.MISMATCH
    assert "date_of_birth" in result.decisive_conflicts


def test_missing_values_are_not_counted_as_mismatches():
    result = match_identity(
        student_id="stu_001",
        submitted_attributes={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"},
        source_record=record(attrs={"full_name": "Asha Kumar"}),
    )
    assert result.fields_compared == 1
    assert result.fields_mismatched == 0


def test_no_comparable_evidence_is_insufficient():
    result = match_identity(
        student_id="stu_001",
        submitted_attributes={"date_of_birth": ""},
        source_record=record(attrs={"date_of_birth": None}),
    )
    assert result.decision == MatchDecision.INSUFFICIENT_EVIDENCE
    assert result.confidence == 0.0


def test_unknown_fields_can_be_compared_deterministically():
    result = compare_field("custom_id", "AB-12", "ab12")
    assert result.matched is True


def test_duplicate_candidates_require_multiple_comparable_fields():
    a = record(ref="digilocker:001", attrs={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"})
    b = record(system=SourceSystem.APAAR, ref="apaar:001", attrs={"full_name": "ASHA KUMAR", "date_of_birth": "14/08/2005"})
    found = detect_duplicate_candidates([a, b])
    assert len(found) == 1
    assert found[0].confidence >= 0.82


def test_single_matching_field_does_not_create_duplicate():
    a = record(ref="a", attrs={"full_name": "Asha Kumar"})
    b = record(ref="b", attrs={"full_name": "Asha Kumar"})
    assert detect_duplicate_candidates([a, b]) == []


def test_duplicate_candidates_are_not_merge_decisions():
    a = record(ref="a", attrs={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"})
    b = record(ref="b", attrs={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"})
    candidate = detect_duplicate_candidates([a, b])[0]
    assert "candidate" in candidate.rationale.lower()
