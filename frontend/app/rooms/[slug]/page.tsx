"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { roomsApi, notesApi, type Room, type RoomNote, type RoomMember, type NoteListItem } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { Editor } from "@/components/Editor";
import { Copy, Check, Plus, ArrowLeft, Loader2, X, FileText } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingUser {
    userId: string;
    displayName: string;
}

export default function RoomPage() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();

    const [room, setRoom] = useState<Room | null>(null);
    const [notes, setNotes] = useState<RoomNote[]>([]);
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("demo-user");
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [activeNoteContent, setActiveNoteContent] = useState("");
    const [activeNoteTitle, setActiveNoteTitle] = useState("");
    const [saving, setSaving] = useState(false);
    const [copiedInvite, setCopiedInvite] = useState(false);
    const [addNoteOpen, setAddNoteOpen] = useState(false);
    const [allNotes, setAllNotes] = useState<NoteListItem[]>([]);
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabaseRef = useRef(createClient());

    // Get user
    useEffect(() => {
        supabaseRef.current.auth.getUser().then(({ data }) => {
            if (data.user?.id) setUserId(data.user.id);
        });
    }, []);

    // Load room data
    const loadRoom = useCallback(async () => {
        try {
            const [roomData, roomNotes, roomMembers] = await Promise.all([
                roomsApi.get(slug),
                roomsApi.getNotes(slug),
                roomsApi.getMembers(slug),
            ]);
            setRoom(roomData);
            setNotes(roomNotes);
            setMembers(roomMembers);
            if (roomNotes.length > 0 && !activeNoteId) {
                setActiveNoteId(roomNotes[0].id);
                setActiveNoteContent(roomNotes[0].content || "");
                setActiveNoteTitle(roomNotes[0].title || "");
            }
        } catch {
            router.push("/rooms");
        } finally {
            setLoading(false);
        }
    }, [slug, activeNoteId, router]);

    useEffect(() => { loadRoom(); }, [slug, loadRoom]);

    // Supabase Realtime presence + postgres_changes
    useEffect(() => {
        const supabase = supabaseRef.current;
        const channel = supabase.channel(`room:${slug}`, {
            config: { presence: { key: userId } },
        });
        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState<{ displayName: string }>();
                const users: TypingUser[] = Object.entries(state)
                    .filter(([uid]) => uid !== userId)
                    .map(([uid, presences]) => ({
                        userId: uid,
                        displayName: (presences as Array<{ displayName: string }>)[0]?.displayName || uid.slice(0, 6),
                    }));
                setTypingUsers(users);
            })
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "notes" },
                (payload) => {
                    const updated = payload.new as RoomNote;
                    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
                    if (updated.id === activeNoteId) {
                        setRealtimeToast(`Note updated`);
                        setTimeout(() => setRealtimeToast(null), 4000);
                    }
                }
            )
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ displayName: userId.slice(0, 8) });
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [slug, userId, activeNoteId]);

    const handleNoteSelect = (note: RoomNote) => {
        setActiveNoteId(note.id);
        setActiveNoteContent(note.content || "");
        setActiveNoteTitle(note.title || "");
    };

    const scheduleSave = (title: string, content: string) => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            if (!activeNoteId) return;
            setSaving(true);
            try {
                await notesApi.update(activeNoteId, { title, content });
                setNotes((prev) =>
                    prev.map((n) => (n.id === activeNoteId ? { ...n, title, content } : n))
                );
            } catch {}
            finally { setSaving(false); }
        }, 1500);
    };

    const handleCopyInvite = () => {
        const url = `${window.location.origin}/rooms/${slug}/join`;
        navigator.clipboard.writeText(url);
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 2000);
    };

    const handleAddNote = async (noteId: string) => {
        try {
            await roomsApi.addNote(slug, noteId);
            const updatedNotes = await roomsApi.getNotes(slug);
            setNotes(updatedNotes);
            setAddNoteOpen(false);
        } catch {
            alert("Failed to add note to room.");
        }
    };

    const handleRemoveNote = async (noteId: string) => {
        await roomsApi.removeNote(slug, noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        if (activeNoteId === noteId) {
            setActiveNoteId(null);
            setActiveNoteContent("");
            setActiveNoteTitle("");
        }
    };

    const handleOpenAddNote = async () => {
        try {
            const all = await notesApi.list();
            const roomNoteIds = new Set(notes.map((n) => n.id));
            setAllNotes(all.filter((n) => !roomNoteIds.has(n.id)));
            setAddNoteOpen(true);
        } catch {}
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: "10px" }}>
                <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                Loading room…
            </div>
        );
    }

    // Avatar initials
    const avatarLetter = (uid: string) => uid.slice(0, 2).toUpperCase();

    return (
        <div style={{ display: "flex", height: "100%", overflow: "hidden", flexDirection: "column" }}>
            {/* Top bar */}
            <div className="editor-topbar" style={{ gap: "10px" }}>
                <button className="btn-icon" onClick={() => router.push("/rooms")} style={{ minWidth: 30, minHeight: 30 }}>
                    <ArrowLeft size={15} />
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {room?.name}
                    </div>
                </div>

                {/* Presence avatars */}
                <div style={{ display: "flex", alignItems: "center", gap: "-6px" }}>
                    {/* Current user */}
                    <div
                        className="presence-avatar"
                        title={`You (${userId.slice(0, 8)})`}
                        style={{ background: "var(--accent-gradient)" }}
                    >
                        {avatarLetter(userId)}
                    </div>
                    {/* Other online users */}
                    {typingUsers.slice(0, 4).map((u) => (
                        <div
                            key={u.userId}
                            className={`presence-avatar${u.userId !== userId ? " typing" : ""}`}
                            title={u.displayName}
                            style={{ marginLeft: "-6px", background: "#22C55E" }}
                        >
                            {u.displayName.slice(0, 2).toUpperCase()}
                        </div>
                    ))}
                    {members.length > 5 && (
                        <div
                            className="presence-avatar"
                            style={{ marginLeft: "-6px", background: "var(--bg-tertiary)", color: "var(--text-muted)", border: "2px solid var(--border)", fontSize: "9px" }}
                        >
                            +{members.length - 5}
                        </div>
                    )}
                </div>

                <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleCopyInvite}
                    style={{ gap: "6px", minHeight: 0 }}
                    title="Copy invite link"
                >
                    {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                    {copiedInvite ? "Copied!" : "Invite"}
                </button>
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
                <div style={{
                    padding: "4px 20px",
                    fontSize: "11.5px",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                }}>
                    {typingUsers.map((u) => u.displayName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} online
                </div>
            )}

            {/* Main content */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Shared notes panel */}
                <div style={{
                    width: "260px",
                    minWidth: "260px",
                    borderRight: "1px solid var(--border)",
                    background: "var(--bg-secondary)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}>
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Shared Notes
                        </span>
                        <button
                            className="btn-icon"
                            onClick={handleOpenAddNote}
                            title="Add note to room"
                            style={{ minWidth: 24, minHeight: 24 }}
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                        {notes.length === 0 ? (
                            <div style={{ padding: "20px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                                <FileText size={24} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                                No shared notes yet.
                                <br />
                                <button
                                    onClick={handleOpenAddNote}
                                    style={{ color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", fontSize: "12px", marginTop: "6px", minHeight: 0 }}
                                >
                                    Add a note
                                </button>
                            </div>
                        ) : (
                            notes.map((note) => (
                                <div
                                    key={note.id}
                                    className={`note-item${activeNoteId === note.id ? " active" : ""}`}
                                    onClick={() => handleNoteSelect(note)}
                                    style={{ position: "relative" }}
                                >
                                    <div className="note-item-title">{note.title || "Untitled"}</div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveNote(note.id); }}
                                        style={{
                                            position: "absolute",
                                            right: "6px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--text-muted)",
                                            display: "none",
                                            padding: "2px",
                                            minHeight: 0,
                                        }}
                                        className="note-remove-btn"
                                        title="Remove from room"
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Editor area */}
                <div className="editor-shell">
                    {realtimeToast && (
                        <div style={{
                            position: "fixed",
                            top: "16px",
                            right: "24px",
                            zIndex: 9999,
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--accent-primary)",
                            borderRadius: "var(--radius-md)",
                            padding: "8px 14px",
                            fontSize: "12.5px",
                            color: "var(--text-primary)",
                            boxShadow: "var(--shadow-md)",
                            animation: "fadeIn 0.2s var(--ease)",
                        }}>
                            {realtimeToast}
                        </div>
                    )}

                    {activeNoteId ? (
                        <>
                            <div className="editor-topbar" style={{ borderTop: "none" }}>
                                <input
                                    className="editor-title-input"
                                    value={activeNoteTitle}
                                    onChange={(e) => {
                                        setActiveNoteTitle(e.target.value);
                                        scheduleSave(e.target.value, activeNoteContent);
                                    }}
                                    placeholder="Untitled"
                                    style={{ fontSize: "15px" }}
                                />
                                <span style={{ fontSize: "11px", color: saving ? "var(--accent-primary)" : "var(--text-muted)" }}>
                                    {saving ? "Saving…" : "Auto-saved"}
                                </span>
                            </div>
                            <div className="editor-content">
                                <div className="editor-body">
                                    <Editor
                                        content={activeNoteContent}
                                        onChange={(html) => {
                                            setActiveNoteContent(html);
                                            scheduleSave(activeNoteTitle, html);
                                        }}
                                        onSlashCommand={() => {}}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <FileText size={40} style={{ opacity: 0.15 }} />
                            <div className="empty-state-title">Select a note</div>
                            <p className="empty-state-sub">Choose a note from the left panel or add one to this room.</p>
                            <button className="btn btn-primary" onClick={handleOpenAddNote}>
                                <Plus size={13} />
                                Add Note
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Note Modal */}
            {addNoteOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(6px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setAddNoteOpen(false)}
                >
                    <div
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-lg)",
                            padding: "20px",
                            width: 380,
                            maxHeight: "70vh",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "var(--shadow-lg)",
                            animation: "paletteIn 0.15s var(--ease)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                                Add Note to Room
                            </div>
                            <button className="btn-icon" onClick={() => setAddNoteOpen(false)} style={{ minWidth: 24, minHeight: 24 }}>
                                <X size={13} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {allNotes.length === 0 ? (
                                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "20px" }}>
                                    No notes available to add.
                                </div>
                            ) : (
                                allNotes.map((note) => (
                                    <div
                                        key={note.id}
                                        className="note-item"
                                        onClick={() => handleAddNote(note.id)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <div className="note-item-title">{note.title || "Untitled"}</div>
                                        <div className="note-item-date">
                                            {note.tags.map((t) => `#${t.name}`).join(" ")}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
