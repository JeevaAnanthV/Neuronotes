"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        setError(null);

        // Create client inside handler — only runs client-side, never during SSR prerender
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setSent(true);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#0A0A0A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            padding: "24px",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "400px",
            }}>
                {/* Logo + tagline */}
                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "52px",
                        height: "52px",
                        background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                        borderRadius: "14px",
                        marginBottom: "16px",
                        boxShadow: "0 0 32px rgba(99,102,241,0.35)",
                    }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" fill="white" opacity="0.6"/>
                            <circle cx="12" cy="12" r="4" fill="white"/>
                            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                        </svg>
                    </div>
                    <h1 style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: "#F8F8F8",
                        margin: "0 0 6px",
                        letterSpacing: "-0.4px",
                    }}>
                        NeuroNotes
                    </h1>
                    <p style={{
                        fontSize: "14px",
                        color: "#6B7280",
                        margin: 0,
                        lineHeight: 1.5,
                    }}>
                        Your AI-powered knowledge workspace
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: "#111111",
                    border: "1px solid #1F1F1F",
                    borderRadius: "16px",
                    padding: "32px",
                }}>
                    {sent ? (
                        <div style={{ textAlign: "center" }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                background: "rgba(99,102,241,0.12)",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px",
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#6366F1"/>
                                </svg>
                            </div>
                            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#F8F8F8", margin: "0 0 8px" }}>
                                Check your email
                            </h2>
                            <p style={{ fontSize: "13.5px", color: "#6B7280", margin: "0 0 20px", lineHeight: 1.6 }}>
                                We sent a magic link to <strong style={{ color: "#A5A5A5" }}>{email}</strong>. Click it to sign in.
                            </p>
                            <button
                                onClick={() => { setSent(false); setEmail(""); }}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#6366F1",
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontFamily: "inherit",
                                }}
                            >
                                Use a different email
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 style={{
                                fontSize: "17px",
                                fontWeight: 600,
                                color: "#F8F8F8",
                                margin: "0 0 6px",
                            }}>
                                Sign in to NeuroNotes
                            </h2>
                            <p style={{
                                fontSize: "13px",
                                color: "#6B7280",
                                margin: "0 0 24px",
                            }}>
                                Enter your email to receive a magic link
                            </p>

                            <form onSubmit={handleSubmit}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={{
                                        display: "block",
                                        fontSize: "12.5px",
                                        fontWeight: 500,
                                        color: "#9CA3AF",
                                        marginBottom: "7px",
                                        letterSpacing: "0.02em",
                                    }}>
                                        Email address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        autoFocus
                                        style={{
                                            width: "100%",
                                            padding: "10px 14px",
                                            background: "#1A1A1A",
                                            border: "1px solid #2A2A2A",
                                            borderRadius: "8px",
                                            color: "#F8F8F8",
                                            fontSize: "14px",
                                            outline: "none",
                                            fontFamily: "inherit",
                                            boxSizing: "border-box",
                                            transition: "border-color 150ms ease",
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                        onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                    />
                                </div>

                                {error && (
                                    <div style={{
                                        background: "rgba(239,68,68,0.08)",
                                        border: "1px solid rgba(239,68,68,0.2)",
                                        borderRadius: "7px",
                                        padding: "10px 12px",
                                        fontSize: "13px",
                                        color: "#F87171",
                                        marginBottom: "16px",
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !email.trim()}
                                    style={{
                                        width: "100%",
                                        padding: "11px",
                                        background: loading || !email.trim()
                                            ? "#2A2A2A"
                                            : "linear-gradient(135deg, #6366F1, #8B5CF6)",
                                        border: "none",
                                        borderRadius: "8px",
                                        color: loading || !email.trim() ? "#555" : "white",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                                        fontFamily: "inherit",
                                        transition: "opacity 150ms ease",
                                        letterSpacing: "0.01em",
                                    }}
                                >
                                    {loading ? "Sending..." : "Send Magic Link"}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p style={{
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#4B5563",
                    marginTop: "20px",
                }}>
                    No password needed. Secure, passwordless sign-in.
                </p>
            </div>
        </div>
    );
}
