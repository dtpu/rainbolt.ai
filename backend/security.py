import re
from typing import Optional

from fastapi import HTTPException, Request

from config import ALLOWED_ORIGINS, INTERNAL_KEY, logger


def origin_allowed(origin: Optional[str]) -> bool:
    """True if the request's Origin header is in the allowlist."""
    return origin is not None and origin in ALLOWED_ORIGINS


def require_allowed_origin(request: Request):
    """FastAPI dependency: reject HTTP requests from disallowed origins.
    Used for endpoints called directly from the browser (Origin set by the browser)."""
    origin = request.headers.get("origin")
    if not origin_allowed(origin):
        logger.warning(f"Rejected request from disallowed origin: {origin!r}")
        raise HTTPException(status_code=403, detail="Origin not allowed")


def require_internal_key(request: Request):
    """FastAPI dependency: reject server-to-server requests without the shared key."""
    if not INTERNAL_KEY:
        return  # not configured (local/dev), allow
    if request.headers.get("x-internal-key") != INTERNAL_KEY:
        logger.warning("Rejected request with missing/invalid internal key")
        raise HTTPException(status_code=403, detail="Forbidden")


def safe_session_id(session_id: str) -> str:
    """Strip a session id down to a filesystem-safe token so it can't be used
    for path traversal (e.g. '../../etc/passwd') when building upload paths."""
    return re.sub(r"[^A-Za-z0-9_-]", "", session_id)
