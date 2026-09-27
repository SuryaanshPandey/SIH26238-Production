from fastapi.testclient import TestClient

from app.api.routes import repository
from app.main import app

client = TestClient(app)


def setup_function():
    repository.clear()


def test_document_crud_and_application_linking():
    response = client.post(
        "/documents",
        json={
            "student_id": "stu_001",
            "application_id": "app_001",
            "document_type": "INCOME_CERTIFICATE",
            "source": "USER_UPLOAD",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    document_id = body["data"]["document_id"]

    fetched = client.get(f"/documents/{document_id}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["version"] == 1

    linked = client.get("/applications/app_001/documents")
    assert linked.status_code == 200
    assert len(linked.json()["data"]) == 1


def test_status_update_rejects_invalid_transition():
    create = client.post(
        "/documents",
        json={
            "student_id": "stu_002",
            "application_id": "app_002",
            "document_type": "ST_CERTIFICATE",
            "source": "DIGITAL_SOURCE",
        },
    )
    document_id = create.json()["data"]["document_id"]

    invalid = client.patch(
        f"/documents/{document_id}/status",
        json={"status": "VERIFIED"},
    )
    assert invalid.status_code == 409
    assert invalid.json()["detail"]["success"] is False
    assert invalid.json()["detail"]["error"]["code"] == "INVALID_DOCUMENT_TRANSITION"


def test_replace_creates_next_version_and_history():
    create = client.post(
        "/documents",
        json={
            "student_id": "stu_003",
            "application_id": "app_003",
            "document_type": "INCOME_CERTIFICATE",
            "source": "USER_UPLOAD",
        },
    )
    document_id = create.json()["data"]["document_id"]

    replacement = client.post(
        f"/documents/{document_id}/replace",
        json={
            "source": "DIGITAL_SOURCE",
            "storage_ref": "secure://document/v2",
        },
    )
    assert replacement.status_code == 201
    new_id = replacement.json()["data"]["document_id"]
    assert replacement.json()["data"]["version"] == 2

    versions = client.get(f"/documents/{new_id}/versions")
    assert versions.status_code == 200
    assert [x["version"] for x in versions.json()["data"]] == [1, 2]
    assert [x["status"] for x in versions.json()["data"]] == ["REPLACED", "UPLOADED"]

    history = client.get(f"/documents/{document_id}/history")
    assert history.status_code == 200
    assert history.json()["data"][-1]["to_status"] == "REPLACED"


def test_multipart_document_upload_persists_real_file_and_metadata(tmp_path, monkeypatch):
    monkeypatch.setenv("SIH_DOCUMENT_STORAGE_PATH", str(tmp_path / "documents"))
    from app.services.file_storage import LocalDocumentFileStorage
    import app.api.routes as routes_module
    routes_module.file_storage = LocalDocumentFileStorage(tmp_path / "documents")

    response = client.post(
        "/documents/upload",
        data={
            "student_id": "stu_upload",
            "application_id": "app_upload",
            "document_type": "MARKSHEET",
            "document_name": "Semester 2 Marksheet",
            "issuer": "College Registrar",
            "issued_at": "2026-09-27T00:00:00Z",
        },
        files={"file": ("marksheet.pdf", b"%PDF-1.4 SIH26238", "application/pdf")},
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["document_name"] == "Semester 2 Marksheet"
    assert data["original_filename"] == "marksheet.pdf"
    assert data["file_size_bytes"] > 0
    assert data["integrity"]["hash"]
    assert data["storage_ref"].startswith("local://documents/")

    listed = client.get("/students/stu_upload/documents")
    assert listed.status_code == 200
    assert listed.json()["data"][0]["document_name"] == "Semester 2 Marksheet"
