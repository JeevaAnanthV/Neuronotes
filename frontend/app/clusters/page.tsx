"use client";

import { useEffect, useState } from "react";
import { aiApi } from "@/lib/api";
import { Layers, FileText, Tag } from "lucide-react";

interface Cluster {
    topic: string;
    note_ids: string[];
    notes: { id: string; title: string }[];
    count: number;
}

export default function ClustersPage() {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<string | null>(null);

    useEffect(() => {
        aiApi.clusters()
            .then(d => setClusters(d.clusters))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
                <span className="loading-spinner" style={{ width: 32, height: 32 }} />
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading topic clusters...</span>
            </div>
        );
    }

    if (clusters.length === 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "16px", padding: "40px", textAlign: "center" }}>
                <Layers size={48} color="var(--accent-primary)" />
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>No Topic Clusters Yet</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "320px", margin: 0 }}>
                    Add tags to your notes — topic clusters are automatically generated from your tags.
                </p>
            </div>
        );
    }

    const displayClusters = active
        ? clusters.filter(c => c.topic === active)
        : clusters;

    return (
        <div style={{ padding: "32px", height: "100%", overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                <Layers size={20} color="var(--accent-primary)" />
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Topic Clusters</h1>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    {clusters.length} topics
                </span>
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "24px" }}>
                <button
                    onClick={() => setActive(null)}
                    style={{
                        padding: "4px 12px",
                        borderRadius: "12px",
                        border: `1px solid ${active === null ? "var(--accent-primary)" : "var(--border)"}`,
                        background: active === null ? "var(--accent-dim)" : "var(--bg-tertiary)",
                        color: active === null ? "var(--accent-primary)" : "var(--text-secondary)",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: active === null ? 600 : 400,
                    }}
                >
                    All
                </button>
                {clusters.map(c => (
                    <button
                        key={c.topic}
                        onClick={() => setActive(active === c.topic ? null : c.topic)}
                        style={{
                            padding: "4px 12px",
                            borderRadius: "12px",
                            border: `1px solid ${active === c.topic ? "var(--accent-primary)" : "var(--border)"}`,
                            background: active === c.topic ? "var(--accent-dim)" : "var(--bg-tertiary)",
                            color: active === c.topic ? "var(--accent-primary)" : "var(--text-secondary)",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontWeight: active === c.topic ? 600 : 400,
                        }}
                    >
                        #{c.topic} <span style={{ opacity: 0.65 }}>({c.count})</span>
                    </button>
                ))}
            </div>

            {/* Cluster grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
                {displayClusters.map(c => (
                    <div
                        key={c.topic}
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-lg, 14px)",
                            padding: "18px 20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            transition: "border-color 150ms",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                        {/* Topic header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <Tag size={13} color="var(--accent-primary)" />
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                                    #{c.topic}
                                </span>
                            </div>
                            <span style={{
                                fontSize: "11px",
                                background: "var(--accent-dim)",
                                color: "var(--accent-primary)",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontWeight: 600,
                            }}>
                                {c.count} note{c.count !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* Top notes */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {c.notes.slice(0, 3).map(n => (
                                <a
                                    key={n.id}
                                    href={`/notes/${n.id}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "7px",
                                        padding: "5px 8px",
                                        borderRadius: "7px",
                                        background: "var(--bg-tertiary)",
                                        textDecoration: "none",
                                        transition: "background 100ms",
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                                >
                                    <FileText size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: "12.5px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {n.title || "Untitled"}
                                    </span>
                                </a>
                            ))}
                            {c.count > 3 && (
                                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", paddingLeft: "8px" }}>
                                    +{c.count - 3} more note{c.count - 3 !== 1 ? "s" : ""}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
