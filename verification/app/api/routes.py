import os
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from app.core.constants import CONTRACT_VERSION, DocumentSource, DocumentStatus, ERROR_CODES
from app.connectors import (
    SourceAuthorizationError,
    SourceNotFoundError,
    SourceResponseError,
    SourceSystem,
    SourceUnavailableError,
    build_default_registry,
)
from app.services.source_service import SourceService
from app.core.ids import new_id
from app.core.time import utc_now
from app.models.common import APIError, APIResponse, ResponseMeta
from app.models.document import Document
from app.connectors.base import SourceRecord, SourceRecordStatus
from app.matching.models import IdentityMatch, DuplicateCandidate
from app.matching.service import IdentityMatchingService
from app.runtime import runtime
from app.consent.service import ConsentError
from app.services.file_storage import FileStorageError, file_storage
from app.services.document_service import (
    DocumentConflictError,
    DocumentNotFoundError,
    DocumentService,
    DocumentTransitionError,
    DocumentValidationError,
)

router = APIRouter()
repository = runtime.document_repository
document_service = runtime.document_service
source_service = runtime.source_service
identity_matching_service = IdentityMatchingService()


def envelope(data=None, *, success=True, error=None):
    return APIResponse(
        success=success,
        data=data,
        error=error,
        meta=ResponseMeta(request_id=new_id("req"), timestamp=utc_now()),
    )


def fail(code: str, message: str, http_status: int) -> HTTPException:
    return HTTPException(
        status_code=http_status,
        detail=envelope(success=False, error=APIError(code=code, message=message)).model_dump(mode="json"),
    )


class SourceRecordInput(BaseModel):
    source_system: SourceSystem
    source_reference: str = Field(min_length=1)
    status: SourceRecordStatus = SourceRecordStatus.FOUND
    subject_id: str = Field(min_length=1)
    attributes: dict = Field(default_factory=dict)
    retrieved_at: datetime | None = None
    response_hash: str | None = None
    document_type: str | None = None
    institution_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)

    def to_record(self) -> SourceRecord:
        from app.core.time import utc_now
        return SourceRecord(
            source_system=self.source_system,
            source_reference=self.source_reference,
            status=self.status,
            subject_id=self.subject_id,
            attributes=self.attributes,
            retrieved_at=self.retrieved_at or utc_now(),
            response_hash=self.response_hash,
            document_type=self.document_type,
            institution_id=self.institution_id,
            metadata=self.metadata,
        )


class IdentityMatchRequest(BaseModel):
    student_id: str = Field(min_length=1)
    submitted_attributes: dict = Field(min_length=1)
    source_records: list[SourceRecordInput] = Field(min_length=1)


class DuplicateDetectionRequest(BaseModel):
    source_records: list[SourceRecordInput] = Field(min_length=2)


class ConsentCreateRequest(BaseModel):
    student_id: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    source: str = Field(default="APP", min_length=1)


class DocumentCreateRequest(BaseModel):
    student_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    document_type: str = Field(min_length=1)
    document_name: str | None = None
    source: DocumentSource
    status: DocumentStatus = DocumentStatus.UPLOADED
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    issuer: str | None = None
    storage_ref: str | None = None
    integrity: dict | None = None
    original_filename: str | None = None
    mime_type: str | None = None
    file_size_bytes: int | None = None


class DocumentStatusUpdateRequest(BaseModel):
    status: DocumentStatus


class SourceRecordQueryRequest(BaseModel):
    system: SourceSystem
    student_id: str = Field(min_length=1)
    attributes: list[str] = Field(default_factory=list)
    external_id: str | None = None
    document_type: str | None = None
    institution_id: str | None = None
    state: str | None = None
    authorized: bool = False
    purpose: str = ""
    consent_id: str | None = None
    application_id: str | None = None


class DocumentReplaceRequest(BaseModel):
    source: DocumentSource
    initial_status: DocumentStatus = DocumentStatus.UPLOADED
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    issuer: str | None = None
    storage_ref: str | None = None
    integrity: dict | None = None
    document_name: str | None = None


