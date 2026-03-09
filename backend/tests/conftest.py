"""
Test fixtures for NeuroNotes backend.

All external I/O (Supabase, Gemini) is mocked so tests run without real
credentials and complete in milliseconds.

Key pattern: FastAPI dependency_overrides replaces get_db;
unittest.mock.patch replaces service-layer calls (gemini, vector).
"""
import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch
import contextlib

import pytest
from fastapi.testclient import TestClient


# ── Shared fake data ────────────────────────────────────────────────────────────

NOTE_ID_1 = str(uuid.uuid4())
NOTE_ID_2 = str(uuid.uuid4())
TAG_ID_1 = str(uuid.uuid4())

NOW = datetime.now(timezone.utc).isoformat()

FAKE_NOTE_1 = {
    "id": NOTE_ID_1,
    "title": "Test Note One",
    "content": "<p>Hello world</p>",
    "created_at": NOW,
    "updated_at": NOW,
    "note_tags": [],
}

FAKE_NOTE_2 = {
    "id": NOTE_ID_2,
    "title": "Test Note Two",
    "content": "<p>More content here</p>",
    "created_at": NOW,
    "updated_at": NOW,
    "note_tags": [],
}

FAKE_TAG = {
    "id": TAG_ID_1,
    "name": "machine-learning",
}


def _make_chain(data: Any):
    """
    Build a minimal Supabase query-builder chain mock.
    Every chainable method returns self, and .execute() returns a result
    with .data set to `data`.
    """
    result = MagicMock()
    result.data = data

    chain = MagicMock()
    chain.execute.return_value = result

    for method in (
        "select", "insert", "update", "delete",
        "eq", "neq", "in_", "or_", "order", "limit", "single",
    ):
        setattr(chain, method, MagicMock(return_value=chain))

    return chain, result


