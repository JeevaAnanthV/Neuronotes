from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from config import get_settings
from database import get_db
import logging
import uuid
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("neuronotes")

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NeuroNotes API starting up…")
    try:
        db = get_db()
        db.table("notes").select("id").limit(1).execute()
        logger.info("Supabase connection OK.")
    except Exception as e:
        logger.error("Supabase connection failed: %s", e)
    yield
    logger.info("NeuroNotes API shutting down.")


app = FastAPI(
    title="NeuroNotes API",
    description="AI-Powered Intelligent Knowledge Workspace",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

import os as _os
_cors_origins = ["http://localhost:3000", "http://localhost:2323", "http://127.0.0.1:2323"]
_extra = _os.environ.get("CORS_ORIGINS_EXTRA", "")
if _extra:
    _cors_origins += [o.strip().rstrip("/") for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_and_logging(request: Request, call_next) -> Response:
    """Attach a unique request ID to every response and log request duration."""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info("%s %s %d (%.1fms) [%s]", request.method, request.url.path, response.status_code, duration_ms, request_id)
    return response

from routers import notes, search, ai, graph, tags, rooms

app.include_router(notes.router)
app.include_router(search.router)
app.include_router(ai.router)
app.include_router(graph.router)
app.include_router(tags.router)
app.include_router(rooms.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "NeuroNotes API"}
