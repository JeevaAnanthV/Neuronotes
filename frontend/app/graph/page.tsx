"use client";

import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { GitBranch } from "lucide-react";

export default function GraphPage() {
    return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <div
                style={{
                    padding: "0 24px",
                    height: "54px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexShrink: 0,
                    background: "var(--bg-primary)",
                }}
            >
                <GitBranch size={18} style={{ color: "var(--accent-primary)" }} />
                <div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Knowledge Graph</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Visualise connections between your notes</div>
                </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
                <KnowledgeGraph />
            </div>
        </div>
    );
}
