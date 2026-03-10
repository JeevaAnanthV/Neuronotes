"use client";

import { useEffect, useState, useRef } from "react";
import { notesApi, aiApi, type NoteListItem } from "@/lib/api";
import { Send, HelpCircle, BookOpen, X, SlidersHorizontal } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: NoteListItem[];
}

export default function QAPage() {
    const [notes, setNotes] = useState<NoteListItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [allNotes, setAllNotes] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [showNoteSelector, setShowNoteSelector] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        notesApi.list().then(n => { setNotes(n); setLoadingNotes(false); }).catch(() => setLoadingNotes(false));
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    function toggleNote(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    async function handleSend() {
        if (!input.trim() || loading) return;
        const q = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: q }]);
        setLoading(true);
        try {
            const note_ids = allNotes ? undefined : Array.from(selectedIds);
            const chatMessages = [
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: "user" as const, content: q },
            ];
            const { reply, sources } = await aiApi.chat(chatMessages, note_ids);
            setMessages(prev => [...prev, { role: "assistant", content: reply, sources }]);
        } catch {
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I could not process that question. Please check the backend connection." }]);
        }
        setLoading(false);
    }

    return (
        <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
            {/* Left: note selection */}
            <div className={`qa-note-selector${showNoteSelector ? " open" : ""}`} style={{
                width: "clamp(180px, 28vw, 260px)",
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}>
                {/* Mobile close button for the selector panel */}
                <button
                    onClick={() => setShowNoteSelector(false)}
                    style={{
                        display: "none",
                        position: "absolute",
                        top: 12,
                        right: 12,
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        padding: "8px",
                        zIndex: 860,
                    }}
                    className="qa-selector-close"
                    aria-label="Close note selector"
                >
                    <X size={16} />
                </button>
                <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "7px" }}>
                        <BookOpen size={14} /> Context Notes
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)" }}>
                        <input
                            type="checkbox"
                            checked={allNotes}
                            onChange={e => setAllNotes(e.target.checked)}
                            style={{ accentColor: "var(--accent-primary)" }}
                        />
                        Ask across all notes
                    </label>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {loadingNotes ? (
                        <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "12px" }}>Loading...</div>
                    ) : notes.length === 0 ? (
                        <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "12px" }}>No notes yet</div>
                    ) : notes.map(n => (
                        <label
                            key={n.id}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "8px",
                                padding: "8px",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                background: selectedIds.has(n.id) ? "var(--accent-dim)" : "transparent",
                                opacity: allNotes ? 0.45 : 1,
                                transition: "background 100ms",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.has(n.id)}
                                onChange={() => toggleNote(n.id)}
                                disabled={allNotes}
                                style={{ accentColor: "var(--accent-primary)", marginTop: "2px", flexShrink: 0 }}
                            />
                            <span style={{ fontSize: "12.5px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                                {n.title || "Untitled"}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Right: chat */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "9px" }}>
                    <HelpCircle size={17} color="var(--accent-primary)" />
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>Cross-Note Q&A</span>
                    {/* Mobile: button to open note selector panel */}
                    <button
                        className="qa-context-btn"
                        onClick={() => setShowNoteSelector(true)}
                        style={{
                            display: "none",
                            alignItems: "center",
                            gap: "6px",
                            padding: "7px 12px",
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                        aria-label="Select context notes"
                    >
                        <SlidersHorizontal size={13} />
                        Context
                    </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", marginTop: "60px" }}>
                            Ask any question — I will search your notes for answers.
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: "6px" }}>
                            <div style={{
                                maxWidth: "80%",
                                padding: "10px 14px",
                                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                background: m.role === "user" ? "var(--accent-primary)" : "var(--bg-elevated)",
                                border: m.role === "user" ? "none" : "1px solid var(--border)",
                                color: m.role === "user" ? "white" : "var(--text-primary)",
                                fontSize: "13.5px",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                            }}>
                                {m.content}
                            </div>
                            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: "80%" }}>
                                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sources:</span>
                                    {m.sources.map(s => (
                                        <a
                                            key={s.id}
                                            href={`/notes/${s.id}`}
                                            style={{
                                                fontSize: "11px",
                                                padding: "2px 8px",
                                                borderRadius: "10px",
                                                background: "var(--accent-dim)",
                                                border: "1px solid rgba(99,102,241,0.3)",
                                                color: "var(--accent-primary)",
                                                textDecoration: "none",
                                            }}
                                        >
                                            {s.title || "Untitled"}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
                            <span className="loading-spinner" />
                            Searching notes...
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Ask a question across your notes..."
                        style={{
                            flex: 1,
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 14px",
                            color: "var(--text-primary)",
                            fontSize: "13.5px",
                            outline: "none",
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        disabled={loading}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        style={{ flexShrink: 0 }}
                    >
                        <Send size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}
