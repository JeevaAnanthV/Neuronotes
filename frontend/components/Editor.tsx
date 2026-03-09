"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useRef, useEffect } from "react";
import { aiApi } from "@/lib/api";
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
} from "lucide-react";

const AI_ACTIONS = [
    { key: "improve", label: "Improve", icon: Sparkles },
    { key: "summarize", label: "Summarize", icon: FileText },
    { key: "expand", label: "Expand", icon: Expand },
    { key: "bullet", label: "Bullets", icon: List },
    { key: "explain", label: "Explain Simply", icon: GraduationCap },
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
            alert("AI service unavailable. Please check your API key and backend.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            ref={ref}
            className="ai-toolbar"
            style={{ left: position.x, top: position.y }}
        >
            {loading ? (
                <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="loading-spinner" />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>AI thinking…</span>
                </div>
            ) : (
                AI_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                        <button
                            key={a.key}
                            className="ai-toolbar-btn"
                            onClick={() => handleAction(a.key)}
                        >
                            <Icon size={13} />
                            {a.label}
                        </button>
                    );
                })
            )}
        </div>
    );
}

interface SlashMenuProps {
    position: { x: number; y: number };
    onSelect: (cmd: string) => void;
    onClose: () => void;
}

const SLASH_CMDS = [
    { cmd: "summarize", label: "Summarize note", icon: FileText },
    { cmd: "expand", label: "Expand idea", icon: Expand },
    { cmd: "flashcards", label: "Generate flashcards", icon: FlipHorizontal },
    { cmd: "structure", label: "Structure note", icon: Layers },
    { cmd: "tags", label: "Generate tags", icon: Tag },
    { cmd: "research", label: "Research topic", icon: GraduationCap },
    { cmd: "meeting", label: "Meeting notes", icon: Mic },
];

function SlashMenu({ position, onSelect, onClose }: SlashMenuProps) {
    const [sel, setSel] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, SLASH_CMDS.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); onSelect(SLASH_CMDS[sel].cmd); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [sel, onSelect, onClose]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        setTimeout(() => document.addEventListener("mousedown", handler), 100);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                padding: "4px",
                boxShadow: "var(--shadow-md)",
                zIndex: 1000,
                animation: "fadeIn 0.12s ease",
                minWidth: "220px",
            }}
        >
            <div style={{ padding: "4px 10px 6px", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                AI Commands
            </div>
            {SLASH_CMDS.map((c, i) => {
                const Icon = c.icon;
                return (
                    <div
                        key={c.cmd}
                        onClick={() => onSelect(c.cmd)}
                        style={{
                            padding: "8px 12px",
                            borderRadius: "7px",
                            cursor: "pointer",
                            background: i === sel ? "var(--bg-hover)" : "transparent",
                            fontSize: "13px",
                            color: "var(--text-primary)",
                            transition: "background 100ms ease",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                        }}
                        onMouseEnter={() => setSel(i)}
                    >
                        <Icon size={14} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
                        {c.label}
                    </div>
                );
            })}
        </div>
    );
}

interface Props {
    content: string;
    onChange: (html: string) => void;
    onSlashCommand: (cmd: string) => void;
}

export function Editor({ content, onChange, onSlashCommand }: Props) {
    const [toolbar, setToolbar] = useState<{ text: string; pos: { x: number; y: number } } | null>(null);
    const [slashMenu, setSlashMenu] = useState<{ pos: { x: number; y: number } } | null>(null);
    const [showAiHint, setShowAiHint] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: "Start writing… or type / for AI commands" }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
            // Show AI hint after 3s of inactivity
            clearTimeout(hintTimerRef.current);
            setShowAiHint(false);
            const text = editor.getText();
            if (text.length > 30) {
                hintTimerRef.current = setTimeout(() => setShowAiHint(true), 3000);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            const { from, to } = editor.state.selection;
            if (from === to) {
                setToolbar(null);
                return;
            }
            const selectedText = editor.state.doc.textBetween(from, to, " ");
            if (!selectedText.trim() || selectedText.length < 10) {
                setToolbar(null);
                return;
            }
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setToolbar({ text: selectedText, pos: { x: rect.left, y: rect.top - 52 } });
            }
        },
        editorProps: {
            handleKeyDown: (view, event) => {
                if (event.key === "/") {
                    setTimeout(() => {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            const rect = range.getBoundingClientRect();
                            setSlashMenu({ pos: { x: rect.left, y: rect.top + 24 } });
                        }
                    }, 10);
                }
                // Hide AI hint on typing
                setShowAiHint(false);
                return false;
            },
        },
    });

    useEffect(() => {
        return () => clearTimeout(hintTimerRef.current);
    }, []);

    const applyAIResult = useCallback(
        (result: string) => {
            if (!editor) return;
            const { from, to } = editor.state.selection;
            editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
        },
        [editor]
    );

    const handleSlashCommand = useCallback(
        (cmd: string) => {
            if (editor) {
                const { from } = editor.state.selection;
                editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
            }
            setSlashMenu(null);
            onSlashCommand(cmd);
        },
        [editor, onSlashCommand]
    );

    return (
        <div ref={editorRef} style={{ position: "relative" }}>
            <EditorContent editor={editor} />
            {showAiHint && (
                <div className="ai-hint">
                    <Sparkles size={11} />
                    Type / for AI commands
                </div>
            )}
            {toolbar && (
                <AIToolbar
                    text={toolbar.text}
                    position={toolbar.pos}
                    onApply={applyAIResult}
                    onClose={() => setToolbar(null)}
                />
            )}
            {slashMenu && (
                <SlashMenu
                    position={slashMenu.pos}
                    onSelect={handleSlashCommand}
                    onClose={() => setSlashMenu(null)}
                />
            )}
        </div>
    );
}
