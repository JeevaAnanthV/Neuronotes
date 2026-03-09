"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { tagsApi, notesApi, type TagWithCount, type NoteListItem } from "@/lib/api";

export default function TagsPage() {
    const [tags, setTags] = useState<TagWithCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [filteredNotes, setFilteredNotes] = useState<NoteListItem[]>([]);
    const [allNotes, setAllNotes] = useState<NoteListItem[]>([]);
    const router = useRouter();

    useEffect(() => {
        Promise.all([tagsApi.list(), notesApi.list()])
            .then(([t, n]) => {
                setTags(t);
                setAllNotes(n);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleTagClick = (tagName: string) => {
        if (selectedTag === tagName) {
            setSelectedTag(null);
            setFilteredNotes([]);
            return;
        }
        setSelectedTag(tagName);
        setFilteredNotes(
            allNotes.filter((n) => n.tags.some((t) => t.name === tagName))
        );
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                <span className="loading-spinner" style={{ marginRight: "10px" }} />
                Loading tags…
            </div>
        );
    }

    return (
        <div style={{ padding: "40px 48px", height: "100%", overflowY: "auto" }}>
            <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "6px" }}>
                    🏷 Tags
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>
                    {tags.length} tag{tags.length !== 1 ? "s" : ""} across your knowledge base
                </p>
            </div>

            {tags.length === 0 ? (
                <div className="empty-state" style={{ height: "auto" }}>
                    <span style={{ fontSize: "48px" }}>🏷</span>
                    <div className="empty-state-title">No tags yet</div>
                    <p className="empty-state-sub">
                        Use the AI Auto Tags button in the context panel of any note to generate tags automatically.
                    </p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                    {/* Tag Cloud */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {tags.map((tag) => {
                            const isSelected = selectedTag === tag.name;
                            const maxCount = Math.max(...tags.map((t) => t.note_count), 1);
                            const scale = 0.85 + (tag.note_count / maxCount) * 0.55;
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => handleTagClick(tag.name)}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        padding: "6px 14px",
                                        borderRadius: "20px",
                                        border: isSelected
                                            ? "1.5px solid var(--accent)"
                                            : "1px solid var(--border)",
                                        background: isSelected
                                            ? "var(--accent-dim)"
                                            : "var(--bg-card)",
                                        color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                                        fontSize: `${scale * 13}px`,
                                        fontWeight: isSelected ? 600 : 400,
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    <span>#{tag.name}</span>
                                    <span style={{
                                        background: isSelected ? "var(--accent)" : "var(--bg-tertiary)",
                                        color: isSelected ? "#fff" : "var(--text-muted)",
                                        borderRadius: "10px",
                                        padding: "1px 6px",
                                        fontSize: "10.5px",
                                        fontWeight: 600,
                                    }}>
                                        {tag.note_count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filtered notes list */}
                    {selectedTag && (
                        <div>
                            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", fontWeight: 500 }}>
                                Notes tagged <span style={{ color: "var(--accent)" }}>#{selectedTag}</span>
                            </div>
                            {filteredNotes.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No notes found.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {filteredNotes.map((note) => (
                                        <div
                                            key={note.id}
                                            onClick={() => router.push(`/notes/${note.id}`)}
                                            style={{
                                                padding: "12px 16px",
                                                borderRadius: "10px",
                                                background: "var(--bg-card)",
                                                border: "1px solid var(--border)",
                                                cursor: "pointer",
                                                transition: "border-color 0.15s, background 0.15s",
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                                                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                                                (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                                            }}
                                        >
                                            <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>
                                                {note.title || "Untitled"}
                                            </div>
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                {note.tags.map((t) => (
                                                    <span key={t.id} className="tag">#{t.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
