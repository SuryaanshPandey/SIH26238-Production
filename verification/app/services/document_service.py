from __future__ import annotations

from datetime import datetime

from app.core.constants import DocumentSource, DocumentStatus
from app.core.ids import new_id
from app.core.time import utc_now
from app.models.document import Document
from app.repositories.document_repository import DocumentHistoryEntry, DocumentRepository


class DocumentServiceError(Exception):
    """Base exception for document-service failures."""


class DocumentNotFoundError(DocumentServiceError):
    pass


class DocumentConflictError(DocumentServiceError):
    pass


class DocumentTransitionError(DocumentServiceError):
    pass


class DocumentValidationError(DocumentServiceError):
    pass


class DocumentService:
    """Owns document lifecycle, versioning and application linkage rules."""

    # Deliberately conservative: transitions only move a document through
    # states that preserve history and avoid silently changing its meaning.
    ALLOWED_TRANSITIONS: dict[DocumentStatus, set[DocumentStatus]] = {
        DocumentStatus.REQUESTED: {
            DocumentStatus.UPLOADED,
            DocumentStatus.PROCESSING,
            DocumentStatus.SOURCE_UNAVAILABLE,
            DocumentStatus.REJECTED,
        },
        DocumentStatus.UPLOADED: {
            DocumentStatus.PROCESSING,
            DocumentStatus.AVAILABLE,
            DocumentStatus.SOURCE_UNAVAILABLE,
            DocumentStatus.REJECTED,
        },
        DocumentStatus.PROCESSING: {
            DocumentStatus.AVAILABLE,
            DocumentStatus.SOURCE_UNAVAILABLE,
            DocumentStatus.REJECTED,
        },
        DocumentStatus.AVAILABLE: {
            DocumentStatus.VERIFIED,
            DocumentStatus.MISMATCH,
            DocumentStatus.EXPIRED,
            DocumentStatus.SOURCE_UNAVAILABLE,
            DocumentStatus.REPLACED,
        },
        DocumentStatus.VERIFIED: {
            DocumentStatus.MISMATCH,
            DocumentStatus.EXPIRED,
            DocumentStatus.REPLACED,
        },
        DocumentStatus.MISMATCH: {
            DocumentStatus.REPLACED,
            DocumentStatus.EXPIRED,
        },
        DocumentStatus.EXPIRED: {
            DocumentStatus.REPLACED,
        },
        DocumentStatus.REJECTED: {
            DocumentStatus.REPLACED,
        },
        DocumentStatus.SOURCE_UNAVAILABLE: {
            DocumentStatus.PROCESSING,
            DocumentStatus.REPLACED,
        },
        DocumentStatus.REPLACED: set(),
    }

    def __init__(self, repository: DocumentRepository) -> None:
        self.repository = repository

    def create_document(
        self,
        *,
        student_id: str,
        application_id: str,
        document_type: str,
        document_name: str | None = None,
        source: DocumentSource,
        status: DocumentStatus = DocumentStatus.UPLOADED,
        version: int | None = None,
        issued_at: datetime | None = None,
        expires_at: datetime | None = None,
        issuer: str | None = None,
        storage_ref: str | None = None,
        integrity: dict | None = None,
        original_filename: str | None = None,
        mime_type: str | None = None,
        file_size_bytes: int | None = None,
        document_id: str | None = None,
    ) -> Document:
        self._validate_fields(student_id, application_id, document_type)
        if version is not None and version < 1:
            raise DocumentValidationError("version must be >= 1")

        versions = self.repository.list_versions(student_id, application_id, document_type)
        current_versions = [d for d in versions if d.status != DocumentStatus.REPLACED]
        if current_versions:
            raise DocumentConflictError(
                "A current document already exists for this student, application and document type; use replacement."
            )

        resolved_version = version if version is not None else (max((d.version for d in versions), default=0) + 1)
        if resolved_version != max((d.version for d in versions), default=0) + 1:
            raise DocumentConflictError("Document version must be the next sequential version.")

        now = utc_now()
        document = Document(
            document_id=document_id or new_id("doc"),
            student_id=student_id,
            application_id=application_id,
            document_type=document_type,
            document_name=(document_name or document_type).strip(),
            status=status,
            source=source,
            version=resolved_version,
            issued_at=issued_at,
            expires_at=expires_at,
            issuer=issuer,
            storage_ref=storage_ref,
            original_filename=original_filename,
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            integrity=integrity,
            created_at=now,
            updated_at=now,
        )
        return self.repository.create(document)

    def get_document(self, document_id: str) -> Document:
        document = self.repository.get(document_id)
        if document is None:
            raise DocumentNotFoundError(document_id)
        return document

    def list_student_documents(self, student_id: str) -> list[Document]:
        if not student_id.strip():
            raise DocumentValidationError("student_id must not be empty")
        return self.repository.list_by_student(student_id)

    def list_application_documents(self, application_id: str) -> list[Document]:
        if not application_id.strip():
            raise DocumentValidationError("application_id must not be empty")
        return self.repository.list_by_application(application_id)

    def list_versions(self, document_id: str) -> list[Document]:
        document = self.get_document(document_id)
        return self.repository.list_versions(document.student_id, document.application_id, document.document_type)

    def transition_status(self, document_id: str, target_status: DocumentStatus) -> Document:
        current = self.get_document(document_id)
        if current.status == target_status:
            return current
        allowed = self.ALLOWED_TRANSITIONS.get(current.status, set())
        if target_status not in allowed:
            current_value = getattr(current.status, "value", current.status)
            target_value = getattr(target_status, "value", target_status)
            raise DocumentTransitionError(
                f"Invalid document transition: {current_value} -> {target_value}"
            )
        now = utc_now()
        updated = current.model_copy(update={"status": target_status, "updated_at": now})
        return self.repository.update(
            updated,
            occurred_at=now,
            action="STATUS_CHANGED",
            from_status=current.status,
        )

    def replace_document(
        self,
        document_id: str,
        *,
        source: DocumentSource,
        issued_at: datetime | None = None,
        expires_at: datetime | None = None,
        issuer: str | None = None,
        storage_ref: str | None = None,
        integrity: dict | None = None,
        document_name: str | None = None,
        original_filename: str | None = None,
        mime_type: str | None = None,
        file_size_bytes: int | None = None,
        initial_status: DocumentStatus = DocumentStatus.UPLOADED,
        replacement_document_id: str | None = None,
    ) -> Document:
        current = self.get_document(document_id)
        if current.status == DocumentStatus.REPLACED:
            raise DocumentConflictError("A replaced document cannot be replaced again; target the current version.")
        versions = self.repository.list_versions(current.student_id, current.application_id, current.document_type)
        next_version = max(d.version for d in versions) + 1
        now = utc_now()
        replacement = Document(
            document_id=replacement_document_id or new_id("doc"),
            student_id=current.student_id,
            application_id=current.application_id,
            document_type=current.document_type,
            document_name=(document_name or current.document_name or current.document_type).strip(),
            status=initial_status,
            source=source,
            version=next_version,
            issued_at=issued_at,
            expires_at=expires_at,
            issuer=issuer,
            storage_ref=storage_ref,
            original_filename=original_filename,
            mime_type=mime_type,
            file_size_bytes=file_size_bytes,
            integrity=integrity,
            created_at=now,
            updated_at=now,
        )
        return self.repository.replace(document_id, replacement, occurred_at=now)

    def history(self, document_id: str) -> list[DocumentHistoryEntry]:
        self.get_document(document_id)
        return self.repository.history(document_id)

    @staticmethod
    def _validate_fields(student_id: str, application_id: str, document_type: str) -> None:
        for field_name, value in (
            ("student_id", student_id),
            ("application_id", application_id),
            ("document_type", document_type),
        ):
            if not value.strip():
                raise DocumentValidationError(f"{field_name} must not be empty")
