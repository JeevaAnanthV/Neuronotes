"use client";

import { usePathname, useRouter } from "next/navigation";
import { FileText, Search, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { CommandPalette } from "@/components/CommandPalette";

const TABS = [
    { label: "Notes", icon: FileText, href: "/" },
    { label: "Search", icon: Search, href: null, action: "search" },
    { label: "AI", icon: Sparkles, href: null, action: "ai" },
    { label: "Rooms", icon: Users, href: "/rooms" },
];

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [paletteOpen, setPaletteOpen] = useState(false);

    return (
        <>
            <nav className="mobile-nav-bar">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.href
                        ? pathname === tab.href || (tab.href === "/" && pathname.startsWith("/notes/"))
                        : tab.href === "/rooms"
                        ? pathname.startsWith("/rooms")
                        : false;

                    return (
                        <button
                            key={tab.label}
                            className={`mobile-nav-item${isActive ? " active" : ""}`}
                            onClick={() => {
                                if (tab.action === "search") {
                                    setPaletteOpen(true);
                                } else if (tab.action === "ai") {
                                    // Toggle floating AI panel via custom event
                                    window.dispatchEvent(new CustomEvent("toggle-floating-ai"));
                                } else if (tab.href) {
                                    router.push(tab.href);
                                }
                            }}
                            aria-label={tab.label}
                        >
                            <Icon size={20} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        </>
    );
}
