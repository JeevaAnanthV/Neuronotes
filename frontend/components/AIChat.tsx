"use client";

import { useState, useRef, useEffect } from "react";
import { aiApi, type NoteListItem } from "@/lib/api";

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: NoteListItem[];
}

export function AIChat() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I'm your AI knowledge assistant. Ask me anything about your notes, or ask me to summarize, connect ideas, or help you think through a concept.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput("");

        const userMsg: Message = { role: "user", content: text };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const allMsgs = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
            const { reply, sources } = await aiApi.chat(allMsgs);
            setMessages((prev) => [...prev, { role: "assistant", content: reply, sources }]);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const isNetwork = (err instanceof Error) && (err.message.includes("Network Error") || err.message.includes("ECONNREFUSED"));
            const isRateLimit = status === 429;
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: isNetwork
                        ? "⚠️ Cannot reach the API server. Make sure the backend is running on port 8001."
                        : isRateLimit
                        ? "⏳ Gemini API rate limit reached. Please wait ~30 seconds and try again."
                        : "⚠️ AI error — please try again in a moment.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-shell">
            <div
                style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <span style={{ fontSize: "20px" }}>💬</span>
                <div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>AI Chat</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Chat with your knowledge base</div>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((m, i) => (
                    <div key={i}>
                        <div className={`chat-bubble ${m.role}`}>{m.content}</div>
                        {m.sources && m.sources.length > 0 && (
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", paddingLeft: "4px" }}>
                                    Sources from your notes:
                                </div>
                                {m.sources.map((s) => (
                                    <a
                                        key={s.id}
                                        href={`/notes/${s.id}`}
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--accent)",
                                            textDecoration: "none",
                                            paddingLeft: "4px",
                                        }}
                                    >
                                        📝 {s.title || "Untitled"}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="chat-bubble assistant" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span className="loading-spinner" />
                        <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Thinking…</span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="chat-input-bar">
                <textarea
                    className="chat-input"
                    placeholder="Ask about your notes… (Enter to send, Shift+Enter for newline)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    id="chat-input"
                />
                <button
                    className="btn btn-primary"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    id="chat-send-btn"
                >
                    {loading ? <span className="loading-spinner" /> : "Send"}
                </button>
            </div>
        </div>
    );
}
