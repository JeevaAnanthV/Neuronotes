"use client";

import { useEffect, useState, useCallback } from "react";
import { notesApi, aiApi } from "@/lib/api";
import { Brain, RotateCcw, CheckCircle2, XCircle, Minus, ChevronRight } from "lucide-react";

interface StudyCard {
    question: string;
    answer: string;
    noteId: string;
    noteTitle: string;
    hash: string;
    repetitions: number;
    easiness: number;
    interval: number;
    nextReview: number;
}

function hashStr(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return Math.abs(h).toString(36);
}

function sm2(quality: number, repetitions: number, easiness: number, interval: number) {
    const newEasiness = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    const newRepetitions = quality >= 3 ? repetitions + 1 : 0;
    const newInterval = newRepetitions <= 1 ? 1 : newRepetitions === 2 ? 6 : Math.round(interval * newEasiness);
    return { easiness: newEasiness, repetitions: newRepetitions, interval: newInterval };
}

function getStorageKey(noteId: string, hash: string) {
    return `fc:${noteId}:${hash}`;
}

function loadCardState(noteId: string, hash: string): Pick<StudyCard, "repetitions" | "easiness" | "interval" | "nextReview"> {
    try {
        const raw = localStorage.getItem(getStorageKey(noteId, hash));
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { repetitions: 0, easiness: 2.5, interval: 1, nextReview: Date.now() };
}

function saveCardState(noteId: string, hash: string, state: Pick<StudyCard, "repetitions" | "easiness" | "interval" | "nextReview">) {
    localStorage.setItem(getStorageKey(noteId, hash), JSON.stringify(state));
}

export default function FlashcardsPage() {
    const [cards, setCards] = useState<StudyCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [current, setCurrent] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [done, setDone] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const notes = await notesApi.list();
                const allCards: StudyCard[] = [];
                for (const note of notes.slice(0, 20)) {
                    // Try to get stored cards for this note from localStorage
                    const stored: { question: string; answer: string }[] = [];
                    // Scan localStorage keys for this note
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(`fc:${note.id}:`)) {
                            const hash = key.replace(`fc:${note.id}:`, "").split(":")[0];
                            const questionKey = `fc-q:${note.id}:${hash}`;
                            const answerKey = `fc-a:${note.id}:${hash}`;
                            const q = localStorage.getItem(questionKey);
                            const a = localStorage.getItem(answerKey);
                            if (q && a) stored.push({ question: q, answer: a });
                        }
                    }
                    for (const card of stored) {
                        const hash = hashStr(card.question);
                        const state = loadCardState(note.id, hash);
                        if (state.nextReview <= Date.now()) {
                            allCards.push({ ...card, noteId: note.id, noteTitle: note.title, hash, ...state });
                        }
                    }
                }
                setCards(allCards);
                if (allCards.length === 0) setCurrent(0);
            } catch { /* ignore */ }
            setLoading(false);
        }
        load();
    }, []);

    async function generateForAllNotes() {
        setGenerating(true);
        try {
            const notes = await notesApi.list();
            // Fetch all note details in parallel
            const detailResults = await Promise.allSettled(
                notes.slice(0, 10).map(n => notesApi.get(n.id))
            );
            const eligible = detailResults
                .map((r, i) => ({ r, note: notes[i] }))
                .filter(({ r }) =>
                    r.status === "fulfilled" &&
                    r.value.content.replace(/<[^>]*>/g, "").length >= 50
                ) as { r: PromiseFulfilledResult<{ content: string }>; note: typeof notes[0] }[];

            // Generate flashcards for all eligible notes in parallel
            const genResults = await Promise.allSettled(
                eligible.map(({ r, note }) =>
                    aiApi.flashcards(r.value.content).then(({ flashcards }) => ({ flashcards, note }))
                )
            );

            const newCards: StudyCard[] = [];
            for (const res of genResults) {
                if (res.status !== "fulfilled") continue;
                const { flashcards, note } = res.value;
                for (const card of flashcards) {
                    const hash = hashStr(card.question);
                    localStorage.setItem(`fc-q:${note.id}:${hash}`, card.question);
                    localStorage.setItem(`fc-a:${note.id}:${hash}`, card.answer);
                    const state = loadCardState(note.id, hash);
                    newCards.push({ ...card, noteId: note.id, noteTitle: note.title, hash, ...state });
                }
            }
            setCards(newCards.filter(c => c.nextReview <= Date.now()));
        } catch { /* ignore */ }
        setGenerating(false);
    }

    const handleRate = useCallback((quality: number) => {
        const card = cards[current];
        const result = sm2(quality, card.repetitions, card.easiness, card.interval);
        const now = new Date().getTime();
        const nextReview = now + result.interval * 86400000;
        saveCardState(card.noteId, card.hash, { ...result, nextReview });
        localStorage.setItem(`fc-q:${card.noteId}:${card.hash}`, card.question);
        localStorage.setItem(`fc-a:${card.noteId}:${card.hash}`, card.answer);

        setFlipped(false);
        if (current + 1 >= cards.length) {
            setDone(true);
        } else {
            setCurrent(c => c + 1);
        }
    }, [cards, current]);

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "16px" }}>
                <span className="loading-spinner" style={{ width: 32, height: 32 }} />
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading flashcards...</span>
            </div>
        );
    }

    if (done) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "20px", padding: "40px" }}>
                <CheckCircle2 size={56} color="var(--success)" />
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>Session Complete!</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>You reviewed {cards.length} card{cards.length !== 1 ? "s" : ""}.</p>
                <button className="btn btn-primary" onClick={() => { setDone(false); setCurrent(0); setFlipped(false); }}>
                    <RotateCcw size={15} /> Review Again
                </button>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "20px", padding: "40px", textAlign: "center" }}>
                <Brain size={56} color="var(--accent-primary)" />
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>No Cards Due</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "360px" }}>
                    No flashcards are due for review. Generate flashcards from your notes to get started.
                </p>
                <button className="btn btn-primary" onClick={generateForAllNotes} disabled={generating}>
                    {generating ? <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Generating...</> : <><Brain size={15} /> Generate Flashcards</>}
                </button>
            </div>
        );
    }

    const card = cards[current];
    const progress = ((current) / cards.length) * 100;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "32px", maxWidth: "640px", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Brain size={20} color="var(--accent-primary)" />
                    <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>Study Mode</span>
                </div>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{current + 1} / {cards.length}</span>
            </div>

            {/* Progress bar */}
            <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", marginBottom: "28px" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent-primary)", borderRadius: "2px", transition: "width 300ms ease" }} />
            </div>

            {/* Note source */}
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <ChevronRight size={11} />
                {card.noteTitle}
            </div>

            {/* Card */}
            <div
                onClick={() => setFlipped(f => !f)}
                style={{
                    flex: 1,
                    maxHeight: "320px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg, 16px)",
                    padding: "32px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    position: "relative",
                    boxShadow: "var(--shadow-md)",
                    transition: "transform 150ms ease",
                    userSelect: "none",
                }}
            >
                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
                    {flipped ? "Answer" : "Question — click to reveal"}
                </div>
                <div style={{ fontSize: "16px", color: "var(--text-primary)", lineHeight: 1.6, fontWeight: flipped ? 400 : 500 }}>
                    {flipped ? card.answer : card.question}
                </div>
                {!flipped && (
                    <div style={{ position: "absolute", bottom: "16px", right: "20px", fontSize: "11px", color: "var(--text-muted)" }}>
                        tap to flip
                    </div>
                )}
            </div>

            {/* Rating buttons */}
            {flipped && (
                <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "center" }}>
                    {[
                        { label: "Again", quality: 0, color: "var(--error, #ef4444)", icon: <XCircle size={15} /> },
                        { label: "Hard", quality: 2, color: "#f59e0b", icon: <Minus size={15} /> },
                        { label: "Good", quality: 4, color: "var(--success)", icon: <CheckCircle2 size={15} /> },
                        { label: "Easy", quality: 5, color: "var(--accent-primary)", icon: <Brain size={15} /> },
                    ].map(({ label, quality, color, icon }) => (
                        <button
                            key={label}
                            onClick={() => handleRate(quality)}
                            style={{
                                flex: 1,
                                padding: "10px 8px",
                                background: "var(--bg-elevated)",
                                border: `1px solid ${color}`,
                                borderRadius: "var(--radius-md)",
                                color,
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                transition: "background 120ms ease",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>
            )}

            {!flipped && (
                <button
                    className="btn btn-ghost"
                    style={{ marginTop: "20px", alignSelf: "center" }}
                    onClick={() => setFlipped(true)}
                >
                    Reveal Answer
                </button>
            )}
        </div>
    );
}
