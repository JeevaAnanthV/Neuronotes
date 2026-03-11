"use client";

import { useState, useRef } from "react";
import { aiApi } from "@/lib/api";
import { Mic, MicOff, Plus, X } from "lucide-react";

interface Props {
    onNoteCreated?: (title: string, content: string) => void;
    onInsertTranscript?: (transcript: string) => void;
}

export function VoiceRecorder({ onNoteCreated, onInsertTranscript }: Props) {
    const [recording, setRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [showPanel, setShowPanel] = useState(false);
    const [result, setResult] = useState<{ title: string; structured_content: string } | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    const startRecording = async () => {
        setVoiceError(null);
        setTranscript("");
        setResult(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
            const recorder = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                stream.getTracks().forEach((t) => t.stop());
                setProcessing(true);
                try {
                    const formData = new FormData();
                    formData.append("file", blob, "voice.webm");
                    const res = await aiApi.voice(formData);
                    setTranscript(res.transcript);
                    setResult({ title: res.title, structured_content: res.structured_content });
                } catch {
                    setVoiceError("Voice processing failed. Check backend connection.");
                } finally {
                    setProcessing(false);
                }
            };
            mediaRef.current = recorder;
            recorder.start();
            setRecording(true);
            setShowPanel(true);
        } catch {
            setVoiceError("Microphone access denied or not available.");
            setShowPanel(true);
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        setRecording(false);
    };

    const handleInsertIntoEditor = () => {
        if (!transcript) return;
        onInsertTranscript?.(transcript);
        setShowPanel(false);
        setTranscript("");
        setResult(null);
    };

    const handleReplaceNote = () => {
        if (!result) return;
        onNoteCreated?.(result.title, result.structured_content);
        setShowPanel(false);
        setTranscript("");
        setResult(null);
    };

    const handleClose = () => {
        setShowPanel(false);
        setTranscript("");
        setResult(null);
        setVoiceError(null);
    };

    return (
        <>
            {/* Mic button in the topbar */}
            <button
                className="btn-icon"
                onClick={recording ? stopRecording : () => { setShowPanel(true); startRecording(); }}
                disabled={processing}
                title={recording ? "Stop recording" : "Voice note"}
                style={{
                    color: recording ? "var(--danger)" : "var(--text-muted)",
                    background: recording ? "rgba(239,68,68,0.1)" : undefined,
                    animation: recording ? "pulse 1.5s infinite" : undefined,
                }}
            >
                {processing ? (
                    <span className="loading-spinner" style={{ width: 14, height: 14 }} />
                ) : recording ? (
                    <MicOff size={15} />
                ) : (
                    <Mic size={15} />
                )}
            </button>

            {/* Voice panel modal */}
            {showPanel && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
                >
                    <div
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-lg)",
                            padding: "24px",
                            width: 380,
                            maxWidth: "90vw",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            boxShadow: "var(--shadow-lg)",
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Mic size={15} style={{ color: "var(--accent-primary)" }} />
                                Voice Note
                            </div>
                            <button
                                onClick={handleClose}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Recording controls */}
                        {!transcript && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "8px 0" }}>
                                <button
                                    onClick={recording ? stopRecording : startRecording}
                                    disabled={processing}
                                    style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: "50%",
                                        border: "none",
                                        background: recording ? "var(--danger)" : "var(--accent-gradient)",
                                        color: "white",
                                        cursor: processing ? "not-allowed" : "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        animation: recording ? "pulse 1.5s infinite" : undefined,
                                        boxShadow: recording ? "0 0 20px rgba(239,68,68,0.4)" : "0 0 20px var(--accent-glow)",
                                        transition: "all 200ms ease",
                                    }}
                                >
                                    {processing ? (
                                        <span className="loading-spinner" style={{ width: 20, height: 20 }} />
                                    ) : recording ? (
                                        <MicOff size={24} />
                                    ) : (
                                        <Mic size={24} />
                                    )}
                                </button>
                                <span style={{ fontSize: "13px", color: recording ? "var(--danger)" : "var(--text-muted)" }}>
                                    {processing ? "AI processing transcript…" : recording ? "Recording… click to stop" : "Click to start recording"}
                                </span>
                            </div>
                        )}

                        {/* Error */}
                        {voiceError && (
                            <div style={{
                                background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                borderRadius: "var(--radius-md)",
                                padding: "10px 12px",
                                fontSize: "12.5px",
                                color: "#f87171",
                            }}>
                                {voiceError}
                            </div>
                        )}

                        {/* Transcript result */}
                        {transcript && (
                            <>
                                <div>
                                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>
                                        Transcript
                                    </div>
                                    <div style={{
                                        background: "var(--bg-tertiary)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "var(--radius-md)",
                                        padding: "10px 12px",
                                        fontSize: "13px",
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.6,
                                        maxHeight: "120px",
                                        overflowY: "auto",
                                    }}>
                                        {transcript}
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {/* Insert into current editor — primary action */}
                                    {onInsertTranscript && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleInsertIntoEditor}
                                            style={{ justifyContent: "center", gap: "8px" }}
                                        >
                                            <Plus size={14} />
                                            Insert into Editor
                                        </button>
                                    )}

                                    {/* Replace note with AI-structured version */}
                                    {onNoteCreated && result && (
                                        <button
                                            className="btn btn-ghost"
                                            onClick={handleReplaceNote}
                                            style={{ justifyContent: "center", fontSize: "12.5px" }}
                                        >
                                            Replace note with AI structure
                                        </button>
                                    )}

                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => { setTranscript(""); setResult(null); }}
                                        style={{ justifyContent: "center", color: "var(--text-muted)" }}
                                    >
                                        Record again
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
