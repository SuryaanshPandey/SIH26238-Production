import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.routes import repository
from app.api.verification_routes import verification_repository, evidence_repository
from app.api.exception_routes import exception_repository
from app.main import app

ROOT = Path(__file__).parents[1]
client = TestClient(app)


def load_fixture(name):
    return json.loads((ROOT / "fixtures" / "verification" / name).read_text(encoding="utf-8"))


def setup_function():
    repository.clear()
    verification_repository._items.clear()
    evidence_repository._items.clear()
    exception_repository.clear()


def test_investigation_projection_aggregates_artifacts():
    create = client.post("/documents", json={
        "student_id": "stu_001", "application_id": "app_inv_001", "document_type": "ST_CERTIFICATE", "source": "USER_UPLOAD"
    })
    assert create.status_code == 201

    payload = load_fixture("verification_mismatch.json")
    payload["application_id"] = "app_inv_001"
    payload["student_id"] = "stu_001"
    run = client.post("/verifications/run", json=payload)
    assert run.status_code == 200
    assert run.json()["data"]["overall_result"] == "MISMATCH"

    exception_payload = {
        "application_id": "app_inv_001",
        "student_id": "stu_001",
        "submitted_attributes": payload["submitted_attributes"],
        "source_records": payload["source_records"],
        "documents": [create.json()["data"]],
        "verification_ids": run.json()["data"]["verification_ids"],
        "evidence_ids": run.json()["data"]["evidence_ids"],
    }
    analyzed = client.post("/exceptions/analyze", json=exception_payload)
    assert analyzed.status_code == 200

    case = client.get("/investigations/app_inv_001")
    assert case.status_code == 200
    data = case.json()["data"]
    assert data["case_id"] == "case_app_inv_001"
    assert data["summary"]["verifications"] >= 1
    assert data["summary"]["exceptions"] >= 1
    assert data["summary"]["evidence"] >= 1
    assert data["review_required"] is True
    assert data["timeline"]


def test_field_endpoint_and_timeline_endpoint():
    payload = load_fixture("verification_match.json")
    payload["application_id"] = "app_inv_002"
    payload["student_id"] = "stu_002"
    run = client.post("/verifications/run", json=payload)
    assert run.status_code == 200

    field = client.get("/investigations/app_inv_002/fields/full_name")
    assert field.status_code == 200
    assert field.json()["data"]["overall_result"] == "MATCH"

    timeline = client.get("/investigations/app_inv_002/timeline")
    assert timeline.status_code == 200
    assert timeline.json()["data"]


def test_investigation_not_found_is_contract_error():
    response = client.get("/investigations/app_missing")
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "INVESTIGATION_NOT_FOUND"


def test_investigation_ui_is_available():
    response = client.get("/investigation")
    assert response.status_code == 200
    assert "Verification Investigation Workspace" in response.text


def test_investigation_index_lists_cases_and_supports_filter():
    payload = load_fixture("verification_match.json")
    payload["application_id"] = "app_inv_003"
    payload["student_id"] = "stu_003"
    run = client.post("/verifications/run", json=payload)
    assert run.status_code == 200

    listed = client.get("/investigations")
    assert listed.status_code == 200
    assert any(item["application_id"] == "app_inv_003" for item in listed.json()["data"])
    filtered = client.get("/investigations?review_required=false")
    assert filtered.status_code == 200
    assert all(item["review_required"] is False for item in filtered.json()["data"])
