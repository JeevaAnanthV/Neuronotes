"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const logoSvg = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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

export default function OnboardingPage() {
    const [username, setUsername] = useState("");
    const [age, setAge] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>("");

    useEffect(() => {
        const supabase = getSupabase();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) {
                window.location.href = "/auth";
            } else {
                setUserEmail(user.email ?? "");
            }
        });
    }, []);

    const validate = (): string | null => {
        if (username.trim().length < 3) return "Display name must be at least 3 characters.";
        if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) return "Username can only contain letters, numbers, underscores, hyphens, and dots.";
        if (age && (isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)) return "Please enter a valid age (1–120).";
        if (password.length < 8) return "Password must be at least 8 characters.";
        if (password !== confirmPassword) return "Passwords do not match.";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        setError(null);

        const supabase = getSupabase();

        // 1. Set password for the user
        const { error: pwError } = await supabase.auth.updateUser({ password });
        if (pwError) {
            setLoading(false);
            setError(pwError.message);
            return;
        }

        // 2. Get user id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            setError("Session expired. Please sign in again.");
            return;
        }

        // 3. Insert profile row
        const profilePayload: { id: string; username: string; age?: number } = {
            id: user.id,
            username: username.trim(),
        };
        if (age) profilePayload.age = Number(age);

        const { error: profileError } = await supabase.from("profiles").insert(profilePayload);
        if (profileError) {
            setLoading(false);
            if (profileError.message.includes("unique") || profileError.code === "23505") {
                setError("That username is already taken. Please choose another.");
            } else {
                setError(profileError.message);
            }
            return;
        }

        // 4. Done — redirect to app
        window.location.href = "/";
    };

    const isDisabled = loading || !username.trim() || !password || !confirmPassword;

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
            <div style={{ width: "100%", maxWidth: "420px" }}>
                {/* Logo + heading */}
                <div style={{ textAlign: "center", marginBottom: "36px" }}>
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "48px",
                        height: "48px",
                        background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                        borderRadius: "13px",
                        marginBottom: "14px",
                        boxShadow: "0 0 28px rgba(99,102,241,0.35)",
                    }}>
                        {logoSvg}
                    </div>
                    <h1 style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: "#F8F8F8",
                        margin: "0 0 6px",
                        letterSpacing: "-0.4px",
                    }}>
                        Welcome to NeuroNotes
                    </h1>
                    <p style={{ fontSize: "13.5px", color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                        {userEmail
                            ? <>Signed in as <span style={{ color: "#A5A5A5" }}>{userEmail}</span>. Finish setting up your account.</>
                            : "Finish setting up your account."}
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: "#111111",
                    border: "1px solid #1F1F1F",
                    borderRadius: "16px",
                    padding: "32px",
                }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#F8F8F8", margin: "0 0 6px" }}>
                        Complete your profile
                    </h2>
                    <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 24px" }}>
                        Choose a display name and set your password
                    </p>

                    <form onSubmit={handleSubmit}>
                        {/* Display Name */}
                        <div style={{ marginBottom: "16px" }}>
                            <label style={labelStyle}>Display Name <span style={{ color: "#6366F1" }}>*</span></label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. alex_notes"
                                required
                                autoFocus
                                minLength={3}
                                style={inputStyle}
                                onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                            />
                            <p style={{ fontSize: "11.5px", color: "#555", margin: "5px 0 0" }}>
                                Min 3 chars. Letters, numbers, _ . - only.
                            </p>
                        </div>

                        {/* Age (optional) */}
                        <div style={{ marginBottom: "16px" }}>
                            <label style={labelStyle}>Age <span style={{ color: "#555" }}>(optional)</span></label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="e.g. 24"
                                min={1}
                                max={120}
                                style={inputStyle}
                                onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: "16px" }}>
                            <label style={labelStyle}>Password <span style={{ color: "#6366F1" }}>*</span></label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPw ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    required
                                    minLength={8}
                                    style={{ ...inputStyle, paddingRight: "42px" }}
                                    onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                    onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
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
                                    <EyeIcon open={showPw} />
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div style={{ marginBottom: "20px" }}>
                            <label style={labelStyle}>Confirm Password <span style={{ color: "#6366F1" }}>*</span></label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showConfirmPw ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat your password"
                                    required
                                    style={{ ...inputStyle, paddingRight: "42px" }}
                                    onFocus={(e) => { e.target.style.borderColor = "#6366F1"; }}
                                    onBlur={(e) => { e.target.style.borderColor = "#2A2A2A"; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPw(!showConfirmPw)}
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
                                    <EyeIcon open={showConfirmPw} />
                                </button>
                            </div>
                            {password && confirmPassword && password !== confirmPassword && (
                                <p style={{ fontSize: "11.5px", color: "#F87171", margin: "5px 0 0" }}>
                                    Passwords do not match.
                                </p>
                            )}
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
                            disabled={isDisabled}
                            style={{
                                width: "100%",
                                padding: "11px",
                                background: isDisabled ? "#2A2A2A" : "linear-gradient(135deg, #6366F1, #8B5CF6)",
                                border: "none",
                                borderRadius: "8px",
                                color: isDisabled ? "#555" : "white",
                                fontSize: "14px",
                                fontWeight: 600,
                                cursor: isDisabled ? "not-allowed" : "pointer",
                                fontFamily: "inherit",
                                transition: "opacity 150ms ease",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {loading ? "Setting up..." : "Complete Setup"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
