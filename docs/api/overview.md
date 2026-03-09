# API Overview

The NeuroNotes API is a REST API built with FastAPI. It runs on port 8000 and provides endpoints for note management, semantic search, AI features, and knowledge graph operations.

## Table of Contents
- [Base URL](#base-url)
- [Interactive Documentation](#interactive-documentation)
- [Rate Limiting](#rate-limiting)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Error Format](#error-format)
- [Authentication](#authentication)
- [CORS](#cors)
- [Request Tracing](#request-tracing)
- [Endpoint Summary](#endpoint-summary)

---

## Base URL

```
http://localhost:8000
```

In production, replace with your deployed backend URL.

---

## Interactive Documentation

FastAPI generates interactive API docs automatically:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## Rate Limiting

**60 requests per minute** per IP address.

Exceeding the limit returns:
```
HTTP 429 Too Many Requests
```

Configurable via the `RATE_LIMIT` environment variable (format: `"N/period"` where period is `second`, `minute`, `hour`, or `day`).

---

## Request Format

All request bodies use **JSON** with `Content-Type: application/json`, except for voice note uploads which use `multipart/form-data`.

UUIDs are accepted as standard UUID strings (`550e8400-e29b-41d4-a716-446655440000`).

---

## Response Format

All responses are **JSON**. Successful responses have HTTP status codes 200, 201, or 204.

Timestamps use ISO 8601 format with UTC timezone: `"2026-03-09T10:00:00Z"`.

UUIDs are returned as lowercase hyphenated strings.

---

## Error Format

```json
{
  "detail": "Note not found"
}
```

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no body) |
| 404 | Resource not found |
| 422 | Validation error (invalid request body or params) |
| 429 | Rate limit exceeded |
| 500 | Internal server error (DB or Gemini API failure) |

Validation errors (422) include the field path and reason:
```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Authentication

There is **no authentication** on any endpoint. All endpoints are publicly accessible to any client that can reach the server.

Rate limiting (60/min per IP) is the only access control.

For production deployments, consider:
- Adding an API key check in middleware
- Enabling Supabase Row-Level Security with JWT tokens
- Deploying behind a reverse proxy (nginx/Caddy) with IP allowlisting

---

## CORS

Allowed origins are configured via `CORS_ORIGINS` (default: `["http://localhost:3000"]`).

All HTTP methods and headers are allowed (`allow_methods=["*"]`, `allow_headers=["*"]`). Credentials are supported (`allow_credentials=True`).

For production, set `CORS_ORIGINS` to your frontend domain(s).

---

## Request Tracing

Every response includes an `X-Request-ID` header with an 8-character identifier:

```
X-Request-ID: a3f8e12b
```

This can be used to correlate frontend errors with backend logs. The backend logs each request in the format:
```
2026-03-09T10:00:00 [INFO] neuronotes: GET /notes/ 200 (12.3ms) [a3f8e12b]
```

---

## Endpoint Summary

| Router | Prefix | Endpoints |
|--------|--------|-----------|
| Notes | `/notes` | 7 endpoints — CRUD + tag management |
| Search | `/search` | 1 endpoint — semantic search |
| AI | `/ai` | 12 endpoints — all AI features |
| Graph | `/graph` | 2 endpoints — graph data + recompute |
| Tags | `/tags` | 1 endpoint — tag listing |
| Health | `/health` | 1 endpoint — health check |

---

## Related Documents

- [API: Notes](notes.md)
- [API: Search](search.md)
- [API: AI](ai.md)
- [API: Graph](graph.md)
