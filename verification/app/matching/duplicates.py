from __future__ import annotations

from itertools import combinations
from typing import Iterable

from app.connectors.base import SourceRecord
from app.core.ids import new_id
from app.matching.algorithms import name_similarity
from app.matching.models import DuplicateCandidate
from app.matching.normalization import normalize_attribute


PAIR_FIELDS = ("full_name", "date_of_birth", "category", "mobile", "email", "institution_id")


def detect_duplicate_candidates(records: Iterable[SourceRecord]) -> list[DuplicateCandidate]:
    records = list(records)
    candidates: list[DuplicateCandidate] = []

    for left, right in combinations(records, 2):
        matching_fields: list[str] = []
        similarities: list[float] = []
        comparable = 0

        for field in PAIR_FIELDS:
            left_raw = left.attributes.get(field)
            right_raw = right.attributes.get(field)
            left_value = normalize_attribute(field, left_raw)
            right_value = normalize_attribute(field, right_raw)
            if not left_value or not right_value:
                continue
            comparable += 1
            if field == "full_name":
                score = name_similarity(left_value, right_value)
                if score >= 0.90:
                    matching_fields.append(field)
                    similarities.append(score)
            elif left_value == right_value:
                matching_fields.append(field)
                similarities.append(1.0)

        if comparable < 2 or not matching_fields:
            continue

        normalized = len(matching_fields) / comparable
        average = sum(similarities) / len(similarities)
        confidence = round(0.55 * average + 0.45 * normalized, 4)
        decisive_match = any(field in {"date_of_birth", "mobile", "email", "institution_id"} for field in matching_fields)

        if confidence >= 0.82 and (decisive_match or len(matching_fields) >= 2):
            candidates.append(
                DuplicateCandidate(
                    duplicate_candidate_id=new_id("dup"),
                    source_a=left.source_reference,
                    source_b=right.source_reference,
                    system_a=left.source_system,
                    system_b=right.source_system,
                    confidence=confidence,
                    matching_fields=matching_fields,
                    rationale="Records share multiple normalized identity attributes strongly enough to warrant duplicate review; this is a candidate, not an automatic merge decision.",
                )
            )

    return candidates
