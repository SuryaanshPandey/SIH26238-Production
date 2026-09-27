from __future__ import annotations

from typing import Any, Mapping

from app.connectors.base import SourceRecord
from app.core.ids import new_id
from app.matching.algorithms import name_similarity, similarity_ratio
from app.matching.models import FieldMatch, IdentityMatch, MatchDecision, MatchMethod
from app.matching.normalization import normalize_attribute


FIELD_WEIGHTS: dict[str, float] = {
    "full_name": 0.35,
    "date_of_birth": 0.25,
    "category": 0.15,
    "mobile": 0.10,
    "email": 0.10,
    "institution_id": 0.05,
}

DECISIVE_FIELDS = {
    "date_of_birth",
    "mobile",
    "email",
    "institution_id",
    "category",
}

FUZZY_FIELDS = {"full_name"}


def _field_weight(field: str) -> float:
    return FIELD_WEIGHTS.get(field, 0.05)


def _explain_exact(field: str) -> str:
    if field == "date_of_birth":
        return "Date of birth matched after date normalization."
    if field == "full_name":
        return "Name matched after Unicode and whitespace normalization."
    return f"{field} matched after normalization."


def compare_field(field: str, submitted_value: Any, source_value: Any) -> FieldMatch:
    submitted = normalize_attribute(field, submitted_value)
    source = normalize_attribute(field, source_value)
    weight = _field_weight(field)

    if not submitted or not source:
        return FieldMatch(
            field=field,
            submitted_value=submitted_value,
            source_value=source_value,
            normalized_submitted=submitted or None,
            normalized_source=source or None,
            comparable=False,
            matched=None,
            similarity=None,
            method=MatchMethod.NOT_COMPARABLE,
            weight=weight,
            explanation="One or both values are unavailable; the field was not compared.",
        )

    if submitted == source:
        method = MatchMethod.DATE_EXACT if field == "date_of_birth" else MatchMethod.NORMALIZED_EXACT
        return FieldMatch(
            field=field,
            submitted_value=submitted_value,
            source_value=source_value,
            normalized_submitted=submitted,
            normalized_source=source,
            comparable=True,
            matched=True,
            similarity=1.0,
            method=method,
            weight=weight,
            explanation=_explain_exact(field),
        )

    if field in FUZZY_FIELDS:
        similarity = name_similarity(submitted, source)
        if similarity >= 0.90:
            return FieldMatch(
                field=field,
                submitted_value=submitted_value,
                source_value=source_value,
                normalized_submitted=submitted,
                normalized_source=source,
                comparable=True,
                matched=True,
                similarity=similarity,
                method=MatchMethod.FUZZY,
                weight=weight,
                explanation="Name is a strong fuzzy match; minor ordering, punctuation or spelling differences were detected.",
            )
        if similarity >= 0.65:
            return FieldMatch(
                field=field,
                submitted_value=submitted_value,
                source_value=source_value,
                normalized_submitted=submitted,
                normalized_source=source,
                comparable=True,
                matched=False,
                similarity=similarity,
                method=MatchMethod.FUZZY,
                weight=weight,
                explanation="Name is similar but below the strong-match threshold and needs corroboration from other fields.",
            )
        return FieldMatch(
            field=field,
            submitted_value=submitted_value,
            source_value=source_value,
            normalized_submitted=submitted,
            normalized_source=source,
            comparable=True,
            matched=False,
            similarity=similarity,
            method=MatchMethod.FUZZY,
            weight=weight,
            explanation="Name similarity is too low to support an identity match by itself.",
        )

    similarity = similarity_ratio(submitted, source)
    return FieldMatch(
        field=field,
        submitted_value=submitted_value,
        source_value=source_value,
        normalized_submitted=submitted,
        normalized_source=source,
        comparable=True,
        matched=False,
        similarity=similarity,
        method=MatchMethod.EXACT,
        weight=weight,
        explanation=f"{field} differs after deterministic normalization.",
    )


def match_identity(
    *,
    student_id: str,
    submitted_attributes: Mapping[str, Any],
    source_record: SourceRecord,
) -> IdentityMatch:
    candidate_fields = [
        field for field in FIELD_WEIGHTS
        if field in submitted_attributes or field in source_record.attributes
    ]
    field_matches = [
        compare_field(field, submitted_attributes.get(field), source_record.attributes.get(field))
        for field in candidate_fields
    ]

    comparable = [item for item in field_matches if item.comparable]
    matched = [item for item in comparable if item.matched]
    mismatched = [item for item in comparable if item.matched is False]
    compared_weight = min(1.0, sum(item.weight for item in comparable))
    matched_weight = sum(item.weight for item in matched)
    weighted_quality = sum(item.weight * (item.similarity or 0.0) for item in comparable)
    base_confidence = weighted_quality / compared_weight if compared_weight else 0.0
    coverage_factor = min(1.0, compared_weight / 0.55) if compared_weight else 0.0
    confidence = min(1.0, round(base_confidence * (0.55 + 0.45 * coverage_factor), 4))

    decisive_conflicts = [
        item.field
        for item in mismatched
        if item.field in DECISIVE_FIELDS
    ]

    has_strong_name = any(
        item.field == "full_name" and item.matched is True and (item.similarity or 0.0) >= 0.90
        for item in comparable
    )
    exact_decisive_matches = sum(
        1 for item in matched
        if item.field in DECISIVE_FIELDS and item.method in {MatchMethod.NORMALIZED_EXACT, MatchMethod.DATE_EXACT}
    )

    if not comparable or len(comparable) < 1:
        decision = MatchDecision.INSUFFICIENT_EVIDENCE
        evidence_strength = "NONE"
    elif decisive_conflicts:
        decision = MatchDecision.MISMATCH
        evidence_strength = "CONFLICT"
    elif has_strong_name and exact_decisive_matches >= 1 and not mismatched:
        decision = MatchDecision.MATCH
        evidence_strength = "STRONG"
    elif matched_weight > 0 and not decisive_conflicts and len(matched) >= 1:
        decision = MatchDecision.PARTIAL_MATCH
        evidence_strength = "PARTIAL"
    else:
        decision = MatchDecision.INSUFFICIENT_EVIDENCE
        evidence_strength = "WEAK"

    return IdentityMatch(
        match_id=new_id("match"),
        student_id=student_id,
        source_system=source_record.source_system,
        source_reference=source_record.source_reference,
        source_subject_id=source_record.subject_id,
        decision=decision,
        confidence=confidence,
        fields_compared=len(comparable),
        fields_matched=len(matched),
        fields_mismatched=len(mismatched),
        field_matches=field_matches,
        decisive_conflicts=decisive_conflicts,
        compared_weight=round(compared_weight, 4),
        evidence_strength=evidence_strength,
    )
