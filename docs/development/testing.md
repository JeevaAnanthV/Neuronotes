# Testing

How to run tests, the test setup, and patterns for writing async endpoint tests.

## Table of Contents
- [Running Tests](#running-tests)
- [Test Configuration](#test-configuration)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Example Tests](#example-tests)
- [Testing Guidelines](#testing-guidelines)

---

## Running Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run a specific test file
pytest tests/test_notes.py -v

# Run tests matching a name pattern
pytest tests/ -v -k "test_create"

# Run with output (don't capture stdout)
pytest tests/ -v -s

# Run with coverage
pip install pytest-cov
pytest tests/ -v --cov=. --cov-report=term-missing
```

---

## Test Configuration

`backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- `asyncio_mode = auto` — automatically handles `async def` test functions without requiring `@pytest.mark.asyncio`
- `testpaths = tests` — pytest looks for tests in `backend/tests/`

**Required packages** (already in `requirements.txt`):
- `pytest >= 8.0.0`
- `pytest-asyncio >= 0.23.0`
- `httpx >= 0.27.0` — provides `AsyncClient` for testing FastAPI

---

## Test Structure

```
backend/
└── tests/
    ├── conftest.py          ← shared fixtures (app client, test DB setup)
    ├── test_notes.py        ← CRUD endpoint tests
    ├── test_search.py       ← semantic search tests
    ├── test_ai.py           ← AI endpoint tests (with mocks)
    └── test_graph.py        ← graph endpoint tests
```

> Note: The `tests/` directory is not yet present in the repository. This is the recommended structure.

---

## Writing Tests

### Basic endpoint test pattern

```python
# backend/tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from database import Base, get_db
from main import app

# Use in-memory SQLite for tests (no pgvector, so vector operations need mocking)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="function")
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture(scope="function")
async def client(db_session):
    """HTTP client with test database."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Testing a notes endpoint

```python
# backend/tests/test_notes.py
import pytest
from unittest.mock import AsyncMock, patch

async def test_create_note(client):
    """Creating a note returns 201 with the note data."""
    with patch("routers.notes.gemini.embed_text", new=AsyncMock(return_value=[0.1] * 768)):
        with patch("routers.notes.vs.upsert_embedding", new=AsyncMock()):
            with patch("routers.notes.vs.recompute_links_for_note", new=AsyncMock()):
                response = await client.post("/notes/", json={
                    "title": "Test Note",
                    "content": "<p>Hello world</p>"
                })

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Note"
    assert data["content"] == "<p>Hello world</p>"
    assert "id" in data
    assert "created_at" in data
    assert data["tags"] == []

async def test_get_note_not_found(client):
    """Getting a non-existent note returns 404."""
    response = await client.get("/notes/550e8400-e29b-41d4-a716-446655440000")
    assert response.status_code == 404
    assert response.json() == {"detail": "Note not found"}

async def test_list_notes_empty(client):
    """Listing notes on empty DB returns empty list."""
    response = await client.get("/notes/")
    assert response.status_code == 200
    assert response.json() == []

async def test_update_note(client):
    """Updating a note changes the specified fields."""
    # Create first
    with patch("routers.notes.gemini.embed_text", new=AsyncMock(return_value=[0.1] * 768)):
        with patch("routers.notes.vs.upsert_embedding", new=AsyncMock()):
            with patch("routers.notes.vs.recompute_links_for_note", new=AsyncMock()):
                create_resp = await client.post("/notes/", json={"title": "Original", "content": ""})
    note_id = create_resp.json()["id"]

    # Update
    with patch("routers.notes.gemini.embed_text", new=AsyncMock(return_value=[0.1] * 768)):
        with patch("routers.notes.vs.upsert_embedding", new=AsyncMock()):
            with patch("routers.notes.vs.recompute_links_for_note", new=AsyncMock()):
                update_resp = await client.put(f"/notes/{note_id}", json={"title": "Updated"})

    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated"

async def test_delete_note(client):
    """Deleting a note returns 204 and the note is gone."""
    with patch("routers.notes.gemini.embed_text", new=AsyncMock(return_value=[0.1] * 768)):
        with patch("routers.notes.vs.upsert_embedding", new=AsyncMock()):
            with patch("routers.notes.vs.recompute_links_for_note", new=AsyncMock()):
                create_resp = await client.post("/notes/", json={"title": "To Delete", "content": ""})
    note_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/notes/{note_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/notes/{note_id}")
    assert get_resp.status_code == 404
```

### Testing AI endpoints with mocks

```python
# backend/tests/test_ai.py
from unittest.mock import AsyncMock, patch

async def test_generate_tags(client):
    """Tags endpoint returns list of lowercase hyphenated tags."""
    mock_response = {"tags": ["machine-learning", "deep-learning", "ai"]}

    with patch("routers.ai.gemini.generate_json", new=AsyncMock(return_value=mock_response)):
        response = await client.post("/ai/tags", json={
            "content": "Convolutional neural networks use filters..."
        })

    assert response.status_code == 200
    data = response.json()
    assert "tags" in data
    assert len(data["tags"]) == 3
    assert "machine-learning" in data["tags"]

async def test_generate_tags_gemini_failure(client):
    """Tags endpoint returns empty list when Gemini returns bad JSON."""
    with patch("routers.ai.gemini.generate_json", new=AsyncMock(return_value={})):
        response = await client.post("/ai/tags", json={"content": "some content"})

    assert response.status_code == 200
    assert response.json()["tags"] == []

async def test_flashcards(client):
    """Flashcards endpoint returns question/answer pairs."""
    mock_response = {
        "flashcards": [
            {"question": "What is backpropagation?", "answer": "An algorithm for training neural networks."}
        ]
    }

    with patch("routers.ai.gemini.generate_json", new=AsyncMock(return_value=mock_response)):
        response = await client.post("/ai/flashcards", json={"content": "Neural networks..."})

    assert response.status_code == 200
    cards = response.json()["flashcards"]
    assert len(cards) == 1
    assert cards[0]["question"] == "What is backpropagation?"
```

---

## Testing Guidelines

### Always mock external calls

Tests should never call the real Gemini API or a real database. Use `unittest.mock.AsyncMock` for async functions:

```python
from unittest.mock import AsyncMock, patch

with patch("services.gemini.embed_text", new=AsyncMock(return_value=[0.0] * 768)):
    # your test code
```

### Use a test database

Override the `get_db` dependency with a test session using SQLite in-memory (or a dedicated test PostgreSQL database). Never run tests against your development database.

### Test both success and failure paths

For each endpoint, write tests for:
- Happy path (valid input, expected output)
- Missing resource (404)
- Invalid input (422 validation errors)
- Upstream failure (Gemini returns `{}` or empty)

### Keep tests isolated

Each test function should be independent. Use function-scoped fixtures so each test starts with a clean database. Do not rely on test ordering.

### Test the contracts, not the implementation

Test that the endpoint returns the expected HTTP status and JSON shape. Do not test internal implementation details (which SQL query ran, which Gemini model was called).

---

## Related Documents

- [Contributing](contributing.md)
- [Local Development](../setup/local-development.md)
- [Backend Architecture](../architecture/backend.md)
