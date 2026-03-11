"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Tab = "signin" | "signup";

const logoSvg = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" fill="white" opacity="0.6"/>
        <circle cx="12" cy="12" r="4" fill="white"/>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
);

const EyeIcon = ({ open }: { open: boolean }) => open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

const inputStyle: React.CSSProperties = {
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
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12.5px",
    fontWeight: 500,
    color: "#9CA3AF",
    marginBottom: "7px",
    letterSpacing: "0.02em",
};

function getSupabase() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

function mapAuthError(msg: string): string {
    if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
    if (msg.includes("Email not confirmed")) return "Email not confirmed. Check your inbox for the verification link.";
    if (msg.includes("User already registered") || msg.includes("already been registered")) return "An account with this email already exists. Try signing in instead.";
    if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) return "Too many attempts. Please wait a minute and try again.";
    if (msg.includes("Unable to validate email")) return "Please enter a valid email address.";
    return msg;
}

export default function AuthPage() {
    const [tab, setTab] = useState<Tab>("signin");
    const searchParams = useSearchParams();

    // Fallback: if Supabase redirected ?code= here instead of /auth/callback, forward it
    useEffect(() => {
        const code = searchParams.get("code");
        if (code) {
            window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
        }
    }, [searchParams]);

    // Sign In state
    const [siEmail, setSiEmail] = useState("");
    const [siPassword, setSiPassword] = useState("");
    const [siShowPw, setSiShowPw] = useState(false);
    const [siLoading, setSiLoading] = useState(false);
    const [siError, setSiError] = useState<string | null>(null);

    // Sign Up state
    const [suEmail, setSuEmail] = useState("");
    const [suPassword, setSuPassword] = useState("");
    const [suShowPw, setSuShowPw] = useState(false);
    const [suLoading, setSuLoading] = useState(false);
    const [suError, setSuError] = useState<string | null>(null);
    const [suSent, setSuSent] = useState(false);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siEmail.trim() || !siPassword) return;
        setSiLoading(true);
        setSiError(null);
        const supabase = getSupabase();
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: siEmail.trim(),
                password: siPassword,
            });
            if (error) {
                setSiError(mapAuthError(error.message));
            } else {
                window.location.href = "/";
            }
        } catch {
            setSiError("Network error — please check your connection and try again.");
        } finally {
            setSiLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!suEmail.trim() || !suPassword) return;
        if (suPassword.length < 6) {
            setSuError("Password must be at least 6 characters.");
            return;
        }
        setSuLoading(true);
        setSuError(null);
        const supabase = getSupabase();
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:2323";

        try {
            const { data, error } = await supabase.auth.signUp({
                email: suEmail.trim(),
                password: suPassword,
                options: { emailRedirectTo: `${siteUrl}/auth/callback` },
            });

            if (error) {
                setSuError(mapAuthError(error.message));
                return;
            }

            // Supabase returns success even for existing emails (anti-enumeration).
            // Detect this: existing user has no new identity row → identities is empty.
            if (data.user && (data.user.identities?.length ?? 0) === 0) {
                setSuError("An account with this email already exists. Please sign in instead.");
                return;
            }

            // If email confirmation is disabled in Supabase (local dev), session is available immediately
            if (data.session) {
                window.location.href = "/";
                return;
            }

            setSuSent(true);
        } catch {
            // Network failure (ERR_NETWORK_CHANGED etc.) — ask user to retry
            setSuError("Network error — please check your connection and try again.");
        } finally {
            setSuLoading(false);
        }
    };

    const containerStyle: React.CSSProperties = {
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "24px",
    };

    const cardStyle: React.CSSProperties = {
        background: "#111111",
        border: "1px solid #1F1F1F",
        borderRadius: "16px",
        padding: "32px",
    };

    const tabBarStyle: React.CSSProperties = {
        display: "flex",
        background: "#1A1A1A",
        borderRadius: "10px",
        padding: "3px",
        marginBottom: "28px",
        gap: "2px",
    };

    const tabBtnStyle = (active: boolean): React.CSSProperties => ({
        flex: 1,
        padding: "8px",
        borderRadius: "7px",
        border: "none",
        background: active ? "#2A2A2A" : "transparent",
        color: active ? "#F8F8F8" : "#6B7280",
        fontSize: "13.5px",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 150ms ease",
    });

    const btnStyle = (disabled: boolean): React.CSSProperties => ({
        width: "100%",
        padding: "11px",
        background: disabled ? "#2A2A2A" : "linear-gradient(135deg, #6366F1, #8B5CF6)",
        border: "none",
        borderRadius: "8px",
        color: disabled ? "#555" : "white",
        fontSize: "14px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "opacity 150ms ease",
        letterSpacing: "0.01em",
    });

    const errorStyle: React.CSSProperties = {
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: "7px",
        padding: "10px 12px",
        fontSize: "13px",
        color: "#F87171",
        marginBottom: "16px",
    };

    return (
        <div style={containerStyle}>
            <div style={{ width: "100%", maxWidth: "400px" }}>
                {/* Logo */}
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
                        {logoSvg}
                    </div>
                    <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#F8F8F8", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
                        NeuroNotes
                    </h1>
                    <p style={{ fontSize: "14px", color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                        Your AI-powered knowledge workspace
                    </p>
                </div>

                {/* Card */}
                <div style={cardStyle}>
                    {/* Tab bar */}
                    <div style={tabBarStyle}>
                        <button style={tabBtnStyle(tab === "signin")} onClick={() => { setTab("signin"); setSiError(null); }}>
                            Sign In
                        </button>
                        <button style={tabBtnStyle(tab === "signup")} onClick={() => { setTab("signup"); setSuError(null); setSuSent(false); }}>
                            Register
                        </button>
                    </div>

                    {/* Sign In panel */}
                    {tab === "signin" && (
                        <>
                            <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#F8F8F8", margin: "0 0 6px" }}>
                                Welcome back
                            </h2>
                            <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 24px" }}>
                                Sign in with your email and password
                            </p>
                            <form onSubmit={handleSignIn}>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={labelStyle}>Email address</label>
                                    <input
                                        type="email"
                                        value={siEmail}
                                        onChange={(e) => setSiEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        autoFocus
                                        style={inputStyle}
                                        onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                        onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                    />
                                </div>
                                <div style={{ marginBottom: "16px" }}>
                                    <label style={labelStyle}>Password</label>
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type={siShowPw ? "text" : "password"}
                                            value={siPassword}
                                            onChange={(e) => setSiPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            style={{ ...inputStyle, paddingRight: "42px" }}
                                            onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                            onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setSiShowPw(!siShowPw)}
                                            style={{
                                                position: "absolute",
                                                right: "12px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                background: "none",
                                                border: "none",
                                                color: "#6B7280",
                                                cursor: "pointer",
                                                padding: "2px",
                                                display: "flex",
                                                alignItems: "center",
                                            }}
                                        >
                                            <EyeIcon open={siShowPw} />
                                        </button>
                                    </div>
                                </div>
                                {siError && <div style={errorStyle}>{siError}</div>}
                                <button
                                    type="submit"
                                    disabled={siLoading || !siEmail.trim() || !siPassword}
                                    style={btnStyle(siLoading || !siEmail.trim() || !siPassword)}
                                >
                                    {siLoading ? "Signing in..." : "Sign In"}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Sign Up panel */}
                    {tab === "signup" && (
                        <>
                            {suSent ? (
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
                                        A confirmation link was sent to{" "}
                                        <strong style={{ color: "#A5A5A5" }}>{suEmail}</strong>.
                                        Click it to verify your account, then sign in with your password.
                                    </p>
                                    <button
                                        onClick={() => { setSuSent(false); setSuEmail(""); setSuPassword(""); }}
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
                                    <h2 style={{ fontSize: "17px", fontWeight: 600, color: "#F8F8F8", margin: "0 0 6px" }}>
                                        Create your account
                                    </h2>
                                    <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 24px" }}>
                                        Sign up with your email and a password
                                    </p>
                                    <form onSubmit={handleSignUp}>
                                        <div style={{ marginBottom: "16px" }}>
                                            <label style={labelStyle}>Email address</label>
                                            <input
                                                type="email"
                                                value={suEmail}
                                                onChange={(e) => setSuEmail(e.target.value)}
                                                placeholder="you@example.com"
                                                required
                                                autoFocus
                                                style={inputStyle}
                                                onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                                onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                            />
                                        </div>
                                        <div style={{ marginBottom: "16px" }}>
                                            <label style={labelStyle}>Password</label>
                                            <div style={{ position: "relative" }}>
                                                <input
                                                    type={suShowPw ? "text" : "password"}
                                                    value={suPassword}
                                                    onChange={(e) => setSuPassword(e.target.value)}
                                                    placeholder="At least 6 characters"
                                                    required
                                                    style={{ ...inputStyle, paddingRight: "42px" }}
                                                    onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                                    onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setSuShowPw(!suShowPw)}
                                                    style={{
                                                        position: "absolute",
                                                        right: "12px",
                                                        top: "50%",
                                                        transform: "translateY(-50%)",
                                                        background: "none",
                                                        border: "none",
                                                        color: "#6B7280",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <EyeIcon open={suShowPw} />
                                                </button>
                                            </div>
                                        </div>
                                        {suError && <div style={errorStyle}>{suError}</div>}
                                        <button
                                            type="submit"
                                            disabled={suLoading || !suEmail.trim() || !suPassword}
                                            style={btnStyle(suLoading || !suEmail.trim() || !suPassword)}
                                        >
                                            {suLoading ? "Creating account..." : "Create Account"}
                                        </button>
                                    </form>
                                </>
                            )}
                        </>
                    )}
                </div>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#4B5563", marginTop: "20px" }}>
                    {tab === "signin"
                        ? "Don't have an account? Click Register above."
                        : "Already have an account? Click Sign In above."}
                </p>
            </div>
        </div>
    );
}
