# Contributing

Guidelines for contributing to NeuroNotes — code style, how to add new features, and the development workflow.

## Table of Contents
- [Code Style](#code-style)
- [Adding a New API Endpoint](#adding-a-new-api-endpoint)
- [Adding a New Frontend Page](#adding-a-new-frontend-page)
- [Adding a New AI Feature](#adding-a-new-ai-feature)
- [Database Changes](#database-changes)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)

---

## Code Style

### Python (Backend)

- Python 3.12+ features are welcome (union types with `|`, PEP 695 type aliases, etc.)
- SQLAlchemy 2.0 style: `Mapped[]` annotations, `mapped_column()`, async sessions
- All route handlers must be `async def`
- External API calls (Gemini SDK) must use `asyncio.to_thread` — never block the event loop
- Type hints on all function signatures
- Short, focused functions — if a function does more than one thing, split it

### TypeScript (Frontend)

- All components use `"use client"` (no server components in this project)
- TypeScript strict mode — no implicit `any`
- Interface names for objects (not `type`): `interface Note { ... }`
- `useCallback` for event handlers passed as props
- Error handling with `.catch(() => {})` for non-critical fetch calls (graceful degradation)

### Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Python functions | `snake_case` | `embed_text`, `create_note` |
| Python classes | `PascalCase` | `Note`, `NoteLink` |
| TypeScript functions | `camelCase` | `handleNewNote`, `loadNotes` |
| TypeScript components | `PascalCase` | `KnowledgeGraph`, `Editor` |
| React hooks | `use` prefix | `useRouter`, `useCallback` |
| CSS variables | `--kebab-case` | `--accent-primary`, `--bg-elevated` |
| API routes | `kebab-case` | `/ai/writing-assist`, `/ai/expand-idea` |

---

## Adding a New API Endpoint

### Step 1: Define the Pydantic schemas

Add request and response models to `backend/schemas.py`:

```python
class MyFeatureRequest(BaseModel):
    text: str
    option: str = "default"

class MyFeatureResponse(BaseModel):
    result: str
    items: list[str] = []
```

### Step 2: Add the route handler

Choose the appropriate router file, or create a new one. For AI features, add to `backend/routers/ai.py`:

```python
from schemas import MyFeatureRequest, MyFeatureResponse

@router.post("/my-feature", response_model=MyFeatureResponse)
async def my_feature(body: MyFeatureRequest):
    system = "You are an AI that does X. Return JSON: {\"result\": ..., \"items\": [...]}"
    data = await gemini.generate_json(body.text, system=system)
    return MyFeatureResponse(
        result=data.get("result", ""),
        items=data.get("items", []),
    )
```

For endpoints requiring database access:
```python
@router.get("/my-data", response_model=MyDataResponse)
async def my_data(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).order_by(Note.updated_at.desc()).limit(10))
    notes = result.scalars().all()
    return MyDataResponse(notes=notes)
```

### Step 3: Register the router (if new file)

In `backend/main.py`:
```python
from routers import notes, search, ai, graph, tags, myrouter

app.include_router(myrouter.router)
```

### Step 4: Add the TypeScript API call

In `frontend/lib/api.ts`, add to the appropriate API object:

```typescript
export const aiApi = {
    // ... existing methods ...
    myFeature: (text: string, option?: string) =>
        api.post<{ result: string; items: string[] }>("/ai/my-feature", { text, option })
           .then(r => r.data),
};
```

### Step 5: Write a test

See [Testing Guidelines](testing.md) for how to write async endpoint tests.

---

## Adding a New Frontend Page

### Step 1: Create the page file

```bash
mkdir -p frontend/app/my-page
touch frontend/app/my-page/page.tsx
```

### Step 2: Write the page component

```typescript
"use client";

import { useState, useEffect } from "react";
import { someApi } from "@/lib/api";

export default function MyPage() {
    const [data, setData] = useState<DataType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        someApi.getData()
            .then(setData)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <span className="loading-spinner" style={{ marginRight: "10px" }} />
                Loading…
            </div>
        );
    }

    return (
        <div style={{ padding: "40px 48px", height: "100%", overflowY: "auto" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "6px" }}>
                My Page
            </h1>
            {/* content */}
        </div>
    );
}
```

### Step 3: Add to the sidebar navigation

In `frontend/components/Sidebar.tsx`, add to the `NAV` array:

```typescript
const NAV = [
    // ... existing items ...
    { label: "My Page", icon: SomeIcon, href: "/my-page", shortcut: null },
];
```

Add the same entry to `MobileNav.tsx` if mobile support is needed.

### Step 4: Use CSS variables for styling

Use existing CSS variables (not Tailwind classes) for consistency with the design system:
```typescript
style={{
    color: "var(--text-primary)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
}}
```

---

## Adding a New AI Feature

### Pattern for JSON-returning features

```python
# backend/routers/ai.py
@router.post("/new-feature", response_model=NewFeatureResponse)
async def new_feature(body: NewFeatureRequest):
    system = (
        "You are an AI that does X. "
        'Return JSON: {"key1": "string", "key2": ["list", "of", "strings"]}'
    )
    data = await gemini.generate_json(body.text, system=system)
    return NewFeatureResponse(
        key1=data.get("key1", ""),
        key2=data.get("key2", []),
    )
```

Key rules:
- Always use `generate_json` for structured output (handles fence stripping + parse errors)
- Always use `.get()` with a safe default — never `data["key"]` (KeyError risk)
- Always include the JSON schema in the system prompt
- Test with short and long inputs

### Pattern for text-returning features

```python
@router.post("/text-feature", response_model=TextFeatureResponse)
async def text_feature(body: TextFeatureRequest):
    prompt = f"Do something with: {body.text}"
    result = await gemini.generate(prompt)
    return TextFeatureResponse(result=result.strip())
```

---

## Database Changes

### For new tables or columns

1. Define the model in `backend/models.py`
2. For fresh installs: `create_all` in `main.py` handles table creation
3. For existing databases: write an Alembic migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "add my_column to notes"
   alembic upgrade head
   ```

### For schema changes in Supabase

Update `supabase/schema.sql` with the additional SQL and document the change.

---

## Testing Guidelines

See [Testing](testing.md) for the full guide.

Summary:
- Test files go in `backend/tests/`
- Use `pytest-asyncio` with `asyncio_mode = auto`
- Use `httpx.AsyncClient` for endpoint testing
- Mock Gemini calls — never call the real API in tests

---

## Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feature/my-feature`
2. Make your changes, following the code style guide above
3. Run tests: `cd backend && pytest tests/ -v`
4. Run type check: `cd frontend && npx tsc --noEmit`
5. Run lint: `cd frontend && npm run lint`
6. Write or update documentation in `docs/` if the change is user-visible
7. Open a PR with a clear title and description of what changed and why
8. Request a review

---

## Related Documents

- [Project Structure](project-structure.md)
- [Testing](testing.md)
- [Architecture Overview](../architecture/overview.md)
