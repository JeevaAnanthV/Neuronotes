"""
Tests for /ai/ endpoints.
All Gemini API calls are mocked — no real API credentials needed.
"""


class TestGenerateTags:
    def test_tags_returns_200(self, client):
        response = client.post("/ai/tags", json={"content": "Machine learning and deep neural networks"})
        assert response.status_code == 200

    def test_tags_returns_list(self, client):
        response = client.post("/ai/tags", json={"content": "Python programming"})
        data = response.json()
        assert "tags" in data
        assert isinstance(data["tags"], list)

    def test_tags_non_empty_for_real_content(self, client):
        response = client.post("/ai/tags", json={"content": "Knowledge graphs and semantic search"})
        data = response.json()
        assert len(data["tags"]) > 0

    def test_tags_missing_content_returns_422(self, client):
        response = client.post("/ai/tags", json={})
        assert response.status_code == 422


class TestFlashcards:
    def test_flashcards_returns_200(self, client):
        response = client.post("/ai/flashcards", json={"content": "React is a JavaScript library for building UIs."})
        assert response.status_code == 200

    def test_flashcards_returns_list(self, client):
        response = client.post("/ai/flashcards", json={"content": "FastAPI is a Python web framework."})
        data = response.json()
        assert "flashcards" in data
        assert isinstance(data["flashcards"], list)

    def test_flashcards_have_question_and_answer(self, client):
        response = client.post("/ai/flashcards", json={"content": "pgvector enables vector similarity search."})
        data = response.json()
        if data["flashcards"]:
            card = data["flashcards"][0]
            assert "question" in card
            assert "answer" in card

    def test_flashcards_missing_content_returns_422(self, client):
        response = client.post("/ai/flashcards", json={})
        assert response.status_code == 422


class TestChat:
    def test_chat_returns_200(self, client):
        response = client.post("/ai/chat", json={
            "messages": [{"role": "user", "content": "What are my notes about?"}]
        })
        assert response.status_code == 200

    def test_chat_returns_reply_and_sources(self, client):
        response = client.post("/ai/chat", json={
            "messages": [{"role": "user", "content": "Tell me about machine learning"}]
        })
        data = response.json()
        assert "reply" in data
        assert "sources" in data
        assert isinstance(data["sources"], list)

    def test_chat_empty_messages_returns_200(self, client):
        response = client.post("/ai/chat", json={"messages": []})
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data

    def test_chat_with_history(self, client):
        response = client.post("/ai/chat", json={
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"},
                {"role": "user", "content": "What do I know about Python?"},
            ]
        })
        assert response.status_code == 200


class TestInsights:
    def test_insights_returns_200(self, client):
        response = client.get("/ai/insights")
        assert response.status_code == 200

    def test_insights_returns_required_fields(self, client):
        response = client.get("/ai/insights")
        data = response.json()
        assert "total_notes" in data
        assert "notes_this_week" in data
        assert "top_topic" in data
        assert "ai_insight" in data
        assert "unfinished_ideas" in data

    def test_insights_total_notes_is_int(self, client):
        response = client.get("/ai/insights")
        data = response.json()
        assert isinstance(data["total_notes"], int)
        assert data["total_notes"] >= 0

    def test_insights_suggested_topics_is_list(self, client):
        response = client.get("/ai/insights")
        data = response.json()
        assert "suggested_topics" in data
        assert isinstance(data["suggested_topics"], list)
