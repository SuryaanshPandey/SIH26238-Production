from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DocumentSource, DocumentStatus
from app.core.time import utc_now
from app.models.common import Integrity


class Document(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    document_id: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    application_id: str = Field(min_length=1)
    document_type: str = Field(min_length=1)
    document_name: str = ""
    status: DocumentStatus
    source: DocumentSource
    version: int = Field(ge=1)
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    issuer: str | None = None
    storage_ref: str | None = None
    original_filename: str | None = None
    mime_type: str | None = None
    file_size_bytes: int | None = Field(default=None, ge=0)
    integrity: Integrity | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
