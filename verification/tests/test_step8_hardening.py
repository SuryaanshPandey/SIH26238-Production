from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.persistence.sqlite import (
    AuditRepository,
    ConsentRepository,
    SQLiteDatabase,
    SQLiteDocumentRepository,
)
from app.services.document_service import DocumentService
from app.core.constants import DocumentSource, DocumentStatus


def test_sqlite_document_repository_round_trip_and_history(tmp_path: Path):
    db = SQLiteDatabase(tmp_path / "test.db")
    repo = SQLiteDocumentRepository(db)
    service = DocumentService(repo)
    doc = service.create_document(
        student_id="stu_8",
        application_id="app_8",
        document_type="ST_CERTIFICATE",
        source=DocumentSource.USER_UPLOAD,
        status=DocumentStatus.UPLOADED,
        storage_ref="secure://doc/8",
    )
    service.transition_status(doc.document_id, DocumentStatus.PROCESSING)
    loaded = repo.get(doc.document_id)
    assert loaded is not None
    assert loaded.status == DocumentStatus.PROCESSING
    history = repo.history(doc.document_id)
    assert [item.action for item in history] == ["CREATED", "STATUS_CHANGED"]


def test_sqlite_round_trip_for_audit_and_consent(tmp_path: Path):
    db = SQLiteDatabase(tmp_path / "audit.db")
    audit = AuditRepository(db)
    consent = ConsentRepository(db)
    from app.audit.service import AuditService
    from app.consent.service import ConsentService
    from app.core.constants import ActorType

    audit_service = AuditService(audit)
    event = audit_service.record(
        actor_type=ActorType.SYSTEM,
        actor_id="test",
        action="POST /documents",
        entity_type="HTTP_ROUTE",
        entity_id="/documents",
        correlation_id="req_test",
    )
    assert audit.list_for_entity("HTTP_ROUTE", "/documents")[0].audit_event_id == event.audit_event_id

    consent_service = ConsentService(consent)
    record = consent_service.grant(student_id="stu_8", purpose="DOCUMENT_VERIFICATION")
    assert consent_service.get(record.consent_id).status == "GRANTED"
    revoked = consent_service.revoke(record.consent_id)
    assert revoked.status == "REVOKED"
    assert consent_service.get(record.consent_id).status == "REVOKED"


def test_api_creates_consent_and_logs_mutation():
    client = TestClient(app)
    created = client.post("/consents", json={"student_id": "stu_api8", "purpose": "DOCUMENT_VERIFICATION"})
    assert created.status_code == 201
    consent_id = created.json()["data"]["consent_id"]
    assert client.get(f"/consents/{consent_id}").status_code == 200
    audits = client.get("/audits/HTTP_ROUTE", params={"entity_id": "/consents"}).json()
    assert audits["success"] is True



def test_cors_preflight_allows_student_auth_header():
    client = TestClient(app)
    response = client.options(
        "/students/stu_api8/documents",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_cors_preflight_bypasses_optional_api_key_gate(monkeypatch):
    client = TestClient(app)
    monkeypatch.setenv("SIH_API_KEY", "local-secret")
    response = client.options(
        "/students/stu_api8/documents",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    monkeypatch.delenv("SIH_API_KEY")

def test_optional_api_key_boundary(monkeypatch):
    client = TestClient(app)
    monkeypatch.setenv("SIH_API_KEY", "local-secret")
    assert client.get("/contracts").status_code == 401
    assert client.get("/contracts", headers={"X-SIH-API-Key": "local-secret"}).status_code == 200
    monkeypatch.delenv("SIH_API_KEY")


def test_source_observation_is_persisted_in_repository():
    client = TestClient(app)
    response = client.post("/source-records/query", json={
        "system": "DIGILOCKER",
        "student_id": "stu_001",
        "attributes": ["full_name"],
        "authorized": True,
        "purpose": "DOCUMENT_VERIFICATION",
        "application_id": "app_obs8",
    })
    assert response.status_code == 200
    reference = response.json()["data"]["source_reference"]
    observations = client.get(f"/source-observations/{reference}")
    assert observations.status_code == 200
    assert observations.json()["data"][0]["source_reference"] == reference


def test_sqlite_runtime_starts_with_persistent_schema(tmp_path, monkeypatch):
    import subprocess, sys
    script = """
from app.runtime import Runtime
r=Runtime()
print(r.backend)
"""
    env = dict(__import__('os').environ)
    env["SIH_STORAGE_BACKEND"] = "sqlite"
    env["SIH_STORAGE_PATH"] = str(tmp_path / "runtime.db")
    output = subprocess.check_output([sys.executable, "-c", script], cwd=str(Path(__file__).parents[1]), env=env, text=True)
    assert output.strip() == "sqlite"
    assert (tmp_path / "runtime.db").exists()
