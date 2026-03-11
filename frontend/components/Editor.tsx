"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useState, useCallback, useRef, useEffect } from "react";
import { aiApi, api } from "@/lib/api";
import {
    Sparkles,
    FileText,
    Expand,
    List,
    GraduationCap,
    Layers,
    Tag,
    FlipHorizontal,
    Mic,
    Image as ImageIcon,
    Heading1,
    Heading2,
    Bold,
    Italic,
    Code,
    Quote,
    Minus,
    Loader2,
    MessageSquare,
    Swords,
    Wand2,
    CheckSquare,
} from "lucide-react";

// ── AI Selection Toolbar ──────────────────────────────────────────────────────

const AI_ACTIONS = [
    { key: "improve", label: "Improve", icon: Sparkles },
    { key: "summarize", label: "Summarize", icon: FileText },
    { key: "expand", label: "Expand", icon: Expand },
    { key: "bullet", label: "Bullets", icon: List },
    { key: "explain", label: "Explain", icon: GraduationCap },
];

interface AIToolbarProps {
    text: string;
    position: { x: number; y: number };
    onApply: (result: string) => void;
    onClose: () => void;
}

function AIToolbar({ text, position, onApply, onClose }: AIToolbarProps) {
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        setTimeout(() => document.addEventListener("mousedown", handler), 100);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const handleAction = async (action: string) => {
        setLoading(true);
        try {
            const { result } = await aiApi.writingAssist(text, action);
            onApply(result);
            onClose();
        } catch {
            // AI unavailable — loading state resets so user can retry
        } finally {
            setLoading(false);
        }
    };

    const mobileStyle = isMobile
        ? { position: "fixed" as const, bottom: 72, left: "50%", transform: "translateX(-50%)", top: "auto", width: "calc(100vw - 32px)", maxWidth: 480 }
        : { left: position.x, top: position.y };

    return (
        <div
            ref={ref}
            className="ai-toolbar"
            style={mobileStyle}
            // Prevent mousedown from blurring the editor and clearing the selection
            onMouseDown={(e) => e.preventDefault()}
        >
            {loading ? (
                <div style={{ padding: "6px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>AI thinking…</span>
                </div>
            ) : (
                AI_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                        <button key={a.key} className="ai-toolbar-btn" onClick={() => handleAction(a.key)}>
                            <Icon size={12} />
                            {a.label}
                        </button>
                    );
                })
            )}
        </div>
    );
}

// ── Slash Command Menu ────────────────────────────────────────────────────────

interface SlashGroup {
    section: string;
    items: { cmd: string; label: string; desc: string; icon: React.ElementType }[];
}

const SLASH_GROUPS: SlashGroup[] = [
    {
        section: "Writing",
        items: [
            { cmd: "heading1", label: "Heading 1", desc: "Large section heading", icon: Heading1 },
            { cmd: "heading2", label: "Heading 2", desc: "Medium section heading", icon: Heading2 },
            { cmd: "bold", label: "Bold", desc: "Bold text", icon: Bold },
            { cmd: "italic", label: "Italic", desc: "Italic text", icon: Italic },
            { cmd: "code", label: "Code", desc: "Inline code block", icon: Code },
            { cmd: "quote", label: "Quote", desc: "Blockquote", icon: Quote },
            { cmd: "divider", label: "Divider", desc: "Horizontal rule", icon: Minus },
            { cmd: "todo", label: "Todo List", desc: "Checkbox task list", icon: CheckSquare },
        ],
    },
    {
        section: "AI",
        items: [
            { cmd: "summarize", label: "Summarize", desc: "Condense note content", icon: FileText },
            { cmd: "expand", label: "Expand", desc: "Elaborate on idea", icon: Expand },
            { cmd: "research", label: "Research", desc: "Deep-dive analysis", icon: GraduationCap },
            { cmd: "meeting", label: "Meeting Notes", desc: "Extract meeting structure", icon: MessageSquare },
            { cmd: "flashcards", label: "Flashcards", desc: "Generate study cards", icon: FlipHorizontal },
            { cmd: "debate", label: "Debate", desc: "Counter-arguments", icon: Swords },
            { cmd: "improve", label: "Improve", desc: "Enhance writing quality", icon: Wand2 },
        ],
    },
    {
        section: "Insert",
        items: [
            { cmd: "image", label: "Image", desc: "Insert image or extract text", icon: ImageIcon },
            { cmd: "voice", label: "Voice", desc: "Record voice note", icon: Mic },
            { cmd: "structure", label: "Structure", desc: "Auto-organize note", icon: Layers },
            { cmd: "tags", label: "Tags", desc: "Generate smart tags", icon: Tag },
        ],
    },
];

