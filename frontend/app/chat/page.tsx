"use client";
export const dynamic = "force-dynamic";

import { AIChat } from "@/components/AIChat";

export default function ChatPage() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <AIChat />
        </div>
    );
}
