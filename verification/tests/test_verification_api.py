import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

ROOT = Path(__file__).parents[1]
client = TestClient(app)


def load_fixture(name):
    return json.loads((ROOT / "fixtures" / "verification" / name).read_text(encoding="utf-8"))


def test_run_verification_api():
    response = client.post("/verifications/run", json=load_fixture("verification_match.json"))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["overall_result"] == "MATCH"


def test_get_verification_and_evidence():
    payload = load_fixture("verification_match.json")
    run = client.post("/verifications/run", json=payload).json()["data"]
    verification_id = run["verification_ids"][0]

    verification = client.get(f"/verifications/{verification_id}")
    assert verification.status_code == 200
    evidence = client.get(f"/verifications/{verification_id}/evidence")
    assert evidence.status_code == 200
    assert len(evidence.json()["data"]) == 2


def test_missing_verification_is_contract_error():
    response = client.get("/verifications/ver_missing")
    assert response.status_code == 404
    body = response.json()
    assert body["detail"]["success"] is False
    assert body["detail"]["error"]["code"] == "VERIFICATION_NOT_FOUND"