const ALL_SLASH_ITEMS = SLASH_GROUPS.flatMap((g) => g.items);

interface SlashMenuProps {
    position: { x: number; y: number };
    query: string;
    onSelect: (cmd: string) => void;
    onClose: () => void;
}

function SlashMenu({ position, query, onSelect, onClose }: SlashMenuProps) {
    const [sel, setSel] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    const filtered = query
        ? ALL_SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()) || i.desc.toLowerCase().includes(query.toLowerCase()))
        : null;

    const flatItems = filtered || ALL_SLASH_ITEMS;

    useEffect(() => { setSel(0); }, [query]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flatItems.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); if (flatItems[sel]) onSelect(flatItems[sel].cmd); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [sel, flatItems, onSelect, onClose]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        setTimeout(() => document.addEventListener("mousedown", handler), 100);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    let globalIdx = 0;

    const renderItems = () => {
        if (filtered) {
            return filtered.map((item, i) => {
                const Icon = item.icon;
                const isSelected = i === sel;
                return (
                    <div
                        key={item.cmd}
                        className={`slash-menu-item${isSelected ? " selected" : ""}`}
                        onClick={() => onSelect(item.cmd)}
                        onMouseEnter={() => setSel(i)}
                    >
                        <div className="cmd-icon"><Icon size={12} /></div>
                        <div>
                            <div>{item.label}</div>
                            <div className="cmd-desc">{item.desc}</div>
                        </div>
                    </div>
                );
            });
        }

        return SLASH_GROUPS.map((group) => (
            <div key={group.section}>
                <div className="slash-menu-section">{group.section}</div>
                {group.items.map((item) => {
                    const Icon = item.icon;
                    const myIdx = globalIdx++;
                    const isSelected = myIdx === sel;
                    return (
                        <div
                            key={item.cmd}
                            className={`slash-menu-item${isSelected ? " selected" : ""}`}
                            onClick={() => onSelect(item.cmd)}
                            onMouseEnter={() => setSel(myIdx)}
                        >
                            <div className="cmd-icon"><Icon size={12} /></div>
                            <div>
                                <div>{item.label}</div>
                                <div className="cmd-desc">{item.desc}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        ));
    };

    // Clamp position so menu stays in viewport
    const menuStyle: React.CSSProperties = {
        position: "fixed",
        left: Math.min(position.x, window.innerWidth - 260),
        top: Math.min(position.y, window.innerHeight - 300),
    };

    if (flatItems.length === 0) return null;

    return (
        <div ref={ref} className="slash-menu" style={menuStyle}>
            {renderItems()}
        </div>
    );
}

// ── Image Import Handler ──────────────────────────────────────────────────────

interface ImageImportProps {
    onExtracted: (text: string) => void;
    onClose: () => void;
}

function ImageImportPanel({ onExtracted, onClose }: ImageImportProps) {
    const [loading, setLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.post<{ extracted_text: string; structured_content: string }>(
                "/ai/image-to-text",
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            onExtracted(res.data.extracted_text);
        } catch {
            // OCR failed — loading state resets, user can try again
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-lg)",
                    padding: "24px",
                    width: 300,
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "var(--shadow-lg)",
                    animation: "paletteIn 0.15s var(--ease)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Import Image
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Extract text from handwriting, documents, or whiteboards.
                </div>
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                        <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite", color: "var(--accent-primary)" }} />
                        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Extracting text…</span>
                    </div>
                ) : (
                    <>
                        <button
                            className="btn btn-ghost"
                            style={{ justifyContent: "center", gap: "8px" }}
                            onClick={() => cameraRef.current?.click()}
                        >
                            <ImageIcon size={14} />
                            Take Photo
                        </button>
                        <button
                            className="btn btn-primary"
                            style={{ justifyContent: "center", gap: "8px" }}
                            onClick={() => fileRef.current?.click()}
                        >
                            <ImageIcon size={14} />
                            Upload Image
                        </button>
                    </>
                )}
                <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
            </div>
        </div>
    );
}

// ── Calendar Event Banner ─────────────────────────────────────────────────────

interface CalendarEvent {
    title: string;
    date_hint: string;
    time_hint: string;
    description: string;
}

interface CalendarBannerProps {
    events: CalendarEvent[];
    onDismiss: () => void;
}

function CalendarBanner({ events, onDismiss }: CalendarBannerProps) {
    const event = events[0];
    if (!event) return null;

    const buildCalendarUrl = (e: CalendarEvent) => {
        const encoded = encodeURIComponent;
        return `https://calendar.google.com/calendar/r/eventedit?text=${encoded(e.title)}&details=${encoded(e.description || e.title)}&sf=true&output=xml`;
    };

    return (
        <div className="calendar-event-banner" style={{ marginTop: "12px" }}>
            <span style={{ fontSize: "13px" }}>📅</span>
            <span style={{ flex: 1, fontSize: "12.5px" }}>
                <strong>{event.title}</strong>
                {event.date_hint ? ` — ${event.date_hint}${event.time_hint ? ` ${event.time_hint}` : ""}` : ""}
            </span>
            <button
                className="cal-add-btn"
                onClick={() => window.open(buildCalendarUrl(event), "_blank")}
                style={{ minHeight: 0 }}
            >
                Add to Calendar
            </button>
            <button
                className="cal-dismiss-btn"
                onClick={onDismiss}
                style={{ minHeight: 0 }}
            >
                Dismiss
            </button>
        </div>
    );
}

// ── Main Editor Component ─────────────────────────────────────────────────────

interface Props {
    content: string;
    onChange: (html: string) => void;
    onSlashCommand: (cmd: string) => void;
}

export function Editor({ content, onChange, onSlashCommand }: Props) {
    const [toolbar, setToolbar] = useState<{ text: string; pos: { x: number; y: number } } | null>(null);
    const [slashMenu, setSlashMenu] = useState<{ pos: { x: number; y: number }; query: string } | null>(null);
    const [slashQuery, setSlashQuery] = useState("");
    const [showAiHint, setShowAiHint] = useState(false);
    const [ghostSuggestion, setGhostSuggestion] = useState<string | null>(null);
    const [isMobileView, setIsMobileView] = useState(false);
    const [showImageImport, setShowImageImport] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [calendarDismissed, setCalendarDismissed] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const coachTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const calendarTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const slashQueryRef = useRef("");

    useEffect(() => {
        const checkMobile = () => setIsMobileView(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: "Start writing… or type / for commands" }),
            TaskList,
            TaskItem.configure({ nested: true }),
        ],
        content,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Defer parent state update to avoid "setState during render" warning.
            // TipTap fires onUpdate synchronously inside its own render — calling
            // the parent's onChange directly triggers React's cross-component setState error.
            setTimeout(() => onChange(html), 0);

            clearTimeout(hintTimerRef.current);
            setShowAiHint(false);
            const text = editor.getText();
            if (text.length > 30) {
                hintTimerRef.current = setTimeout(() => setShowAiHint(true), 3000);
            }

            // Writing coach
            clearTimeout(coachTimerRef.current);
            setGhostSuggestion(null);
            const { $from } = editor.state.selection;
            const paragraphText = $from.parent.textContent || "";
            if (paragraphText.length >= 50) {
                coachTimerRef.current = setTimeout(async () => {
                    try {
                        const res = await api.post<{ suggestion: string }>("/ai/writing-coach", { text: paragraphText });
                        if (res.data?.suggestion) setGhostSuggestion(res.data.suggestion);
                    } catch { /* ignore */ }
                }, 2000);
            }

            // Calendar event detection (debounced 5s, only when content is substantial)
            if (!calendarDismissed && text.length > 50) {
                clearTimeout(calendarTimerRef.current);
                calendarTimerRef.current = setTimeout(async () => {
                    try {
                        const res = await api.post<{ events: CalendarEvent[] }>("/ai/detect-events", { content: html });
                        if (res.data?.events?.length) {
                            setCalendarEvents(res.data.events);
                        }
                    } catch { /* ignore */ }
                }, 5000);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            if (from === to) { setToolbar(null); return; }
            const selectedText = editor.state.doc.textBetween(from, to, " ");
            if (!selectedText.trim() || selectedText.length < 10) { setToolbar(null); return; }
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setToolbar({ text: selectedText, pos: { x: rect.left, y: rect.top - 46 } });
            }
        },
        editorProps: {
            handleKeyDown: (view, event) => {
                // Ctrl+K / Cmd+K — let the window listener handle it (CommandPalette)
                if ((event.ctrlKey || event.metaKey) && event.key === "k") {
                    // Re-dispatch on the window so Sidebar.tsx's handler fires
                    window.dispatchEvent(new KeyboardEvent("keydown", {
                        key: "k",
                        ctrlKey: event.ctrlKey,
                        metaKey: event.metaKey,
                        bubbles: true,
                    }));
                    return true; // tell TipTap we handled it (suppress default)
                }

                if (event.key === "/") {
                    setTimeout(() => {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            const rect = range.getBoundingClientRect();
                            setSlashQuery("");
                            slashQueryRef.current = "";
                            setSlashMenu({ pos: { x: rect.left, y: rect.bottom + 4 }, query: "" });
                        }
                    }, 10);
                    return false;
                }

                if (slashMenu) {
                    if (event.key === "Backspace") {
                        const newQ = slashQueryRef.current.slice(0, -1);
                        slashQueryRef.current = newQ;
                        setSlashQuery(newQ);
                        setSlashMenu((m) => m ? { ...m, query: newQ } : null);
                        return false;
                    }
                    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                        const newQ = slashQueryRef.current + event.key;
                        slashQueryRef.current = newQ;
                        setSlashQuery(newQ);
                        setSlashMenu((m) => m ? { ...m, query: newQ } : null);
                    }
                }

                if (event.key === "Tab") {
                    setGhostSuggestion((current) => {
                        if (current) {
                            event.preventDefault();
                            view.dispatch(view.state.tr.insertText(" " + current));
                            return null;
                        }
                        return current;
                    });
                    return false;
                }
                if (event.key === "Escape") setGhostSuggestion(null);
                setShowAiHint(false);
                return false;
            },
        },
    });

    useEffect(() => {
        return () => {
            clearTimeout(hintTimerRef.current);
            clearTimeout(coachTimerRef.current);
            clearTimeout(calendarTimerRef.current);
        };
    }, []);

    /**
     * Convert a markdown string to minimal HTML before inserting into TipTap.
     * TipTap is a rich-text editor — it renders HTML, not markdown syntax.
     */
    const markdownToHtml = (md: string): string => {
        return md
            // Headings
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
            // Bold + italic combo
            .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
            // Bold
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/__(.+?)__/g, "<strong>$1</strong>")
            // Italic
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/_(.+?)_/g, "<em>$1</em>")
            // Inline code
            .replace(/`(.+?)`/g, "<code>$1</code>")
            // Unordered list items
            .replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>")
            // Ordered list items
            .replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>")
            // Wrap consecutive <li> tags in <ul>
            .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
            // Blockquote
            .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
            // Horizontal rule
            .replace(/^---+$/gm, "<hr>")
            // Blank lines → paragraph breaks (simple pass)
            .replace(/\n{2,}/g, "</p><p>")
            // Single newlines → space
            .replace(/\n/g, " ");
    };

    const applyAIResult = useCallback(
        (result: string) => {
            if (!editor) return;
            const { from, to } = editor.state.selection;
            const html = markdownToHtml(result);
            editor.chain().focus().deleteRange({ from, to }).insertContent(html).run();
        },
        [editor]
    );

    const handleSlashCommand = useCallback(
        (cmd: string) => {
            if (editor) {
                const { from } = editor.state.selection;
                // Delete the slash + any typed query
                const deleteLen = 1 + slashQueryRef.current.length;
                editor.chain().focus().deleteRange({ from: from - deleteLen, to: from }).run();
            }
            setSlashMenu(null);
            setSlashQuery("");
            slashQueryRef.current = "";

            // Handle writing-level commands directly in editor
            if (editor) {
                switch (cmd) {
                    case "heading1":
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                        return;
                    case "heading2":
                        editor.chain().focus().toggleHeading({ level: 2 }).run();
                        return;
                    case "bold":
                        editor.chain().focus().toggleBold().run();
                        return;
                    case "italic":
                        editor.chain().focus().toggleItalic().run();
                        return;
                    case "code":
                        editor.chain().focus().toggleCode().run();
                        return;
                    case "quote":
                        editor.chain().focus().toggleBlockquote().run();
                        return;
                    case "divider":
                        editor.chain().focus().setHorizontalRule().run();
                        return;
                    case "todo":
                        editor.chain().focus().toggleTaskList().run();
                        return;
                    case "image":
                        setShowImageImport(true);
                        return;
                }
            }

            onSlashCommand(cmd);
        },
        [editor, onSlashCommand]
    );

    const handleImageExtracted = useCallback(
        (text: string) => {
            if (!editor) return;
            editor.chain().focus().insertContent(text).run();
            setShowImageImport(false);
        },
        [editor]
    );

    return (
        <div ref={editorRef} style={{ position: "relative" }}>
            <EditorContent editor={editor} />

            {/* Ghost writing coach suggestion */}
            {ghostSuggestion && (
                <div style={{
                    marginTop: "2px",
                    padding: "4px 8px",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: 0.7,
                }}>
                    <span style={{
                        fontSize: "9px",
                        background: "var(--accent-primary)",
                        color: "white",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        fontStyle: "normal",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                    }}>AI</span>
                    <span>{ghostSuggestion}</span>
                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontStyle: "normal" }}>
                        {isMobileView ? "Tap to insert" : "Tab to accept · Esc to dismiss"}
                    </span>
                </div>
            )}

            {/* AI hint */}
            {showAiHint && (
                <div className="ai-hint">
                    <Sparkles size={10} />
                    Type / for commands
                </div>
            )}

            {/* AI selection toolbar */}
            {toolbar && (
                <AIToolbar
                    text={toolbar.text}
                    position={toolbar.pos}
                    onApply={applyAIResult}
                    onClose={() => setToolbar(null)}
                />
            )}

            {/* Slash command menu */}
            {slashMenu && (
                <SlashMenu
                    position={slashMenu.pos}
                    query={slashQuery}
                    onSelect={handleSlashCommand}
                    onClose={() => { setSlashMenu(null); setSlashQuery(""); slashQueryRef.current = ""; }}
                />
            )}

            {/* Image import panel */}
            {showImageImport && (
                <ImageImportPanel
                    onExtracted={handleImageExtracted}
                    onClose={() => setShowImageImport(false)}
                />
            )}

            {/* Calendar event banner */}
            {calendarEvents.length > 0 && !calendarDismissed && (
                <CalendarBanner
                    events={calendarEvents}
                    onDismiss={() => { setCalendarDismissed(true); setCalendarEvents([]); }}
                />
            )}
        </div>
    );
}
