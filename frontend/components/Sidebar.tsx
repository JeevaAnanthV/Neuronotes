"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { notesApi, type NoteListItem } from "@/lib/api";
import { CommandPalette } from "@/components/CommandPalette";
import {
    FileText,
    Tag,
    GitBranch,
    MessageSquare,
    Search,
    Settings,
    Plus,
    Brain,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    Menu,
    X,
} from "lucide-react";

const NAV = [
    { label: "Notes", icon: FileText, href: "/", shortcut: null },
    { label: "Tags", icon: Tag, href: "/tags", shortcut: null },
    { label: "Graph", icon: GitBranch, href: "/graph", shortcut: null },
    { label: "AI Chat", icon: MessageSquare, href: "/chat", shortcut: null },
    { label: "Insights", icon: Lightbulb, href: "/insights", shortcut: null },
];

function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [notes, setNotes] = useState<NoteListItem[]>([]);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const loadNotes = useCallback(async () => {
        try {
            const data = await notesApi.list();
            setNotes(data);
        } catch {
            // backend may not be running during dev
        }
    }, []);

    useEffect(() => {
        loadNotes();
        const interval = setInterval(loadNotes, 10000);
        return () => clearInterval(interval);
    }, [loadNotes]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setPaletteOpen(true);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "n") {
                e.preventDefault();
                handleNewNote();
            }
            // Ctrl+[ to toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === "[") {
                e.preventDefault();
                setCollapsed((c) => !c);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNewNote = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const note = await notesApi.create("Untitled", "");
            await loadNotes();
            router.push(`/notes/${note.id}`);
            setMobileOpen(false);
        } catch {
            alert("Backend not connected. Please start the API server.");
        } finally {
            setCreating(false);
        }
    };

    const handleNavClick = (href: string) => {
        router.push(href);
        setMobileOpen(false);
    };

    const currentNoteId = pathname.startsWith("/notes/") ? pathname.split("/")[2] : null;

    const sidebarContent = (
        <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
            {/* Logo + Collapse Toggle */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <Brain size={15} color="white" />
                </div>
                {!collapsed && <span className="sidebar-title">NeuroNotes</span>}
                <button
                    className="sidebar-collapse-btn"
                    onClick={() => setCollapsed((c) => !c)}
                    title={collapsed ? "Expand sidebar (Ctrl+[)" : "Collapse sidebar (Ctrl+[)"}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* New Note */}
            <button
                className="sidebar-new-note"
                onClick={handleNewNote}
                disabled={creating}
                id="new-note-btn"
                title="New note (Ctrl+N)"
            >
                {creating ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : <Plus size={15} />}
                {!collapsed && (creating ? "Creating…" : "New Note")}
            </button>

            {/* Nav */}
            <nav className="sidebar-nav">
                {NAV.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <button
                            key={item.href}
                            className={`nav-item${isActive ? " active" : ""}`}
                            onClick={() => handleNavClick(item.href)}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon size={16} />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
                        </button>
                    );
                })}
                <button
                    className="nav-item"
                    onClick={() => setPaletteOpen(true)}
                    title={collapsed ? "Search (Ctrl+K)" : undefined}
                >
                    <Search size={16} />
                    {!collapsed && (
                        <>
                            <span className="nav-label">Search</span>
                            <span className="nav-shortcut">Ctrl+K</span>
                        </>
                    )}
                </button>
            </nav>

            {/* Notes list */}
            {!collapsed && (
                <div className="sidebar-notes">
                    <div className="sidebar-section-title">Recent Notes</div>
                    {notes.length === 0 ? (
                        <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
                            No notes yet
                        </div>
                    ) : (
                        notes.slice(0, 10).map((note) => (
                            <div
                                key={note.id}
                                className={`note-item${currentNoteId === note.id ? " active" : ""}`}
                                onClick={() => { router.push(`/notes/${note.id}`); setMobileOpen(false); }}
                            >
                                <div className="note-item-title">{note.title || "Untitled"}</div>
                                <div className="note-item-date">{timeAgo(note.updated_at)}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Settings */}
            <div style={{ padding: "4px 8px 12px", marginTop: collapsed ? "auto" : 0 }}>
                <button
                    className={`nav-item${pathname === "/settings" ? " active" : ""}`}
                    onClick={() => handleNavClick("/settings")}
                    title={collapsed ? "Settings" : undefined}
                >
                    <Settings size={16} />
                    {!collapsed && <span className="nav-label">Settings</span>}
                </button>
            </div>
        </aside>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="mobile-hamburger btn-icon"
                style={{
                    position: "fixed",
                    top: 12,
                    left: 12,
                    zIndex: 900,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                }}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
            >
                <Menu size={18} />
            </button>

            {/* Mobile overlay */}
            <div
                className={`sidebar-mobile-overlay${mobileOpen ? " visible" : ""}`}
                onClick={() => setMobileOpen(false)}
            />

            {/* Desktop sidebar (normal flow) */}
            <div style={{ display: "contents" }} className="desktop-sidebar">
                {sidebarContent}
            </div>

            {/* Mobile sidebar (fixed, slide-in) — rendered separately */}
            {mobileOpen && (
                <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 850 }}>
                    <aside className="sidebar mobile-open" style={{ height: "100vh" }}>
                        <div className="sidebar-header">
                            <div className="sidebar-logo">
                                <Brain size={15} color="white" />
                            </div>
                            <span className="sidebar-title">NeuroNotes</span>
                            <button
                                className="sidebar-collapse-btn"
                                onClick={() => setMobileOpen(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <button
                            className="sidebar-new-note"
                            onClick={handleNewNote}
                            disabled={creating}
                        >
                            <Plus size={15} />
                            {creating ? "Creating…" : "New Note"}
                        </button>

                        <nav className="sidebar-nav">
                            {NAV.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.href}
                                        className={`nav-item${pathname === item.href ? " active" : ""}`}
                                        onClick={() => handleNavClick(item.href)}
                                    >
                                        <Icon size={16} />
                                        <span className="nav-label">{item.label}</span>
                                    </button>
                                );
                            })}
                            <button className="nav-item" onClick={() => { setPaletteOpen(true); setMobileOpen(false); }}>
                                <Search size={16} />
                                <span className="nav-label">Search</span>
                                <span className="nav-shortcut">Ctrl+K</span>
                            </button>
                        </nav>

                        <div className="sidebar-notes">
                            <div className="sidebar-section-title">Recent Notes</div>
                            {notes.slice(0, 10).map((note) => (
                                <div
                                    key={note.id}
                                    className={`note-item${currentNoteId === note.id ? " active" : ""}`}
                                    onClick={() => { router.push(`/notes/${note.id}`); setMobileOpen(false); }}
                                >
                                    <div className="note-item-title">{note.title || "Untitled"}</div>
                                    <div className="note-item-date">{timeAgo(note.updated_at)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: "4px 8px 12px" }}>
                            <button
                                className={`nav-item${pathname === "/settings" ? " active" : ""}`}
                                onClick={() => handleNavClick("/settings")}
                            >
                                <Settings size={16} />
                                <span className="nav-label">Settings</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        </>
    );
}