def _document_or_http(document_id: str) -> Document:
    try:
        return document_service.get_document(document_id)
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)


@router.get("/health")
def health() -> APIResponse[dict]:
    return envelope({"status": "ok", "service": "documents-verification", "contract_version": CONTRACT_VERSION})


@router.get("/contracts")
def contracts() -> APIResponse[dict]:
    return envelope(
        {
            "contract_version": CONTRACT_VERSION,
            "owned_entities": [
                "Document",
                "Verification",
                "Evidence",
                "ExternalReference",
                "AuditEvent",
                "ConsentRecord",
            ],
            "error_codes": ERROR_CODES,
        }
    )


@router.post("/documents", status_code=status.HTTP_201_CREATED)
def create_document(request: DocumentCreateRequest):
    try:
        document = document_service.create_document(**request.model_dump())
        return envelope(document.model_dump(mode="json"))
    except DocumentConflictError as exc:
        raise fail("DOCUMENT_CONFLICT", str(exc), status.HTTP_409_CONFLICT)
    except DocumentValidationError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.post("/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_document_file(
    file: UploadFile = File(...),
    student_id: str = Form(...),
    application_id: str = Form("UNASSIGNED"),
    document_type: str = Form(...),
    document_name: str = Form(""),
    issuer: str = Form(""),
    issued_at: datetime | None = Form(None),
    expires_at: datetime | None = Form(None),
    content_sha256: str | None = Form(None),
):
    if file.content_type not in {"application/pdf", "image/jpeg", "image/png"}:
        raise fail("UNSUPPORTED_FILE_TYPE", "Only PDF, JPG and PNG files are supported.", status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    try:
        content = await file.read()
        doc_id = new_id("doc")
        file_storage.verify_hash(content, content_sha256)
        versions = document_service.repository.list_versions(student_id, application_id, document_type)
        current_versions = [d for d in versions if d.status != DocumentStatus.REPLACED]
        if current_versions:
            import hashlib
            incoming_digest = hashlib.sha256(content).hexdigest().lower()
            current_hashes = {str(d.integrity.hash).lower() for d in current_versions if d.integrity and d.integrity.hash}
            if incoming_digest in current_hashes:
                raise DocumentConflictError("This exact document has already been uploaded for this student and application.")
            raise DocumentConflictError("A current document already exists for this student, application and document type; use replacement.")

        storage_ref, size, digest = file_storage.save(
            student_id=student_id,
            document_id=doc_id,
            filename=file.filename or "document",
            mime_type=file.content_type,
            content=content,
        )
        document = document_service.create_document(
            student_id=student_id, application_id=application_id, document_type=document_type,
            document_name=(document_name or document_type).strip(), source=DocumentSource.USER_UPLOAD,
            status=DocumentStatus.UPLOADED, issued_at=issued_at, expires_at=expires_at, issuer=issuer or None,
            storage_ref=storage_ref, integrity={"hash": digest}, original_filename=file.filename,
            mime_type=file.content_type, file_size_bytes=size, document_id=doc_id,
        )
        return envelope(document.model_dump(mode="json"))
    except (FileStorageError, DocumentValidationError) as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)
    except DocumentConflictError as exc:
        raise fail("DOCUMENT_CONFLICT", str(exc), status.HTTP_409_CONFLICT)


