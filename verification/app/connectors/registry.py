from __future__ import annotations

import os

from app.connectors.base import SourceConnector, SourceSystem
from app.connectors.http import HttpSourceConnector
from app.connectors.mock import (
    MockAISHEConnector,
    MockAPAARConnector,
    MockDigiLockerConnector,
    MockInstitutionConnector,
    MockStateEDistrictConnector,
    MockUDISEPlusConnector,
    MockUGCNTAConnector,
    MockUIDAIConnector,
)


class ConnectorRegistry:
    """Registry that decouples consumers from concrete source adapters."""

    def __init__(self, connectors: list[SourceConnector] | None = None) -> None:
        self._connectors: dict[SourceSystem, SourceConnector] = {}
        for connector in connectors or []:
            self.register(connector)

    def register(self, connector: SourceConnector) -> None:
        if connector.system in self._connectors:
            raise ValueError(f"Connector already registered for {connector.system.value}")
        self._connectors[connector.system] = connector

    def get(self, system: SourceSystem) -> SourceConnector:
        try:
            return self._connectors[system]
        except KeyError as exc:
            raise KeyError(f"No connector registered for {system.value}") from exc

    def list(self) -> list[SourceConnector]:
        return list(self._connectors.values())

    def health(self) -> list[dict]:
        return [connector.health_check() for connector in self._connectors.values()]


def build_default_registry() -> ConnectorRegistry:
    # Real integrations are the production default. Tests/local demo may set
    # SIH_REAL_DATA_MODE=false to deliberately opt into deterministic mocks.
    if os.getenv("SIH_REAL_DATA_MODE", "true").lower() != "false":
        return ConnectorRegistry([
            HttpSourceConnector(
                system=SourceSystem.DIGILOCKER,
                display_name="DigiLocker (official connector)",
                supported={"full_name", "date_of_birth", "category", "document_type", "issuer", "document_number_masked", "issue_date", "expiry_date"},
            ),
            HttpSourceConnector(
                system=SourceSystem.UDISE_PLUS,
                display_name="UDISE+ (official connector)",
                supported={"full_name", "date_of_birth", "school_id", "school_name", "enrollment_status", "class_level"},
            ),
            HttpSourceConnector(
                system=SourceSystem.APAAR,
                display_name="APAAR (official connector)",
                supported={"full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course"},
            ),
            HttpSourceConnector(
                system=SourceSystem.AISHE,
                display_name="AISHE (official connector)",
                supported={"institution_id", "institution_name", "education_level", "course", "institution_status"},
            ),
            HttpSourceConnector(
                system=SourceSystem.UIDAI,
                display_name="UIDAI (authorized connector)",
                supported={"full_name", "date_of_birth", "identity_status", "identifier_last4"},
            ),
            HttpSourceConnector(
                system=SourceSystem.STATE_EDISTRICT,
                display_name="State e-District (official connector)",
                supported={"full_name", "category", "income_annual", "domicile_state", "certificate_status", "certificate_number_masked"},
            ),
            HttpSourceConnector(
                system=SourceSystem.UGC_NTA,
                display_name="UGC/NTA (official connector)",
                supported={"full_name", "qualification", "qualification_status", "exam_name", "exam_year"},
            ),
            HttpSourceConnector(
                system=SourceSystem.INSTITUTION,
                display_name="Institution Record (configured connector)",
                supported={"full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course", "enrollment_status", "year_of_study"},
            ),
        ])

    return ConnectorRegistry([
        MockDigiLockerConnector(),
        MockUDISEPlusConnector(),
        MockAPAARConnector(),
        MockAISHEConnector(),
        MockUIDAIConnector(),
        MockStateEDistrictConnector(),
        MockUGCNTAConnector(),
        MockInstitutionConnector(),
    ])
