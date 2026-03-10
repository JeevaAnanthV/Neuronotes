"use client";

import ReactFlow, {
    Background,
    Controls,
    type Node as RFNode,
    type Edge as RFEdge,
    useNodesState,
    useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEffect, useState, useCallback, useRef } from "react";
import { graphApi, type GraphData } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";

interface NodeTooltip {
    nodeId: string;
    title: string;
    tags: string[];
    x: number;
    y: number;
}

const NODE_LIMIT = 50;

// Clean minimal node style — small filled dot, label only on hover
function buildNodes(data: GraphData, filterTag: string | null, highlightQuery: string): { nodes: RFNode[]; edges: RFEdge[] } {
    const filteredNodes = (filterTag
        ? data.nodes.filter((n) => n.tags.includes(filterTag))
        : data.nodes).slice(0, NODE_LIMIT);

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const count = filteredNodes.length;
    const radius = Math.max(200, count * 50);
    const q = highlightQuery.toLowerCase();

    const rfNodes: RFNode[] = filteredNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / count;
        const isHighlighted = q ? n.title.toLowerCase().includes(q) : false;
        const dimmed = q && !isHighlighted;

        return {
            id: n.id,
            position: {
                x: 440 + radius * Math.cos(angle),
                y: 300 + radius * Math.sin(angle),
            },
            data: { label: n.title || "Untitled", tags: n.tags },
            style: {
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: isHighlighted ? "#6366F1" : dimmed ? "#2A2A2A" : "#383838",
                border: isHighlighted ? "2px solid #6366F1" : "1.5px solid #2A2A2A",
                boxShadow: isHighlighted ? "0 0 12px rgba(99,102,241,0.5)" : "none",
                opacity: dimmed ? 0.3 : 1,
                cursor: "pointer",
                padding: 0,
                transition: "all 150ms ease",
            },
        };
    });

    const rfEdges: RFEdge[] = data.edges
        .filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
        .map((e) => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            style: {
                stroke: "rgba(99,102,241,0.25)",
                strokeWidth: 0.5,
            },
            markerEnd: undefined,
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
    const [tooltip, setTooltip] = useState<NodeTooltip | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const loadGraph = useCallback(async () => {
        setLoading(true);
        try {
            const data: GraphData = await graphApi.get();
            setGraphData(data);
            const { nodes: rfNodes, edges: rfEdges } = buildNodes(data, null, "");
            setNodes(rfNodes);
            setEdges(rfEdges);
        } catch {
            setNodes([]);
            setEdges([]);
        } finally {
            setLoading(false);
        }
    }, [setNodes, setEdges]);

    useEffect(() => { loadGraph(); }, [loadGraph]);

    // Search highlighting
    useEffect(() => {
        if (!graphData) return;
        const { nodes: rfNodes, edges: rfEdges } = buildNodes(graphData, null, searchQuery);
        setNodes(rfNodes);
        setEdges(rfEdges);
    }, [searchQuery, graphData, setNodes, setEdges]);

    const handleRecompute = async () => {
        setRecomputing(true);
        try {
            await graphApi.recompute();
            await loadGraph();
        } catch {
            // Backend unavailable — recomputing state resets, graph unchanged
        } finally {
            setRecomputing(false);
        }
    };

    if (loading) {
        return (
            <div style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-primary)", overflow: "hidden" }}>
                {/* Skeleton dots simulating graph nodes */}
                {[
                    { top: "35%", left: "50%", size: 12 },
                    { top: "25%", left: "35%", size: 10 },
                    { top: "50%", left: "30%", size: 10 },
                    { top: "20%", left: "60%", size: 8 },
                    { top: "60%", left: "55%", size: 10 },
                    { top: "45%", left: "70%", size: 8 },
                    { top: "70%", left: "40%", size: 8 },
                ].map((node, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        top: node.top,
                        left: node.left,
                        width: node.size,
                        height: node.size,
                        borderRadius: "50%",
                        background: "var(--bg-tertiary)",
                        transform: "translate(-50%, -50%)",
                        animation: `skeletonPulse 1.4s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                ))}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px", gap: "8px" }}>
                    <span className="loading-spinner" style={{ width: 12, height: 12 }} />
                    Loading graph…
                </div>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="empty-state">
                <GitBranchSvg />
                <div className="empty-state-title">No graph yet</div>
                <p className="empty-state-sub">
                    Create notes and click &quot;Build Graph&quot; to visualise your knowledge network.
                </p>
                <button className="btn btn-primary" onClick={handleRecompute} disabled={recomputing}>
                    {recomputing ? <span className="loading-spinner" /> : <RefreshCw size={13} />}
                    Build Graph
                </button>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%", minHeight: "400px", position: "relative", background: "var(--bg-primary)" }}>
            {/* Minimal controls — top-right only */}
            <div style={{
                position: "absolute",
                top: 14,
                right: 14,
                display: "flex",
                gap: "7px",
                zIndex: 10,
                alignItems: "center",
            }}>
                {/* Search */}
                <div style={{ position: "relative" }}>
                    <Search size={12} style={{
                        position: "absolute", left: "9px", top: "50%",
                        transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none",
                    }} />
                    <input
                        ref={searchRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter nodes…"
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "6px 10px 6px 27px",
                            color: "var(--text-primary)",
                            fontSize: "12px",
                            fontFamily: "inherit",
                            outline: "none",
                            width: "170px",
                            boxShadow: "var(--shadow-sm)",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                </div>

                <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleRecompute}
                    disabled={recomputing}
                    style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)", minHeight: 0, padding: "5px 10px" }}
                    title="Recompute graph"
                >
                    {recomputing ? <span className="loading-spinner" style={{ width: 11, height: 11 }} /> : <RefreshCw size={11} />}
                    Recompute
                </button>
                {graphData && graphData.nodes.length > NODE_LIMIT && (
                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
                        Showing {NODE_LIMIT} of {graphData.nodes.length} nodes
                    </div>
                )}
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                onNodeClick={(_, node) => router.push(`/notes/${node.id}`)}
                onNodeMouseEnter={(event, node) => {
                    const target = event.target as HTMLElement;
                    const rect = target.getBoundingClientRect();
                    setTooltip({
                        nodeId: node.id,
                        title: node.data.label as string,
                        tags: (node.data.tags as string[]) || [],
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                    });
                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === node.id
                                ? { ...n, style: { ...n.style, background: "#6366F1", boxShadow: "0 0 14px rgba(99,102,241,0.55)", border: "2px solid #6366F1" } }
                                : n
                        )
                    );
                    setEdges((eds) =>
                        eds.map((e) =>
                            e.source === node.id || e.target === node.id
                                ? { ...e, style: { stroke: "rgba(99,102,241,0.7)", strokeWidth: 1.5 } }
                                : e
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
                                        background: "#383838",
                                        boxShadow: "none",
                                        border: "1.5px solid #2A2A2A",
                                    },
                                }
                                : n
                        )
                    );
                    setEdges((eds) =>
                        eds.map((e) =>
                            e.source === node.id || e.target === node.id
                                ? { ...e, style: { stroke: "rgba(99,102,241,0.25)", strokeWidth: 0.5 } }
                                : e
                        )
                    );
                }}
                proOptions={{ hideAttribution: true }}
                style={{ background: "var(--bg-primary)" }}
            >
                <Background color="#1A1A1A" gap={28} size={1} />
                <Controls
                    style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-sm)",
                        bottom: 14,
                        left: 14,
                    }}
                />
            </ReactFlow>

            {/* Node tooltip — shows on hover */}
            {tooltip && (
                <div style={{
                    position: "fixed",
                    left: tooltip.x,
                    top: tooltip.y,
                    transform: "translate(-50%, -100%)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-md)",
                    padding: "7px 11px",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 9999,
                    pointerEvents: "none",
                    animation: "fadeIn 0.1s var(--ease)",
                    maxWidth: "200px",
                }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                        {tooltip.title}
                    </div>
                    {tooltip.tags.length > 0 && (
                        <div style={{ fontSize: "10.5px", color: "var(--accent-primary)" }}>
                            {tooltip.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
                        </div>
                    )}
                    <div style={{ fontSize: "9.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Click to open
                    </div>
                </div>
            )}
        </div>
    );
}

function GitBranchSvg() {
    return (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, color: "var(--text-muted)" }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 01-9 9" />
        </svg>
    );
}
