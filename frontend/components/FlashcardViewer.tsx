"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/api";

interface Props {
    flashcards: Flashcard[];
}

function FlashcardItem({ card, index, total }: { card: Flashcard; index: number; total: number }) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div>
            <div
                style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}
            >
                Card {index + 1} of {total} — click to flip
            </div>
            <div className="flashcard-wrapper" onClick={() => setFlipped(!flipped)}>
                <div className={`flashcard ${flipped ? "flipped" : ""}`}>
                    <div className="flashcard-face front">
                        <div className="flashcard-label">Question</div>
                        <div className="flashcard-text">{card.question}</div>
                    </div>
                    <div className="flashcard-face back">
                        <div className="flashcard-label">Answer</div>
                        <div className="flashcard-text">{card.answer}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FlashcardViewer({ flashcards }: Props) {
    const [idx, setIdx] = useState(0);

    if (flashcards.length === 0) return null;

    return (
        <div>
            <FlashcardItem card={flashcards[idx]} index={idx} total={flashcards.length} />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "center" }}>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    disabled={idx === 0}
                >
                    ← Prev
                </button>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIdx((i) => Math.min(flashcards.length - 1, i + 1))}
                    disabled={idx === flashcards.length - 1}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
