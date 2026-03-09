"""
Tests for /notes/ CRUD endpoints.
All Supabase and Gemini calls are mocked via conftest.py fixtures.
"""
import uuid
from unittest.mock import patch, MagicMock

import pytest

from tests.conftest import NOTE_ID_1, NOW


class TestListNotes:
    def test_list_returns_200(self, client):
        response = client.get("/notes/")
        assert response.status_code == 200

    def test_list_returns_list(self, client):
        response = client.get("/notes/")
        data = response.json()
        assert isinstance(data, list)

    def test_list_items_have_required_fields(self, client):
        response = client.get("/notes/")
        data = response.json()
        assert len(data) > 0
        item = data[0]
        assert "id" in item
        assert "title" in item
        assert "created_at" in item
        assert "updated_at" in item
        assert "tags" in item


class TestCreateNote:
    def test_create_returns_201(self, client):
        response = client.post("/notes/", json={"title": "New Note", "content": "<p>Hello</p>"})
        assert response.status_code == 201

    def test_create_returns_note_data(self, client):
        response = client.post("/notes/", json={"title": "My Note", "content": "<p>Content</p>"})
        data = response.json()
        assert "id" in data
        assert "title" in data
        assert "content" in data

    def test_create_with_empty_content(self, client):
        response = client.post("/notes/", json={"title": "Empty Note", "content": ""})
        assert response.status_code == 201

    def test_create_default_title(self, client):
        response = client.post("/notes/", json={"content": "Some content"})
        assert response.status_code == 201


class TestGetNote:
    def test_get_existing_note_returns_200(self, client):
        response = client.get(f"/notes/{NOTE_ID_1}")
        assert response.status_code == 200

    def test_get_returns_correct_structure(self, client):
        response = client.get(f"/notes/{NOTE_ID_1}")
        data = response.json()
        assert "id" in data
        assert "title" in data
        assert "content" in data
        assert "tags" in data

    def test_get_invalid_id_returns_422(self, client):
        response = client.get("/notes/not-a-uuid")
        assert response.status_code == 422

    def test_get_nonexistent_note_returns_404(self):
        """A note that doesn't exist in the DB should return 404."""
        from postgrest.exceptions import APIError as PostgRESTError
        from fastapi.testclient import TestClient
        from unittest.mock import patch, MagicMock
        from main import app
        from database import get_db

        nonexistent_id = str(uuid.uuid4())

        # Build a db mock that raises PGRST116 on .single().execute()
        mock_db_404 = MagicMock()

        def _table(name):
            t = MagicMock()
            sel = MagicMock()
            eq = MagicMock()
            single = MagicMock()
            single.execute.side_effect = PostgRESTError(
                {"code": "PGRST116", "message": "not found", "details": None, "hint": None}
            )
            eq.single = MagicMock(return_value=single)
            sel.eq = MagicMock(return_value=eq)
            t.select = MagicMock(return_value=sel)
            return t

        mock_db_404.table = _table

        # Save existing override so the session-scoped client stays functional
        existing_override = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = lambda: mock_db_404

        try:
            with patch("services.gemini.embed_text", return_value=[0.1] * 768), \
                 patch("services.vector.upsert_embedding", return_value=None), \
                 patch("services.vector.recompute_links_for_note", return_value=None):
                with TestClient(app, raise_server_exceptions=False) as c:
                    response = c.get(f"/notes/{nonexistent_id}")
        finally:
            # Restore the override that the session fixture set
            if existing_override is not None:
                app.dependency_overrides[get_db] = existing_override
            else:
                app.dependency_overrides.pop(get_db, None)

        assert response.status_code == 404


class TestUpdateNote:
    def test_update_returns_200(self, client):
        response = client.put(
            f"/notes/{NOTE_ID_1}",
            json={"title": "Updated Title", "content": "<p>Updated</p>"}
        )
        assert response.status_code == 200

    def test_update_partial_title_only(self, client):
        response = client.put(f"/notes/{NOTE_ID_1}", json={"title": "New Title"})
        assert response.status_code == 200

    def test_update_returns_note_structure(self, client):
        response = client.put(f"/notes/{NOTE_ID_1}", json={"title": "X"})
        data = response.json()
        assert "id" in data
        assert "title" in data


class TestDeleteNote:
    def test_delete_returns_204(self, client):
        response = client.delete(f"/notes/{NOTE_ID_1}")
        assert response.status_code == 204

    def test_delete_invalid_uuid_returns_422(self, client):
        response = client.delete("/notes/bad-id")
        assert response.status_code == 422
