from __future__ import annotations

from fastapi import APIRouter, Query, status
from fastapi.responses import HTMLResponse

from app.api.routes import envelope, fail, document_service, repository
from app.api.verification_routes import verification_repository, evidence_repository
from app.api.exception_routes import exception_repository
from app.investigation import InvestigationNotFoundError, InvestigationService
from app.core.constants import ERROR_CODES

router = APIRouter()
investigation_service = InvestigationService(
    document_repository=repository,
    verification_repository=verification_repository,
    evidence_repository=evidence_repository,
    exception_repository=exception_repository,
)


@router.get("/investigations")
def list_investigations(review_required: bool | None = Query(default=None)):
    items = investigation_service.list_cases(review_required=review_required)
    return envelope([item.model_dump(mode="json") for item in items])


@router.get("/investigations/{application_id}")
def get_investigation(application_id: str):
    try:
        case = investigation_service.get_case(application_id)
        return envelope(case.model_dump(mode="json"))
    except InvestigationNotFoundError:
        raise fail("INVESTIGATION_NOT_FOUND", "No verification investigation artifacts found for application", status.HTTP_404_NOT_FOUND)
    except ValueError as exc:
        raise fail("VALIDATION_ERROR", str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)


@router.get("/investigations/{application_id}/timeline")
def get_investigation_timeline(application_id: str):
    try:
        case = investigation_service.get_case(application_id)
        return envelope([item.model_dump(mode="json") for item in case.timeline])
    except InvestigationNotFoundError:
        raise fail("INVESTIGATION_NOT_FOUND", "No verification investigation artifacts found for application", status.HTTP_404_NOT_FOUND)


@router.get("/investigations/{application_id}/fields/{field_name}")
def get_investigation_field(application_id: str, field_name: str):
    try:
        case = investigation_service.get_case(application_id)
    except InvestigationNotFoundError:
        raise fail("INVESTIGATION_NOT_FOUND", "No verification investigation artifacts found for application", status.HTTP_404_NOT_FOUND)
    field = next((item for item in case.fields if item.field == field_name), None)
    if field is None:
        raise fail("FIELD_NOT_FOUND", "Investigation field not found", status.HTTP_404_NOT_FOUND)
    return envelope(field.model_dump(mode="json"))


@router.get("/investigation", response_class=HTMLResponse, include_in_schema=False)
def investigation_ui():
    from pathlib import Path
    return (Path(__file__).parents[1] / "static" / "investigation.html").read_text(encoding="utf-8")
