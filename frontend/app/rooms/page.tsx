"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { roomsApi, type Room } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { Users, Plus, Copy, Check, Loader2, ArrowRight, Calendar } from "lucide-react";

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function RoomsPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [creating, setCreating] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? "demo-user");
        });
    }, []);

    const loadRooms = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await roomsApi.list(userId);
            setRooms(data);
        } catch {
            setRooms([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) loadRooms();
    }, [userId, loadRooms]);

    const handleCreateRoom = async () => {
        const name = roomName.trim();
        if (!name || creating || !userId) return;
        setCreating(true);
        try {
            const room = await roomsApi.create(name, userId);
            setRooms((prev) => [{ ...room, member_count: 1 }, ...prev]);
            setCreateModalOpen(false);
            setRoomName("");
            router.push(`/rooms/${room.slug}`);
        } catch {
            alert("Failed to create room. Check backend connection.");
        } finally {
            setCreating(false);
        }
    };

    const handleCopyInvite = (slug: string) => {
        const url = `${window.location.origin}/rooms/${slug}/join`;
        navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    return (
        <div className="editor-shell">
            <div className="editor-topbar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <Users size={17} style={{ color: "var(--accent-primary)" }} />
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                        Rooms
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Real-time collaboration
                    </span>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setCreateModalOpen(true)}
                    style={{ gap: "6px" }}
                >
                    <Plus size={13} />
                    New Room
                </button>
            </div>

            <div className="editor-content">
                <div className="editor-body">
                    {loading ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "40px 0", color: "var(--text-muted)" }}>
                            <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                            Loading rooms…
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="empty-state" style={{ height: "auto", padding: "60px 40px" }}>
                            <Users size={44} style={{ opacity: 0.15, color: "var(--text-muted)" }} />
                            <div className="empty-state-title">No rooms yet</div>
                            <p className="empty-state-sub">
                                Create a room to collaborate in real-time with others on shared notes.
                            </p>
                            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
                                <Plus size={14} />
                                Create Your First Room
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                            {rooms.map((room) => (
                                <div key={room.id} className="room-card">
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                                        <div>
                                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>
                                                {room.name}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", color: "var(--text-muted)" }}>
                                                <Users size={11} />
                                                {room.member_count ?? 1} member{(room.member_count ?? 1) !== 1 ? "s" : ""}
                                                <span>·</span>
                                                <Calendar size={11} />
                                                {timeAgo(room.created_at)}
                                            </div>
                                        </div>
                                        <button
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); handleCopyInvite(room.slug); }}
                                            title="Copy invite link"
                                            style={{ minWidth: 28, minHeight: 28, color: copiedSlug === room.slug ? "var(--success)" : "var(--text-muted)" }}
                                        >
                                            {copiedSlug === room.slug ? <Check size={13} /> : <Copy size={13} />}
                                        </button>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                                        <div style={{
                                            fontSize: "10.5px",
                                            color: "var(--text-muted)",
                                            background: "var(--bg-tertiary)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-sm)",
                                            padding: "2px 7px",
                                            fontFamily: "var(--font-jetbrains), monospace",
                                        }}>
                                            /{room.slug}
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => router.push(`/rooms/${room.slug}`)}
                                        style={{ width: "100%", justifyContent: "center", gap: "7px" }}
                                    >
                                        Open Room
                                        <ArrowRight size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {createModalOpen && (
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
                    onClick={() => setCreateModalOpen(false)}
                >
                    <div
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-lg)",
                            padding: "28px",
                            width: 360,
                            boxShadow: "var(--shadow-lg)",
                            animation: "paletteIn 0.15s var(--ease)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                            Create Room
                        </div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "20px" }}>
                            A room lets you collaborate in real-time on shared notes.
                        </div>
                        <input
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoom(); if (e.key === "Escape") setCreateModalOpen(false); }}
                            placeholder="Room name…"
                            autoFocus
                            style={{
                                width: "100%",
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                padding: "10px 12px",
                                color: "var(--text-primary)",
                                fontSize: "14px",
                                fontFamily: "inherit",
                                outline: "none",
                                marginBottom: "16px",
                                boxSizing: "border-box",
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setCreateModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleCreateRoom}
                                disabled={creating || !roomName.trim()}
                            >
                                {creating ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={13} />}
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
