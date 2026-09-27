from __future__ import annotations

from abc import ABC, abstractmethod
from threading import RLock

from app.exceptions.models import VerificationException


class ExceptionRepository(ABC):
    @abstractmethod
    def save(self, exception: VerificationException) -> VerificationException: ...

    @abstractmethod
    def get(self, exception_id: str) -> VerificationException | None: ...

    @abstractmethod
    def list_for_application(self, application_id: str) -> list[VerificationException]: ...


class InMemoryExceptionRepository(ExceptionRepository):
    """Independent local repository; replaceable by Postgres/Supabase later."""

    def __init__(self) -> None:
        self._items: dict[str, VerificationException] = {}
        self._by_application: dict[str, list[str]] = {}
        self._lock = RLock()

    def save(self, exception: VerificationException) -> VerificationException:
        with self._lock:
            if exception.exception_id in self._items:
                raise ValueError("exception_id already exists")
            self._items[exception.exception_id] = exception.model_copy(deep=True)
            self._by_application.setdefault(exception.application_id, []).append(exception.exception_id)
            return exception.model_copy(deep=True)

    def get(self, exception_id: str) -> VerificationException | None:
        with self._lock:
            item = self._items.get(exception_id)
            return item.model_copy(deep=True) if item else None

    def list_for_application(self, application_id: str) -> list[VerificationException]:
        with self._lock:
            ids = self._by_application.get(application_id, [])
            return [self._items[eid].model_copy(deep=True) for eid in ids]

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
            self._by_application.clear()
