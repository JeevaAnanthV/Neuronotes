"use client";

import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    type Node as RFNode,
    type Edge as RFEdge,
    MarkerType,
    useNodesState,
    useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEffect, useState, useCallback, useRef } from "react";
import { graphApi, tagsApi, type GraphData, type TagWithCount } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, RotateCcw, ChevronDown } from "lucide-react";

interface NodeTooltip {
    nodeId: string;
    title: string;
    tags: string[];
    x: number;
    y: number;
}

function buildNodes(data: GraphData, filterTag: string | null): { nodes: RFNode[]; edges: RFEdge[] } {
    const filteredNodes = filterTag
        ? data.nodes.filter((n) => n.tags.includes(filterTag))
        : data.nodes;

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    const count = filteredNodes.length;
    const radius = Math.max(220, count * 55);

    const rfNodes: RFNode[] = filteredNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / count;
        return {
            id: n.id,
            position: {
                x: 450 + radius * Math.cos(angle),
                y: 320 + radius * Math.sin(angle),
            },
            data: { label: n.title || "Untitled", tags: n.tags },
            style: {
                background: "#121212",
                border: `1px solid ${n.tags.length > 0 ? "rgba(99,102,241,0.45)" : "#2a2a2a"}`,
                borderRadius: "10px",
                padding: "10px 14px",
                color: "#EAEAEA",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                maxWidth: "160px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                transition: "box-shadow 120ms ease, border-color 120ms ease",
            },
        };
    });

    const rfEdges: RFEdge[] = data.edges
        .filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
        .map((e) => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            animated: e.similarity > 0.87,
            style: {
                stroke: `rgba(99, 102, 241, ${Math.min(0.8, e.similarity * 0.9)})`,
                strokeWidth: Math.max(1, e.similarity * 3),
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(99,102,241,0.5)" },
            label: e.similarity > 0.9 ? `${(e.similarity * 100).toFixed(0)}%` : undefined,
            labelStyle: { fill: "#A1A1A1", fontSize: "10px" },
            labelBgStyle: { fill: "#1A1A1A", fillOpacity: 0.8 },
        }));

    return { nodes: rfNodes, edges: rfEdges };
}

