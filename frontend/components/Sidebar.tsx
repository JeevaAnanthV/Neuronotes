"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { notesApi, notesEvents, type NoteListItem } from "@/lib/api";
import { CommandPalette } from "@/components/CommandPalette";
import { TemplateSelector, type Template } from "@/components/TemplateSelector";
import { CalendarWidget } from "@/components/CalendarWidget";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
    FileText,
    GitBranch,
    Search,
    Settings,
    Plus,
    Brain,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    X,
    Menu,
    Users,
    Layers,
    GraduationCap,
    ChevronDown,
    MessageSquare,
    Network,
    LogOut,
    User,
    TrendingUp,
} from "lucide-react";

const EXPLORE_ITEMS = [
    { label: "Knowledge Graph", icon: GitBranch, href: "/graph" },
    { label: "AI Insights", icon: Lightbulb, href: "/insights" },
    { label: "Flashcards", icon: GraduationCap, href: "/flashcards" },
    { label: "Search Notes", icon: Search, href: null, action: "search" },
    { label: "Topic Clusters", icon: Layers, href: "/clusters" },
    { label: "AI Chat", icon: MessageSquare, href: "/chat" },
    { label: "Trends", icon: TrendingUp, href: "/trends" },
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
    const [templateOpen, setTemplateOpen] = useState(false);
    const [exploreOpen, setExploreOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [profileEditOpen, setProfileEditOpen] = useState(false);
    const [profileUsername, setProfileUsername] = useState("");
    const [profileAge, setProfileAge] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    // Load current user info
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setUserEmail(data.user.email);
        });
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/auth");
    };

    const handleProfileSave = async () => {
        if (!profileUsername.trim()) return;
        setProfileSaving(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from("profiles").upsert({
                id: user.id,
                username: profileUsername.trim(),
                age: profileAge ? parseInt(profileAge, 10) : null,
            });
            setProfileEditOpen(false);
            setUserMenuOpen(false);
        } catch {
            // Profile save failed — silently ignore; modal closes only on success
        } finally {
            setProfileSaving(false);
        }
    };

    const loadNotes = useCallback(async () => {
        try {
            const data = await notesApi.list();
            setNotes(data);
        } catch {
            // backend may not be running during dev
        }
    }, []);

    // Fetch once on mount, then re-fetch only when notes are mutated.
    // No polling — sidebar reacts to the global nn:notes-changed event emitted
    // by notesApi.create / update / delete.
    useEffect(() => {
        loadNotes();
        const unsub = notesEvents.subscribe(loadNotes);
        return unsub;
    }, [loadNotes]);

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
            if ((e.ctrlKey || e.metaKey) && e.key === "[") {
                e.preventDefault();
                setCollapsed((c) => !c);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const handleNewNote = () => setTemplateOpen(true);

    const handleTemplateSelect = async (template: Template) => {
        setTemplateOpen(false);
        if (creating) return;
        setCreating(true);
        try {
            const note = await notesApi.create("Untitled", template.content);
            await loadNotes();
            router.push(`/notes/${note.id}`);
            setMobileOpen(false);
        } catch {
            // Backend offline — silently fail; creating state resets so user can retry
        } finally {
            setCreating(false);
        }
    };

    const handleNavClick = (href: string) => {
        router.push(href);
        setMobileOpen(false);
    };

    const currentNoteId = pathname.startsWith("/notes/") ? pathname.split("/")[2] : null;

    const filteredNotes = searchQuery.trim()
        ? notes.filter((n) => (n.title || "Untitled").toLowerCase().includes(searchQuery.toLowerCase()))
        : notes;

    const isExploreActive = EXPLORE_ITEMS.some((i) => i.href && pathname === i.href);

    const sidebarContent = (
        <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
            {/* Header */}
            <div className="sidebar-header">
                <div
                    className="sidebar-logo"
                    onClick={() => router.push("/")}
                    style={{ cursor: "pointer" }}
                    title="Go to dashboard"
                >
                    <Brain size={13} color="white" />
                </div>
                {!collapsed && (
                    <span
                        className="sidebar-title"
                        onClick={() => router.push("/")}
                        style={{ cursor: "pointer" }}
                        title="Go to dashboard"
                    >
                        NeuroNotes
                    </span>
                )}
                <button
                    className="sidebar-collapse-btn"
                    onClick={() => setCollapsed((c) => !c)}
                    title={collapsed ? "Expand (Ctrl+[)" : "Collapse (Ctrl+[)"}
                >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                </button>
            </div>

            {/* Search */}
            <div className="sidebar-search">
                <Search size={12} className="search-icon" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => !searchQuery && setPaletteOpen(true)}
                    placeholder="Search notes…"
                    readOnly={!searchQuery}
                />
                {!searchQuery && <span className="search-shortcut">⌘K</span>}
            </div>

            {/* New Note */}
            <button
                className="sidebar-new-note"
                onClick={handleNewNote}
                disabled={creating}
                title="New note (Ctrl+N)"
            >
                {creating ? <span className="loading-spinner" style={{ width: 13, height: 13 }} /> : <Plus size={13} />}
                {!collapsed && (creating ? "Creating…" : "New Note")}
            </button>

            {/* NOTES section */}
            {!collapsed && <div className="sidebar-section-label">Notes</div>}

            <div className="sidebar-notes">
                {filteredNotes.length === 0 ? (
                    !collapsed && (
                        <div style={{ padding: "12px 4px", color: "var(--text-muted)", fontSize: "12.5px", textAlign: "center" }}>
                            {searchQuery ? "No matches" : "No notes yet"}
                        </div>
                    )
                ) : (
                    filteredNotes.slice(0, 15).map((note) => (
                        <div
                            key={note.id}
                            className={`note-item${currentNoteId === note.id ? " active" : ""}`}
                            onClick={() => { router.push(`/notes/${note.id}`); setMobileOpen(false); }}
                        >
                            {!collapsed && (
                                <>
                                    <div className="note-item-title">{note.title || "Untitled"}</div>
                                    <div className="note-item-date">{timeAgo(note.updated_at)}</div>
                                </>
                            )}
                            {collapsed && (
                                <div title={note.title || "Untitled"} style={{ display: "flex", justifyContent: "center" }}>
                                    <FileText size={14} color="var(--text-muted)" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Mini calendar widget */}
            {!collapsed && (
                <>
                    <div className="sidebar-section-divider" />
                    <div className="sidebar-section-label" style={{ padding: "8px 14px 2px" }}>Calendar</div>
                    <CalendarWidget notes={notes} />
                </>
            )}

            {/* Divider */}
            <div className="sidebar-section-divider" />

            {/* ROOMS section */}
            <div className="sidebar-nav">
                {!collapsed && <div className="sidebar-section-label" style={{ padding: "4px 4px 4px" }}>Rooms</div>}
                <button
                    className={`nav-item${pathname === "/rooms" || pathname.startsWith("/rooms/") ? " active" : ""}`}
                    onClick={() => handleNavClick("/rooms")}
                    title={collapsed ? "Rooms" : undefined}
                >
                    <Users size={14} />
                    {!collapsed && <span className="nav-label">My Rooms</span>}
                </button>
            </div>

            {/* Divider */}
            <div className="sidebar-section-divider" />

            {/* EXPLORE section */}
            <div className="sidebar-nav" style={{ paddingBottom: "4px" }}>
                {!collapsed && (
                    <button
                        className={`nav-item${isExploreActive ? " active" : ""}`}
                        onClick={() => setExploreOpen((o) => !o)}
                        style={{ fontWeight: 500 }}
                    >
                        <Network size={14} />
                        <span className="nav-label">Explore</span>
                        <ChevronDown size={11} style={{
                            color: "var(--text-muted)",
                            transform: exploreOpen ? "rotate(180deg)" : "none",
                            transition: "transform 150ms var(--ease)",
                        }} />
                    </button>
                )}
                {(exploreOpen || collapsed) && EXPLORE_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href && pathname === item.href;
                    return (
                        <button
                            key={item.label}
                            className={`nav-item${collapsed ? "" : " explore-sub"}${isActive ? " active" : ""}`}
                            onClick={() => {
                                if (item.action === "search") {
                                    setPaletteOpen(true);
                                } else if (item.href) {
                                    handleNavClick(item.href);
                                }
                            }}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon size={13} />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
                        </button>
                    );
                })}
            </div>

            {/* User menu at bottom */}
            <div style={{ padding: "2px 8px 4px", marginTop: "auto", position: "relative" }}>
                <button
                    className="nav-item"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    title={collapsed ? (userEmail || "Account") : undefined}
                    style={{ width: "100%" }}
                >
                    <User size={14} />
                    {!collapsed && (
                        <span className="nav-label" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px" }}>
                            {userEmail ? userEmail.split("@")[0] : "Account"}
                        </span>
                    )}
                </button>

                {userMenuOpen && (
                    <div style={{
                        position: "absolute",
                        bottom: "100%",
                        left: 8,
                        right: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-lg)",
                        padding: "6px",
                        zIndex: 200,
                        animation: "fadeIn 0.12s var(--ease)",
                    }}>
                        {userEmail && (
                            <div style={{ padding: "6px 8px 8px", fontSize: "11px", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", marginBottom: "4px" }}>
                                {userEmail}
                            </div>
                        )}
                        <button
                            className="nav-item"
                            style={{ width: "100%", fontSize: "12.5px" }}
                            onClick={() => { setProfileEditOpen(true); setUserMenuOpen(false); }}
                        >
                            <User size={13} />
                            <span className="nav-label">Edit Profile</span>
                        </button>
                        <button
                            className="nav-item"
                            style={{ width: "100%", fontSize: "12.5px", color: "var(--accent-danger, #ef4444)" }}
                            onClick={handleLogout}
                        >
                            <LogOut size={13} />
                            <span className="nav-label">Log Out</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Settings + theme toggle at bottom */}
            <div style={{ padding: "2px 8px 10px", display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                    className={`nav-item${pathname === "/settings" ? " active" : ""}`}
                    onClick={() => handleNavClick("/settings")}
                    title={collapsed ? "Settings" : undefined}
                    style={{ flex: 1 }}
                >
                    <Settings size={14} />
                    {!collapsed && <span className="nav-label">Settings</span>}
                </button>
                <ThemeToggle />
            </div>

            {/* Profile edit modal */}
            {profileEditOpen && (
                <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => setProfileEditOpen(false)}
                >
                    <div
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", padding: "28px", width: 360, boxShadow: "var(--shadow-lg)", animation: "paletteIn 0.15s var(--ease)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "18px" }}>Edit Profile</div>
                        <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Username</label>
                        <input
                            value={profileUsername}
                            onChange={(e) => setProfileUsername(e.target.value)}
                            placeholder="your_username"
                            autoFocus
                            style={{ width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "9px 12px", color: "var(--text-primary)", fontSize: "13.5px", fontFamily: "inherit", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                        <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Age (optional)</label>
                        <input
                            type="number"
                            value={profileAge}
                            onChange={(e) => setProfileAge(e.target.value)}
                            placeholder="25"
                            style={{ width: "100%", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "9px 12px", color: "var(--text-primary)", fontSize: "13.5px", fontFamily: "inherit", outline: "none", marginBottom: "20px", boxSizing: "border-box" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-primary)"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setProfileEditOpen(false)}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleProfileSave} disabled={profileSaving || !profileUsername.trim()}>
                                {profileSaving ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="mobile-hamburger btn-icon"
                style={{
                    position: "fixed",
                    top: 10,
                    left: 10,
                    zIndex: 900,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    minWidth: 36,
                    minHeight: 36,
                }}
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
            >
                <Menu size={17} />
            </button>

            {/* Mobile overlay */}
            <div
                className={`sidebar-mobile-overlay${mobileOpen ? " visible" : ""}`}
                onClick={() => setMobileOpen(false)}
            />

            {/* Desktop sidebar */}
            <div style={{ display: "contents" }}>
                {sidebarContent}
            </div>

            {/* Mobile sidebar */}
            {mobileOpen && (
                <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 850 }}>
                    <aside className="sidebar mobile-open" style={{ height: "100vh" }}>
                        <div className="sidebar-header">
                            <div className="sidebar-logo" onClick={() => { router.push("/"); setMobileOpen(false); }} style={{ cursor: "pointer" }}>
                                <Brain size={13} color="white" />
                            </div>
                            <span className="sidebar-title" onClick={() => { router.push("/"); setMobileOpen(false); }} style={{ cursor: "pointer" }}>NeuroNotes</span>
                            <button className="sidebar-collapse-btn" onClick={() => setMobileOpen(false)}>
                                <X size={13} />
                            </button>
                        </div>
                        <div className="sidebar-search">
                            <Search size={12} className="search-icon" />
                            <input
                                placeholder="Search notes… ⌘K"
                                onFocus={() => { setPaletteOpen(true); setMobileOpen(false); }}
                                readOnly
                            />
                        </div>
                        <button className="sidebar-new-note" onClick={handleNewNote} disabled={creating}>
                            <Plus size={13} />
                            {creating ? "Creating…" : "New Note"}
                        </button>
                        <div className="sidebar-section-label">Notes</div>
                        <div className="sidebar-notes">
                            {notes.slice(0, 15).map((note) => (
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
                        <div className="sidebar-section-divider" />
                        <div className="sidebar-nav">
                            <div className="sidebar-section-label" style={{ padding: "4px 4px 4px" }}>Rooms</div>
                            <button className={`nav-item${pathname.startsWith("/rooms") ? " active" : ""}`} onClick={() => handleNavClick("/rooms")}>
                                <Users size={14} />
                                <span className="nav-label">My Rooms</span>
                            </button>
                        </div>
                        <div className="sidebar-section-divider" />
                        <div className="sidebar-nav">
                            <div className="sidebar-section-label" style={{ padding: "4px 4px 4px" }}>Explore</div>
                            {EXPLORE_ITEMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.label}
                                        className={`nav-item explore-sub${item.href && pathname === item.href ? " active" : ""}`}
                                        onClick={() => {
                                            if (item.action === "search") { setPaletteOpen(true); setMobileOpen(false); }
                                            else if (item.href) handleNavClick(item.href);
                                        }}
                                    >
                                        <Icon size={13} />
                                        <span className="nav-label">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ padding: "2px 8px 10px", marginTop: "auto" }}>
                            <button className={`nav-item${pathname === "/settings" ? " active" : ""}`} onClick={() => handleNavClick("/settings")}>
                                <Settings size={14} />
                                <span className="nav-label">Settings</span>
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
            {templateOpen && (
                <TemplateSelector
                    onSelect={handleTemplateSelect}
                    onClose={() => setTemplateOpen(false)}
                />
            )}
        </>
    );
}
