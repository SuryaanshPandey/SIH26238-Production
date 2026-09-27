from app.core.constants import DocumentSource, DocumentStatus
from app.repositories.document_repository import InMemoryDocumentRepository
from app.services.document_service import (
    DocumentConflictError,
    DocumentService,
    DocumentTransitionError,
)


def make_service():
    repo = InMemoryDocumentRepository()
    return DocumentService(repo), repo


def test_create_document_starts_version_one():
    service, _ = make_service()
    doc = service.create_document(
        student_id="stu_001",
        application_id="app_001",
        document_type="INCOME_CERTIFICATE",
        source=DocumentSource.USER_UPLOAD,
    )
    assert doc.version == 1
    assert doc.status == "UPLOADED"
    assert doc.student_id == "stu_001"
    assert doc.application_id == "app_001"


def test_duplicate_current_document_requires_replacement():
    service, _ = make_service()
    kwargs = dict(
        student_id="stu_001",
        application_id="app_001",
        document_type="ST_CERTIFICATE",
        source=DocumentSource.DIGITAL_SOURCE,
    )
    service.create_document(**kwargs)
    try:
        service.create_document(**kwargs)
        assert False, "expected conflict"
    except DocumentConflictError as exc:
        assert "use replacement" in str(exc).lower()


def test_status_transition_is_controlled():
    service, _ = make_service()
    doc = service.create_document(
        student_id="stu_001",
        application_id="app_001",
        document_type="INCOME_CERTIFICATE",
        source=DocumentSource.USER_UPLOAD,
    )
    updated = service.transition_status(doc.document_id, DocumentStatus.PROCESSING)
    assert updated.status == "PROCESSING"

    try:
        service.transition_status(doc.document_id, DocumentStatus.VERIFIED)
        assert False, "expected invalid transition"
    except DocumentTransitionError as exc:
        assert "PROCESSING -> VERIFIED" in str(exc)


def test_replacement_preserves_old_version_as_replaced():
    service, _ = make_service()
    old = service.create_document(
        student_id="stu_001",
        application_id="app_001",
        document_type="INCOME_CERTIFICATE",
        source=DocumentSource.USER_UPLOAD,
    )
    new = service.replace_document(
        old.document_id,
        source=DocumentSource.DIGITAL_SOURCE,
        storage_ref="secure://document/v2",
    )

    assert new.version == 2
    assert new.status == "UPLOADED"
    old_after = service.get_document(old.document_id)
    assert old_after.status == "REPLACED"

    versions = service.list_versions(new.document_id)
    assert [d.version for d in versions] == [1, 2]
    assert [d.status for d in versions] == ["REPLACED", "UPLOADED"]


def test_history_records_create_and_status_change():
    service, _ = make_service()
    doc = service.create_document(
        student_id="stu_001",
        application_id="app_001",
        document_type="DOMICILE_CERTIFICATE",
        source=DocumentSource.GOVERNMENT_SOURCE,
    )
    service.transition_status(doc.document_id, DocumentStatus.PROCESSING)
    history = service.history(doc.document_id)
    assert [entry.action for entry in history] == ["CREATED", "STATUS_CHANGED"]
    assert history[-1].from_status == "UPLOADED"
    assert history[-1].to_status == "PROCESSING"
