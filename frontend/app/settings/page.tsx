"use client";

import { useState } from "react";
import { graphApi } from "@/lib/api";

export default function SettingsPage() {
    const [rebuilding, setRebuilding] = useState(false);
    const [rebuildResult, setRebuildResult] = useState<string | null>(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const handleRebuildGraph = async () => {
        setRebuilding(true);
        setRebuildResult(null);
        try {
            const result = await graphApi.recompute(0.72);
            setRebuildResult(`✅ Graph rebuilt — ${result.links_created} connections created.`);
        } catch {
            setRebuildResult("❌ Rebuild failed. Make sure the backend is running.");
        } finally {
            setRebuilding(false);
        }
    };

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "16px",
        }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "16px" }}>
                {title}
            </div>
            {children}
        </div>
    );

    const Row = ({ label, value }: { label: string; value: string }) => (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{label}</span>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "monospace", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "6px" }}>
                {value}
            </span>
        </div>
    );

    return (
        <div style={{ padding: "40px 48px", height: "100%", overflowY: "auto", maxWidth: "640px" }}>
            <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "6px" }}>
                    ⚙️ Settings
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>
                    Application configuration and tools
                </p>
            </div>

            <Section title="Application Info">
                <Row label="Version" value="1.0.0" />
                <Row label="Backend URL" value={apiUrl} />
                <Row label="AI Model" value="gemini-2.0-flash" />
                <Row label="Embedding Model" value="text-embedding-004 (768-dim)" />
            </Section>

            <Section title="Knowledge Graph">
                <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.6, margin: "0 0 14px" }}>
                    Recompute all semantic connections between your notes. Run this after importing many notes or if the graph looks incomplete.
                    Uses cosine similarity threshold of 0.72.
                </p>
                <button
                    className="btn btn-primary"
                    onClick={handleRebuildGraph}
                    disabled={rebuilding}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                    {rebuilding ? <span className="loading-spinner" /> : "🔗"}
                    {rebuilding ? "Rebuilding…" : "Rebuild Knowledge Graph"}
                </button>
                {rebuildResult && (
                    <div style={{ marginTop: "12px", fontSize: "13px", color: rebuildResult.startsWith("✅") ? "var(--success)" : "var(--danger)", padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: "8px" }}>
                        {rebuildResult}
                    </div>
                )}
            </Section>

            <Section title="Keyboard Shortcuts">
                {[
                    ["⌘K / Ctrl+K", "Open command palette"],
                    ["⌘N / Ctrl+N", "New note"],
                    ["⌘Shift+A", "Open AI Assistant"],
                    ["/", "AI slash commands in editor"],
                    ["Esc", "Close palette / dismiss"],
                ].map(([key, label]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{label}</span>
                        <kbd style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "5px", padding: "2px 8px", fontSize: "11.5px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                            {key}
                        </kbd>
                    </div>
                ))}
            </Section>
        </div>
    );
}
