"use client";

import { usePathname, useRouter } from "next/navigation";
import { FileText, Search, MessageSquare, GitBranch, Brain } from "lucide-react";
import { useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";

const MOBILE_NAV = [
    { label: "Notes", icon: FileText, href: "/" },
    { label: "Search", icon: Search, href: null, action: "search" },
    { label: "AI Chat", icon: MessageSquare, href: "/chat" },
    { label: "Graph", icon: GitBranch, href: "/graph" },
    { label: "Flashcards", icon: Brain, href: "/flashcards" },
];

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [paletteOpen, setPaletteOpen] = useState(false);

    return (
        <>
            <nav className="mobile-nav-bar">
                {MOBILE_NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href ? pathname === item.href || (item.href === "/" && pathname.startsWith("/notes/")) : false;
                    return (
                        <button
                            key={item.label}
                            className={`mobile-nav-item${isActive ? " active" : ""}`}
                            onClick={() => {
                                if (item.action === "search") {
                                    setPaletteOpen(true);
                                } else if (item.href) {
                                    router.push(item.href);
                                }
                            }}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>
            {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        </>
    );
}
