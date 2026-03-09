"use client";

import { useEffect, useState } from "react";
import { notesApi, aiApi } from "@/lib/api";
import { Bell, Calendar, CheckCircle2, Circle, AlertTriangle, Info } from "lucide-react";

interface ActionItem {
    task: string;
    due_hint: string | null;
    priority: "high" | "medium" | "low";
    noteId: string;
    noteTitle: string;
    key: string;
}

function priorityIcon(priority: string) {
    if (priority === "high") return <AlertTriangle size={13} color="#ef4444" />;
    if (priority === "medium") return <Info size={13} color="#f59e0b" />;
    return <Info size={13} color="var(--text-muted)" />;
}

function priorityOrder(p: string): number {
    return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

function storageKey(k: string) { return `action-done:${k}`; }

export default function RemindersPage() {
    const [actions, setActions] = useState<ActionItem[]>([]);
    const [done, setDone] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load done state from localStorage
        const doneKeys: Set<string> = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith("action-done:") && localStorage.getItem(k) === "1") {
                doneKeys.add(k.replace("action-done:", ""));
            }
        }
        setDone(doneKeys);
    }, []);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const notes = await notesApi.list();
                const candidates = notes.slice(0, 15);

                // Fetch all note details in parallel
                const detailResults = await Promise.allSettled(
                    candidates.map(n => notesApi.get(n.id))
                );

                // Extract actions in parallel for notes with enough content
                const actionJobs = detailResults
                    .map((r, i) => ({ r, note: candidates[i] }))
                    .filter(({ r }) => {
                        if (r.status !== "fulfilled") return false;
                        return r.value.content.replace(/<[^>]*>/g, "").length >= 30;
                    })
                    .map(({ r, note }) =>
                        aiApi.extractActions((r as PromiseFulfilledResult<{ content: string }>).value.content, note.id)
                            .then(({ actions: extracted }) => ({ extracted, note }))
                    );

                const actionResults = await Promise.allSettled(actionJobs);
                const allActions: ActionItem[] = [];
                for (const res of actionResults) {
                    if (res.status !== "fulfilled") continue;
                    const { extracted, note } = res.value;
                    for (const a of extracted) {
                        allActions.push({
                            ...a,
                            noteId: note.id,
                            noteTitle: note.title,
                            key: `${note.id}:${a.task.slice(0, 40)}`,
                        });
                    }
                }
                allActions.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
                setActions(allActions);
            } catch { /* ignore */ }
            setLoading(false);
        }
        load();
    }, []);

    function toggleDone(key: string) {
        setDone(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
                localStorage.removeItem(storageKey(key));
            } else {
                next.add(key);
                localStorage.setItem(storageKey(key), "1");
            }
            return next;
        });
    }

    function openCalendar(task: string, dueHint: string | null) {
        const text = encodeURIComponent(task);
        const dates = encodeURIComponent(dueHint || "");
        window.open(`https://calendar.google.com/calendar/r/eventedit?text=${text}&details=${dates}`, "_blank");
    }

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
                <span className="loading-spinner" style={{ width: 32, height: 32 }} />
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Extracting action items from notes...</span>
            </div>
        );
    }

    const pending = actions.filter(a => !done.has(a.key));
    const completed = actions.filter(a => done.has(a.key));

    return (
        <div style={{ padding: "32px", maxWidth: "720px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
                <Bell size={20} color="var(--accent-primary)" />
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Reminders & Action Items</h1>
            </div>

            {actions.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", fontSize: "14px" }}>
                    No action items found in your notes.
                </div>
            )}

            {pending.length > 0 && (
                <>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                        Pending ({pending.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
                        {pending.map(a => (
                            <div key={a.key} style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "12px",
                                padding: "12px 16px",
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                            }}>
                                <button
                                    onClick={() => toggleDone(a.key)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", flexShrink: 0, marginTop: "1px" }}
                                >
                                    <Circle size={16} />
                                </button>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                        {priorityIcon(a.priority)}
                                        <span style={{ fontSize: "13.5px", color: "var(--text-primary)", fontWeight: 500 }}>{a.task}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <a href={`/notes/${a.noteId}`} style={{ fontSize: "11px", color: "var(--accent-primary)", textDecoration: "none" }}>
                                            {a.noteTitle}
                                        </a>
                                        {a.due_hint && (
                                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{a.due_hint}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => openCalendar(a.task, a.due_hint)}
                                    title="Add to Google Calendar"
                                    style={{
                                        background: "none",
                                        border: "1px solid var(--border)",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontSize: "11px",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Calendar size={12} /> Calendar
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {completed.length > 0 && (
                <>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                        Completed ({completed.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {completed.map(a => (
                            <div key={a.key} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "10px 14px",
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                opacity: 0.6,
                            }}>
                                <button
                                    onClick={() => toggleDone(a.key)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", padding: "2px", flexShrink: 0 }}
                                >
                                    <CheckCircle2 size={16} />
                                </button>
                                <span style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "line-through" }}>{a.task}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
