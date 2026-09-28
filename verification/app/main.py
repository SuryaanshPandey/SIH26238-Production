import hmac
import logging
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


logger = logging.getLogger("sih26238.verification")

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


app = FastAPI(
    title="SIH26238 Documents & Verification Intelligence",
    version=CONTRACT_VERSION,
    description=(
        "Contract-first foundation for the Documents + Verification module."
    ),
)


def _configured_cors_origins() -> list[str]:
    """
    Build the production CORS allow-list.

    Environment configuration remains authoritative, while the known
    production Student App origin is always included so a missing or
    malformed Render environment variable does not break the browser app.
    """
    production_origin = (
        "https://sih26238-student-v25-free.onrender.com"
    )

    raw = os.getenv(
        "SIH_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
    )

    origins = {
        origin.strip().rstrip("/")
        for origin in raw.split(",")
        if origin.strip()
    }

    origins.add(production_origin)

    # Local development.
    origins.add("http://localhost:3000")
    origins.add("http://localhost:3001")
    origins.add("http://127.0.0.1:3000")
    origins.add("http://127.0.0.1:3001")

    return sorted(origins)


# ---------------------------------------------------------------------------
# Application middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def security_and_correlation_middleware(
    request: Request,
    call_next,
):
    """
    Application-level security and correlation middleware.

    IMPORTANT:
    CORSMiddleware is deliberately registered AFTER this middleware
    declaration below so CORS becomes the outermost middleware.

    This means even an unhandled 500 response can receive the appropriate
    CORS headers instead of becoming a browser-level CORS error.
    """

    # Browser CORS preflight requests do not carry application credentials.
    #
    # Never reject OPTIONS here. CORSMiddleware must be allowed to process
    # and answer the preflight request.
    if request.method == "OPTIONS":
        return await call_next(request)

    configured_key = os.getenv("SIH_API_KEY")

    if (
        configured_key
        and request.url.path
        not in {
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc",
        }
    ):
        provided = (
            request.headers.get("X-SIH-API-Key")
            or ""
        )

        if not hmac.compare_digest(
            provided,
            configured_key,
        ):
            response = JSONResponse(
                status_code=401,
                content=envelope(
                    success=False,
                    error=APIError(
                        code="UNAUTHORIZED",
                        message="API key required",
                    ),
                ).model_dump(
                    mode="json"
                ),
            )

            correlation_id = (
                request.headers.get("X-Request-ID")
                or new_id("req")
            )

            response.headers[
                "X-Request-ID"
            ] = correlation_id

            return response

    correlation_id = (
        request.headers.get("X-Request-ID")
        or new_id("req")
    )

    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled exception while processing %s %s",
            request.method,
            request.url.path,
        )

        response = JSONResponse(
            status_code=500,
            content=envelope(
                success=False,
                error=APIError(
                    code="INTERNAL_ERROR",
                    message=(
                        "The verification service encountered "
                        "an unexpected server error."
                    ),
                ),
            ).model_dump(
                mode="json"
            ),
        )

    response.headers[
        "X-Request-ID"
    ] = correlation_id

    if (
        request.method
        in {"POST", "PUT", "PATCH", "DELETE"}
        and response.status_code < 400
        and runtime.audit_service is not None
    ):
        try:
            runtime.audit_service.record(
                actor_type="SYSTEM",
                actor_id="http-api",
                action=(
                    request.method
                    + " "
                    + request.url.path
                ),
                entity_type="HTTP_ROUTE",
                entity_id=request.url.path,
                correlation_id=correlation_id,
            )
        except Exception:
            logger.exception(
                "Audit recording failed for %s %s",
                request.method,
                request.url.path,
            )

    return response


# ---------------------------------------------------------------------------
# CORS
#
# MUST be added after the custom middleware above so it becomes the
# outermost middleware in the FastAPI/Starlette middleware stack.
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-SIH-API-Key",
    ],
    expose_headers=[
        "X-Request-ID",
    ],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(router)
app.include_router(verification_router)
app.include_router(exception_router)
app.include_router(investigation_router)


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

@app.exception_handler(
    RequestValidationError
)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    logger.warning(
        "Request validation failed: %s %s",
        request.method,
        request.url.path,
    )

    return JSONResponse(
        status_code=422,
        content=envelope(
            success=False,
            error=APIError(
                code="VALIDATION_ERROR",
                message="Request validation failed",
            ),
        ).model_dump(
            mode="json"
        ),
    )
