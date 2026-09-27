from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.connectors.base import SourceSystem


class MatchDecision(str, Enum):
    MATCH = "MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    MISMATCH = "MISMATCH"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class MatchMethod(str, Enum):
    EXACT = "EXACT"
    FUZZY = "FUZZY"
    NORMALIZED_EXACT = "NORMALIZED_EXACT"
    DATE_EXACT = "DATE_EXACT"
    NOT_COMPARABLE = "NOT_COMPARABLE"


class FieldMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str = Field(min_length=1)
    submitted_value: Any | None = None
    source_value: Any | None = None
    normalized_submitted: str | None = None
    normalized_source: str | None = None
    comparable: bool
    matched: bool | None = None
    similarity: float | None = Field(default=None, ge=0.0, le=1.0)
    method: MatchMethod
    weight: float = Field(gt=0.0, le=1.0)
    explanation: str = Field(min_length=1)


class IdentityMatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    source_system: SourceSystem
    source_reference: str = Field(min_length=1)
    source_subject_id: str = Field(min_length=1)
    decision: MatchDecision
    confidence: float = Field(ge=0.0, le=1.0)
    fields_compared: int = Field(ge=0)
    fields_matched: int = Field(ge=0)
    fields_mismatched: int = Field(ge=0)
    field_matches: list[FieldMatch]
    decisive_conflicts: list[str]
    compared_weight: float = Field(ge=0.0, le=1.0)
    evidence_strength: str = Field(min_length=1)


class DuplicateCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    duplicate_candidate_id: str = Field(min_length=1)
    source_a: str = Field(min_length=1)
    source_b: str = Field(min_length=1)
    system_a: SourceSystem
    system_b: SourceSystem
    confidence: float = Field(ge=0.0, le=1.0)
    matching_fields: list[str]
    rationale: str = Field(min_length=1)
