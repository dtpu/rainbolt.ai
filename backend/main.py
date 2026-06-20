from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS, ENABLE_DOCS, logger
from routers import chat_ws, mapillary_routes, misc, upload

logger.info(f"Allowed origins: {ALLOWED_ORIGINS}")

app = FastAPI(
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

# CORS still applies for well-behaved browsers; the explicit origin checks in
# the routers also cover non-browser clients (curl/scripts) that ignore CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(misc.router)
app.include_router(upload.router)
app.include_router(mapillary_routes.router)
app.include_router(chat_ws.router)
