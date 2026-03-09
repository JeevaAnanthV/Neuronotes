# Feature: Knowledge Graph

The Knowledge Graph visualizes semantic connections between notes as an interactive node-link diagram. Nodes are notes; edges represent cosine similarity between their embeddings.

## Table of Contents
- [Accessing the Graph](#accessing-the-graph)
- [Graph Visualization](#graph-visualization)
- [Node Design](#node-design)
- [Edge Design](#edge-design)
- [Interactivity](#interactivity)
- [Filtering and Search](#filtering-and-search)
- [Building the Graph](#building-the-graph)
- [Performance Considerations](#performance-considerations)

---

## Accessing the Graph

- **Navigation**: Sidebar → "Graph" or click the Knowledge Map card on the dashboard
- **URL**: `/graph`
- **Keyboard**: No dedicated shortcut; accessible via command palette → "Open Knowledge Graph"

---

## Graph Visualization

The graph page renders the `KnowledgeGraph` component which uses **React Flow v11**.

```
┌─────────────────────────────────────────────────┐
│  [Search nodes...]  [Filter by tag ▼]   [Reset] [Refresh] [Rebuild]  │
│                                                                        │
│                    ●────────●                                          │
│                   / \      /│                                          │
│                  ●   ●────● │                                          │
│                   \       │ │                                          │
│                    ●──────● │                                          │
│                             │                                          │
│                         ┌───────────────┐                              │
│                         │ Note Title    │    (tooltip on hover)        │
│                         │ #tag1 #tag2   │                              │
│                         │ Click to open │                              │
│                         └───────────────┘                              │
│  [Controls: zoom+/zoom-/fit]           [MiniMap]                       │
└─────────────────────────────────────────────────┘
```

The initial layout arranges nodes in a circle. React Flow then allows dragging nodes to custom positions (not persisted — refreshing resets to circular layout).

---

## Node Design

Each node (`GraphNode`) represents one note.

```typescript
// frontend/components/KnowledgeGraph.tsx:37-61
{
    background: "#121212",
    border: `1px solid ${n.tags.length > 0 ? "rgba(99,102,241,0.45)" : "#2a2a2a"}`,
    borderRadius: "10px",
    padding: "10px 14px",
    color: "#EAEAEA",
    fontSize: "13px",
    fontWeight: 500,
    maxWidth: "160px",
}
```

| Node state | Visual |
|-----------|--------|
| Default (untagged) | Dark background, dim gray border |
| Tagged | Indigo border at 45% opacity |
| Hovered | Purple glow (0 0 20px rgba(99,102,241,0.5)), brighter border |
| Search match | Full opacity, highlighted border with box shadow |
| Search non-match | 25% opacity, dark border |

---

## Edge Design

Each edge (`GraphEdge`) encodes the cosine similarity between two notes visually:

| Property | Encoding |
|----------|---------|
| Stroke opacity | `min(0.8, similarity * 0.9)` — more opaque = more similar |
| Stroke width | `max(1, similarity * 3)` — thicker = more similar |
| Animation | Flowing dash when similarity > 0.87 |
| Label | Similarity percentage shown when similarity > 0.90 |
| Arrow | Closed arrow at target end (React Flow `MarkerType.ArrowClosed`) |

The graph is stored as undirected pairs (`a.id < b.id` in DB), but rendered with directional arrows for visual clarity. The "direction" has no semantic meaning.

---

## Interactivity

### Click node
Navigates to the note: `router.push(`/notes/${node.id}`)`.

### Hover node
1. Shows a tooltip above the node:
   ```
   ┌─────────────────┐
   │ Machine Learning│
   │ #ml #ai         │
   │ Click to open   │
   └─────────────────┘
   ```
2. Applies glow effect to the hovered node
3. Restores normal style when cursor leaves

### Drag nodes
React Flow allows dragging nodes to custom positions within the canvas session (not persisted).

### Zoom/Pan
- Scroll to zoom, drag background to pan
- Built-in Controls widget (bottom-left): zoom in, zoom out, fit view
- MiniMap (bottom-right): shows all nodes at reduced scale

---

## Filtering and Search

### Node search
The search input in the controls bar filters nodes by title substring (client-side):
```typescript
// frontend/components/KnowledgeGraph.tsx:130-153
setNodes(nds => nds.map(n => ({
    ...n,
    style: {
        ...n.style,
        opacity: n.data.label.toLowerCase().includes(q) ? 1 : 0.25,
        border: n.data.label.toLowerCase().includes(q)
            ? "1.5px solid var(--accent-primary)"
            : "1px solid #2a2a2a",
        boxShadow: n.data.label.toLowerCase().includes(q)
            ? "0 0 16px rgba(99,102,241,0.4)"
            : "none",
    },
})));
```

Non-matching nodes are dimmed to 25% opacity. Edges to/from non-matching nodes remain visible.

### Tag filter
The "Filter by tag" dropdown loads all tags from `GET /tags/`. Selecting a tag shows only notes that have that tag, and hides edges to excluded nodes:
```typescript
// frontend/components/KnowledgeGraph.tsx:27-81
const filteredNodes = filterTag
    ? data.nodes.filter(n => n.tags.includes(filterTag))
    : data.nodes;

const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
const rfEdges = data.edges
    .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
    .map(...);
```

### Reset
The Reset button clears both the search query and the tag filter.

---

## Building the Graph

### Automatic (background)
Every note save triggers `recompute_links_for_note` in the background, which updates edges for that note against all other notes with similarity ≥ 0.75.

### Manual rebuild
The "Rebuild" button in the graph controls calls `POST /graph/recompute` with threshold 0.72. This wipes all `note_links` rows and recomputes all pairs. Use this when:
- Many notes have been imported at once
- The threshold was changed
- Some edges are missing or stale

Also available from: Settings page → "Rebuild Knowledge Graph".

### Empty state
If there are no nodes (no notes with embeddings), the graph shows an empty state with a "Build Graph" button that triggers a full rebuild.

---

## Performance Considerations

The graph fetches all notes and all edges in a single request (`GET /graph/`). For large knowledge bases:

| Notes | Expected behavior |
|-------|------------------|
| < 100 | Fast, no issues |
| 100–500 | Slightly slower initial load, circular layout may look dense |
| 500+ | `GET /graph/` returns a large payload; consider adding filters |

For dense graphs (many edges), React Flow may have rendering performance overhead. The circular layout algorithm positions nodes every time the component re-renders (on filter/search changes) — this is fast for < 500 nodes.

---

## Related Documents

- [Architecture: Database](../architecture/database.md)
- [Dataflow: Knowledge Graph](../dataflow/knowledge-graph.md)
- [API Reference: Graph](../api/graph.md)
- [Features: Search](search.md)
