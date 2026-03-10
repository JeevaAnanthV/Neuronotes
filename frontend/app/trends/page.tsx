"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { api, type NoteListItem } from "@/lib/api";
import { TrendingUp, Loader2, GitBranch, Activity, Lightbulb } from "lucide-react";

interface TrendsData {
    trending_topics: { topic: string; count: number; notes: { id: string; title: string }[] }[];
    most_connected: { id: string; title: string; connections: number }[];
    activity_heatmap: { date: string; count: number }[];
}

function HeatmapCell({ count }: { count: number }) {
    const opacity = count === 0 ? 0.06 : Math.min(0.15 + count * 0.25, 1);
    return (
        <div
            style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: `rgba(99, 102, 241, ${opacity})`,
            }}
            title={`${count} note${count !== 1 ? "s" : ""}`}
        />
    );
}

export default function TrendsPage() {
    const [data, setData] = useState<TrendsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get<TrendsData>("/ai/trends");
                setData(res.data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <div className="editor-shell">
            <div className="editor-topbar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <TrendingUp size={17} style={{ color: "var(--accent-primary)" }} />
                    <div>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Technical Trend Intelligence</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Insights derived from your own notes</div>
                    </div>
                </div>
            </div>

            <div className="editor-content">
                <div className="editor-body">
                    {loading && (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "40px 0", color: "var(--text-muted)" }}>
                            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                            Analysing your notes…
                        </div>
                    )}

                    {error && !loading && (
                        <div style={{ padding: "40px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                            Could not load trends. Make sure the backend is running.
                        </div>
                    )}

                    {data && !loading && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                            {/* Section 1: Trending Topics */}
                            <section>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                                    <TrendingUp size={15} style={{ color: "var(--accent-primary)" }} />
                                    <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                        Trending Topics in Your Notes
                                    </h2>
                                </div>
                                {data.trending_topics.length === 0 ? (
                                    <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No topic clusters found yet. Add tags to your notes.</p>
                                ) : (
                                    <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                                        {data.trending_topics.map((topic) => (
                                            <div key={topic.topic} style={{
                                                background: "var(--bg-elevated)",
                                                border: "1px solid var(--border)",
                                                borderRadius: "var(--radius-md)",
                                                padding: "14px 16px",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                                                        #{topic.topic}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "11px",
                                                        background: "rgba(99,102,241,0.12)",
                                                        color: "var(--accent-primary)",
                                                        borderRadius: "var(--radius-sm)",
                                                        padding: "2px 7px",
                                                        fontWeight: 600,
                                                    }}>
                                                        {topic.count} note{topic.count !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                                    {topic.notes.slice(0, 3).map((n) => (
                                                        <a key={n.id} href={`/notes/${n.id}`} style={{ fontSize: "11.5px", color: "var(--text-muted)", textDecoration: "none" }}>
                                                            {n.title || "Untitled"}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Section 2: Most Connected Concepts */}
                            <section>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                                    <GitBranch size={15} style={{ color: "var(--accent-primary)" }} />
                                    <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                        Most Connected Concepts
                                    </h2>
                                </div>
                                {data.most_connected.length === 0 ? (
                                    <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                        No graph links yet. Click &quot;Recompute&quot; on the Knowledge Graph page.
                                    </p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {data.most_connected.map((node, i) => (
                                            <div key={node.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "20px", textAlign: "right" }}>{i + 1}</span>
                                                <div style={{ flex: 1, background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", height: "6px", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%",
                                                        width: `${Math.min(100, (node.connections / (data.most_connected[0]?.connections || 1)) * 100)}%`,
                                                        background: "var(--accent-primary)",
                                                        borderRadius: "var(--radius-sm)",
                                                        opacity: 0.7 + i * -0.06,
                                                    }} />
                                                </div>
                                                <a href={`/notes/${node.id}`} style={{ fontSize: "12.5px", color: "var(--text-primary)", textDecoration: "none", minWidth: "140px" }}>
                                                    {node.title || "Untitled"}
                                                </a>
                                                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                                                    {node.connections} link{node.connections !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Section 3: Activity Heatmap */}
                            <section>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                                    <Activity size={15} style={{ color: "var(--accent-primary)" }} />
                                    <h2 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                        Note Activity (Last 12 Weeks)
                                    </h2>
                                </div>
                                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                                    {data.activity_heatmap.map((day) => (
                                        <HeatmapCell key={day.date} count={day.count} />
                                    ))}
                                </div>
                                <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                                    Each cell = one day. Darker = more notes written.
                                </div>
                            </section>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