@router.post("/documents/{document_id}/replace-upload", status_code=status.HTTP_201_CREATED)
async def replace_document_file(
    document_id: str,
    file: UploadFile = File(...),
    document_name: str = Form(""),
    issuer: str = Form(""),
    issued_at: datetime | None = Form(None),
    expires_at: datetime | None = Form(None),
    content_sha256: str | None = Form(None),
):
    if file.content_type not in {"application/pdf", "image/jpeg", "image/png"}:
        raise fail("UNSUPPORTED_FILE_TYPE", "Only PDF, JPG and PNG files are supported.", status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    try:
        current = document_service.get_document(document_id)
        content = await file.read()
        file_storage.verify_hash(content, content_sha256)
        replacement_id = new_id("doc")
        storage_ref, size, digest = file_storage.save(
            student_id=current.student_id, document_id=replacement_id,
            filename=file.filename or "document", mime_type=file.content_type, content=content,
        )
        replacement = document_service.replace_document(
            document_id, source=DocumentSource.USER_UPLOAD, issued_at=issued_at, expires_at=expires_at,
            issuer=issuer or None, storage_ref=storage_ref, integrity={"hash": digest},
            document_name=(document_name or current.document_name or current.document_type).strip(),
            original_filename=file.filename, mime_type=file.content_type, file_size_bytes=size,
            replacement_document_id=replacement_id,
        )
        return envelope(replacement.model_dump(mode="json"))
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    except (FileStorageError, DocumentValidationError) as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)
    except DocumentConflictError as exc:
        raise fail("DOCUMENT_CONFLICT", str(exc), status.HTTP_409_CONFLICT)


@router.get("/documents/{document_id}")
def get_document(document_id: str):
    document = _document_or_http(document_id)
    return envelope(document.model_dump(mode="json"))


@router.get("/students/{student_id}/documents")
def list_student_documents(student_id: str):
    if not student_id.strip():
        raise fail("VALIDATION_ERROR", "student_id is required", status.HTTP_422_UNPROCESSABLE_ENTITY)
    documents = document_service.list_student_documents(student_id)
    return envelope([document.model_dump(mode="json") for document in documents])


@router.get("/applications/{application_id}/documents")
def list_application_documents(application_id: str):
    try:
        documents = document_service.list_application_documents(application_id)
        return envelope([document.model_dump(mode="json") for document in documents])
    except DocumentValidationError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.get("/documents/{document_id}/versions")
def list_document_versions(document_id: str):
    try:
        documents = document_service.list_versions(document_id)
        return envelope([document.model_dump(mode="json") for document in documents])
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)


@router.patch("/documents/{document_id}/status")
def update_document_status(document_id: str, request: DocumentStatusUpdateRequest):
    try:
        document = document_service.transition_status(document_id, request.status)
        return envelope(document.model_dump(mode="json"))
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    except DocumentTransitionError as exc:
        raise fail("INVALID_DOCUMENT_TRANSITION", str(exc), status.HTTP_409_CONFLICT)


@router.post("/documents/{document_id}/replace", status_code=status.HTTP_201_CREATED)
def replace_document(document_id: str, request: DocumentReplaceRequest):
    try:
        document = document_service.replace_document(document_id, **request.model_dump())
        return envelope(document.model_dump(mode="json"))
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    except DocumentConflictError as exc:
        raise fail("DOCUMENT_CONFLICT", str(exc), status.HTTP_409_CONFLICT)


@router.get("/documents/{document_id}/history")
def document_history(document_id: str):
    try:
        entries = document_service.history(document_id)
        return envelope(
            [
                {
                    "document_id": entry.document_id,
                    "action": entry.action,
                    "from_status": entry.from_status,
                    "to_status": entry.to_status,
                    "occurred_at": entry.occurred_at.isoformat().replace("+00:00", "Z"),
                    "version": entry.version,
                }
                for entry in entries
            ]
        )
    except DocumentNotFoundError:
        raise fail("DOCUMENT_NOT_FOUND", ERROR_CODES["DOCUMENT_NOT_FOUND"], status.HTTP_404_NOT_FOUND)


@router.get("/connectors")
def list_connectors():
    return envelope(source_service.list_connectors())


