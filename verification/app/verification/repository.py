from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import RLock

from app.models.evidence import Evidence
from app.models.verification import Verification


class VerificationRepository(ABC):
    @abstractmethod
    def save_verification(self, verification: Verification) -> Verification: ...

    @abstractmethod
    def get_verification(self, verification_id: str) -> Verification | None: ...

    @abstractmethod
    def list_for_application(self, application_id: str) -> list[Verification]: ...


class EvidenceRepository(ABC):
    @abstractmethod
    def save_evidence(self, evidence: Evidence) -> Evidence: ...

    @abstractmethod
    def get_evidence(self, evidence_id: str) -> Evidence | None: ...

    @abstractmethod
    def list_for_ids(self, evidence_ids: list[str]) -> list[Evidence]: ...


@dataclass
class InMemoryVerificationRepository(VerificationRepository):
    _items: dict[str, Verification] | None = None

    def __post_init__(self):
        self._items = self._items or {}
        self._lock = RLock()

    def save_verification(self, verification: Verification) -> Verification:
        with self._lock:
            if verification.verification_id in self._items:
                raise ValueError("verification_id already exists")
            self._items[verification.verification_id] = verification
        return verification

    def get_verification(self, verification_id: str) -> Verification | None:
        with self._lock:
            return self._items.get(verification_id)

    def list_for_application(self, application_id: str) -> list[Verification]:
        with self._lock:
            return [v for v in self._items.values() if v.application_id == application_id]


@dataclass
class InMemoryEvidenceRepository(EvidenceRepository):
    _items: dict[str, Evidence] | None = None

    def __post_init__(self):
        self._items = self._items or {}
        self._lock = RLock()

    def save_evidence(self, evidence: Evidence) -> Evidence:
        with self._lock:
            if evidence.evidence_id in self._items:
                raise ValueError("evidence_id already exists")
            self._items[evidence.evidence_id] = evidence
        return evidence

    def get_evidence(self, evidence_id: str) -> Evidence | None:
        with self._lock:
            return self._items.get(evidence_id)

    def list_for_ids(self, evidence_ids: list[str]) -> list[Evidence]:
        with self._lock:
            return [self._items[eid] for eid in evidence_ids if eid in self._items]
