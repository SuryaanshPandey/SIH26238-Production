from __future__ import annotations

import os

from app.core.constants import DocumentSource, DocumentStatus
from app.connectors.base import SourceSystem
from app.runtime import runtime

STUDENT_ID = "STU-2026-JH-88391"
APPLICATION_ID = "APP-2026-ST-84091"
INSTITUTION_ID = "INST-JH-00412"


def seed_documents() -> list[str]:
    existing = runtime.document_service.list_student_documents(STUDENT_ID)
    by_type = {d.document_type: d for d in existing if d.status != DocumentStatus.REPLACED}
    specs = [
        ("CASTE_CERTIFICATE", DocumentSource.GOVERNMENT_SOURCE, DocumentStatus.VERIFIED, "2026-01-15", None, "Mock State Authority", "government://edistrict/asha-caste"),
        ("INCOME_CERTIFICATE", DocumentSource.USER_UPLOAD, DocumentStatus.MISMATCH, "2026-05-10", "2027-05-09", "Circle Officer (CO), Kanke Circle", "upload://asha-income-2026"),
        ("DOMICILE_CERTIFICATE", DocumentSource.DIGITAL_SOURCE, DocumentStatus.VERIFIED, "2024-09-18", None, "Government of Jharkhand / DigiLocker", "digilocker://asha-domicile"),
        ("BONAFIDE_CERTIFICATE", DocumentSource.INSTITUTION_SOURCE, DocumentStatus.VERIFIED, "2026-07-28", "2027-06-30", "BIT Sindri Dean Academic Affairs", "institution://bitsindri/asha-bonafide"),
        ("FEE_RECEIPT", DocumentSource.USER_UPLOAD, DocumentStatus.AVAILABLE, "2026-08-05", None, "BIT Sindri Accounts Office", "upload://asha-fee-receipt"),
    ]
    ids: list[str] = []
    for doc_type, source, status, issued, expires, issuer, storage in specs:
        if doc_type in by_type:
            ids.append(by_type[doc_type].document_id)
            continue
        doc = runtime.document_service.create_document(
            student_id=STUDENT_ID, application_id=APPLICATION_ID, document_type=doc_type, source=source,
            status=status, issuer=issuer, storage_ref=storage,
            issued_at=None, expires_at=None, integrity={"hash": f"demo-{doc_type.lower()}"},
        )
        ids.append(doc.document_id)
    return ids


def seed_verification(document_ids: list[str]) -> None:
    consent = runtime.consent_service.repository.latest_granted(STUDENT_ID, "SCHOLARSHIP_VERIFICATION")
    if consent is None:
        consent = runtime.consent_service.grant(student_id=STUDENT_ID, purpose="SCHOLARSHIP_VERIFICATION", source="APP")

    existing = runtime.verification_repository.list_for_application(APPLICATION_ID)
    if existing:
        return
    sources = []
    for system, attrs, institution_id, external_id in [
        (SourceSystem.DIGILOCKER, ["full_name", "date_of_birth", "category"], INSTITUTION_ID, STUDENT_ID),
        (SourceSystem.APAAR, ["full_name", "date_of_birth", "institution_id", "institution_name", "education_level", "course"], INSTITUTION_ID, STUDENT_ID),
        (SourceSystem.AISHE, ["institution_id", "institution_name", "education_level", "course", "institution_status"], INSTITUTION_ID, INSTITUTION_ID),
        (SourceSystem.STATE_EDISTRICT, ["full_name", "category", "income_annual", "domicile_state", "certificate_status"], INSTITUTION_ID, STUDENT_ID),
    ]:
        record = runtime.source_service.query(
            system=system, student_id=STUDENT_ID, attributes=attrs, institution_id=institution_id,
            external_id=external_id, authorized=True, purpose="SCHOLARSHIP_VERIFICATION", consent_id=consent.consent_id, application_id=APPLICATION_ID,
        )
        sources.append(record)

    result = runtime.verification_engine.verify(
        application_id=APPLICATION_ID,
        student_id=STUDENT_ID,
        submitted_attributes={
            "full_name": "Asha Kumar",
            "date_of_birth": "2005-07-14",
            "category": "ST",
            "income_annual": 180000,
            "institution_id": INSTITUTION_ID,
            "institution_name": "Birsa Institute of Technology (BIT) Sindri",
            "education_level": "UNDERGRADUATE",
            "course": "B.Tech Computer Science",
        },
        source_records=sources,
        document_ids=document_ids,
    )
    print(f"Seeded verification: {result.overall_result} / {len(result.verification_ids)} checks")


if __name__ == "__main__":
    ids = seed_documents()
    seed_verification(ids)
    print(f"Integration demo seed ready for {STUDENT_ID} / {APPLICATION_ID}")
