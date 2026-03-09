"use client";

import { useState, useEffect } from "react";
import { aiApi, type InsightsData } from "@/lib/api";
import { Sparkles } from "lucide-react";

export function DailyInsights() {
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        aiApi.insights()
            .then(setInsights)
            .catch(() => setInsights(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading || !insights) return null;

    return (
        <div className="insights-banner">
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--accent-gradient)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}>
                    <Sparkles size={14} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent-primary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        Daily Insight
                    </div>
                    <div style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {insights.ai_insight}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "16px", flexShrink: 0 }}>
                    {[
                        { label: "Total", value: insights.total_notes },
                        { label: "This week", value: insights.notes_this_week },
                        { label: "Top topic", value: insights.top_topic },
                    ].map((s) => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
