"use client";

import { useState, useEffect, useRef } from "react";
import { aiApi, notesApi, searchApi, type NoteListItem, type Flashcard } from "@/lib/api";
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
                        size={12}
                        className={`panel-section-toggle${open ? " open" : ""}`}
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
    const [linkSuggestions, setLinkSuggestions] = useState<NoteListItem[]>([]);
    const [actions, setActions] = useState<ActionItem[]>([]);
    const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
    const actionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastContentRef = useRef<string>("");

    useEffect(() => {
        if (!noteId) return;
        notesApi.get(noteId)
            .then((n) => setTags(n.tags.map((t) => t.name)))
            .catch(() => {});
    }, [noteId]);

    useEffect(() => {
        if (!content || content.length < 20) return;
        const timer = setTimeout(async () => {
            try {
                const results = await searchApi.semantic(content.slice(0, 200), 4);
                setRelated(results.filter((r) => r.note.id !== noteId).slice(0, 3).map((r) => r.note));
            } catch {}
        }, 2000);
        return () => clearTimeout(timer);
    }, [content, noteId]);

    useEffect(() => {
        if (!noteId) return;
        aiApi.linkSuggestions(noteId)
            .then((data) => setLinkSuggestions(data.suggestions))
            .catch(() => {});
    }, [noteId]);

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
            } catch {}
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
        } catch {}
        finally { setAddingTag(false); }
    };

    const handleGenerateTags = async () => {
        setLoadingTags(true);
        try {
            const { tags: newTags } = await aiApi.generateTags(content);
            const toAdd = newTags.filter((t) => !tags.includes(t));
            for (const tag of toAdd) await notesApi.addTag(noteId, tag).catch(() => {});
            setTags((prev) => {
                const merged = [...prev];
                for (const t of newTags) { if (!merged.includes(t)) merged.push(t); }
                return merged;
            });
            onTagsGenerated?.(newTags);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 429) alert("Rate limit reached — wait a moment and try again.");
            else alert("AI error — please check the backend.");
        } finally {
            setLoadingTags(false);
        }
    };

    const handleRemoveTag = async (tagName: string) => {
        try {
            await notesApi.removeTag(noteId, tagName);
            setTags((prev) => prev.filter((t) => t !== tagName));
        } catch {}
    };

    const handleFlashcards = async () => {
        setLoadingFlash(true);
        try {
            const { flashcards: cards } = await aiApi.flashcards(content);
            setFlashcards(cards);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 429) alert("Rate limit reached — wait a moment and try again.");
            else alert("AI error — please check the backend.");
        } finally { setLoadingFlash(false); }
    };

    const handleExpandIdea = async () => {
        const snippet = content.replace(/<[^>]*>/g, "").slice(0, 300);
        setLoadingExpand(true);
        try {
            const { expanded: items } = await aiApi.expandIdea(snippet);
            setExpanded(items);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 429) alert("Rate limit reached — wait a moment and try again.");
            else alert("AI error — please check the backend.");
        } finally { setLoadingExpand(false); }
    };

    const rowStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "flex-start",
        padding: "7px 9px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        textDecoration: "none",
        transition: "border-color 150ms var(--ease)",
        marginBottom: "5px",
    };

    return (
        <aside className="context-panel">

            {/* AI Actions */}
            <Section title="AI Actions" icon={<Zap size={11} />} defaultOpen={true}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleGenerateTags}
                        disabled={loadingTags}
                        style={{ justifyContent: "flex-start", gap: "7px", fontSize: "12px" }}
                    >
                        {loadingTags ? <span className="loading-spinner" /> : <TagIcon size={12} />}
                        Auto Tags
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleFlashcards}
                        disabled={loadingFlash}
                        style={{ justifyContent: "flex-start", gap: "7px", fontSize: "12px" }}
                    >
                        {loadingFlash ? <span className="loading-spinner" /> : <BookOpen size={12} />}
                        Flashcards
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleExpandIdea}
                        disabled={loadingExpand}
                        style={{ justifyContent: "flex-start", gap: "7px", fontSize: "12px" }}
                    >
                        {loadingExpand ? <span className="loading-spinner" /> : <Sparkles size={12} />}
                        Expand Idea
                    </button>
                </div>
            </Section>

            <div className="panel-separator" />

            {/* Tags */}
            <Section title="Tags" icon={<TagIcon size={11} />} defaultOpen={true}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: tags.length > 0 ? "7px" : "0" }}>
                    {tags.map((t) => (
                        <span key={t} className="tag" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            #{t}
                            <button
                                onClick={() => handleRemoveTag(t)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "10px", padding: "0 1px", lineHeight: 1, display: "flex", alignItems: "center", minHeight: 0 }}
                            >
                                <X size={9} />
                            </button>
                        </span>
                    ))}
                </div>
                <div style={{ display: "flex", gap: "5px", marginTop: "3px" }}>
                    <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTagManually(); } }}
                        placeholder="Add tag…"
                        style={{
                            flex: 1,
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "4px 8px",
                            color: "var(--text-primary)",
                            fontSize: "11.5px",
                            outline: "none",
                            fontFamily: "inherit",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleAddTagManually}
                        disabled={addingTag || !tagInput.trim()}
                        style={{ flexShrink: 0, padding: "4px 9px", minHeight: 0 }}
                    >
                        {addingTag ? <span className="loading-spinner" /> : "+"}
                    </button>
                </div>
            </Section>

            {/* Flashcards */}
            {flashcards.length > 0 && (
                <>
                    <div className="panel-separator" />
                    <Section title={`Flashcards (${flashcards.length})`} icon={<BookOpen size={11} />} defaultOpen={true}>
                        <FlashcardViewer flashcards={flashcards} />
                    </Section>
                </>
            )}

            {/* Expanded Ideas */}
            {expanded.length > 0 && (
                <>
                    <div className="panel-separator" />
                    <Section title="Expanded Ideas" icon={<Sparkles size={11} />} defaultOpen={true}>
                        <ul style={{ margin: 0, padding: "0 0 0 14px", display: "flex", flexDirection: "column", gap: "5px" }}>
                            {expanded.map((item, i) => (
                                <li key={i} style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </Section>
                </>
            )}

            {/* Related Notes */}
            {related.length > 0 && (
                <>
                    <div className="panel-separator" />
                    <Section title="Related Notes" icon={<Link2 size={11} />} defaultOpen={true}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {related.map((n) => (
                                <a
                                    key={n.id}
                                    href={`/notes/${n.id}`}
                                    style={rowStyle}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                                >
                                    <div>
                                        <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
                                            {n.title || "Untitled"}
                                        </div>
                                        {n.tags.length > 0 && (
                                            <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                                                {n.tags.map((t) => `#${t.name}`).join(" ")}
                                            </div>
                                        )}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </Section>
                </>
            )}

            {/* Connections */}
            {linkSuggestions.length > 0 && (
                <>
                    <div className="panel-separator" />
                    <Section title="Connections" icon={<GitBranch size={11} />} defaultOpen={false}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {linkSuggestions.map((n) => (
                                <a
                                    key={n.id}
                                    href={`/notes/${n.id}`}
                                    style={{ ...rowStyle, borderColor: "rgba(99,102,241,0.18)" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.18)"; }}
                                >
                                    <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
                                        {n.title || "Untitled"}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </Section>
                </>
            )}

            {/* Action Items / Calendar Events */}
            {actions.length > 0 && (
                <>
                    <div className="panel-separator" />
                    <Section title={`Action Items (${actions.length})`} icon={<Calendar size={11} />} defaultOpen={true}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {actions.map((a, i) => {
                                const key = `${noteId}:${a.task.slice(0, 40)}`;
                                const isDone = doneTasks.has(key);
                                return (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                        <button
                                            onClick={() => {
                                                setDoneTasks((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(key)) next.delete(key); else next.add(key);
                                                    return next;
                                                });
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: isDone ? "var(--success)" : "var(--text-muted)", padding: "1px", flexShrink: 0, marginTop: "1px", minHeight: 0 }}
                                        >
                                            {isDone ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                        </button>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: "12px", color: isDone ? "var(--text-muted)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                                                {a.task}
                                            </div>
                                            {a.due_hint && (
                                                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px" }}>{a.due_hint}</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const text = encodeURIComponent(a.task);
                                                window.open(`https://calendar.google.com/calendar/r/eventedit?text=${text}`, "_blank");
                                            }}
                                            title="Add to Google Calendar"
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "1px", flexShrink: 0, minHeight: 0 }}
                                        >
                                            <Calendar size={11} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                </>
            )}

            {/* Shortcuts hint */}
            <div style={{
                marginTop: "auto",
                padding: "10px",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
            }}>
                <div className="panel-section-title" style={{ marginBottom: "5px" }}>Shortcuts</div>
                {[
                    ["⌘K", "Search"],
                    ["⌘N", "New note"],
                    ["/", "Commands"],
                    ["⌘[", "Toggle sidebar"],
                ].map(([key, label]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "2px 0" }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <kbd style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "3px",
                            padding: "1px 5px",
                            fontSize: "10px",
                            color: "var(--text-secondary)",
                            fontFamily: "inherit",
                        }}>
                            {key}
                        </kbd>
                    </div>
                ))}
            </div>
        </aside>
    );
}
