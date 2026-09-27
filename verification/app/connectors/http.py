from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.connectors.base import (
    SourceConnector,
    SourceNotFoundError,
    SourceQuery,
    SourceRecord,
    SourceRecordStatus,
    SourceResponseError,
    SourceSystem,
    SourceUnavailableError,
)


class HttpSourceConnector(SourceConnector):
    """Configurable production adapter for an officially authorized source API.

    The external API may have its own schema; this adapter expects the configured
    endpoint to return the normalized source-record envelope documented below.
    That keeps government-specific credentials and payload details outside the
    verification engine and avoids falling back to fabricated records.
    """

    def __init__(self, *, system: SourceSystem, display_name: str, supported: set[str]) -> None:
        self.system = system
        self.display_name = display_name
        self.government_managed = system != SourceSystem.INSTITUTION
        self._supported = set(supported)
        env_prefix = f"SIH_SOURCE_{system.value}"
        self.base_url = os.getenv(f"{env_prefix}_BASE_URL", "").strip()
        self.api_key = os.getenv(f"{env_prefix}_API_KEY", "").strip()
        self.timeout_seconds = float(os.getenv(f"{env_prefix}_TIMEOUT_SECONDS", "15"))
        self.live_integration = bool(self.base_url)

    def supported_attributes(self) -> set[str]:
        return set(self._supported)

    def health_check(self) -> dict[str, Any]:
        base = super().health_check()
        base["status"] = "CONFIGURED" if self.base_url else "NOT_CONFIGURED"
        base["endpoint_configured"] = bool(self.base_url)
        return base

    def _url(self) -> str:
        if not self.base_url:
            raise SourceUnavailableError(
                f"{self.display_name} is not configured. Official provider credentials and endpoint are required."
            )
        return self.base_url.rstrip("/")

    def fetch_record(self, query: SourceQuery) -> SourceRecord:
        query.validate()
        if query.attributes:
            unsupported = sorted(set(query.attributes) - self._supported)
            if unsupported:
                raise SourceResponseError(
                    f"Unsupported attributes for {self.system.value}: {', '.join(unsupported)}"
                )

        payload = {
            "student_id": query.student_id,
            "external_id": query.external_id,
            "attributes": list(query.attributes),
            "document_type": query.document_type,
            "institution_id": query.institution_id,
            "state": query.state,
            "purpose": query.authorization.purpose,
            "consent_id": query.authorization.consent_id,
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SIH26238-Official-Source-Connector/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key

        request = Request(self._url(), data=body, headers=headers, method="POST")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw_body = response.read().decode("utf-8")
        except HTTPError as exc:
            if exc.code == 404:
                raise SourceNotFoundError(f"No matching record found in {self.system.value}") from exc
            if exc.code in (401, 403):
                raise SourceUnavailableError(
                    f"{self.display_name} rejected the configured authorization (HTTP {exc.code})."
                ) from exc
            raise SourceUnavailableError(
                f"{self.display_name} returned HTTP {exc.code}."
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise SourceUnavailableError(f"Unable to reach {self.display_name}: {exc}") from exc

        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise SourceResponseError(f"{self.display_name} returned non-JSON data.") from exc

        if data.get("status") == "NOT_FOUND":
            raise SourceNotFoundError(f"No matching record found in {self.system.value}")
        if data.get("status") == "UNAVAILABLE":
            raise SourceUnavailableError(data.get("message") or f"{self.display_name} is unavailable")
        if data.get("success") is False:
            raise SourceResponseError(data.get("message") or f"{self.display_name} returned an error")

        record = data.get("data", data)
        attrs = record.get("attributes")
        if not isinstance(attrs, dict):
            raise SourceResponseError(
                f"{self.display_name} did not return normalized source attributes."
            )
        subject_id = str(record.get("subject_id") or query.external_id or query.student_id)
        source_reference = str(record.get("source_reference") or f"{self.system.value.lower()}:{subject_id}")
        retrieved_at = datetime.fromisoformat(record["retrieved_at"].replace("Z", "+00:00")) if record.get("retrieved_at") else None
        source_payload = {
            "source_system": self.system.value,
            "source_reference": source_reference,
            "subject_id": subject_id,
            "attributes": attrs,
            "document_type": record.get("document_type") or query.document_type,
            "institution_id": record.get("institution_id") or query.institution_id,
        }
        response_hash = hashlib.sha256(
            json.dumps(source_payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        ).hexdigest()
        return SourceRecord(
            source_system=self.system,
            source_reference=source_reference,
            status=SourceRecordStatus.FOUND,
            subject_id=subject_id,
            attributes=attrs,
            retrieved_at=retrieved_at or datetime.now().astimezone(),
            response_hash=record.get("response_hash") or response_hash,
            document_type=record.get("document_type") or query.document_type,
            institution_id=record.get("institution_id") or query.institution_id,
            metadata={
                "adapter_mode": "HTTP",
                "display_name": self.display_name,
                "source_url": self.base_url,
            },
        )
