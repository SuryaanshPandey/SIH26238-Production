from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import CONTRACT_VERSION
from app.core.time import utc_now

T = TypeVar("T")


class APIError(BaseModel):
    code: str
    message: str


class ResponseMeta(BaseModel):
    contract_version: str = CONTRACT_VERSION
    request_id: str
    timestamp: datetime = Field(default_factory=utc_now)


class APIResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    success: bool
    data: T | None
    error: APIError | None
    meta: ResponseMeta


class Integrity(BaseModel):
    hash: str


class SourceRef(BaseModel):
    source_reference: str = Field(min_length=1)
    system: str = Field(min_length=1)
