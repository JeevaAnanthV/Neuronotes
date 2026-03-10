"use client";

import { useState, useRef, useEffect } from "react";
import { aiApi, api, type NoteListItem } from "@/lib/api";
import { createClient } from "@/lib/supabase";

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: NoteListItem[];
}

const WELCOME_MSG: Message = {
    role: "assistant",
    content: "Hi! I'm your AI knowledge assistant. Ask me anything about your notes, or ask me to summarize, connect ideas, or help you think through a concept.",
};

export function AIChat() {
    const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load user and chat history on mount
    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id ?? null;
            setUserId(uid);

            if (uid) {
                try {
                    const res = await api.get<{ messages: { role: string; content: string; created_at: string }[] }>(
                        "/ai/chat/history",
                        { params: { user_id: uid, limit: 40 } }
                    );
                    const history = res.data.messages || [];
                    if (history.length > 0) {
                        const loaded: Message[] = history.map((m) => ({
                            role: m.role as "user" | "assistant",
                            content: m.content,
                        }));
                        setMessages([WELCOME_MSG, ...loaded]);
                    }
                } catch {
                    // history fetch failure is non-fatal
                }
            }
            setHistoryLoaded(true);
        };
        init();
    }, []);

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
            const { reply, sources } = await aiApi.chat(allMsgs, undefined, userId ?? undefined);
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
                        ? "Cannot reach the API server. Make sure the backend is running on port 8001."
                        : isRateLimit
                        ? "Gemini API rate limit reached. Please wait ~30 seconds and try again."
                        : "AI error — please try again in a moment.",
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
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Chat with your knowledge base
                        {historyLoaded && userId && messages.length > 1 && (
                            <span style={{ marginLeft: "8px", color: "var(--accent-primary)" }}>· history loaded</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="chat-messages">
                {!historyLoaded && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px" }}>
                        <span className="loading-spinner" style={{ width: 12, height: 12 }} />
                        Loading history…
                    </div>
                )}
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
                                        {s.title || "Untitled"}
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
