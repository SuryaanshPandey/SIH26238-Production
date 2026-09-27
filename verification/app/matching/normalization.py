from __future__ import annotations

from datetime import date, datetime
import re
import unicodedata
from typing import Any


_DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip().casefold()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_name(value: Any) -> str:
    text = normalize_text(value)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def compact_name(value: Any) -> str:
    return re.sub(r"[^\w]", "", normalize_name(value), flags=re.UNICODE)


def normalize_phone(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) > 10 and digits.endswith(digits[-10:]):
        return digits[-10:]
    return digits


def normalize_email(value: Any) -> str:
    return normalize_text(value).replace(" ", "")


def normalize_date(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    raw = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return normalize_text(raw)


def normalize_identifier(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", normalize_text(value))


def normalize_category(value: Any) -> str:
    return normalize_text(value).replace(" ", "_")


def normalize_attribute(field: str, value: Any) -> str:
    field = normalize_text(field)
    if value is None:
        return ""
    if field in {"full_name", "name", "student_name"}:
        return normalize_name(value)
    if field in {"mobile", "mobile_number", "phone", "phone_number"}:
        return normalize_phone(value)
    if field in {"email", "email_address"}:
        return normalize_email(value)
    if field in {"date_of_birth", "dob"}:
        return normalize_date(value)
    if field in {"category", "caste_category"}:
        return normalize_category(value)
    if field.endswith("_id") or field in {"identifier", "student_id"}:
        return normalize_identifier(value)
    return normalize_text(value)


def normalize_attributes(attributes: dict[str, Any]) -> dict[str, str]:
    return {key: normalize_attribute(key, value) for key, value in attributes.items()}
