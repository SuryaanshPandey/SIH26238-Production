from __future__ import annotations

from typing import Any, Iterable, Mapping

from app.connectors.base import SourceRecord
from app.matching.duplicates import detect_duplicate_candidates
from app.matching.matcher import match_identity
from app.matching.models import DuplicateCandidate, IdentityMatch


class IdentityMatchingService:
    """Source-agnostic identity matching service.

    The service accepts normalized SourceRecord objects produced by Step 3.
    It never knows which concrete connector produced them.
    """

    def match(self, *, student_id: str, submitted_attributes: Mapping[str, Any], source_record: SourceRecord) -> IdentityMatch:
        if not student_id.strip():
            raise ValueError("student_id is required")
        if not submitted_attributes:
            raise ValueError("submitted_attributes cannot be empty")
        return match_identity(
            student_id=student_id,
            submitted_attributes=submitted_attributes,
            source_record=source_record,
        )

    def match_against_sources(
        self,
        *,
        student_id: str,
        submitted_attributes: Mapping[str, Any],
        source_records: Iterable[SourceRecord],
    ) -> list[IdentityMatch]:
        records = list(source_records)
        return [
            self.match(
                student_id=student_id,
                submitted_attributes=submitted_attributes,
                source_record=record,
            )
            for record in records
        ]

    def duplicate_candidates(self, source_records: Iterable[SourceRecord]) -> list[DuplicateCandidate]:
        return detect_duplicate_candidates(source_records)
