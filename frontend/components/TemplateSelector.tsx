"use client";

import { useState } from "react";
import { X } from "lucide-react";

export interface Template {
    id: string;
    label: string;
    emoji: string;
    description: string;
    content: string;
}

export const TEMPLATES: Template[] = [
    {
        id: "meeting",
        label: "Meeting Notes",
        emoji: "📋",
        description: "Agenda, attendees, decisions, action items",
        content: `<h2>Meeting Notes</h2>
<h3>Agenda</h3><ul><li></li></ul>
<h3>Attendees</h3><ul><li></li></ul>
<h3>Discussion</h3><p></p>
<h3>Key Decisions</h3><ul><li></li></ul>
<h3>Action Items</h3><ul><li></li></ul>`,
    },
    {
        id: "research",
        label: "Research Note",
        emoji: "🔬",
        description: "Hypothesis, sources, findings, analysis",
        content: `<h2>Research Note</h2>
<h3>Hypothesis</h3><p></p>
<h3>Sources</h3><ul><li></li></ul>
<h3>Key Findings</h3><ul><li></li></ul>
<h3>Analysis</h3><p></p>
<h3>Conclusions</h3><p></p>`,
    },
    {
        id: "journal",
        label: "Daily Journal",
        emoji: "📓",
        description: "Focus, gratitude, wins, challenges",
        content: `<h2>Daily Journal</h2>
<h3>Today's Focus</h3><p></p>
<h3>Gratitude</h3><ul><li></li></ul>
<h3>Wins</h3><ul><li></li></ul>
<h3>Challenges</h3><ul><li></li></ul>
<h3>Tomorrow</h3><p></p>`,
    },
    {
        id: "idea",
        label: "Idea Capture",
        emoji: "💡",
        description: "The idea, problem, audience, next steps",
        content: `<h2>Idea Capture</h2>
<h3>The Idea</h3><p></p>
<h3>Problem it Solves</h3><p></p>
<h3>Who it Helps</h3><p></p>
<h3>Next Steps</h3><ul><li></li></ul>`,
    },
    {
        id: "book",
        label: "Book Notes",
        emoji: "📚",
        description: "Key concepts, quotes, takeaways",
        content: `<h2>Book Notes</h2>
<h3>Book Info</h3><p>Title: <br/>Author: </p>
<h3>Key Concepts</h3><ul><li></li></ul>
<h3>Quotes</h3><blockquote><p></p></blockquote>
<h3>My Takeaways</h3><ul><li></li></ul>
<h3>Action Items</h3><ul><li></li></ul>`,
    },
    {
        id: "blank",
        label: "Blank",
        emoji: "✏️",
        description: "Start with an empty note",
        content: "",
    },
];

interface Props {
    onSelect: (template: Template) => void;
    onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: Props) {
    const [hovered, setHovered] = useState<string | null>(null);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 2000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg, 16px)",
                    padding: "28px",
                    width: "520px",
                    maxWidth: "94vw",
                    boxShadow: "var(--shadow-lg)",
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        Choose a Template
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => onSelect(t)}
                            onMouseEnter={() => setHovered(t.id)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                background: hovered === t.id ? "var(--bg-hover)" : "var(--bg-tertiary)",
                                border: `1px solid ${hovered === t.id ? "var(--accent-primary)" : "var(--border)"}`,
                                borderRadius: "var(--radius-md)",
                                padding: "14px 16px",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 120ms ease",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "12px",
                            }}
                        >
                            <span style={{ fontSize: "22px", flexShrink: 0 }}>{t.emoji}</span>
                            <div>
                                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>
                                    {t.label}
                                </div>
                                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                    {t.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
