# API Reference: Notes

All endpoints for note CRUD operations and tag management.

**Base path:** `/notes`

## Table of Contents
- [List Notes](#list-notes)
- [Create Note](#create-note)
- [Get Note](#get-note)
- [Update Note](#update-note)
- [Delete Note](#delete-note)
- [Add Tag](#add-tag)
- [Remove Tag](#remove-tag)
- [Schemas](#schemas)

---

## List Notes

```
GET /notes/
```

Returns all notes ordered by `updated_at` descending (most recently modified first).

### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Machine Learning Fundamentals",
    "created_at": "2026-03-01T08:00:00Z",
    "updated_at": "2026-03-09T10:00:00Z",
    "tags": [
      {"id": "660e8400-e29b-41d4-a716-446655440001", "name": "ml"},
      {"id": "770e8400-e29b-41d4-a716-446655440002", "name": "ai"}
    ]
  }
]
```

Returns `NoteListItem[]` (no `content` or `embedding` fields for efficiency).

### Example

```bash
curl http://localhost:8000/notes/
```

---

## Create Note

```
POST /notes/
```

Creates a new note. Triggers background embedding generation and graph link computation.

### Request Body

```json
{
  "title": "My New Note",
  "content": "<p>Hello world</p>"
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | No | `"Untitled"` |
| `content` | string | No | `""` |

### Response

```
HTTP 201 Created
Content-Type: application/json
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My New Note",
  "content": "<p>Hello world</p>",
  "created_at": "2026-03-09T10:00:00Z",
  "updated_at": "2026-03-09T10:00:00Z",
  "tags": []
}
```

Returns `NoteRead` (includes `content`).

### Example

```bash
curl -X POST http://localhost:8000/notes/ \
  -H "Content-Type: application/json" \
  -d '{"title": "My New Note", "content": "<p>Hello world</p>"}'
```

---

## Get Note

```
GET /notes/{note_id}
```

Returns a single note including its full content and tags.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note identifier |

### Response

```
HTTP 200 OK
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Machine Learning Fundamentals",
  "content": "<h1>Introduction</h1><p>Machine learning is...</p>",
  "created_at": "2026-03-01T08:00:00Z",
  "updated_at": "2026-03-09T10:00:00Z",
  "tags": [
    {"id": "660e8400-e29b-41d4-a716-446655440001", "name": "ml"}
  ]
}
```

### Errors

```
HTTP 404 Not Found
{"detail": "Note not found"}
```

### Example

```bash
curl http://localhost:8000/notes/550e8400-e29b-41d4-a716-446655440000
```

---

## Update Note

```
PUT /notes/{note_id}
```

Partially updates a note. Only provided fields are changed. Triggers background embedding regeneration.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note identifier |

### Request Body

All fields are optional (partial update):

```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>"
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `content` | string | No |

### Response

```
HTTP 200 OK
```

Returns the updated `NoteRead` object.

### Example

```bash
curl -X PUT http://localhost:8000/notes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
```

---

## Delete Note

```
DELETE /notes/{note_id}
```

Permanently deletes a note. Cascades to `note_tags` and `note_links`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note identifier |

### Response

```
HTTP 204 No Content
```

No body on success.

### Errors

```
HTTP 404 Not Found
{"detail": "Note not found"}
```

### Example

```bash
curl -X DELETE http://localhost:8000/notes/550e8400-e29b-41d4-a716-446655440000
```

---

## Add Tag

```
POST /notes/{note_id}/tags/{tag_name}
```

Adds a tag to a note. Creates the tag if it does not already exist (get-or-create). Idempotent — adding a tag that's already attached has no effect.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note identifier |
| `tag_name` | string | Tag name (should be lowercase, hyphenated) |

### Response

```
HTTP 200 OK
```

Returns the updated `NoteRead` object with the new tag in `tags[]`.

### Example

```bash
curl -X POST http://localhost:8000/notes/550e8400-e29b-41d4-a716-446655440000/tags/machine-learning
```

---

## Remove Tag

```
DELETE /notes/{note_id}/tags/{tag_name}
```

Removes a tag from a note. The tag itself is preserved in the `tags` table if other notes use it.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note identifier |
| `tag_name` | string | Tag name to remove |

### Response

```
HTTP 200 OK
```

Returns the updated `NoteRead` with the tag removed from `tags[]`.

### Errors

```
HTTP 404 Not Found
{"detail": "Note not found"}
{"detail": "Tag not found"}
```

### Example

```bash
curl -X DELETE http://localhost:8000/notes/550e8400-e29b-41d4-a716-446655440000/tags/machine-learning
```

---

## Schemas

### NoteCreate (request)

```json
{
  "title": "string (default: 'Untitled')",
  "content": "string (default: '')"
}
```

### NoteUpdate (request)

```json
{
  "title": "string | null",
  "content": "string | null"
}
```

### NoteRead (response — full note)

```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "created_at": "datetime",
  "updated_at": "datetime",
  "tags": [TagRead]
}
```

### NoteListItem (response — list/search items)

```json
{
  "id": "uuid",
  "title": "string",
  "created_at": "datetime",
  "updated_at": "datetime",
  "tags": [TagRead]
}
```

### TagRead

```json
{
  "id": "uuid",
  "name": "string"
}
```

---

## Related Documents

- [API Overview](overview.md)
- [Features: Notes](../features/notes.md)
- [Dataflow: Note Creation](../dataflow/note-creation.md)
