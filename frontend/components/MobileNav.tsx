"use client";

import { usePathname, useRouter } from "next/navigation";
import { FileText, Search, MessageSquare, GitBranch, Grid, Brain, HelpCircle, Bell, Layers, Tag, Settings, Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";

const MORE_ITEMS = [
    { label: "Flashcards", icon: Brain, href: "/flashcards" },
    { label: "Q&A", icon: HelpCircle, href: "/qa" },
    { label: "Reminders", icon: Bell, href: "/reminders" },
    { label: "Clusters", icon: Layers, href: "/clusters" },
    { label: "Tags", icon: Tag, href: "/tags" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Insights", icon: Lightbulb, href: "/insights" },
];

const MAIN_TABS = [
    { label: "Notes", icon: FileText, href: "/" },
    { label: "Search", icon: Search, href: null, action: "search" },
    { label: "AI Chat", icon: MessageSquare, href: "/chat" },
    { label: "Graph", icon: GitBranch, href: "/graph" },
    { label: "More", icon: Grid, href: null, action: "more" },
];

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    const moreActive = MORE_ITEMS.some(item => pathname === item.href);

    return (
        <>
            {/* Bottom tab bar */}
            <nav className="mobile-nav-bar">
                {MAIN_TABS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href
                        ? pathname === item.href || (item.href === "/" && pathname.startsWith("/notes/"))
                        : item.action === "more"
                        ? moreActive
                        : false;

                    return (
                        <button
                            key={item.label}
                            className={`mobile-nav-item${isActive ? " active" : ""}`}
                            onClick={() => {
                                if (item.action === "search") {
                                    setPaletteOpen(true);
                                } else if (item.action === "more") {
                                    setMoreOpen(true);
                                } else if (item.href) {
                                    router.push(item.href);
                                }
                            }}
                            aria-label={item.label}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* More bottom sheet */}
            {moreOpen && (
                <>
                    {/* Scrim */}
                    <div
                        onClick={() => setMoreOpen(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.55)",
                            zIndex: 700,
                            backdropFilter: "blur(2px)",
                        }}
                    />
                    {/* Sheet */}
                    <div
                        style={{
                            position: "fixed",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: "var(--bg-secondary)",
                            borderTop: "1px solid var(--border-light)",
                            borderRadius: "18px 18px 0 0",
                            zIndex: 701,
                            padding: "0 0 calc(env(safe-area-inset-bottom, 0px) + 72px)",
                            animation: "slideUp 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    >
                        {/* Handle + header */}
                        <div style={{ padding: "12px 20px 14px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ width: 36, height: 4, background: "var(--border-light)", borderRadius: 2, margin: "0 auto 0 0" }} />
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", flex: 1, textAlign: "center" }}>More</span>
                            <button
                                onClick={() => setMoreOpen(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: "4px", minHeight: 0 }}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Feature grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "2px",
                            padding: "16px 12px",
                        }}>
                            {MORE_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <button
                                        key={item.label}
                                        onClick={() => {
                                            router.push(item.href);
                                            setMoreOpen(false);
                                        }}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: "7px",
                                            padding: "14px 8px",
                                            borderRadius: "var(--radius-md)",
                                            border: "none",
                                            background: isActive ? "var(--accent-dim)" : "transparent",
                                            color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                            fontSize: "11px",
                                            fontWeight: 500,
                                            transition: "background 100ms ease",
                                            minHeight: 0,
                                        }}
                                    >
                                        <Icon size={22} />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        </>
    );
}
