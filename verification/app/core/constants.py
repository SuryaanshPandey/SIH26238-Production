from enum import Enum

CONTRACT_VERSION = "v1"


class DocumentStatus(str, Enum):
    REQUESTED = "REQUESTED"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    AVAILABLE = "AVAILABLE"
    VERIFIED = "VERIFIED"
    MISMATCH = "MISMATCH"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"
    REPLACED = "REPLACED"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"


class DocumentSource(str, Enum):
    USER_UPLOAD = "USER_UPLOAD"
    DIGITAL_SOURCE = "DIGITAL_SOURCE"
    INSTITUTION_SOURCE = "INSTITUTION_SOURCE"
    GOVERNMENT_SOURCE = "GOVERNMENT_SOURCE"
    MOCK_SOURCE = "MOCK_SOURCE"


class VerificationResult(str, Enum):
    MATCH = "MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    MISMATCH = "MISMATCH"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    PENDING_REVIEW = "PENDING_REVIEW"


class ReviewStatus(str, Enum):
    NOT_REQUIRED = "NOT_REQUIRED"
    PENDING = "PENDING"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"


class EvidenceType(str, Enum):
    DOCUMENT = "DOCUMENT"
    SOURCE_RECORD = "SOURCE_RECORD"
    API_RESPONSE = "API_RESPONSE"
    USER_SUBMISSION = "USER_SUBMISSION"
    INSTITUTION_RECORD = "INSTITUTION_RECORD"
    DATABASE_RECORD = "DATABASE_RECORD"
    SYSTEM_EVENT = "SYSTEM_EVENT"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class ExternalReferenceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    REVOKED = "REVOKED"


class ConsentStatus(str, Enum):
    REQUESTED = "REQUESTED"
    GRANTED = "GRANTED"
    DENIED = "DENIED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class ActorType(str, Enum):
    STUDENT = "STUDENT"
    INSTITUTE = "INSTITUTE"
    REVIEWER = "REVIEWER"
    MINISTRY = "MINISTRY"
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"


ERROR_CODES = {
    "INVALID_REQUEST": "Invalid request",
    "VALIDATION_ERROR": "Validation error",
    "DOCUMENT_NOT_FOUND": "Document not found",
    "DOCUMENT_CONFLICT": "Document conflict",
    "INVALID_DOCUMENT_TRANSITION": "Invalid document lifecycle transition",
    "VERIFICATION_NOT_FOUND": "Verification not found",
    "EVIDENCE_NOT_FOUND": "Evidence not found",
    "SOURCE_UNAVAILABLE": "Verification source unavailable",
    "SOURCE_AUTHORIZATION_REQUIRED": "Source authorization is required",
    "SOURCE_RECORD_NOT_FOUND": "Source record not found",
    "SOURCE_RESPONSE_INVALID": "Source response could not be normalized",
    "CONNECTOR_NOT_FOUND": "Source connector not found",
    "UNSUPPORTED_DOCUMENT_TYPE": "Unsupported document type",
    "INCOMPLETE_EVIDENCE": "Insufficient evidence",
    "CONSENT_REQUIRED": "Required consent is missing",
    "EXCEPTION_NOT_FOUND": "Verification exception not found",
    "INTERNAL_ERROR": "Internal server error",
    "INVESTIGATION_NOT_FOUND": "Verification investigation not found",
    "FIELD_NOT_FOUND": "Investigation field not found",
    "UNAUTHORIZED": "Unauthorized",
}
