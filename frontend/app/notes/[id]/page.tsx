"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { notesApi, aiApi } from "@/lib/api";
import { Editor } from "@/components/Editor";
import { ContextPanel } from "@/components/ContextPanel";
import { DailyInsights } from "@/components/DailyInsights";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { CollaborativeIndicator } from "@/components/CollaborativeIndicator";
import { createClient } from "@/lib/supabase";
import { Check, Loader2, Trash2, Cloud, Save, PanelRight } from "lucide-react";

const AUTOSAVE_DELAY = 1500;

/** Strip HTML tags and check if a note has meaningful content */
function isNoteEmpty(title: string, content: string): boolean {
    const titleEmpty = !title.trim() || title.trim() === "Untitled";
    const plainContent = content.replace(/<[^>]*>/g, "").trim();
    return titleEmpty && plainContent.length < 10;
}

export default function NotePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showInsights, setShowInsights] = useState(false);
    const [realtimeToast, setRealtimeToast] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        setLoading(true);
        notesApi.get(id).then((n) => {
            setTitle(n.title || "");
            setContent(n.content || "");
        }).catch((err) => {
            const msg = err?.response?.data?.detail || err?.message || "Failed to load note";
            setLoadError(msg);
        }).finally(() => setLoading(false));
    }, [id, router]);

    // Supabase Realtime — notify when another user updates this note
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`note:${id}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "notes", filter: `id=eq.${id}` },
                () => {
                    setRealtimeToast(true);
                    setTimeout(() => setRealtimeToast(false), 8000);
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const save = useCallback(
        async (newTitle: string, newContent: string) => {
            setSaving(true);
            setSaved(false);
            try {
                let finalTitle = newTitle;
                // Auto-generate title if empty or still "Untitled" and there's real content
                const titleNeedsGeneration = (!finalTitle.trim() || finalTitle.trim() === "Untitled");
                const plainContent = newContent.replace(/<[^>]*>/g, "").trim();
                if (titleNeedsGeneration && plainContent.length > 20) {
                    try {
                        const { title: generatedTitle } = await aiApi.structure(plainContent.slice(0, 500));
                        if (generatedTitle && generatedTitle !== "Untitled") {
                            finalTitle = generatedTitle;
                            setTitle(finalTitle);
                        }
                    } catch {
                        // AI unavailable — keep existing title
                    }
                }
                await notesApi.update(id, { title: finalTitle, content: newContent });
                setSaved(true);
            } catch { }
            finally { setSaving(false); }
        },
        [id]
    );

    const scheduleSave = useCallback(
        (newTitle: string, newContent: string) => {
            // Don't autosave if the note is still empty
            if (isNoteEmpty(newTitle, newContent)) return;
            clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => save(newTitle, newContent), AUTOSAVE_DELAY);
        },
        [save]
    );

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                clearTimeout(saveTimer.current);
                save(title, content);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [title, content, save, saveTimer]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setTitle(v);
        scheduleSave(v, content);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.querySelector<HTMLElement>(".tiptap")?.focus();
        }
    };

    const handleSaveNow = () => {
        clearTimeout(saveTimer.current);
        save(title, content);
    };

    const handleContentChange = (html: string) => {
        setContent(html);
        scheduleSave(title, html);
    };

    const handleSlashCommand = useCallback(
        async (cmd: string) => {
            const plainText = content.replace(/<[^>]*>/g, "");
            if (!plainText.trim()) {
                // No content to act on — silently ignore
                return;
            }
            try {
                switch (cmd) {
                    case "structure": {
                        const { title: newTitle, structured_content } = await aiApi.structure(plainText);
                        setTitle(newTitle);
                        setContent(structured_content);
                        scheduleSave(newTitle, structured_content);
                        break;
                    }
                    case "summarize": {
                        const { result } = await aiApi.writingAssist(plainText, "summarize");
                        const newContent = `${content}\n\n<hr/><p><strong>Summary:</strong> ${result}</p>`;
                        setContent(newContent);
                        scheduleSave(title, newContent);
                        break;
                    }
                    case "expand": {
                        const snippet = plainText.slice(0, 300);
                        const { expanded } = await aiApi.expandIdea(snippet);
                        const newContent = `${content}\n\n<ul>${expanded.map((i) => `<li>${i}</li>`).join("")}</ul>`;
                        setContent(newContent);
                        scheduleSave(title, newContent);
                        break;
                    }
                    case "research": {
                        const snippet = plainText.slice(0, 500);
                        const { summary, key_insights } = await aiApi.research(snippet);
                        const newContent = `${content}\n\n<hr/><p><strong>Research:</strong> ${summary}</p><ul>${key_insights.map((i) => `<li>${i}</li>`).join("")}</ul>`;
                        setContent(newContent);
                        scheduleSave(title, newContent);
                        break;
                    }
                    case "flashcards":
                    case "tags":
                    case "meeting":
                        // These are handled in the ContextPanel / via other UI
                        break;
                }
            } catch {
                // AI unavailable — silently ignore, autosave state is unaffected
            }
        },
        [content, title, scheduleSave]
    );

    const handleVoiceNote = async (voiceTitle: string, voiceContent: string) => {
        setTitle(voiceTitle);
        setContent(voiceContent);
        await save(voiceTitle, voiceContent);
    };

    const handleInsertTranscript = (transcript: string) => {
        // Append transcript as a new paragraph to the existing editor content
        const appended = content
            ? `${content}<p>${transcript}</p>`
            : `<p>${transcript}</p>`;
        setContent(appended);
        scheduleSave(title, appended);
    };

    const handleDelete = async () => {
        if (!confirm("Delete this note?")) return;
        await notesApi.delete(id);
        router.push("/");
    };

    if (loadError) {
        return (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", color: "var(--text-muted)", padding: "40px" }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>Failed to load note</div>
                <div style={{ fontSize: "13px", color: "var(--accent-warning, #f59e0b)", fontFamily: "monospace", background: "var(--bg-elevated)", padding: "10px 16px", borderRadius: "8px", maxWidth: "600px", wordBreak: "break-all" }}>{loadError}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => router.push("/")}>Go home</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, minWidth: 0 }}>
            <div className="editor-shell" style={{ padding: "0 20px" }}>
                {/* Skeleton top bar */}
                <div className="editor-topbar">
                    <div style={{
                        height: "28px",
                        width: "240px",
                        borderRadius: "6px",
                        background: "var(--bg-tertiary)",
                        animation: "skeletonPulse 1.4s ease-in-out infinite",
                    }} />
                </div>
                {/* Skeleton body */}
                <div className="editor-content">
                    <div className="editor-body" style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "20px" }}>
                        {[85, 65, 95, 50, 75, 40, 80].map((w, i) => (
                            <div key={i} className="skeleton-shimmer" style={{
                                height: i === 0 ? "22px" : "14px",
                                width: `${w}%`,
                                borderRadius: "6px",
                                animationDelay: `${i * 0.08}s`,
                            }} />
                        ))}
                    </div>
                </div>
            </div>
            </div>
        );
    }

    const saveColor = saving
        ? "var(--accent-primary)"
        : saved
        ? "var(--success)"
        : "var(--text-muted)";

    const noteIsEmpty = isNoteEmpty(title, content);

    return (
        <div className="page-fade-in" style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, minWidth: 0 }}>
            <div className="editor-shell">
                {/* Realtime toast */}
                {realtimeToast && (
                    <div style={{
                        position: "fixed",
                        top: "16px",
                        right: "24px",
                        zIndex: 9999,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--accent-primary)",
                        borderRadius: "var(--radius-md)",
                        padding: "10px 16px",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        boxShadow: "var(--shadow-md)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}>
                        <span>Note updated by another user</span>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: "var(--accent-primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "3px 10px",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}
                        >
                            Refresh
                        </button>
                        <button
                            onClick={() => setRealtimeToast(false)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", lineHeight: 1 }}
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Top bar */}
                <div className="editor-topbar">
                    <input
                        className="editor-title-input"
                        value={title}
                        onChange={handleTitleChange}
                        onKeyDown={handleTitleKeyDown}
                        placeholder="Untitled"
                        id="note-title-input"
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <CollaborativeIndicator noteId={id} />
                        {/* Autosave indicator */}
                        <div className="autosave-indicator" style={{ color: saveColor }}>
                            {saving ? (
                                <><Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /><span>Saving…</span></>
                            ) : saved ? (
                                <><Check size={13} /><span>Saved</span></>
                            ) : (
                                <><Cloud size={13} /><span>Unsaved</span></>
                            )}
                        </div>
                        <button
                            className="btn-icon"
                            onClick={handleSaveNow}
                            title="Save now (Ctrl+S)"
                            style={{ color: saved ? "var(--text-muted)" : "var(--accent-primary)" }}
                        >
                            <Save size={15} />
                        </button>
                        <VoiceRecorder onNoteCreated={handleVoiceNote} onInsertTranscript={handleInsertTranscript} />
                        <button
                            className="btn-icon"
                            onClick={() => setPanelOpen((o) => !o)}
                            title={panelOpen ? "Hide AI panel" : "Show AI panel"}
                            style={{ color: panelOpen ? "var(--accent-primary)" : "var(--text-muted)" }}
                        >
                            <PanelRight size={15} />
                        </button>
                        <button
                            className="btn-icon"
                            onClick={handleDelete}
                            title="Delete note"
                            id="delete-note-btn"
                            style={{ color: "var(--text-muted)" }}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                {/* Empty note banner */}
                {noteIsEmpty && (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 20px",
                        background: "rgba(245,158,11,0.08)",
                        borderBottom: "1px solid rgba(245,158,11,0.2)",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                    }}>
                        <span>This note is empty.</span>
                        <button
                            onClick={handleDelete}
                            style={{
                                background: "none",
                                border: "1px solid rgba(245,158,11,0.4)",
                                borderRadius: "6px",
                                color: "var(--accent-warning, #f59e0b)",
                                cursor: "pointer",
                                fontSize: "12px",
                                padding: "2px 10px",
                            }}
                        >
                            Delete note
                        </button>
                        <span style={{ color: "var(--text-muted)" }}>or start writing.</span>
                    </div>
                )}

                {/* Editor body */}
                <div className="editor-content">
                    <div className="editor-body">
                        {showInsights && (
                            <div style={{ position: "relative", marginBottom: "12px" }}>
                                <DailyInsights />
                                <button
                                    onClick={() => setShowInsights(false)}
                                    style={{
                                        position: "absolute",
                                        top: "8px",
                                        right: "8px",
                                        background: "none",
                                        border: "none",
                                        color: "var(--text-muted)",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        padding: "2px",
                                    }}
                                >
                                    <span style={{ fontSize: "16px", lineHeight: 1 }}>×</span>
                                </button>
                            </div>
                        )}
                        <Editor content={content} onChange={handleContentChange} onSlashCommand={handleSlashCommand} />
                    </div>
                </div>
            </div>

            <ContextPanel noteId={id} content={content} open={panelOpen} />
        </div>
    );
}
