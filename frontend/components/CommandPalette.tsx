"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { searchApi, notesApi, type NoteListItem, type SearchResult } from "@/lib/api";
import { FileText, Plus, Search, Zap, MessageSquare, BookOpen, GitBranch } from "lucide-react";

interface Props {
    onClose: () => void;
}

interface ActionItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void;
}

export function CommandPalette({ onClose }: Props) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [allNotes, setAllNotes] = useState<NoteListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        notesApi.list().then(setAllNotes).catch(() => { });
    }, []);

    const navigate = useCallback((href: string) => {
        router.push(href);
        onClose();
    }, [router, onClose]);

    const ACTIONS: ActionItem[] = [
        {
            id: "new-note",
            label: "Create new note",
            description: "Start a blank note",
            icon: <Plus size={15} />,
            action: async () => {
                const note = await notesApi.create("Untitled", "");
                navigate(`/notes/${note.id}`);
            },
        },
        {
            id: "graph",
            label: "Open Knowledge Graph",
            description: "Visualise note connections",
            icon: <GitBranch size={15} />,
            action: () => navigate("/graph"),
        },
        {
            id: "chat",
            label: "AI Chat",
            description: "Chat with your knowledge base",
            icon: <MessageSquare size={15} />,
            action: () => navigate("/chat"),
        },
        {
            id: "insights",
            label: "View AI Insights",
            description: "Learning progress and knowledge gaps",
            icon: <Zap size={15} />,
            action: () => navigate("/insights"),
        },
        {
            id: "tags",
            label: "Browse Tags",
            description: "Filter notes by tag",
            icon: <BookOpen size={15} />,
            action: () => navigate("/tags"),
        },
    ];

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await searchApi.semantic(query, 8);
                setResults(data);
                setSelected(0);
            } catch {
                const filtered = allNotes
                    .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
                    .map((n) => ({ note: n, score: 1 }));
                setResults(filtered);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, allNotes]);

    // Combined items for keyboard navigation
    const filteredActions = query.trim()
        ? ACTIONS.filter(
            (a) =>
                a.label.toLowerCase().includes(query.toLowerCase()) ||
                a.description.toLowerCase().includes(query.toLowerCase())
        )
        : ACTIONS;

    const noteItems = query.trim()
        ? results
        : allNotes.slice(0, 6).map((n) => ({ note: n, score: 1 }));

    // Flat list for keyboard nav: actions first, then notes
    const allItems = useMemo<Array<
        | { type: "action"; item: ActionItem }
        | { type: "note"; item: SearchResult }
    >>(() => [
        ...filteredActions.map((a) => ({ type: "action" as const, item: a })),
        ...noteItems.map((n) => ({ type: "note" as const, item: n })),
    ], [filteredActions, noteItems]);

    const handleSelect = useCallback(
        (idx: number) => {
            const entry = allItems[idx];
            if (!entry) return;
            if (entry.type === "action") {
                entry.item.action();
            } else {
                router.push(`/notes/${entry.item.note.id}`);
                onClose();
            }
        },
        [allItems, router, onClose]
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, allItems.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); handleSelect(selected); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [allItems.length, selected, handleSelect, onClose]);

    return (
        <div className="palette-overlay" onClick={onClose}>
            <div
                className="palette-box"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "fadeIn 0.15s ease" }}
            >
                {/* Search input */}
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search
                        size={16}
                        style={{
                            position: "absolute",
                            left: "18px",
                            color: "var(--text-muted)",
                            pointerEvents: "none",
                        }}
                    />
                    <input
                        ref={inputRef}
                        className="palette-input"
                        style={{ paddingLeft: "42px" }}
                        placeholder="Search notes, run commands…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        id="command-palette-input"
                    />
                    {loading && (
                        <span
                            className="loading-spinner"
                            style={{ position: "absolute", right: "16px" }}
                        />
                    )}
                </div>

                <div className="palette-results">
                    {/* Actions section */}
                    {filteredActions.length > 0 && (
                        <>
                            <div className="palette-section-label">Actions</div>
                            {filteredActions.map((action, i) => {
                                const globalIdx = i;
                                return (
                                    <div
                                        key={action.id}
                                        className={`palette-item${globalIdx === selected ? " selected" : ""}`}
                                        onClick={() => { action.action(); }}
                                    >
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "var(--radius-sm)",
                                            background: "var(--bg-tertiary)",
                                            border: "1px solid var(--border)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "var(--accent-primary)",
                                            flexShrink: 0,
                                        }}>
                                            {action.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="palette-item-title">{action.label}</div>
                                            <div className="palette-item-meta">{action.description}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Notes section */}
                    {noteItems.length > 0 && (
                        <>
                            <div className="palette-section-label">
                                {query.trim() ? "Search Results" : "Recent Notes"}
                            </div>
                            {noteItems.map((item, i) => {
                                const globalIdx = filteredActions.length + i;
                                return (
                                    <div
                                        key={item.note.id}
                                        className={`palette-item${globalIdx === selected ? " selected" : ""}`}
                                        onClick={() => { router.push(`/notes/${item.note.id}`); onClose(); }}
                                    >
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "var(--radius-sm)",
                                            background: "var(--bg-tertiary)",
                                            border: "1px solid var(--border)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "var(--text-muted)",
                                            flexShrink: 0,
                                        }}>
                                            <FileText size={14} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="palette-item-title">{item.note.title || "Untitled"}</div>
                                            {item.note.tags.length > 0 && (
                                                <div className="palette-item-meta">
                                                    {item.note.tags.map((t) => `#${t.name}`).join(" ")}
                                                </div>
                                            )}
                                        </div>
                                        {item.score < 1 && (
                                            <span className="palette-score">{(item.score * 100).toFixed(0)}%</span>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {allItems.length === 0 && query.trim() && !loading && (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                            No results found
                        </div>
                    )}
                </div>

                <div style={{
                    padding: "8px 14px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: "16px",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                }}>
                    <span>↑↓ navigate</span>
                    <span>↵ select</span>
                    <span>esc close</span>
                </div>
            </div>
        </div>
    );
}
