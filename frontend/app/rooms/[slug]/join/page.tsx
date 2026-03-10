"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { roomsApi, type Room } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { Users, Loader2, LogIn, Brain } from "lucide-react";

export default function JoinRoomPage() {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();

    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load room info
        roomsApi.get(slug)
            .then((r) => setRoom(r))
            .catch(() => setError("Room not found or invite link is invalid."))
            .finally(() => setLoading(false));

        // Get user
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? null);
        });
    }, [slug]);

    const handleJoin = async () => {
        const uid = userId || "demo-user";
        setJoining(true);
        try {
            await roomsApi.join(slug, uid);
            router.push(`/rooms/${slug}`);
        } catch {
            setError("Failed to join room. Please try again.");
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: "10px" }}>
                <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
                Loading…
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="empty-state">
                <Users size={44} style={{ opacity: 0.15 }} />
                <div className="empty-state-title">Room not found</div>
                <p className="empty-state-sub">{error || "This invite link may be expired or invalid."}</p>
                <button className="btn btn-ghost" onClick={() => router.push("/rooms")}>
                    Back to Rooms
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px" }}>
            <div style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "40px",
                width: 380,
                textAlign: "center",
                boxShadow: "var(--shadow-lg)",
                animation: "fadeIn 0.2s var(--ease)",
            }}>
                {/* Logo */}
                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366F1, #818CF8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                }}>
                    <Brain size={22} color="white" />
                </div>

                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "8px" }}>
                    You&apos;re invited to join
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px", fontFamily: "var(--font-playfair), serif" }}>
                    {room.name}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "28px" }}>
                    Collaborate in real-time on shared notes with your team.
                </div>

                {!userId ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                            Sign in to join this room.
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => router.push(`/auth?redirect=/rooms/${slug}/join`)}
                            style={{ justifyContent: "center", gap: "8px", width: "100%" }}
                        >
                            <LogIn size={14} />
                            Sign In to Join
                        </button>
                    </div>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={handleJoin}
                        disabled={joining}
                        style={{ justifyContent: "center", gap: "8px", width: "100%", padding: "11px" }}
                    >
                        {joining ? (
                            <>
                                <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                                Joining…
                            </>
                        ) : (
                            <>
                                <Users size={14} />
                                Join Collaboration
                            </>
                        )}
                    </button>
                )}

                {error && (
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--danger)" }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
