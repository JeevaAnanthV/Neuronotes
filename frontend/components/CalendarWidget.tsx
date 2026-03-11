"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { NoteListItem } from "@/lib/api";

interface Props {
    notes: NoteListItem[];
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
    // Returns 0=Sun..6=Sat
    return new Date(year, month, 1).getDay();
}

function toDateKey(dateStr: string) {
    // Returns "YYYY-MM-DD" from ISO string
    return dateStr.slice(0, 10);
}

export function CalendarWidget({ notes }: Props) {
    const router = useRouter();
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [tooltip, setTooltip] = useState<{ day: number; notes: NoteListItem[]; x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build a map: "YYYY-MM-DD" → NoteListItem[]
    const notesByDay = new Map<string, NoteListItem[]>();
    for (const note of notes) {
        const key = toDateKey(note.updated_at);
        if (!notesByDay.has(key)) notesByDay.set(key, []);
        notesByDay.get(key)!.push(note);
    }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const DAY_LABELS = ["S","M","T","W","T","F","S"];

    // Close tooltip on outside click
    useEffect(() => {
        if (!tooltip) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setTooltip(null);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", handler), 50);
        return () => document.removeEventListener("mousedown", handler);
    }, [tooltip]);

    const handleDayClick = (day: number, e: React.MouseEvent) => {
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayNotes = notesByDay.get(key);
        if (!dayNotes || dayNotes.length === 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ day, notes: dayNotes, x: rect.left, y: rect.bottom + 4 });
    };

    // Build grid cells: blanks + days
    const cells: { day: number | null }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return (
        <div ref={containerRef} style={{ padding: "8px 10px 6px", userSelect: "none" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <button
                    onClick={prevMonth}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", display: "flex", alignItems: "center", minHeight: 0 }}
                >
                    <ChevronLeft size={12} />
                </button>
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                    {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button
                    onClick={nextMonth}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", display: "flex", alignItems: "center", minHeight: 0 }}
                >
                    <ChevronRight size={12} />
                </button>
            </div>

            {/* Day-of-week labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", marginBottom: "3px" }}>
                {DAY_LABELS.map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: "9px", color: "var(--text-muted)", fontWeight: 600 }}>{d}</div>
                ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                {cells.map((cell, idx) => {
                    if (!cell.day) return <div key={idx} />;
                    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                    const hasNotes = notesByDay.has(key);
                    const isToday = key === todayKey;
                    return (
                        <div
                            key={idx}
                            onClick={(e) => handleDayClick(cell.day!, e)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "2px 0",
                                borderRadius: "4px",
                                cursor: hasNotes ? "pointer" : "default",
                                background: isToday ? "var(--accent-dim)" : "transparent",
                                transition: "background 100ms ease",
                                position: "relative",
                            }}
                            onMouseEnter={(e) => {
                                if (hasNotes) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = isToday ? "var(--accent-dim)" : "transparent";
                            }}
                        >
                            <span style={{
                                fontSize: "10px",
                                color: isToday ? "var(--accent-primary)" : hasNotes ? "var(--text-primary)" : "var(--text-muted)",
                                fontWeight: isToday ? 700 : hasNotes ? 600 : 400,
                                lineHeight: 1,
                            }}>
                                {cell.day}
                            </span>
                            {hasNotes && (
                                <div style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: "50%",
                                    background: "var(--accent-primary)",
                                    marginTop: "1px",
                                    flexShrink: 0,
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Tooltip popover */}
            {tooltip && (
                <div
                    style={{
                        position: "fixed",
                        left: Math.min(tooltip.x, window.innerWidth - 200),
                        top: tooltip.y,
                        zIndex: 9999,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-md)",
                        padding: "6px",
                        minWidth: 160,
                        maxWidth: 200,
                        animation: "fadeIn 0.1s var(--ease)",
                    }}
                >
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "2px 6px 5px" }}>
                        {MONTH_NAMES[viewMonth]} {tooltip.day}
                    </div>
                    {tooltip.notes.slice(0, 5).map((n) => (
                        <div
                            key={n.id}
                            onClick={() => { router.push(`/notes/${n.id}`); setTooltip(null); }}
                            style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                color: "var(--text-primary)",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                transition: "background 100ms ease",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                            {n.title || "Untitled"}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
