"""FastAPI wrapper around the LangGraph workflow.

Endpoints (all under /runs, protected by X-Internal-Key when INTERNAL_API_KEY is set):
  POST /runs                    start a run, returns at the first human review
  GET  /runs/{id}               current status + state
  POST /runs/{id}/resume        approve / revise the pending review
  POST /runs/{id}/retry         re-run a step that failed (status == "stalled")

Endpoints are plain `def` on purpose: LLM calls block, and FastAPI runs sync
endpoints in a threadpool so they don't freeze the event loop.
"""
import logging
import os
import secrets
import sqlite3
import threading
import uuid
from contextlib import asynccontextmanager, contextmanager

from dotenv import load_dotenv

load_dotenv()  # must run before importing modules that read env vars at import time

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request  # noqa: E402
from langgraph.checkpoint.sqlite import SqliteSaver  # noqa: E402
from langgraph.types import Command  # noqa: E402

from .graph import build_blog_graph  # noqa: E402
from .schemas import ResumeRequest, RunResponse, StartRunRequest  # noqa: E402
from .state import BlogState  # noqa: E402

logger = logging.getLogger("blogflow.ai")

# State fields the Node API / UI are allowed to see.
PUBLIC_FIELDS = [
    "topic", "audience", "research", "draft", "final_blog",
    "research_revision_count", "revision_count", "llm_provider", "llm_model",
]


# ------------------------------------------------------------------ lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open the checkpoint DB once; this is what lets a paused run survive restarts."""
    db_path = os.getenv("CHECKPOINT_DB", "checkpoints.sqlite")
    conn = sqlite3.connect(db_path, check_same_thread=False)
    app.state.graph = build_blog_graph(SqliteSaver(conn))
    if not os.getenv("INTERNAL_API_KEY"):
        logger.warning("INTERNAL_API_KEY is not set: the API is unauthenticated (ok for local dev only)")
    yield
    conn.close()


app = FastAPI(title="BlogFlow AI service", version="0.1.0", lifespan=lifespan)


def get_graph(request: Request):
    return request.app.state.graph


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Shared-secret check between Express and this service."""
    expected = os.getenv("INTERNAL_API_KEY")
    if not expected:
        return
    if not x_internal_key or not secrets.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Key")


router = APIRouter(prefix="/runs", dependencies=[Depends(require_internal_key)])

# ------------------------------------------------------------------- helpers
# One in-flight request per thread: two simultaneous resumes would race.
# In-process only, so run a single worker (see README for the scaling note).
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


@contextmanager
def _exclusive(thread_id: str):
    with _locks_guard:
        lock = _locks.setdefault(thread_id, threading.Lock())
    if not lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="This run is already processing a request")
    try:
        yield
    finally:
        lock.release()


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _require_run(graph, thread_id: str):
    snapshot = graph.get_state(_config(thread_id))
    if snapshot.created_at is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return snapshot


def _values(snapshot) -> dict:
    v = snapshot.values
    raw = v.model_dump() if hasattr(v, "model_dump") else dict(v or {})
    # LangGraph omits fields no node has written yet; fill them from the model's defaults
    # so clients always get e.g. revision_count == 0 instead of null.
    return {**BlogState().model_dump(), **raw}


def _pending_interrupt(snapshot) -> dict | None:
    for task in snapshot.tasks:
        for it in task.interrupts:
            return it.value
    return None


def _to_response(thread_id: str, snapshot) -> RunResponse:
    values = _values(snapshot)
    review = _pending_interrupt(snapshot)
    if review is not None:
        status, stage = "awaiting_review", review.get("stage")
    elif snapshot.next:
        status, stage = "stalled", snapshot.next[0]
    else:
        status, stage = "completed", None
    return RunResponse(
        thread_id=thread_id, status=status, stage=stage, review=review,
        state={k: values.get(k) for k in PUBLIC_FIELDS},
    )


def _invoke(graph, payload, thread_id: str) -> None:
    """Run the graph until the next pause or the end. Never leak provider errors to callers."""
    try:
        graph.invoke(payload, _config(thread_id))
    except Exception:
        logger.exception("Workflow step failed for run %s", thread_id)
        raise HTTPException(
            status_code=502,
            detail=f"An LLM step failed. Progress is saved; POST /runs/{thread_id}/retry to try again.",
        )


# ------------------------------------------------------------------ endpoints
@app.get("/health")
def health():
    return {"status": "ok"}


@router.post("", response_model=RunResponse, status_code=201)
def start_run(req: StartRunRequest, graph=Depends(get_graph)):
    thread_id = req.thread_id or str(uuid.uuid4())
    with _exclusive(thread_id):
        if graph.get_state(_config(thread_id)).created_at is not None:
            raise HTTPException(status_code=409, detail="A run with this thread_id already exists")
        _invoke(graph, {
            "topic": req.topic,
            "audience": req.audience,
            "llm_provider": req.provider,
            "llm_model": req.model,
            "llm_temperature": req.temperature,
        }, thread_id)
        return _to_response(thread_id, graph.get_state(_config(thread_id)))


@router.get("/{thread_id}", response_model=RunResponse)
def get_run(thread_id: str, graph=Depends(get_graph)):
    return _to_response(thread_id, _require_run(graph, thread_id))


@router.post("/{thread_id}/resume", response_model=RunResponse)
def resume_run(thread_id: str, req: ResumeRequest, graph=Depends(get_graph)):
    with _exclusive(thread_id):
        review = _pending_interrupt(_require_run(graph, thread_id))
        if review is None:
            raise HTTPException(status_code=409, detail="Run is not waiting for a review")
        if req.action == "revise" and not review.get("can_revise", True):
            raise HTTPException(status_code=409, detail="Revision limit reached for this stage; approve to continue")
        _invoke(graph, Command(resume={"action": req.action, "feedback": req.feedback}), thread_id)
        return _to_response(thread_id, graph.get_state(_config(thread_id)))


@router.post("/{thread_id}/retry", response_model=RunResponse)
def retry_run(thread_id: str, graph=Depends(get_graph)):
    with _exclusive(thread_id):
        current = _to_response(thread_id, _require_run(graph, thread_id))
        if current.status != "stalled":
            raise HTTPException(status_code=409, detail=f"Nothing to retry (status: {current.status})")
        _invoke(graph, None, thread_id)  # None = continue from the last checkpoint
        return _to_response(thread_id, graph.get_state(_config(thread_id)))


app.include_router(router)
