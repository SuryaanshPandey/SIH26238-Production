from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_uses_common_envelope():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    assert body["meta"]["contract_version"] == "v1"
    assert body["meta"]["request_id"].startswith("req_")
    assert body["meta"]["timestamp"].endswith("Z")


def test_contract_endpoint_exposes_owned_entities_and_errors():
    response = client.get("/contracts")
    body = response.json()
    assert response.status_code == 200
    assert "Document" in body["data"]["owned_entities"]
    assert "Verification" in body["data"]["owned_entities"]
    assert "Evidence" in body["data"]["owned_entities"]
    assert "VERIFICATION_NOT_FOUND" in body["data"]["error_codes"]
    assert body["data"]["error_codes"]["VALIDATION_ERROR"] == "Validation error"
