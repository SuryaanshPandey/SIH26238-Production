from app.connectors import (
    ConnectorAuthorization,
    ConnectorRegistry,
    SourceQuery,
    SourceSystem,
    SourceAuthorizationError,
    SourceNotFoundError,
    SourceResponseError,
    SourceUnavailableError,
    build_default_registry,
)
from app.connectors.mock import MockDigiLockerConnector
from app.services.source_service import SourceService


AUTH = ConnectorAuthorization(authorized=True, purpose="DOCUMENT_VERIFICATION", consent_id="cons_001")


def test_default_registry_contains_all_required_step3_sources():
    registry = build_default_registry()
    systems = {connector.system for connector in registry.list()}
    assert systems == {
        SourceSystem.DIGILOCKER,
        SourceSystem.UDISE_PLUS,
        SourceSystem.APAAR,
        SourceSystem.AISHE,
        SourceSystem.UIDAI,
        SourceSystem.STATE_EDISTRICT,
        SourceSystem.UGC_NTA,
        SourceSystem.INSTITUTION,
    }


def test_same_query_contract_works_for_digilocker():
    connector = MockDigiLockerConnector()
    record = connector.fetch_record(
        SourceQuery(student_id="stu_001", attributes=("full_name", "category"), authorization=AUTH)
    )
    assert record.source_system == SourceSystem.DIGILOCKER
    assert record.status.value == "FOUND"
    assert record.attributes == {"full_name": "Asha Kumar", "category": "ST"}
    assert record.response_hash


def test_connector_requires_authorization():
    connector = MockDigiLockerConnector()
    try:
        connector.fetch_record(SourceQuery(student_id="stu_001", authorization=ConnectorAuthorization(False, "DOCUMENT_ACCESS")))
    except SourceAuthorizationError as exc:
        assert "authorization" in str(exc).lower()
    else:
        raise AssertionError("Expected SourceAuthorizationError")


def test_connector_requires_purpose():
    connector = MockDigiLockerConnector()
    try:
        connector.fetch_record(SourceQuery(student_id="stu_001", authorization=ConnectorAuthorization(True, "")))
    except SourceAuthorizationError as exc:
        assert "purpose" in str(exc).lower()
    else:
        raise AssertionError("Expected SourceAuthorizationError")


def test_missing_record_is_not_found_not_source_unavailable():
    connector = MockDigiLockerConnector()
    try:
        connector.fetch_record(SourceQuery(student_id="unknown", authorization=AUTH))
    except SourceNotFoundError:
        pass
    else:
        raise AssertionError("Expected SourceNotFoundError")


def test_unavailable_source_is_distinct_error():
    connector = MockDigiLockerConnector(unavailable=True)
    try:
        connector.fetch_record(SourceQuery(student_id="stu_001", authorization=AUTH))
    except SourceUnavailableError:
        pass
    else:
        raise AssertionError("Expected SourceUnavailableError")


def test_unsupported_attribute_is_rejected():
    connector = MockDigiLockerConnector()
    try:
        connector.fetch_record(SourceQuery(student_id="stu_001", attributes=("income_annual",), authorization=AUTH))
    except SourceResponseError as exc:
        assert "income_annual" in str(exc)
    else:
        raise AssertionError("Expected SourceResponseError")


def test_registry_prevents_duplicate_system_registration():
    registry = ConnectorRegistry([MockDigiLockerConnector()])
    try:
        registry.register(MockDigiLockerConnector())
    except ValueError as exc:
        assert "already registered" in str(exc)
    else:
        raise AssertionError("Expected duplicate registration failure")


def test_source_service_lists_connectors():
    service = SourceService(build_default_registry())
    health = service.list_connectors()
    assert len(health) == 8
    assert all(item["live_integration"] is False for item in health)


def test_source_service_queries_normalized_record():
    service = SourceService(build_default_registry())
    record = service.query(
        system=SourceSystem.APAAR,
        student_id="stu_001",
        attributes=["full_name", "education_level", "course"],
        authorized=True,
        purpose="APPLICATION_VERIFICATION",
        consent_id="cons_001",
    )
    assert record.attributes["education_level"] == "UNDERGRADUATE"
    assert record.attributes["course"] == "B.Tech"


def test_source_service_query_many_skips_not_found_sources():
    service = SourceService(build_default_registry())
    records = service.query_many(
        systems=[SourceSystem.DIGILOCKER, SourceSystem.AISHE],
        student_id="stu_001",
        institution_id="inst_001",
        authorized=True,
        purpose="CROSS_SOURCE_MATCH",
        consent_id="cons_001",
    )
    # Both adapters can return normalized records through the same service contract.
    assert {record.source_system for record in records} == {SourceSystem.DIGILOCKER, SourceSystem.AISHE}


def test_response_hash_is_deterministic_for_same_payload():
    connector = MockDigiLockerConnector()
    query = SourceQuery(student_id="stu_001", authorization=AUTH)
    first = connector.fetch_record(query)
    second = connector.fetch_record(query)
    assert first.response_hash == second.response_hash