@router.post("/source-records/query")
def query_source_record(request: SourceRecordQueryRequest):
    try:
        record = source_service.query(**request.model_dump())
        return envelope(
            {
                "source_system": record.source_system.value,
                "source_reference": record.source_reference,
                "status": record.status.value,
                "subject_id": record.subject_id,
                "attributes": dict(record.attributes),
                "retrieved_at": record.retrieved_at.isoformat().replace("+00:00", "Z"),
                "response_hash": record.response_hash,
                "document_type": record.document_type,
                "institution_id": record.institution_id,
                "metadata": dict(record.metadata),
            }
        )
    except (SourceAuthorizationError, ConsentError, PermissionError) as exc:
        raise fail(
            "SOURCE_AUTHORIZATION_REQUIRED",
            str(exc),
            status.HTTP_403_FORBIDDEN,
        )
    except SourceNotFoundError as exc:
        raise fail(
            "SOURCE_RECORD_NOT_FOUND",
            str(exc),
            status.HTTP_404_NOT_FOUND,
        )
    except SourceUnavailableError as exc:
        raise fail(
            "SOURCE_UNAVAILABLE",
            str(exc),
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except SourceResponseError as exc:
        raise fail(
            "SOURCE_RESPONSE_INVALID",
            str(exc),
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    except KeyError as exc:
        raise fail(
            "CONNECTOR_NOT_FOUND",
            str(exc).strip("'"),
            status.HTTP_404_NOT_FOUND,
        )


@router.post("/identity-matches")
def identity_matches(request: IdentityMatchRequest):
    try:
        records = [record.to_record() for record in request.source_records]
        results = identity_matching_service.match_against_sources(
            student_id=request.student_id,
            submitted_attributes=request.submitted_attributes,
            source_records=records,
        )
        return envelope([item.model_dump(mode="json") for item in results])
    except ValueError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.post("/identity-matches/duplicates")
def identity_duplicate_candidates(request: DuplicateDetectionRequest):
    records = [record.to_record() for record in request.source_records]
    results = identity_matching_service.duplicate_candidates(records)
    return envelope([item.model_dump(mode="json") for item in results])


@router.get("/source-observations/{source_reference}")
def source_observations(source_reference: str):
    if not source_reference.strip():
        raise fail("VALIDATION_ERROR", "source_reference is required", status.HTTP_422_UNPROCESSABLE_ENTITY)
    items = runtime.source_observation_repository.list_for_reference(source_reference)
    return envelope(items)


@router.get("/system/storage")
def storage_status():
    return envelope({"backend": runtime.backend, "persistent": runtime.backend in {"sqlite", "postgres"}, "document_storage": os.getenv("SIH_DOCUMENT_STORAGE_BACKEND", "local")})


@router.post("/consents", status_code=status.HTTP_201_CREATED)
def create_consent(request: ConsentCreateRequest):
    try:
        record = runtime.consent_service.grant(student_id=request.student_id, purpose=request.purpose, source=request.source)
        return envelope(record.model_dump(mode="json"))
    except (ValueError, ConsentError) as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.get("/consents/latest")
def get_latest_granted_consent(student_id: str = Query(min_length=1), purpose: str = Query(min_length=1)):
    item = runtime.consent_service.repository.latest_granted(student_id, purpose)
    if item is None:
        raise fail("CONSENT_REQUIRED", "No granted consent exists for this student and purpose", status.HTTP_404_NOT_FOUND)
    return envelope(item.model_dump(mode="json"))


@router.get("/consents/{consent_id}")
def get_consent(consent_id: str):
    item = runtime.consent_service.get(consent_id)
    if item is None:
        raise fail("VALIDATION_ERROR", "Consent record not found", status.HTTP_404_NOT_FOUND)
    return envelope(item.model_dump(mode="json"))


@router.post("/consents/{consent_id}/revoke")
def revoke_consent(consent_id: str):
    try:
        item = runtime.consent_service.revoke(consent_id)
        return envelope(item.model_dump(mode="json"))
    except ConsentError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_404_NOT_FOUND)


@router.get("/audits/{entity_type}")
def get_audit_events(entity_type: str, entity_id: str = Query(min_length=1)):
    return envelope([item.model_dump(mode="json") for item in runtime.audit_repository.list_for_entity(entity_type, entity_id)])
