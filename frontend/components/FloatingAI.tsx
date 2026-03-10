"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, Bot } from "lucide-react";
import { aiApi } from "@/lib/api";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function FloatingAI() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const pathname = usePathname();

    // Focus input when panel opens
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 60);
    }, [open]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Keyboard shortcut + mobile nav toggle
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) setOpen(false);
            if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); setOpen((o) => !o); }
        };
        const onToggle = () => setOpen((o) => !o);
        window.addEventListener("keydown", onKey);
        window.addEventListener("toggle-floating-ai", onToggle);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("toggle-floating-ai", onToggle);
        };
    }, [open]);

    const contextNote = pathname.startsWith("/notes/") ? pathname.split("/")[2] : null;

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: Message = { role: "user", content: text };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));
            const noteIds = contextNote ? [contextNote] : undefined;
            const { reply } = await aiApi.chat(apiMessages, noteIds);
            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I couldn't reach the AI service. Please check your backend connection." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Floating circle button */}
            <button
                className="floating-ai-btn"
                onClick={() => setOpen((o) => !o)}
                title="AI Assistant (Ctrl+/)"
                aria-label="Open AI assistant"
                style={{
                    background: open
                        ? "linear-gradient(135deg, #4F46E5, #6366F1)"
                        : "linear-gradient(135deg, #6366F1, #818CF8)",
                }}
            >
                {open ? <X size={20} /> : <Sparkles size={20} />}
            </button>

            {/* Chat panel — slides up from bottom-right */}
            {open && (
                <div className="floating-ai-panel">
                    {/* Header */}
                    <div className="floating-ai-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #6366F1, #818CF8)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}>
                                <Bot size={13} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                                    NeuroNotes AI
                                </div>
                                {contextNote ? (
                                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                                        Using current note
                                    </div>
                                ) : (
                                    <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                                        Ask anything
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            className="btn-icon"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                            style={{ minWidth: 30, minHeight: 30 }}
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="floating-ai-messages">
                        {messages.length === 0 && (
                            <div style={{ textAlign: "center", padding: "16px 10px" }}>
                                <Sparkles size={20} style={{ color: "var(--text-muted)", margin: "0 auto 8px", display: "block" }} />
                                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                    Ask questions about your notes, generate content, or explore ideas.
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "92%" }}
                            >
                                <div style={{
                                    padding: "7px 11px",
                                    borderRadius: msg.role === "user"
                                        ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)"
                                        : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
                                    background: msg.role === "user" ? "var(--accent-primary)" : "var(--bg-tertiary)",
                                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                                    fontSize: "12.5px",
                                    lineHeight: 1.55,
                                    color: msg.role === "user" ? "white" : "var(--text-primary)",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "7px", padding: "7px 10px" }}>
                                <span className="loading-spinner" />
                                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Thinking…</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="floating-ai-input-row">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything…"
                            style={{
                                flex: 1,
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                padding: "7px 10px",
                                color: "var(--text-primary)",
                                outline: "none",
                                fontSize: "12.5px",
                                fontFamily: "inherit",
                                resize: "none",
                                maxHeight: "70px",
                                lineHeight: 1.5,
                                transition: "border-color 150ms var(--ease)",
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            className="btn-icon"
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            style={{
                                background: input.trim() ? "var(--accent-primary)" : "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                color: input.trim() ? "white" : "var(--text-muted)",
                                transition: "all 150ms var(--ease)",
                                borderRadius: "var(--radius-md)",
                                alignSelf: "flex-end",
                                minWidth: 32,
                                minHeight: 32,
                            }}
                            aria-label="Send"
                        >
                            <Send size={13} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