export function KnowledgeGraph() {
    const router = useRouter();
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [recomputing, setRecomputing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [allTags, setAllTags] = useState<TagWithCount[]>([]);
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [tooltip, setTooltip] = useState<NodeTooltip | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadGraph = useCallback(async () => {
        setLoading(true);
        try {
            const data: GraphData = await graphApi.get();
            setGraphData(data);
            const { nodes: rfNodes, edges: rfEdges } = buildNodes(data, filterTag);
            setNodes(rfNodes);
            setEdges(rfEdges);
        } catch {
            setNodes([]);
            setEdges([]);
        } finally {
            setLoading(false);
        }
    }, [filterTag, setNodes, setEdges]);

    useEffect(() => {
        loadGraph();
        tagsApi.list().then(setAllTags).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refilter when tag changes
    useEffect(() => {
        if (!graphData) return;
        const { nodes: rfNodes, edges: rfEdges } = buildNodes(graphData, filterTag);
        setNodes(rfNodes);
        setEdges(rfEdges);
    }, [filterTag, graphData, setNodes, setEdges]);

    // Search highlighting
    useEffect(() => {
        if (!graphData) return;
        if (!searchQuery.trim()) {
            const { nodes: rfNodes, edges: rfEdges } = buildNodes(graphData, filterTag);
            setNodes(rfNodes);
            setEdges(rfEdges);
            return;
        }
        const q = searchQuery.toLowerCase();
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    opacity: (n.data.label as string).toLowerCase().includes(q) ? 1 : 0.25,
                    border: (n.data.label as string).toLowerCase().includes(q)
                        ? "1.5px solid var(--accent-primary)"
                        : "1px solid #2a2a2a",
                    boxShadow: (n.data.label as string).toLowerCase().includes(q)
                        ? "0 0 16px rgba(99,102,241,0.4)"
                        : "none",
                },
            }))
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, graphData]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as globalThis.Node)) {
                setTagDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleRecompute = async () => {
        setRecomputing(true);
        try {
            await graphApi.recompute();
            await loadGraph();
        } catch {
            alert("Backend unavailable");
        } finally {
            setRecomputing(false);
        }
    };

    const handleReset = () => {
        setSearchQuery("");
        setFilterTag(null);
        setTagDropdownOpen(false);
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                <span className="loading-spinner" style={{ marginRight: "10px" }} />
                Building knowledge graph…
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="empty-state">
                <GitBranchIcon />
                <div className="empty-state-title">No graph yet</div>
                <p className="empty-state-sub">
                    Create notes and click &quot;Build Graph&quot; to visualise your knowledge network.
                </p>
                <button className="btn btn-primary" onClick={handleRecompute} disabled={recomputing}>
                    {recomputing ? <span className="loading-spinner" /> : null}
                    Build Graph
                </button>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {/* Controls bar */}
            <div style={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 12,
                display: "flex",
                gap: "8px",
                zIndex: 10,
                alignItems: "center",
            }}>
                {/* Search */}
                <div style={{ position: "relative", flex: "0 0 200px" }}>
                    <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search nodes…"
                        style={{
                            width: "100%",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "7px 12px 7px 30px",
                            color: "var(--text-primary)",
                            fontSize: "12.5px",
                            fontFamily: "Inter, sans-serif",
                            outline: "none",
                            boxShadow: "var(--shadow-sm)",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                </div>

                {/* Tag filter */}
                <div ref={dropdownRef} style={{ position: "relative" }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "var(--bg-elevated)",
                            boxShadow: "var(--shadow-sm)",
                            color: filterTag ? "var(--accent-primary)" : "var(--text-secondary)",
                            borderColor: filterTag ? "var(--accent-primary)" : "var(--border)",
                        }}
                        onClick={() => setTagDropdownOpen((o) => !o)}
                    >
                        {filterTag ? `#${filterTag}` : "Filter by tag"}
                        <ChevronDown size={12} />
                    </button>
                    {tagDropdownOpen && (
                        <div style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-md)",
                            padding: "4px",
                            minWidth: "150px",
                            boxShadow: "var(--shadow-md)",
                            zIndex: 20,
                            animation: "fadeIn 0.12s ease",
                        }}>
                            <div
                                onClick={() => { setFilterTag(null); setTagDropdownOpen(false); }}
                                style={{
                                    padding: "8px 12px",
                                    fontSize: "13px",
                                    color: !filterTag ? "var(--accent-primary)" : "var(--text-secondary)",
                                    borderRadius: "7px",
                                    cursor: "pointer",
                                    background: !filterTag ? "var(--accent-dim)" : "transparent",
                                }}
                                onMouseEnter={(e) => { if (filterTag) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                                onMouseLeave={(e) => { if (filterTag) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                                All notes
                            </div>
                            {allTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    onClick={() => { setFilterTag(tag.name); setTagDropdownOpen(false); }}
                                    style={{
                                        padding: "8px 12px",
                                        fontSize: "13px",
                                        color: filterTag === tag.name ? "var(--accent-primary)" : "var(--text-secondary)",
                                        borderRadius: "7px",
                                        cursor: "pointer",
                                        background: filterTag === tag.name ? "var(--accent-dim)" : "transparent",
                                    }}
                                    onMouseEnter={(e) => { if (filterTag !== tag.name) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                                    onMouseLeave={(e) => { if (filterTag !== tag.name) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                    #{tag.name}
                                    <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px" }}>{tag.note_count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleReset}
                        style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)" }}
                        title="Reset filters"
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={loadGraph}
                        style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)" }}
                        title="Refresh graph"
                    >
                        <RefreshCw size={12} />
                        Refresh
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleRecompute}
                        disabled={recomputing}
                        style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)" }}
                    >
                        {recomputing ? <span className="loading-spinner" style={{ width: 12, height: 12 }} /> : <RefreshCw size={12} />}
                        Rebuild
                    </button>
                </div>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                onNodeClick={(_, node) => router.push(`/notes/${node.id}`)}
                onNodeMouseEnter={(event, node) => {
                    const rect = (event.target as HTMLElement).getBoundingClientRect();
                    setTooltip({
                        nodeId: node.id,
                        title: node.data.label as string,
                        tags: (node.data.tags as string[]) || [],
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                    });
                    // Glow effect
                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === node.id
                                ? {
                                    ...n,
                                    style: {
                                        ...n.style,
                                        boxShadow: "0 0 20px rgba(99,102,241,0.5)",
                                        borderColor: "rgba(99,102,241,0.8)",
                                    },
                                }
                                : n
                        )
                    );
                }}
                onNodeMouseLeave={(_, node) => {
                    setTooltip(null);
                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === node.id
                                ? {
                                    ...n,
                                    style: {
                                        ...n.style,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                        borderColor: (n.data.tags as string[])?.length > 0
                                            ? "rgba(99,102,241,0.45)"
                                            : "#2a2a2a",
                                    },
                                }
                                : n
                        )
                    );
                }}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#2a2a2a" gap={24} />
                <Controls
                    style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                />
                <MiniMap
                    nodeColor="var(--accent-primary)"
                    maskColor="rgba(10,10,10,0.7)"
                    style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-sm)",
                    }}
                />
            </ReactFlow>

            {/* Node tooltip */}
            {tooltip && (
                <div style={{
                    position: "fixed",
                    left: tooltip.x,
                    top: tooltip.y,
                    transform: "translate(-50%, -100%)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 9999,
                    pointerEvents: "none",
                    animation: "fadeIn 0.1s ease",
                    maxWidth: "200px",
                }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>
                        {tooltip.title}
                    </div>
                    {tooltip.tags.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--accent-primary)" }}>
                            {tooltip.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
                        </div>
                    )}
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                        Click to open note
                    </div>
                </div>
            )}
        </div>
    );
}

// Inline SVG icon to avoid import issues
function GitBranchIcon() {
    return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, color: "var(--text-muted)" }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 01-9 9" />
        </svg>
    );
}
