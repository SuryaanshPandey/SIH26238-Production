from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def source(ref, system="DIGILOCKER", attrs=None):
    return {
        "source_system": system,
        "source_reference": ref,
        "status": "FOUND",
        "subject_id": "stu_001",
        "attributes": attrs or {},
        "retrieved_at": "2026-09-23T10:30:00Z",
        "response_hash": "hash",
        "document_type": None,
        "institution_id": None,
        "metadata": {"adapter_mode": "MOCK"},
    }


def test_identity_match_api_returns_normalized_result():
    response = client.post(
        "/identity-matches",
        json={
            "student_id": "stu_001",
            "submitted_attributes": {
                "full_name": "Asha Kumar",
                "date_of_birth": "14/08/2005",
                "category": "ST",
            },
            "source_records": [
                source(
                    "digilocker:001",
                    attrs={
                        "full_name": "ASHA KUMAR",
                        "date_of_birth": "2005-08-14",
                        "category": "ST",
                    },
                )
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"][0]["decision"] == "MATCH"
    assert body["data"][0]["confidence"] >= 0.9


def test_duplicate_api():
    response = client.post(
        "/identity-matches/duplicates",
        json={
            "source_records": [
                source("a", attrs={"full_name": "Asha Kumar", "date_of_birth": "2005-08-14"}),
                source("b", system="APAAR", attrs={"full_name": "Asha Kumar", "date_of_birth": "14/08/2005"}),
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]
