"use client";

import { useState, useEffect, useRef } from "react";
import { aiApi, notesApi, searchApi, type NoteListItem, type Flashcard, type InsightsData } from "@/lib/api";
import { FlashcardViewer } from "./FlashcardViewer";
import {
    Sparkles,
    Link2,
    Tag as TagIcon,
    BookOpen,
    GitBranch,
    ChevronDown,
    Zap,
    X,
    Bell,
    Calendar,
    Circle,
    CheckCircle2,
} from "lucide-react";

interface ActionItem {
    task: string;
    due_hint: string | null;
    priority: "high" | "medium" | "low";
}

interface Props {
    noteId: string;
    content: string;
    onTagsGenerated?: (tags: string[]) => void;
}

function Section({
    title,
    icon,
    children,
    defaultOpen = true,
    action,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    action?: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="panel-section">
            <div className="panel-section-header" onClick={() => setOpen((o) => !o)}>
                <div className="panel-section-title">
                    {icon}
                    {title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
                    <ChevronDown
                        size={13}
                        className={`panel-section-toggle${open ? " open" : ""}`}
                        style={{ color: "var(--text-muted)", flexShrink: 0 }}
                    />
                </div>
            </div>
            {open && <div>{children}</div>}
        </div>
    );
}

export function ContextPanel({ noteId, content, onTagsGenerated }: Props) {
    const [related, setRelated] = useState<NoteListItem[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [addingTag, setAddingTag] = useState(false);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loadingTags, setLoadingTags] = useState(false);
    const [loadingFlash, setLoadingFlash] = useState(false);
    const [expanded, setExpanded] = useState<string[]>([]);
    const [loadingExpand, setLoadingExpand] = useState(false);
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [gaps, setGaps] = useState<string[]>([]);
    const [gapSuggestion, setGapSuggestion] = useState("");
    const [linkSuggestions, setLinkSuggestions] = useState<NoteListItem[]>([]);
    const [actions, setActions] = useState<ActionItem[]>([]);
    const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
    const actionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastContentRef = useRef<string>("");

    // Load existing tags for this note on mount
    useEffect(() => {
        if (!noteId) return;
        notesApi.get(noteId)
            .then((n) => setTags(n.tags.map((t) => t.name)))
            .catch(() => { });
    }, [noteId]);

    useEffect(() => {
        setLoadingInsights(true);
        aiApi.insights()
            .then((data) => setInsights(data))
            .catch(() => { })
            .finally(() => setLoadingInsights(false));
        aiApi.gaps()
            .then((data) => { setGaps(data.gaps); setGapSuggestion(data.suggestion); })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!content || content.length < 20) return;
        const timer = setTimeout(async () => {
            try {
                const results = await searchApi.semantic(content.slice(0, 200), 4);
                setRelated(results.filter((r) => r.note.id !== noteId).slice(0, 3).map((r) => r.note));
            } catch { }
        }, 2000);
        return () => clearTimeout(timer);
    }, [content, noteId]);

    useEffect(() => {
        if (!noteId) return;
        aiApi.linkSuggestions(noteId)
            .then((data) => setLinkSuggestions(data.suggestions))
            .catch(() => { });
    }, [noteId]);

    // Extract action items (debounced, only when content changes significantly)
    useEffect(() => {
        const plainText = content.replace(/<[^>]*>/g, "");
        if (plainText.length < 50) return;
        const changed = Math.abs(plainText.length - lastContentRef.current.length) > 80;
        if (!changed) return;
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = setTimeout(async () => {
            lastContentRef.current = plainText;
            try {
                const { actions: extracted } = await aiApi.extractActions(content, noteId);
                setActions(extracted);
            } catch { /* ignore */ }
        }, 3000);
        return () => clearTimeout(actionTimerRef.current);
    }, [content, noteId]);

    const handleAddTagManually = async () => {
        const name = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
        if (!name || tags.includes(name)) { setTagInput(""); return; }
        setAddingTag(true);
        try {
            await notesApi.addTag(noteId, name);
            setTags((prev) => [...prev, name]);
            setTagInput("");
        } catch { }
        finally { setAddingTag(false); }
    };

    const handleGenerateTags = async () => {
        setLoadingTags(true);
        try {
            const { tags: newTags } = await aiApi.generateTags(content);
            // Merge new tags with existing ones (deduplicated)
            const toAdd = newTags.filter((t) => !tags.includes(t));
            for (const tag of toAdd) {
                await notesApi.addTag(noteId, tag).catch(() => { });
            }
            setTags((prev) => {
                const merged = [...prev];
                for (const t of newTags) {
                    if (!merged.includes(t)) merged.push(t);
                }
                return merged;
            });
            onTagsGenerated?.(newTags);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            if (status === 429) {
                alert("Rate limit reached — wait a moment and try again.");
            } else if (detail) {
                alert(`AI error: ${detail}`);
            } else {
                alert("AI error — please check the backend is running on port 8001.");
            }
        } finally {
            setLoadingTags(false);
        }
    };

    const handleRemoveTag = async (tagName: string) => {
        try {
            await notesApi.removeTag(noteId, tagName);
            setTags((prev) => prev.filter((t) => t !== tagName));
        } catch { }
    };

    const handleFlashcards = async () => {
        setLoadingFlash(true);
        try {
            const { flashcards: cards } = await aiApi.flashcards(content);
            setFlashcards(cards);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            if (status === 429) {
                alert("Rate limit reached — wait a moment and try again.");
            } else if (detail) {
                alert(`AI error: ${detail}`);
            } else {
                alert("AI error — please check the backend is running on port 8001.");
            }
        } finally {
            setLoadingFlash(false);
        }
    };

    const handleExpandIdea = async () => {
        const snippet = content.replace(/<[^>]*>/g, "").slice(0, 300);
        setLoadingExpand(true);
        try {
            const { expanded: items } = await aiApi.expandIdea(snippet);
            setExpanded(items);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            if (status === 429) {
                alert("Rate limit reached — wait a moment and try again.");
            } else if (detail) {
                alert(`AI error: ${detail}`);
            } else {
                alert("AI error — please check the backend is running on port 8001.");
            }
        } finally {
            setLoadingExpand(false);
        }
    };

    return (
        <aside className="context-panel">
            {/* AI Insights */}
            <Section
                title="AI Insights"
                icon={<Sparkles size={12} />}
                defaultOpen={true}
            >
                {loadingInsights ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0" }}>
                        <span className="loading-spinner" />
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading…</span>
                    </div>
                ) : insights ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{
                            background: "var(--accent-dim)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 12px",
                            border: "1px solid rgba(99,102,241,0.2)",
                        }}>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                {insights.ai_insight}
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                            <div style={{
                                background: "var(--bg-tertiary)",
                                borderRadius: "var(--radius-md)",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                textAlign: "center",
                            }}>
                                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-primary)" }}>
                                    {insights.total_notes}
                                </div>
                                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Total Notes
                                </div>
                            </div>
                            <div style={{
                                background: "var(--bg-tertiary)",
                                borderRadius: "var(--radius-md)",
                                padding: "8px 10px",
                                border: "1px solid var(--border)",
                                textAlign: "center",
                            }}>
                                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--success)" }}>
                                    {insights.notes_this_week}
                                </div>
                                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    This Week
                                </div>
                            </div>
                        </div>
                        {insights.top_topic && insights.top_topic !== "General" && (
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                Top topic: <span style={{ color: "var(--accent-primary)", fontWeight: 500 }}>#{insights.top_topic}</span>
                            </div>
                        )}
                        {insights.suggested_topics && insights.suggested_topics.length > 0 && (
                            <div>
                                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
                                    Explore next
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                    {insights.suggested_topics.map((topic) => (
                                        <span key={topic} style={{
                                            fontSize: "11.5px",
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            background: "var(--bg-tertiary)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-secondary)",
                                        }}>
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No insights yet</div>
                )}
            </Section>

            {/* AI Actions */}
            <Section title="AI Actions" icon={<Zap size={12} />} defaultOpen={true}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleGenerateTags}
                        disabled={loadingTags}
                        style={{ justifyContent: "flex-start", gap: "8px" }}
                    >
                        {loadingTags ? <span className="loading-spinner" /> : <TagIcon size={13} />}
                        Auto Tags
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleFlashcards}
                        disabled={loadingFlash}
                        style={{ justifyContent: "flex-start", gap: "8px" }}
                    >
                        {loadingFlash ? <span className="loading-spinner" /> : <BookOpen size={13} />}
                        Flashcards
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleExpandIdea}
                        disabled={loadingExpand}
                        style={{ justifyContent: "flex-start", gap: "8px" }}
                    >
                        {loadingExpand ? <span className="loading-spinner" /> : <Sparkles size={13} />}
                        Expand Idea
                    </button>
                </div>
            </Section>

            {/* Tags — always shown so user can add tags even on new notes */}
            <Section title="Tags" icon={<TagIcon size={12} />} defaultOpen={true}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: tags.length > 0 ? "8px" : "0" }}>
                    {tags.map((t) => (
                        <span key={t} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            #{t}
                            <button
                                onClick={() => handleRemoveTag(t)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    fontSize: "11px",
                                    padding: "0 1px",
                                    lineHeight: 1,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                                title={`Remove tag #${t}`}
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
                {/* Manual tag input */}
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTagManually(); } }}
                        placeholder="Add tag…"
                        style={{
                            flex: 1,
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "5px 8px",
                            color: "var(--text-primary)",
                            fontSize: "12px",
                            outline: "none",
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--accent-primary)"; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)"; }}
                    />
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleAddTagManually}
                        disabled={addingTag || !tagInput.trim()}
                        style={{ flexShrink: 0, padding: "5px 10px" }}
                    >
                        {addingTag ? <span className="loading-spinner" /> : "+"}
                    </button>
                </div>
            </Section>

            {/* Flashcards */}
            {flashcards.length > 0 && (
                <Section title={`Flashcards (${flashcards.length})`} icon={<BookOpen size={12} />} defaultOpen={true}>
                    <FlashcardViewer flashcards={flashcards} />
                </Section>
            )}

            {/* Expanded Ideas */}
            {expanded.length > 0 && (
                <Section title="Expanded Ideas" icon={<Sparkles size={12} />} defaultOpen={true}>
                    <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {expanded.map((item, i) => (
                            <li key={i} style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                {item}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Related Notes */}
            {related.length > 0 && (
                <Section title="Related Notes" icon={<Link2 size={12} />} defaultOpen={true}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {related.map((n) => (
                            <a
                                key={n.id}
                                href={`/notes/${n.id}`}
                                style={{
                                    display: "block",
                                    padding: "8px 10px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--bg-tertiary)",
                                    border: "1px solid var(--border)",
                                    textDecoration: "none",
                                    transition: "border-color 120ms ease",
                                }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)")}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}
                            >
                                <div style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: 500 }}>
                                    {n.title || "Untitled"}
                                </div>
                                {n.tags.length > 0 && (
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
                                        {n.tags.map((t) => `#${t.name}`).join(" ")}
                                    </div>
                                )}
                            </a>
                        ))}
                    </div>
                </Section>
            )}

            {/* Connections / Suggested Links */}
            {linkSuggestions.length > 0 && (
                <Section title="Connections" icon={<GitBranch size={12} />} defaultOpen={false}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {linkSuggestions.map((n) => (
                            <a
                                key={n.id}
                                href={`/notes/${n.id}`}
                                style={{
                                    display: "block",
                                    padding: "8px 10px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--bg-tertiary)",
                                    border: "1px solid rgba(99,102,241,0.2)",
                                    textDecoration: "none",
                                    transition: "border-color 120ms ease",
                                }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)")}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.2)")}
                            >
                                <div style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: 500 }}>
                                    {n.title || "Untitled"}
                                </div>
                            </a>
                        ))}
                    </div>
                </Section>
            )}

            {/* Action Items */}
            {actions.length > 0 && (
                <Section title={`Action Items (${actions.length})`} icon={<Bell size={12} />} defaultOpen={true}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {actions.map((a, i) => {
                            const key = `${noteId}:${a.task.slice(0, 40)}`;
                            const isDone = doneTasks.has(key);
                            return (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                    <button
                                        onClick={() => {
                                            setDoneTasks(prev => {
                                                const next = new Set(prev);
                                                if (next.has(key)) next.delete(key); else next.add(key);
                                                return next;
                                            });
                                        }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: isDone ? "var(--success)" : "var(--text-muted)", padding: "1px", flexShrink: 0, marginTop: "1px" }}
                                    >
                                        {isDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                    </button>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: "12.5px", color: isDone ? "var(--text-muted)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                                            {a.task}
                                        </div>
                                        {a.due_hint && (
                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{a.due_hint}</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const text = encodeURIComponent(a.task);
                                            window.open(`https://calendar.google.com/calendar/r/eventedit?text=${text}`, "_blank");
                                        }}
                                        title="Add to Google Calendar"
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "1px", flexShrink: 0 }}
                                    >
                                        <Calendar size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {/* Knowledge Gaps */}
            {gaps.length > 0 && (
                <Section title="Knowledge Gaps" icon={<Sparkles size={12} />} defaultOpen={false}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                        {gaps.map((gap) => (
                            <span key={gap} style={{
                                fontSize: "12px",
                                padding: "3px 10px",
                                borderRadius: "14px",
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                            }}>
                                {gap}
                            </span>
                        ))}
                    </div>
                    {gapSuggestion && (
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.5, fontStyle: "italic" }}>
                            {gapSuggestion}
                        </div>
                    )}
                </Section>
            )}

            {/* Keyboard shortcuts hint */}
            <div style={{
                marginTop: "auto",
                padding: "12px",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
            }}>
                <div className="panel-section-title" style={{ marginBottom: "6px" }}>Shortcuts</div>
                {[
                    ["Ctrl+K", "Search"],
                    ["Ctrl+N", "New note"],
                    ["/", "AI commands"],
                    ["Ctrl+[", "Toggle sidebar"],
                ].map(([key, label]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", padding: "3px 0" }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <kbd style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            padding: "1px 5px",
                            fontSize: "10.5px",
                            color: "var(--text-secondary)",
                        }}>
                            {key}
                        </kbd>
                    </div>
                ))}
            </div>
        </aside>
    );
}