def build_db_mock() -> MagicMock:
    """
    Return a MagicMock that mimics the Supabase Client enough for all router
    tests.  Each .table() call returns a fresh chain so chaining works.
    """
    db = MagicMock()

    def _table(name: str):
        # --- notes table ---
        if name == "notes":
            chain, _ = _make_chain([dict(FAKE_NOTE_1), dict(FAKE_NOTE_2)])

            # POST /notes/ : insert returns single new note
            insert_chain, _ = _make_chain([dict(FAKE_NOTE_1)])
            chain.insert = MagicMock(return_value=insert_chain)

            # GET /notes/{id} : single() should return FAKE_NOTE_1
            single_result = MagicMock()
            single_result.data = dict(FAKE_NOTE_1)
            single_chain = MagicMock()
            single_chain.execute.return_value = single_result
            for m in ("eq", "neq", "in_", "order", "limit"):
                inner = MagicMock()
                inner.execute.return_value = single_result
                inner.single = MagicMock(return_value=single_chain)
                setattr(single_chain, m, MagicMock(return_value=inner))

            # Make .select().eq().single().execute() work
            sel_chain = MagicMock()
            eq_inner = MagicMock()
            eq_inner.single = MagicMock(return_value=single_chain)
            eq_inner.execute.return_value = MagicMock(data=[dict(FAKE_NOTE_1)])
            sel_chain.eq = MagicMock(return_value=eq_inner)
            sel_chain.in_ = MagicMock(return_value=chain)
            sel_chain.order = MagicMock(return_value=chain)
            sel_chain.execute.return_value = MagicMock(
                data=[dict(FAKE_NOTE_1), dict(FAKE_NOTE_2)]
            )
            chain.select = MagicMock(return_value=sel_chain)

            # update().eq().execute()
            update_chain = MagicMock()
            update_eq = MagicMock()
            update_eq.execute.return_value = MagicMock(data=[dict(FAKE_NOTE_1)])
            update_chain.eq = MagicMock(return_value=update_eq)
            chain.update = MagicMock(return_value=update_chain)

            # delete().eq().execute()
            del_chain = MagicMock()
            del_eq = MagicMock()
            del_eq.execute.return_value = MagicMock(data=[])
            del_chain.eq = MagicMock(return_value=del_eq)
            chain.delete = MagicMock(return_value=del_chain)

            return chain

        # --- tags table ---
        elif name == "tags":
            chain, _ = _make_chain([])

            sel = MagicMock()
            eq_r = MagicMock()
            eq_r.execute.return_value = MagicMock(data=[])
            sel.eq = MagicMock(return_value=eq_r)
            sel.execute.return_value = MagicMock(data=[])
            chain.select = MagicMock(return_value=sel)

            ins = MagicMock()
            ins.execute.return_value = MagicMock(data=[FAKE_TAG])
            chain.insert = MagicMock(return_value=ins)

            return chain

        # --- note_tags table ---
        elif name == "note_tags":
            chain, _ = _make_chain([])

            sel = MagicMock()
            eq1 = MagicMock()
            eq2 = MagicMock()
            eq2.execute.return_value = MagicMock(data=[])
            eq1.eq = MagicMock(return_value=eq2)
            eq1.execute.return_value = MagicMock(data=[])
            sel.eq = MagicMock(return_value=eq1)
            sel.execute.return_value = MagicMock(data=[])
            chain.select = MagicMock(return_value=sel)

            ins = MagicMock()
            ins.execute.return_value = MagicMock(data=[])
            chain.insert = MagicMock(return_value=ins)

            del_c = MagicMock()
            del_eq = MagicMock()
            del_eq2 = MagicMock()
            del_eq2.execute.return_value = MagicMock(data=[])
            del_eq.eq = MagicMock(return_value=del_eq2)
            del_eq.execute.return_value = MagicMock(data=[])
            del_c.eq = MagicMock(return_value=del_eq)
            chain.delete = MagicMock(return_value=del_c)

            return chain

        # --- note_links table ---
        elif name == "note_links":
            chain, _ = _make_chain([])
            sel = MagicMock()
            sel.execute.return_value = MagicMock(data=[])
            sel.select = MagicMock(return_value=sel)
            chain.select = MagicMock(return_value=sel)
            return chain

        # --- fallback ---
        else:
            chain, _ = _make_chain([])
            return chain

    db.table = _table

    # RPC mock (used by vector service)
    rpc_result = MagicMock()
    rpc_result.data = 5
    rpc_mock = MagicMock()
    rpc_mock.execute.return_value = rpc_result
    db.rpc = MagicMock(return_value=rpc_mock)

    return db


# ── Session-scoped fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """
    FastAPI TestClient with:
    - Supabase replaced via app.dependency_overrides[get_db]
    - Gemini and vector service calls replaced via unittest.mock.patch
    """
    mock_db = build_db_mock()

    with patch("services.gemini.embed_text", return_value=[0.1] * 768), \
         patch("services.gemini.generate", return_value="Mocked AI response."), \
         patch("services.gemini.generate_json", return_value={
             "tags": ["ai", "testing", "python"],
             "flashcards": [{"question": "What is AI?", "answer": "Artificial Intelligence"}],
             "expanded": ["sub-idea 1", "sub-idea 2"],
             "topics": ["topic-a", "topic-b"],
             "gaps": ["gap-1", "gap-2"],
             "suggestion": "Keep learning!",
             "ai_insight": "Great progress on your notes!",
         }), \
         patch("services.vector.similarity_search", return_value=[
             (uuid.UUID(NOTE_ID_1), 0.92),
         ]), \
         patch("services.vector.upsert_embedding", return_value=None), \
         patch("services.vector.recompute_links_for_note", return_value=None), \
         patch("services.vector.recompute_all_links", return_value=3):

        from main import app
        from database import get_db

        # Use FastAPI's built-in override mechanism (works reliably with TestClient)
        app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

        app.dependency_overrides.clear()
