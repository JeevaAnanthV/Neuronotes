"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";

interface Viewer {
    user_id: string;
    name: string;
    color: string;
}

interface Props {
    noteId: string;
}

const COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"
];

function colorForId(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
}

export function CollaborativeIndicator({ noteId }: Props) {
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

    useEffect(() => {
        const supabase = createClient();
        const userId = `anon-${Math.random().toString(36).slice(2, 8)}`;
        const channel = supabase.channel(`note-presence:${noteId}`, {
            config: { presence: { key: userId } },
        });

        channelRef.current = channel;

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState<{ name: string }>();
                const active: Viewer[] = Object.entries(state)
                    .filter(([id]) => id !== userId)
                    .map(([id, presences]) => ({
                        user_id: id,
                        name: (presences[0] as { name: string })?.name || "Viewer",
                        color: colorForId(id),
                    }));
                setViewers(active);
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({ name: "You", joined_at: Date.now() });
                }
            });

        return () => {
            channel.untrack();
            supabase.removeChannel(channel);
        };
    }, [noteId]);

    if (viewers.length === 0) return null;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ display: "flex", gap: "-4px" }}>
                {viewers.slice(0, 4).map((v) => (
                    <div
                        key={v.user_id}
                        title={v.name}
                        style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: v.color,
                            border: "2px solid var(--bg-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "9px",
                            fontWeight: 700,
                            color: "white",
                            marginLeft: viewers.indexOf(v) > 0 ? "-6px" : "0",
                            zIndex: viewers.length - viewers.indexOf(v),
                            position: "relative",
                        }}
                    >
                        {v.name[0].toUpperCase()}
                    </div>
                ))}
            </div>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {viewers.length === 1 ? "1 other viewing" : `${viewers.length} others viewing`}
            </span>
        </div>
    );
}
