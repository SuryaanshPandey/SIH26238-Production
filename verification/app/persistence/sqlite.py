from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Iterable

from app.exceptions.models import VerificationException
from app.models.audit import AuditEvent
from app.models.consent import ConsentRecord
from app.models.document import Document
from app.models.evidence import Evidence
from app.models.verification import Verification
from app.repositories.document_repository import DocumentHistoryEntry, DocumentRepository
from app.verification.repository import EvidenceRepository, VerificationRepository
from app.exceptions.repository import ExceptionRepository


class SQLiteDatabase:
    """Small stdlib-only persistence adapter for local/demo deployments.

    The domain services still depend on repository interfaces. This class is
    deliberately an infrastructure adapter so production deployments can swap
    it for Postgres/Supabase without changing business logic.
    """

    def __init__(self, path: str | Path = "./data/sih26238.db") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    @contextmanager
    def connection(self):
        with self._lock:
            conn = sqlite3.connect(self.path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _initialize(self) -> None:
        with self.connection() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS documents (
                    document_id TEXT PRIMARY KEY,
                    student_id TEXT NOT NULL,
                    application_id TEXT NOT NULL,
                    document_type TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_documents_application
                    ON documents(application_id);
                CREATE INDEX IF NOT EXISTS idx_documents_version_key
                    ON documents(student_id, application_id, document_type, version);

                CREATE TABLE IF NOT EXISTS document_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    from_status TEXT,
                    to_status TEXT,
                    occurred_at TEXT NOT NULL,
                    version INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_document_history_document
                    ON document_history(document_id, id);

                CREATE TABLE IF NOT EXISTS verifications (
                    verification_id TEXT PRIMARY KEY,
                    application_id TEXT NOT NULL,
                    student_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_verifications_application
                    ON verifications(application_id, created_at);

                CREATE TABLE IF NOT EXISTS evidence (
                    evidence_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS verification_exceptions (
                    exception_id TEXT PRIMARY KEY,
                    application_id TEXT NOT NULL,
                    student_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    detected_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_exceptions_application
                    ON verification_exceptions(application_id, detected_at);

                CREATE TABLE IF NOT EXISTS audit_events (
                    audit_event_id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_audit_entity
                    ON audit_events(entity_type, entity_id, timestamp);

                CREATE TABLE IF NOT EXISTS consent_records (
                    consent_id TEXT PRIMARY KEY,
                    student_id TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_consent_student_purpose
                    ON consent_records(student_id, purpose, created_at);

                CREATE TABLE IF NOT EXISTS source_observations (
                    observation_id TEXT PRIMARY KEY,
                    source_system TEXT NOT NULL,
                    source_reference TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    application_id TEXT,
                    payload TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_source_observation_reference
                    ON source_observations(source_reference, retrieved_at);
                CREATE INDEX IF NOT EXISTS idx_source_observation_subject
                    ON source_observations(subject_id, source_system, retrieved_at);
                """
            )


class SQLiteDocumentRepository(DocumentRepository):
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def create(self, document: Document) -> Document:
        payload = json.dumps(document.model_dump(mode="json"), separators=(",", ":"))
        with self.db.connection() as conn:
            conn.execute(
                "INSERT INTO documents(document_id,student_id,application_id,document_type,version,status,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    document.document_id,
                    document.student_id,
                    document.application_id,
                    document.document_type,
                    document.version,
                    document.status,
                    payload,
                    document.created_at.isoformat(),
                    document.updated_at.isoformat(),
                ),
            )
            self._history(conn, document.document_id, "CREATED", None, document.status, document.created_at, document.version)
        return document.model_copy(deep=True)

    def get(self, document_id: str) -> Document | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM documents WHERE document_id=?", (document_id,)).fetchone()
        return Document.model_validate(json.loads(row["payload"])) if row else None

    def list_by_student(self, student_id: str) -> list[Document]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM documents WHERE student_id=? ORDER BY created_at, document_id", (student_id,)).fetchall()
        return [Document.model_validate(json.loads(row["payload"])) for row in rows]

    def list_by_application(self, application_id: str) -> list[Document]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM documents WHERE application_id=? ORDER BY document_type, version", (application_id,)).fetchall()
        return [Document.model_validate(json.loads(row["payload"])) for row in rows]

    def list_versions(self, student_id: str, application_id: str, document_type: str) -> list[Document]:
        with self.db.connection() as conn:
            rows = conn.execute(
                "SELECT payload FROM documents WHERE student_id=? AND application_id=? AND document_type=? ORDER BY version",
                (student_id, application_id, document_type),
            ).fetchall()
        return [Document.model_validate(json.loads(row["payload"])) for row in rows]

    def replace(self, old_document_id: str, new_document: Document, occurred_at: datetime) -> Document:
        with self.db.connection() as conn:
            old_row = conn.execute("SELECT payload FROM documents WHERE document_id=?", (old_document_id,)).fetchone()
            if not old_row:
                raise KeyError(old_document_id)
            old = Document.model_validate(json.loads(old_row["payload"]))
            replacement_old = old.model_copy(update={"status": "REPLACED", "updated_at": occurred_at})
            conn.execute("UPDATE documents SET status=?, updated_at=?, payload=? WHERE document_id=?", ("REPLACED", occurred_at.isoformat(), json.dumps(replacement_old.model_dump(mode="json")), old_document_id))
            self._history(conn, old_document_id, "REPLACED", old.status, "REPLACED", occurred_at, old.version)
            payload = json.dumps(new_document.model_dump(mode="json"), separators=(",", ":"))
            conn.execute(
                "INSERT INTO documents(document_id,student_id,application_id,document_type,version,status,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (new_document.document_id, new_document.student_id, new_document.application_id, new_document.document_type, new_document.version, new_document.status, payload, new_document.created_at.isoformat(), new_document.updated_at.isoformat()),
            )
            self._history(conn, new_document.document_id, "CREATED_AS_REPLACEMENT", None, new_document.status, new_document.created_at, new_document.version)
        return new_document.model_copy(deep=True)

    def update(self, document: Document, occurred_at: datetime, action: str, from_status: str | None) -> Document:
        with self.db.connection() as conn:
            if conn.execute("SELECT 1 FROM documents WHERE document_id=?", (document.document_id,)).fetchone() is None:
                raise KeyError(document.document_id)
            conn.execute("UPDATE documents SET status=?, updated_at=?, payload=? WHERE document_id=?", (document.status, document.updated_at.isoformat(), json.dumps(document.model_dump(mode="json")), document.document_id))
            self._history(conn, document.document_id, action, from_status, document.status, occurred_at, document.version)
        return document.model_copy(deep=True)

    def history(self, document_id: str) -> list[DocumentHistoryEntry]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT document_id,action,from_status,to_status,occurred_at,version FROM document_history WHERE document_id=? ORDER BY id", (document_id,)).fetchall()
        return [DocumentHistoryEntry(document_id=r["document_id"], action=r["action"], from_status=r["from_status"], to_status=r["to_status"], occurred_at=datetime.fromisoformat(r["occurred_at"]), version=r["version"]) for r in rows]

    @staticmethod
    def _history(conn, document_id, action, from_status, to_status, occurred_at, version):
        conn.execute("INSERT INTO document_history(document_id,action,from_status,to_status,occurred_at,version) VALUES (?,?,?,?,?,?)", (document_id, action, from_status, to_status, occurred_at.isoformat(), version))


class SQLiteVerificationRepository(VerificationRepository):
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save_verification(self, verification: Verification) -> Verification:
        with self.db.connection() as conn:
            conn.execute(
                "INSERT INTO verifications(verification_id,application_id,student_id,payload,created_at) VALUES (?,?,?,?,?)",
                (verification.verification_id, verification.application_id, verification.student_id, json.dumps(verification.model_dump(mode="json")), verification.created_at.isoformat()),
            )
        return verification.model_copy(deep=True)

    def get_verification(self, verification_id: str) -> Verification | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM verifications WHERE verification_id=?", (verification_id,)).fetchone()
        return Verification.model_validate(json.loads(row["payload"])) if row else None

    def list_for_application(self, application_id: str) -> list[Verification]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM verifications WHERE application_id=? ORDER BY created_at, verification_id", (application_id,)).fetchall()
        return [Verification.model_validate(json.loads(row["payload"])) for row in rows]


class SQLiteEvidenceRepository(EvidenceRepository):
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save_evidence(self, evidence: Evidence) -> Evidence:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO evidence(evidence_id,payload,created_at) VALUES (?,?,?)", (evidence.evidence_id, json.dumps(evidence.model_dump(mode="json")), evidence.retrieved_at.isoformat()))
        return evidence.model_copy(deep=True)

    def get_evidence(self, evidence_id: str) -> Evidence | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM evidence WHERE evidence_id=?", (evidence_id,)).fetchone()
        return Evidence.model_validate(json.loads(row["payload"])) if row else None

    def list_for_ids(self, evidence_ids: list[str]) -> list[Evidence]:
        if not evidence_ids:
            return []
        placeholders = ",".join("?" for _ in evidence_ids)
        with self.db.connection() as conn:
            rows = conn.execute(f"SELECT payload FROM evidence WHERE evidence_id IN ({placeholders})", tuple(evidence_ids)).fetchall()
        by_id = {Evidence.model_validate(json.loads(row["payload"])).evidence_id: Evidence.model_validate(json.loads(row["payload"])) for row in rows}
        return [by_id[eid] for eid in evidence_ids if eid in by_id]


class SQLiteExceptionRepository(ExceptionRepository):
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save(self, exception: VerificationException) -> VerificationException:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO verification_exceptions(exception_id,application_id,student_id,payload,detected_at) VALUES (?,?,?,?,?)", (exception.exception_id, exception.application_id, exception.student_id, json.dumps(exception.model_dump(mode="json")), exception.detected_at.isoformat()))
        return exception.model_copy(deep=True)

    def get(self, exception_id: str) -> VerificationException | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM verification_exceptions WHERE exception_id=?", (exception_id,)).fetchone()
        return VerificationException.model_validate(json.loads(row["payload"])) if row else None

    def list_for_application(self, application_id: str) -> list[VerificationException]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM verification_exceptions WHERE application_id=? ORDER BY detected_at, exception_id", (application_id,)).fetchall()
        return [VerificationException.model_validate(json.loads(row["payload"])) for row in rows]


class AuditRepository:
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save(self, event: AuditEvent) -> AuditEvent:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO audit_events(audit_event_id,entity_type,entity_id,timestamp,payload) VALUES (?,?,?,?,?)", (event.audit_event_id, event.entity_type, event.entity_id, event.timestamp.isoformat(), json.dumps(event.model_dump(mode="json"))))
        return event.model_copy(deep=True)

    def list_for_entity(self, entity_type: str, entity_id: str) -> list[AuditEvent]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM audit_events WHERE entity_type=? AND entity_id=? ORDER BY timestamp", (entity_type, entity_id)).fetchall()
        return [AuditEvent.model_validate(json.loads(row["payload"])) for row in rows]


class ConsentRepository:
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save(self, record: ConsentRecord) -> ConsentRecord:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO consent_records(consent_id,student_id,purpose,status,created_at,payload) VALUES (?,?,?,?,?,?)", (record.consent_id, record.student_id, record.purpose, record.status, record.created_at.isoformat(), json.dumps(record.model_dump(mode="json"))))
        return record.model_copy(deep=True)

    def update(self, record: ConsentRecord) -> ConsentRecord:
        with self.db.connection() as conn:
            if conn.execute("SELECT 1 FROM consent_records WHERE consent_id=?", (record.consent_id,)).fetchone() is None:
                raise KeyError(record.consent_id)
            conn.execute("UPDATE consent_records SET student_id=?, purpose=?, status=?, created_at=?, payload=? WHERE consent_id=?", (record.student_id, record.purpose, record.status, record.created_at.isoformat(), json.dumps(record.model_dump(mode="json")), record.consent_id))
        return record.model_copy(deep=True)

    def get(self, consent_id: str) -> ConsentRecord | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM consent_records WHERE consent_id=?", (consent_id,)).fetchone()
        return ConsentRecord.model_validate(json.loads(row["payload"])) if row else None

    def latest_granted(self, student_id: str, purpose: str) -> ConsentRecord | None:
        with self.db.connection() as conn:
            row = conn.execute("SELECT payload FROM consent_records WHERE student_id=? AND purpose=? AND status='GRANTED' ORDER BY created_at DESC LIMIT 1", (student_id, purpose)).fetchone()
        return ConsentRecord.model_validate(json.loads(row["payload"])) if row else None


class SourceObservationRepository:
    def __init__(self, db: SQLiteDatabase):
        self.db = db

    def save(self, *, observation_id: str, source_record: dict, application_id: str | None = None) -> None:
        with self.db.connection() as conn:
            conn.execute(
                "INSERT INTO source_observations(observation_id,source_system,source_reference,subject_id,application_id,payload,retrieved_at) VALUES (?,?,?,?,?,?,?)",
                (observation_id, str(source_record["source_system"]), source_record["source_reference"], source_record["subject_id"], application_id, json.dumps(source_record), source_record["retrieved_at"]),
            )

    def list_for_reference(self, source_reference: str) -> list[dict]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT payload FROM source_observations WHERE source_reference=? ORDER BY retrieved_at", (source_reference,)).fetchall()
        return [json.loads(row["payload"]) for row in rows]
