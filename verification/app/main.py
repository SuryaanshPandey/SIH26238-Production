import hmac
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import router, envelope
from app.api.verification_routes import router as verification_router
from app.api.exception_routes import router as exception_router
from app.api.investigation_routes import router as investigation_router
from app.core.constants import CONTRACT_VERSION
from app.core.ids import new_id
from app.core.time import utc_now
from app.models.common import APIError
from app.runtime import runtime

app = FastAPI(
    title="SIH26238 Documents & Verification Intelligence",
    version=CONTRACT_VERSION,
    description="Contract-first foundation for the Documents + Verification module.",
)

# Local cross-module browser integration. Production deployments should use an allow-list
# of trusted origins rather than the permissive development default.
_raw_origins = os.getenv("SIH_CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
_allowed_origins = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    # The student app sends its session as a Bearer token. Keep the header
    # explicitly allow-listed so authenticated browser requests can complete
    # their CORS preflight.
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-SIH-API-Key"],
    expose_headers=["X-Request-ID"],
)

app.include_router(router)
app.include_router(verification_router)
app.include_router(exception_router)
app.include_router(investigation_router)


@app.middleware("http")
async def security_and_correlation_middleware(request: Request, call_next):
    # Browser CORS preflight requests do not carry application credentials.
    # Never reject OPTIONS at the auth boundary; CORSMiddleware must be able
    # to answer the preflight and validate the actual request headers.
    if request.method == "OPTIONS":
        return await call_next(request)

    configured_key = os.getenv("SIH_API_KEY")
    if configured_key and request.url.path not in {"/health", "/docs", "/openapi.json", "/redoc"}:
        provided = request.headers.get("X-SIH-API-Key") or ""
        if not hmac.compare_digest(provided, configured_key):
            return JSONResponse(
                status_code=401,
                content=envelope(success=False, error=APIError(code="UNAUTHORIZED", message="API key required")).model_dump(mode="json"),
            )

    correlation_id = request.headers.get("X-Request-ID") or new_id("req")
    response = await call_next(request)
    response.headers["X-Request-ID"] = correlation_id

    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 400 and runtime.audit_service is not None:
        runtime.audit_service.record(
            actor_type="SYSTEM",
            actor_id="http-api",
            action=request.method + " " + request.url.path,
            entity_type="HTTP_ROUTE",
            entity_id=request.url.path,
            correlation_id=correlation_id,
        )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=envelope(
            success=False,
            error=APIError(code="VALIDATION_ERROR", message="Request validation failed"),
        ).model_dump(mode="json"),
    )
