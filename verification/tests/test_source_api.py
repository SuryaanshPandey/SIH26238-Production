from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_connectors_endpoint():
    response = client.get("/connectors")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert len(payload["data"]) == 8


def test_source_query_requires_authorization():
    response = client.post(
        "/source-records/query",
        json={
            "system": "DIGILOCKER",
            "student_id": "stu_001",
            "attributes": ["full_name"],
            "authorized": False,
            "purpose": "DOCUMENT_VERIFICATION",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"]["error"]["code"] == "SOURCE_AUTHORIZATION_REQUIRED"


def test_source_query_returns_normalized_record():
    response = client.post(
        "/source-records/query",
        json={
            "system": "DIGILOCKER",
            "student_id": "stu_001",
            "attributes": ["full_name", "date_of_birth", "category"],
            "authorized": True,
            "purpose": "DOCUMENT_VERIFICATION",
            "consent_id": "cons_001",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["source_system"] == "DIGILOCKER"
    assert payload["data"]["attributes"]["category"] == "ST"
    assert payload["data"]["metadata"]["adapter_mode"] == "MOCK"


def test_source_query_not_found_maps_to_404():
    response = client.post(
        "/source-records/query",
        json={
            "system": "DIGILOCKER",
            "student_id": "unknown",
            "authorized": True,
            "purpose": "DOCUMENT_VERIFICATION",
            "consent_id": "cons_001",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"]["error"]["code"] == "SOURCE_RECORD_NOT_FOUND"
