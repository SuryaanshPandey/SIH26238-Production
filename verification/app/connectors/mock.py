from __future__ import annotations

from dataclasses import replace
from hashlib import sha256
import json
from typing import Any, Mapping

from app.connectors.base import (
    ConnectorAuthorization,
    SourceConnector,
    SourceNotFoundError,
    SourceQuery,
    SourceRecord,
    SourceRecordStatus,
    SourceResponseError,
    SourceSystem,
    SourceUnavailableError,
)


class MockSourceConnector(SourceConnector):
    """Deterministic adapter used for local development and testing.

    It deliberately models source behavior without implying live government access.
    """

    def __init__(
        self,
        *,
        system: SourceSystem,
        display_name: str,
        government_managed: bool,
        supported: set[str],
        records: Mapping[str, Mapping[str, Any]] | None = None,
        unavailable: bool = False,
    ) -> None:
        self.system = system
        self.display_name = display_name
        self.government_managed = government_managed
        self.live_integration = False
        self._supported = set(supported)
        self._records = dict(records or {})
        self._unavailable = unavailable

    def supported_attributes(self) -> set[str]:
        return set(self._supported)

    def fetch_record(self, query: SourceQuery) -> SourceRecord:
        query.validate()
        if self._unavailable:
            raise SourceUnavailableError(f"{self.display_name} is unavailable")

        if query.attributes:
            unsupported = sorted(set(query.attributes) - self._supported)
            if unsupported:
                raise SourceResponseError(
                    f"Unsupported attributes for {self.system.value}: {', '.join(unsupported)}"
                )

        key = query.external_id or query.student_id
        raw = self._records.get(key)
        if raw is None:
            raise SourceNotFoundError(
                f"No matching record found in {self.system.value} for subject {key}"
            )

        attributes = dict(raw.get("attributes", {}))
        if query.attributes:
            attributes = {name: attributes.get(name) for name in query.attributes}

        source_reference = str(raw.get("source_reference") or f"{self.system.value.lower()}:{key}")
        subject_id = str(raw.get("subject_id") or query.student_id)
        document_type = raw.get("document_type") or query.document_type
        institution_id = raw.get("institution_id") or query.institution_id
        payload = {
            "source_system": self.system.value,
            "source_reference": source_reference,
            "subject_id": subject_id,
            "attributes": attributes,
            "document_type": document_type,
            "institution_id": institution_id,
        }
        response_hash = sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        ).hexdigest()
        return SourceRecord(
            source_system=self.system,
            source_reference=source_reference,
            status=SourceRecordStatus.FOUND,
            subject_id=subject_id,
            attributes=attributes,
            response_hash=response_hash,
            document_type=document_type,
            institution_id=institution_id,
            metadata={"adapter_mode": "MOCK", "display_name": self.display_name},
        )

    def with_unavailable(self, unavailable: bool = True) -> "MockSourceConnector":
        return MockSourceConnector(
            system=self.system,
            display_name=self.display_name,
            government_managed=self.government_managed,
            supported=self._supported,
            records=self._records,
            unavailable=unavailable,
        )


class MockDigiLockerConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.DIGILOCKER,
            display_name="DigiLocker (Mock)",
            government_managed=True,
            supported={
                "full_name", "date_of_birth", "category", "document_type", "issuer",
                "document_number_masked", "issue_date", "expiry_date",
            },
            records={
                "stu_001": {
                    "source_reference": "digilocker:doc_001",
                    "subject_id": "stu_001",
                    "document_type": "ST_CERTIFICATE",
                    "attributes": {
                        "full_name": "Asha Kumar", "date_of_birth": "2005-08-14", "category": "ST",
                        "document_type": "ST_CERTIFICATE", "issuer": "Mock State Authority",
                        "document_number_masked": "ST-****-001", "issue_date": "2026-01-15", "expiry_date": None,
                    },
                },
                "STU-2026-JH-88391": {
                    "source_reference": "digilocker:asha_001",
                    "subject_id": "STU-2026-JH-88391",
                    "document_type": "ST_CERTIFICATE",
                    "attributes": {
                        "full_name": "Asha Kumar", "date_of_birth": "2005-07-14", "category": "ST",
                        "document_type": "ST_CERTIFICATE", "issuer": "Government of Jharkhand (Mock)",
                        "document_number_masked": "ST-****-8821", "issue_date": "2026-01-15", "expiry_date": None,
                    },
                },
            },
            unavailable=unavailable,
        )


class MockUDISEPlusConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.UDISE_PLUS,
            display_name="UDISE+ (Mock)",
            government_managed=True,
            supported={"full_name", "date_of_birth", "school_id", "school_name", "enrollment_status", "class_level"},
            records={
                "stu_001": {
                    "source_reference": "udise:stu_001",
                    "subject_id": "stu_001",
                    "institution_id": "school_001",
                    "attributes": {
                        "full_name": "Asha Kumar",
                        "date_of_birth": "2005-08-14",
                        "school_id": "school_001",
                        "school_name": "Mock Tribal Residential School",
                        "enrollment_status": "ENROLLED",
                        "class_level": "X",
                    },
                }
            },
            unavailable=unavailable,
        )


class MockAPAARConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.APAAR,
            display_name="APAAR (Mock)",
            government_managed=True,
            supported={"full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course"},
            records={
                "stu_001": {
                    "source_reference": "apaar:stu_001", "subject_id": "stu_001", "institution_id": "inst_001",
                    "attributes": {
                        "full_name": "Asha Kumar", "date_of_birth": "2005-08-14", "institution_id": "inst_001",
                        "institution_name": "Mock Institute of Technology", "education_level": "UNDERGRADUATE", "course": "B.Tech",
                    },
                },
                "STU-2026-JH-88391": {
                    "source_reference": "apaar:asha_001", "subject_id": "STU-2026-JH-88391", "institution_id": "INST-JH-00412",
                    "attributes": {
                        "full_name": "Asha Kumar", "date_of_birth": "2005-07-14", "institution_id": "INST-JH-00412",
                        "institution_name": "Birsa Institute of Technology (BIT) Sindri", "education_level": "UNDERGRADUATE",
                        "course": "B.Tech Computer Science",
                    },
                },
            },
            unavailable=unavailable,
        )


class MockAISHEConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.AISHE,
            display_name="AISHE (Mock)",
            government_managed=True,
            supported={"institution_id", "institution_name", "education_level", "course", "institution_status"},
            records={
                "inst_001": {
                    "source_reference": "aishe:inst_001", "subject_id": "inst_001", "institution_id": "inst_001",
                    "attributes": {
                        "institution_id": "inst_001", "institution_name": "Mock Institute of Technology", "education_level": "UNDERGRADUATE",
                        "course": "B.Tech", "institution_status": "ACTIVE",
                    },
                },
                "INST-JH-00412": {
                    "source_reference": "aishe:INST-JH-00412", "subject_id": "INST-JH-00412", "institution_id": "INST-JH-00412",
                    "attributes": {
                        "institution_id": "INST-JH-00412", "institution_name": "Birsa Institute of Technology (BIT) Sindri",
                        "education_level": "UNDERGRADUATE", "course": "B.Tech Computer Science", "institution_status": "ACTIVE",
                    },
                },
            },
            unavailable=unavailable,
        )

    def fetch_record(self, query: SourceQuery) -> SourceRecord:
        if not query.institution_id and not query.external_id:
            raise SourceResponseError("AISHE mock requires institution_id or external_id")
        effective = replace(query, external_id=query.external_id or query.institution_id)
        return super().fetch_record(effective)


class MockStateEDistrictConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.STATE_EDISTRICT,
            display_name="State e-District (Mock)",
            government_managed=True,
            supported={"full_name", "category", "income_annual", "domicile_state", "certificate_status", "certificate_number_masked"},
            records={
                "stu_001": {
                    "source_reference": "edistrict:cert_001", "subject_id": "stu_001",
                    "attributes": {
                        "full_name": "Asha Kumar", "category": "ST", "income_annual": 180000, "domicile_state": "Uttar Pradesh",
                        "certificate_status": "VALID", "certificate_number_masked": "INC-****-001",
                    },
                },
                "STU-2026-JH-88391": {
                    "source_reference": "edistrict:asha_income", "subject_id": "STU-2026-JH-88391",
                    "attributes": {
                        "full_name": "Asha Kumar", "category": "ST", "income_annual": 240000, "domicile_state": "Jharkhand",
                        "certificate_status": "VALID", "certificate_number_masked": "INC-****-8821",
                    },
                },
            },
            unavailable=unavailable,
        )


class MockUGCNTAConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.UGC_NTA,
            display_name="UGC/NTA-related Source (Mock)",
            government_managed=True,
            supported={"full_name", "qualification", "qualification_status", "exam_name", "exam_year"},
            records={
                "stu_001": {
                    "source_reference": "ugc-nta:stu_001",
                    "subject_id": "stu_001",
                    "attributes": {
                        "full_name": "Asha Kumar",
                        "qualification": "NET",
                        "qualification_status": "QUALIFIED",
                        "exam_name": "UGC-NET",
                        "exam_year": "2026",
                    },
                }
            },
            unavailable=unavailable,
        )


class MockUIDAIConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.UIDAI,
            display_name="UIDAI (Mock)",
            government_managed=True,
            supported={"full_name", "date_of_birth", "identity_status", "identifier_last4"},
            records={
                "STU-2026-JH-88391": {
                    "source_reference": "uidai:tokenized-asha_001",
                    "subject_id": "STU-2026-JH-88391",
                    "attributes": {
                        "full_name": "Asha Kumar",
                        "date_of_birth": "2005-07-14",
                        "identity_status": "VERIFIED",
                        "identifier_last4": "8921",
                    },
                },
                "stu_001": {
                    "source_reference": "uidai:tokenized-stu_001",
                    "subject_id": "stu_001",
                    "attributes": {
                        "full_name": "Asha Kumar",
                        "date_of_birth": "2005-08-14",
                        "identity_status": "VERIFIED",
                        "identifier_last4": "1001",
                    },
                }
            },
            unavailable=unavailable,
        )


class MockInstitutionConnector(MockSourceConnector):
    def __init__(self, *, unavailable: bool = False) -> None:
        super().__init__(
            system=SourceSystem.INSTITUTION,
            display_name="Institution Record (Mock)",
            government_managed=False,
            supported={"full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course", "enrollment_status", "year_of_study"},
            records={
                "stu_001": {
                    "source_reference": "institution:student_001",
                    "subject_id": "stu_001",
                    "institution_id": "inst_001",
                    "attributes": {
                        "full_name": "Asha Kumar",
                        "date_of_birth": "2005-08-14",
                        "institution_id": "inst_001",
                        "institution_name": "Mock Institute of Technology",
                        "education_level": "UNDERGRADUATE",
                        "course": "B.Tech",
                        "enrollment_status": "ENROLLED",
                        "year_of_study": 2,
                    },
                }
            },
            unavailable=unavailable,
        )


__all__ = [
    "MockSourceConnector",
    "MockDigiLockerConnector",
    "MockUDISEPlusConnector",
    "MockAPAARConnector",
    "MockAISHEConnector",
    "MockStateEDistrictConnector",
    "MockUGCNTAConnector",
    "MockUIDAIConnector",
    "MockInstitutionConnector",
]
