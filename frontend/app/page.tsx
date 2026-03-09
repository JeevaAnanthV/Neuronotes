"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notesApi, aiApi, type NoteListItem, type InsightsData } from "@/lib/api";
import { FileText, GitBranch, Sparkles, Plus, ArrowRight, Clock } from "lucide-react";

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<NoteListItem[]>([]);
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        Promise.all([
            notesApi.list().catch(() => [] as NoteListItem[]),
            aiApi.insights().catch(() => null),
        ]).then(([n, i]) => {
            setNotes(n);
            setInsights(i);
        }).finally(() => setLoading(false));
    }, []);

    const handleNewNote = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const note = await notesApi.create("Untitled", "");
            router.push(`/notes/${note.id}`);
        } catch {
            alert("Backend not connected. Please start the API server.");
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                <span className="loading-spinner" style={{ marginRight: "10px" }} />
                Loading…
            </div>
        );
    }

    const recentNote = notes[0] ?? null;

    return (
        <div style={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            padding: "40px 48px",
            maxWidth: "900px",
            margin: "0 auto",
            width: "100%",
        }}>
            {/* Welcome header */}
            <div style={{ marginBottom: "36px" }}>
                <h1 style={{
                    fontSize: "28px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                    letterSpacing: "-0.5px",
                    lineHeight: 1.3,
                }}>
                    Welcome back
                </h1>
                {insights && (
                    <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        You created <strong style={{ color: "var(--text-primary)" }}>{insights.notes_this_week} note{insights.notes_this_week !== 1 ? "s" : ""}</strong> this week.
                        {insights.top_topic && insights.top_topic !== "General" && (
                            <> Your main topic: <span style={{ color: "var(--accent-primary)", fontWeight: 500 }}>#{insights.top_topic}</span></>
                        )}
                    </p>
                )}
            </div>

            {/* Continue writing banner */}
            {recentNote && (
                <div
                    onClick={() => router.push(`/notes/${recentNote.id}`)}
                    style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-lg)",
                        padding: "20px 24px",
                        marginBottom: "28px",
                        cursor: "pointer",
                        transition: "border-color 120ms ease, box-shadow 120ms ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                >
                    <div style={{
                        width: 40,
                        height: 40,
                        background: "var(--accent-dim)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <FileText size={18} style={{ color: "var(--accent-primary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
                            Continue Writing
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                            {recentNote.title || "Untitled"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={11} />
                            {timeAgo(recentNote.updated_at)}
                        </div>
                    </div>
                    <ArrowRight size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </div>
            )}

            {/* 3-card grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "32px",
            }}>
                {/* Recent Notes */}
                <div className="dashboard-card">
                    <div className="dashboard-card-title">
                        <FileText size={13} />
                        Recent Notes
                    </div>
                    {notes.length === 0 ? (
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                            No notes yet
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {notes.slice(0, 5).map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => router.push(`/notes/${note.id}`)}
                                    style={{
                                        cursor: "pointer",
                                        padding: "8px 10px",
                                        borderRadius: "var(--radius-sm)",
                                        transition: "background 120ms ease",
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {note.title || "Untitled"}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                        <Clock size={10} />
                                        {timeAgo(note.updated_at)}
                                        {note.tags.length > 0 && (
                                            <span style={{ marginLeft: "4px", color: "var(--accent-primary)" }}>
                                                {note.tags.slice(0, 2).map((t) => `#${t.name}`).join(" ")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={handleNewNote}
                                disabled={creating}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "8px 10px",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px dashed var(--border)",
                                    background: "transparent",
                                    color: "var(--text-muted)",
                                    fontSize: "12.5px",
                                    cursor: "pointer",
                                    fontFamily: "Inter, sans-serif",
                                    transition: "all 120ms ease",
                                    marginTop: "4px",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)";
                                    (e.currentTarget as HTMLElement).style.color = "var(--accent-primary)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                                }}
                            >
                                <Plus size={13} />
                                New note
                            </button>
                        </div>
                    )}
                </div>

                {/* AI Insights */}
                <div className="dashboard-card">
                    <div className="dashboard-card-title">
                        <Sparkles size={13} />
                        AI Insights
                    </div>
                    {insights ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                {insights.ai_insight}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <div style={{ textAlign: "center", padding: "10px 8px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-primary)" }}>{insights.total_notes}</div>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</div>
                                </div>
                                <div style={{ textAlign: "center", padding: "10px 8px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                                    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--success)" }}>{insights.notes_this_week}</div>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>This Week</div>
                                </div>
                            </div>
                            {insights.suggested_topics && insights.suggested_topics.length > 0 && (
                                <div>
                                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>
                                        Suggested Exploration
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                        {insights.suggested_topics.slice(0, 3).map((t) => (
                                            <span key={t} style={{
                                                fontSize: "11px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                background: "var(--accent-dim)",
                                                border: "1px solid rgba(99,102,241,0.2)",
                                                color: "var(--accent-primary)",
                                            }}>{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => router.push("/insights")}
                                style={{ justifyContent: "space-between", marginTop: "4px" }}
                            >
                                <span>View full insights</span>
                                <ArrowRight size={13} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                            No insights available
                        </div>
                    )}
                </div>

                {/* Knowledge Map */}
                <div className="dashboard-card">
                    <div className="dashboard-card-title">
                        <GitBranch size={13} />
                        Knowledge Map
                    </div>
                    <div
                        onClick={() => router.push("/graph")}
                        style={{
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "24px 20px",
                            cursor: "pointer",
                            transition: "border-color 120ms ease",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "10px",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                    >
                        {/* Mini network preview */}
                        <svg width="80" height="60" viewBox="0 0 80 60">
                            <line x1="40" y1="30" x2="15" y2="15" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                            <line x1="40" y1="30" x2="65" y2="15" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                            <line x1="40" y1="30" x2="20" y2="50" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" />
                            <line x1="40" y1="30" x2="60" y2="48" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
                            <line x1="15" y1="15" x2="65" y2="15" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
                            <circle cx="40" cy="30" r="6" fill="var(--accent-primary)" opacity="0.9" />
                            <circle cx="15" cy="15" r="4" fill="var(--accent-primary)" opacity="0.6" />
                            <circle cx="65" cy="15" r="4" fill="var(--accent-primary)" opacity="0.6" />
                            <circle cx="20" cy="50" r="3" fill="var(--accent-primary)" opacity="0.4" />
                            <circle cx="60" cy="48" r="3" fill="var(--accent-primary)" opacity="0.4" />
                        </svg>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
                                {notes.length} notes connected
                            </div>
                            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                                Click to explore
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--accent-primary)" }}>
                            Open Graph <ArrowRight size={12} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Empty state if no notes */}
            {notes.length === 0 && (
                <div className="empty-state" style={{ height: "auto", marginTop: "20px" }}>
                    <div style={{ fontSize: "48px" }}>🧠</div>
                    <div className="empty-state-title">Welcome to NeuroNotes</div>
                    <p className="empty-state-sub">
                        Your AI-powered knowledge workspace.<br />
                        Create your first note to get started, or use{" "}
                        <kbd style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", padding: "2px 6px", fontSize: "12px" }}>
                            Ctrl+N
                        </kbd>{" "}
                        to create one instantly.
                    </p>
                    <button
                        className="btn btn-primary"
                        style={{ marginTop: "8px" }}
                        onClick={handleNewNote}
                        disabled={creating}
                    >
                        <Plus size={15} />
                        Create First Note
                    </button>
                </div>
            )}
        </div>
    );
}
