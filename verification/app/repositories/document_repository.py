from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from threading import RLock

from app.models.document import Document


@dataclass(frozen=True)
class DocumentHistoryEntry:
    document_id: str
    action: str
    from_status: str | None
    to_status: str | None
    occurred_at: datetime
    version: int


class DocumentRepository(ABC):
    """Storage boundary for the document service.

    The service depends on this interface, not on a concrete database.
    This keeps the module independently testable and makes a later
    Postgres/Supabase implementation a replaceable adapter.
    """

    @abstractmethod
    def create(self, document: Document) -> Document:
        raise NotImplementedError

    @abstractmethod
    def get(self, document_id: str) -> Document | None:
        raise NotImplementedError

    @abstractmethod
    def list_by_student(self, student_id: str) -> list[Document]:
        raise NotImplementedError

    @abstractmethod
    def list_by_application(self, application_id: str) -> list[Document]:
        raise NotImplementedError

    @abstractmethod
    def list_versions(self, student_id: str, application_id: str, document_type: str) -> list[Document]:
        raise NotImplementedError

    @abstractmethod
    def replace(self, old_document_id: str, new_document: Document, occurred_at: datetime) -> Document:
        raise NotImplementedError

    @abstractmethod
    def update(self, document: Document, occurred_at: datetime, action: str, from_status: str | None) -> Document:
        raise NotImplementedError

    @abstractmethod
    def history(self, document_id: str) -> list[DocumentHistoryEntry]:
        raise NotImplementedError


class InMemoryDocumentRepository(DocumentRepository):
    """Deterministic in-memory repository for local development and tests."""

    def __init__(self) -> None:
        self._documents: dict[str, Document] = {}
        self._histories: dict[str, list[DocumentHistoryEntry]] = {}
        self._lock = RLock()

    def create(self, document: Document) -> Document:
        with self._lock:
            if document.document_id in self._documents:
                raise ValueError("document_id already exists")
            self._documents[document.document_id] = document.model_copy(deep=True)
            self._histories.setdefault(document.document_id, []).append(
                DocumentHistoryEntry(
                    document_id=document.document_id,
                    action="CREATED",
                    from_status=None,
                    to_status=document.status,
                    occurred_at=document.created_at,
                    version=document.version,
                )
            )
            return document.model_copy(deep=True)

    def get(self, document_id: str) -> Document | None:
        with self._lock:
            document = self._documents.get(document_id)
            return document.model_copy(deep=True) if document else None

    def list_by_student(self, student_id: str) -> list[Document]:
        with self._lock:
            docs = [d for d in self._documents.values() if d.student_id == student_id]
            return sorted(
                (d.model_copy(deep=True) for d in docs),
                key=lambda d: (d.application_id, d.document_type, d.version),
            )

    def list_by_application(self, application_id: str) -> list[Document]:
        with self._lock:
            docs = [d for d in self._documents.values() if d.application_id == application_id]
            return sorted((d.model_copy(deep=True) for d in docs), key=lambda d: (d.document_type, d.version))

    def list_versions(self, student_id: str, application_id: str, document_type: str) -> list[Document]:
        with self._lock:
            docs = [
                d
                for d in self._documents.values()
                if d.student_id == student_id
                and d.application_id == application_id
                and d.document_type == document_type
            ]
            return sorted((d.model_copy(deep=True) for d in docs), key=lambda d: d.version)

    def replace(self, old_document_id: str, new_document: Document, occurred_at: datetime) -> Document:
        with self._lock:
            old = self._documents.get(old_document_id)
            if old is None:
                raise KeyError(old_document_id)
            if new_document.document_id in self._documents:
                raise ValueError("new document_id already exists")

            replacement_old = old.model_copy(update={"status": "REPLACED", "updated_at": occurred_at})
            self._documents[old_document_id] = replacement_old
            self._histories[old_document_id].append(
                DocumentHistoryEntry(
                    document_id=old_document_id,
                    action="REPLACED",
                    from_status=old.status,
                    to_status="REPLACED",
                    occurred_at=occurred_at,
                    version=old.version,
                )
            )
            self._documents[new_document.document_id] = new_document.model_copy(deep=True)
            self._histories.setdefault(new_document.document_id, []).append(
                DocumentHistoryEntry(
                    document_id=new_document.document_id,
                    action="CREATED_AS_REPLACEMENT",
                    from_status=None,
                    to_status=new_document.status,
                    occurred_at=new_document.created_at,
                    version=new_document.version,
                )
            )
            return new_document.model_copy(deep=True)

    def update(self, document: Document, occurred_at: datetime, action: str, from_status: str | None) -> Document:
        with self._lock:
            if document.document_id not in self._documents:
                raise KeyError(document.document_id)
            self._documents[document.document_id] = document.model_copy(deep=True)
            self._histories.setdefault(document.document_id, []).append(
                DocumentHistoryEntry(
                    document_id=document.document_id,
                    action=action,
                    from_status=from_status,
                    to_status=document.status,
                    occurred_at=occurred_at,
                    version=document.version,
                )
            )
            return document.model_copy(deep=True)

    def history(self, document_id: str) -> list[DocumentHistoryEntry]:
        with self._lock:
            return list(self._histories.get(document_id, []))

    def clear(self) -> None:
        with self._lock:
            self._documents.clear()
            self._histories.clear()
