"""
Tests for /search/ semantic search endpoint.
Gemini embeddings and pgvector similarity search are mocked.
"""


class TestSemanticSearch:
    def test_search_returns_200(self, client):
        response = client.get("/search/", params={"q": "machine learning"})
        assert response.status_code == 200

    def test_search_returns_list(self, client):
        response = client.get("/search/", params={"q": "python"})
        data = response.json()
        assert isinstance(data, list)

    def test_search_result_has_note_and_score(self, client):
        response = client.get("/search/", params={"q": "knowledge graph"})
        data = response.json()
        if data:
            item = data[0]
            assert "note" in item
            assert "score" in item
            assert isinstance(item["score"], float)

    def test_search_note_has_required_fields(self, client):
        response = client.get("/search/", params={"q": "fastapi"})
        data = response.json()
        if data:
            note = data[0]["note"]
            assert "id" in note
            assert "title" in note
            assert "tags" in note

    def test_search_missing_query_returns_422(self, client):
        response = client.get("/search/")
        assert response.status_code == 422

    def test_search_empty_query_returns_422(self, client):
        response = client.get("/search/", params={"q": ""})
        assert response.status_code == 422

    def test_search_custom_top_k(self, client):
        response = client.get("/search/", params={"q": "AI", "top_k": 3})
        assert response.status_code == 200

    def test_search_score_is_float(self, client):
        response = client.get("/search/", params={"q": "test query"})
        data = response.json()
        for item in data:
            assert isinstance(item["score"], float)
            assert 0.0 <= item["score"] <= 1.0
