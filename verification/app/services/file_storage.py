from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path


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
        if mime_type not in ALLOWED_MIME_TYPES:
            raise FileStorageError("Only PDF, JPG and PNG files are supported.")
        if not content:
            raise FileStorageError("The selected file is empty.")
        if len(content) > MAX_FILE_SIZE:
            raise FileStorageError("The selected file is larger than 5 MB.")
        extension = ALLOWED_MIME_TYPES[mime_type]
        folder = self.root / safe_filename(student_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{safe_filename(document_id)}{extension}"
        target.write_bytes(content)
        digest = hashlib.sha256(content).hexdigest()
        return f"local://documents/{safe_filename(student_id)}/{target.name}", len(content), digest

    @staticmethod
    def verify_hash(content: bytes, expected: str | None) -> None:
        if expected and hashlib.sha256(content).hexdigest().lower() != expected.lower():
            raise FileStorageError("Document integrity check failed. Please retry the upload.")


file_storage = LocalDocumentFileStorage()
