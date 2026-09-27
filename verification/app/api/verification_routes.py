from fastapi import APIRouter, status

from app.api.routes import envelope, fail
from app.core.constants import ERROR_CODES
from app.verification.models import VerificationRunRequest
from app.runtime import runtime

router = APIRouter()
verification_repository = runtime.verification_repository
evidence_repository = runtime.evidence_repository
verification_engine = runtime.verification_engine


@router.post("/verifications/run")
def run_verification(request: VerificationRunRequest):
    try:
        result = verification_engine.verify(
            application_id=request.application_id,
            student_id=request.student_id,
            submitted_attributes=request.submitted_attributes,
            source_records=[record.to_record() for record in request.source_records],
            document_ids=request.document_ids,
        )
        return envelope(result.model_dump(mode="json"))
    except ValueError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.get("/verifications/{verification_id}")
def get_verification(verification_id: str):
    item = verification_repository.get_verification(verification_id)
    if item is None:
        raise fail("VERIFICATION_NOT_FOUND", ERROR_CODES["VERIFICATION_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    return envelope(item.model_dump(mode="json"))


@router.get("/applications/{application_id}/verifications")
def list_verifications(application_id: str):
    if not application_id.strip():
        raise fail("VALIDATION_ERROR", "application_id is required", status.HTTP_422_UNPROCESSABLE_ENTITY)
    items = verification_repository.list_for_application(application_id)
    return envelope([item.model_dump(mode="json") for item in items])


@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: str):
    item = evidence_repository.get_evidence(evidence_id)
    if item is None:
        raise fail("EVIDENCE_NOT_FOUND", ERROR_CODES["EVIDENCE_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    return envelope(item.model_dump(mode="json"))


@router.get("/verifications/{verification_id}/evidence")
def list_verification_evidence(verification_id: str):
    item = verification_repository.get_verification(verification_id)
    if item is None:
        raise fail("VERIFICATION_NOT_FOUND", ERROR_CODES["VERIFICATION_NOT_FOUND"], status.HTTP_404_NOT_FOUND)
    evidence = evidence_repository.list_for_ids(item.evidence_ids)
    return envelope([entry.model_dump(mode="json") for entry in evidence])
