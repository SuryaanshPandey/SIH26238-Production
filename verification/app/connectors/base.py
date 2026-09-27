from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Mapping

from app.core.time import utc_now


class SourceSystem(str, Enum):
    DIGILOCKER = "DIGILOCKER"
    UDISE_PLUS = "UDISE_PLUS"
    APAAR = "APAAR"
    AISHE = "AISHE"
    UIDAI = "UIDAI"
    STATE_EDISTRICT = "STATE_EDISTRICT"
    UGC_NTA = "UGC_NTA"
    INSTITUTION = "INSTITUTION"


class SourceRecordStatus(str, Enum):
    FOUND = "FOUND"
    NOT_FOUND = "NOT_FOUND"
    UNAVAILABLE = "UNAVAILABLE"


class ConnectorError(Exception):
    """Base class for connector failures."""


class SourceUnavailableError(ConnectorError):
    """The source cannot be reached or is unavailable."""


class SourceNotFoundError(ConnectorError):
    """The source is available but has no matching record."""


class SourceAuthorizationError(ConnectorError):
    """The request lacks the required authorization context."""


class SourceResponseError(ConnectorError):
    """The source response could not be normalized safely."""


@dataclass(frozen=True)
class ConnectorAuthorization:
    authorized: bool
    purpose: str
    consent_id: str | None = None

    def validate(self) -> None:
        if not self.purpose.strip():
            raise SourceAuthorizationError("Connector purpose is required")
        if not self.authorized:
            raise SourceAuthorizationError("Connector authorization is required")


@dataclass(frozen=True)
class SourceQuery:
    student_id: str
    attributes: tuple[str, ...] = ()
    external_id: str | None = None
    document_type: str | None = None
    institution_id: str | None = None
    state: str | None = None
    authorization: ConnectorAuthorization = field(
        default_factory=lambda: ConnectorAuthorization(authorized=False, purpose="")
    )

    def validate(self) -> None:
        if not self.student_id.strip():
            raise SourceResponseError("student_id is required")
        self.authorization.validate()


@dataclass(frozen=True)
class SourceRecord:
    source_system: SourceSystem
    source_reference: str
    status: SourceRecordStatus
    subject_id: str
    attributes: Mapping[str, Any]
    retrieved_at: datetime = field(default_factory=utc_now)
    response_hash: str | None = None
    document_type: str | None = None
    institution_id: str | None = None
    metadata: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.source_reference.strip():
            raise SourceResponseError("source_reference is required")
        if not self.subject_id.strip():
            raise SourceResponseError("subject_id is required")


class SourceConnector(ABC):
    """Common interface implemented by every source adapter."""

    system: SourceSystem
    display_name: str
    government_managed: bool
    live_integration: bool

    @abstractmethod
    def fetch_record(self, query: SourceQuery) -> SourceRecord:
        """Fetch one normalized source record."""

    def supports(self, attribute: str) -> bool:
        return not attribute or attribute in self.supported_attributes()

    @abstractmethod
    def supported_attributes(self) -> set[str]:
        """Return fields the adapter can return in normalized form."""

    def health_check(self) -> dict[str, Any]:
        return {
            "system": self.system.value,
            "display_name": self.display_name,
            "government_managed": self.government_managed,
            "live_integration": self.live_integration,
            "status": "READY",
        }
