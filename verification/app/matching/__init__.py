from app.matching.models import (
    DuplicateCandidate,
    FieldMatch,
    IdentityMatch,
    MatchDecision,
    MatchMethod,
)
from app.matching.normalization import normalize_attribute, normalize_attributes
from app.matching.service import IdentityMatchingService

__all__ = [
    "DuplicateCandidate",
    "FieldMatch",
    "IdentityMatch",
    "MatchDecision",
    "MatchMethod",
    "IdentityMatchingService",
    "normalize_attribute",
    "normalize_attributes",
]
