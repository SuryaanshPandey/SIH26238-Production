from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from urllib.parse import quote

import httpx


ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
MAX_FILE_SIZE = 5 * 1024 * 1024


class FileStorageError(Exception):
    pass


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name or "document").name).strip("._")
    return cleaned[:120] or "document"


class LocalDocumentFileStorage:
    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root or os.getenv("SIH_DOCUMENT_STORAGE_PATH", "./data/documents"))
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, *, student_id: str, document_id: str, filename: str, mime_type: str, content: bytes) -> tuple[str, int, str]:
        _validate_upload(mime_type, content)
        extension = ALLOWED_MIME_TYPES[mime_type]
        folder = self.root / safe_filename(student_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{safe_filename(document_id)}{extension}"
        target.write_bytes(content)
        digest = hashlib.sha256(content).hexdigest()
        return f"local://documents/{safe_filename(student_id)}/{target.name}", len(content), digest

    @staticmethod
    def verify_hash(content: bytes, expected: str | None) -> None:
        _verify_hash(content, expected)


class SupabaseDocumentFileStorage:
    """Server-side Supabase Storage adapter.

    Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
    SUPABASE_STORAGE_BUCKET. The service-role key must never be exposed to
    the student web app or Android APK.
    """

    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "sih26238-documents")
        if not self.base_url or not self.service_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when SIH_DOCUMENT_STORAGE_BACKEND=supabase"
            )

    def save(self, *, student_id: str, document_id: str, filename: str, mime_type: str, content: bytes) -> tuple[str, int, str]:
        _validate_upload(mime_type, content)
        extension = ALLOWED_MIME_TYPES[mime_type]
        path = f"{safe_filename(student_id)}/{safe_filename(document_id)}{extension}"
        url = f"{self.base_url}/storage/v1/object/{quote(self.bucket, safe='')}/{quote(path, safe='/')}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
            "Content-Type": mime_type,
            "x-upsert": "false",
        }
        try:
            response = httpx.put(url, content=content, headers=headers, timeout=20.0)
        except httpx.HTTPError as exc:
            raise FileStorageError(f"Document storage unavailable: {exc}") from exc
        if response.status_code >= 400:
            try:
                detail = response.json()
            except ValueError:
                detail = response.text[:300]
            raise FileStorageError(f"Document storage upload failed ({response.status_code}): {detail}")
        digest = hashlib.sha256(content).hexdigest()
        return f"supabase://{self.bucket}/{path}", len(content), digest

    @staticmethod
    def verify_hash(content: bytes, expected: str | None) -> None:
        _verify_hash(content, expected)


def _validate_upload(mime_type: str, content: bytes) -> None:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise FileStorageError("Only PDF, JPG and PNG files are supported.")
    if not content:
        raise FileStorageError("The selected file is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise FileStorageError("The selected file is larger than 5 MB.")


def _verify_hash(content: bytes, expected: str | None) -> None:
    if expected and hashlib.sha256(content).hexdigest().lower() != expected.lower():
        raise FileStorageError("Document integrity check failed. Please retry the upload.")


def _build_storage():
    backend = os.getenv("SIH_DOCUMENT_STORAGE_BACKEND", "local").strip().lower()
    if backend == "supabase":
        return SupabaseDocumentFileStorage()
    return LocalDocumentFileStorage()


file_storage = _build_storage()
