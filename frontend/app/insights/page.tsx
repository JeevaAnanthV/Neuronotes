"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { aiApi, tagsApi, notesApi, type InsightsData, type TagWithCount, type NoteListItem } from "@/lib/api";
import { Sparkles, Lightbulb, TrendingUp, AlertCircle, Calendar, FileText, ArrowRight } from "lucide-react";

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
}

function ProgressBar({ value, max, color = "var(--accent-primary)" }: { value: number; max: number; color?: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="progress-bar" style={{ flex: 1 }}>
                <div
                    className="progress-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", minWidth: "24px", textAlign: "right" }}>
                {value}
            </span>
        </div>
    );
}

export default function InsightsPage() {
    const router = useRouter();
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [gaps, setGaps] = useState<string[]>([]);
    const [gapSuggestion, setGapSuggestion] = useState("");
    const [tags, setTags] = useState<TagWithCount[]>([]);
    const [notes, setNotes] = useState<NoteListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            aiApi.insights().catch(() => null),
            aiApi.gaps().catch(() => ({ gaps: [] as string[], suggestion: "" })),
            tagsApi.list().catch(() => [] as TagWithCount[]),
            notesApi.list().catch(() => [] as NoteListItem[]),
        ]).then(([i, g, t, n]) => {
            setInsights(i);
            if (g) { setGaps(g.gaps); setGapSuggestion(g.suggestion); }
            setTags(t);
            setNotes(n);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                <span className="loading-spinner" style={{ marginRight: "10px" }} />
                Loading insights…
            </div>
        );
    }

    // Build notes-by-day timeline (last 14 days)
    const today = new Date();
    const last14Days = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (13 - i));
        return d;
    });

    const notesByDay = last14Days.map((d) => {
        const dateStr = d.toISOString().slice(0, 10);
        const count = notes.filter((n) => n.created_at.slice(0, 10) === dateStr).length;
        return { date: d, count };
    });

    const maxTagCount = tags.length > 0 ? Math.max(...tags.map((t) => t.note_count)) : 1;
    const topTags = [...tags].sort((a, b) => b.note_count - a.note_count).slice(0, 8);

    const recentNotes = [...notes]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);

    const maxDayCount = Math.max(...notesByDay.map((d) => d.count), 1);

    return (
        <div style={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            padding: "40px 48px",
        }}>
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                {/* Header */}
                <div style={{ marginBottom: "36px" }}>
                    <h1 style={{
                        fontSize: "28px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        margin: 0,
                        letterSpacing: "-0.5px",
                        lineHeight: 1.3,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}>
                        <Lightbulb size={26} style={{ color: "var(--accent-warning)" }} />
                        AI Insights
                    </h1>
                    <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
                        Understanding your knowledge patterns and growth
                    </p>
                </div>

                {/* AI summary card */}
                {insights && (
                    <div style={{
                        background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,197,94,0.06))",
                        border: "1px solid rgba(99,102,241,0.2)",
                        borderRadius: "var(--radius-lg)",
                        padding: "20px 24px",
                        marginBottom: "24px",
                        display: "flex",
                        gap: "20px",
                        alignItems: "flex-start",
                    }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "var(--accent-gradient)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <Sparkles size={18} color="white" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "5px" }}>
                                AI Summary
                            </div>
                            <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                {insights.ai_insight}
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats row */}
                {insights && (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "12px",
                        marginBottom: "24px",
                    }}>
                        {[
                            { label: "Total Notes", value: insights.total_notes, color: "var(--accent-primary)" },
                            { label: "This Week", value: insights.notes_this_week, color: "var(--success)" },
                            { label: "Unfinished Ideas", value: insights.unfinished_ideas, color: "var(--warning)" },
                            { label: "Top Topic", value: insights.top_topic || "—", color: "var(--text-primary)" },
                        ].map((stat) => (
                            <div key={stat.label} className="dashboard-card" style={{ textAlign: "center", padding: "16px" }}>
                                <div style={{ fontSize: "22px", fontWeight: 700, color: stat.color, letterSpacing: "-0.5px" }}>
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    {/* Knowledge Overview — topic distribution */}
                    {topTags.length > 0 && (
                        <div className="dashboard-card">
                            <div className="dashboard-card-title">
                                <TrendingUp size={13} />
                                Knowledge Overview
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {topTags.map((tag) => (
                                    <div key={tag.id}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                                #{tag.name}
                                            </span>
                                        </div>
                                        <ProgressBar value={tag.note_count} max={maxTagCount} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Learning timeline */}
                    <div className="dashboard-card">
                        <div className="dashboard-card-title">
                            <Calendar size={13} />
                            Learning Progress (14 days)
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
                            {notesByDay.map((d, i) => {
                                const h = maxDayCount > 0 ? Math.max(4, (d.count / maxDayCount) * 72) : 4;
                                const isToday = i === 13;
                                return (
                                    <div
                                        key={i}
                                        title={`${d.date.toLocaleDateString()}: ${d.count} note${d.count !== 1 ? "s" : ""}`}
                                        style={{
                                            flex: 1,
                                            height: `${h}px`,
                                            borderRadius: "2px",
                                            background: d.count > 0
                                                ? (isToday ? "var(--accent-primary)" : "rgba(99,102,241,0.45)")
                                                : "var(--border)",
                                            transition: "height 300ms ease",
                                            cursor: "default",
                                        }}
                                    />
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>14d ago</span>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Today</span>
                        </div>
                    </div>
                </div>

                {/* Knowledge Gaps */}
                {gaps.length > 0 && (
                    <div className="dashboard-card" style={{ marginBottom: "16px" }}>
                        <div className="dashboard-card-title">
                            <AlertCircle size={13} style={{ color: "var(--accent-warning)" }} />
                            Knowledge Gaps
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                            {gaps.map((gap) => (
                                <span key={gap} style={{
                                    fontSize: "12.5px",
                                    padding: "4px 12px",
                                    borderRadius: "14px",
                                    background: "rgba(245,158,11,0.08)",
                                    border: "1px solid rgba(245,158,11,0.2)",
                                    color: "var(--accent-warning)",
                                }}>
                                    {gap}
                                </span>
                            ))}
                        </div>
                        {gapSuggestion && (
                            <div style={{
                                fontSize: "13px",
                                color: "var(--text-secondary)",
                                lineHeight: 1.6,
                                padding: "10px 12px",
                                background: "var(--bg-tertiary)",
                                borderRadius: "var(--radius-sm)",
                                borderLeft: "3px solid var(--accent-warning)",
                            }}>
                                {gapSuggestion}
                            </div>
                        )}
                    </div>
                )}

                {/* Suggested Exploration */}
                {insights?.suggested_topics && insights.suggested_topics.length > 0 && (
                    <div className="dashboard-card" style={{ marginBottom: "16px" }}>
                        <div className="dashboard-card-title">
                            <Sparkles size={13} />
                            Suggested Exploration
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {insights.suggested_topics.map((topic) => (
                                <span key={topic} style={{
                                    fontSize: "12.5px",
                                    padding: "5px 14px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--accent-dim)",
                                    border: "1px solid rgba(99,102,241,0.2)",
                                    color: "var(--accent-primary)",
                                    fontWeight: 500,
                                }}>
                                    {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent notes with timeline */}
                {recentNotes.length > 0 && (
                    <div className="dashboard-card">
                        <div className="dashboard-card-title" style={{ marginBottom: "16px" }}>
                            <FileText size={13} />
                            Recent Activity
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {recentNotes.map((note, i) => (
                                <div
                                    key={note.id}
                                    onClick={() => router.push(`/notes/${note.id}`)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        padding: "10px 12px",
                                        borderRadius: "var(--radius-md)",
                                        cursor: "pointer",
                                        transition: "background 120ms ease",
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: i === 0 ? "var(--accent-primary)" : "var(--border-light)",
                                        flexShrink: 0,
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {note.title || "Untitled"}
                                        </div>
                                        {note.tags.length > 0 && (
                                            <div style={{ fontSize: "11px", color: "var(--accent-primary)", marginTop: "1px" }}>
                                                {note.tags.slice(0, 3).map((t) => `#${t.name}`).join(" ")}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "var(--text-muted)", flexShrink: 0 }}>
                                        {timeAgo(note.updated_at)}
                                        <ArrowRight size={11} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
