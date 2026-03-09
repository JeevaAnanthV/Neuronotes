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
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) setOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
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
            const { reply } = await aiApi.chat(apiMessages);
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
            {/* Floating button */}
            <button
                className="floating-ai-btn"
                onClick={() => setOpen((o) => !o)}
                title="Ask NeuroNotes AI (Ctrl+/)"
                aria-label="Open AI assistant"
            >
                <Sparkles size={22} />
            </button>

            {/* Chat panel */}
            {open && (
                <div className="floating-ai-panel">
                    <div className="floating-ai-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "var(--accent-gradient)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                <Bot size={14} color="white" />
                            </div>
                            <div>
                                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                                    Ask NeuroNotes
                                </div>
                                {contextNote && (
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                        Using current note as context
                                    </div>
                                )}
                            </div>
                        </div>
                        <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Close AI panel">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="floating-ai-messages">
                        {messages.length === 0 && (
                            <div style={{ textAlign: "center", padding: "20px 12px" }}>
                                <Sparkles size={24} style={{ color: "var(--text-muted)", margin: "0 auto 8px", display: "block" }} />
                                <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                    Ask anything about your notes or request AI-generated content.
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                                    maxWidth: "90%",
                                }}
                            >
                                <div style={{
                                    padding: "8px 12px",
                                    borderRadius: msg.role === "user"
                                        ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)"
                                        : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
                                    background: msg.role === "user" ? "var(--accent-primary)" : "var(--bg-tertiary)",
                                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                                    fontSize: "13px",
                                    lineHeight: 1.5,
                                    color: msg.role === "user" ? "white" : "var(--text-primary)",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
                                <span className="loading-spinner" />
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Thinking…</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="floating-ai-input-row">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything… (Enter to send)"
                            style={{
                                flex: 1,
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                padding: "8px 12px",
                                color: "var(--text-primary)",
                                outline: "none",
                                fontSize: "13px",
                                fontFamily: "Inter, sans-serif",
                                resize: "none",
                                maxHeight: "80px",
                                lineHeight: 1.5,
                                transition: "border-color 120ms ease",
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
                                transition: "all 120ms ease",
                                borderRadius: "var(--radius-md)",
                                alignSelf: "flex-end",
                            }}
                            aria-label="Send message"
                        >
                            <Send size={15} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
