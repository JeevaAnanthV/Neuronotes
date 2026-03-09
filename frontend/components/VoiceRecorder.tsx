"use client";

import { useState, useRef } from "react";
import { aiApi } from "@/lib/api";

interface Props {
    onNoteCreated?: (title: string, content: string) => void;
}

export function VoiceRecorder({ onNoteCreated }: Props) {
    const [recording, setRecording] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach((t) => t.stop());
                setProcessing(true);
                try {
                    const formData = new FormData();
                    formData.append("file", blob, "voice.webm");
                    const result = await aiApi.voice(formData);
                    setTranscript(result.transcript);
                    onNoteCreated?.(result.title, result.structured_content);
                } catch {
                    alert("Voice processing failed. Check backend connection.");
                } finally {
                    setProcessing(false);
                }
            };
            mediaRef.current = recorder;
            recorder.start();
            setRecording(true);
        } catch {
            alert("Microphone access denied or not available.");
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        setRecording(false);
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                background: recording ? "rgba(239,68,68,0.1)" : "var(--bg-tertiary)",
                border: `1px solid ${recording ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
                borderRadius: "10px",
                transition: "all 0.3s ease",
            }}
        >
            <button
                className="btn btn-sm"
                style={{
                    background: recording ? "var(--danger)" : "var(--accent)",
                    color: "white",
                    border: "none",
                    position: "relative",
                }}
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                id="voice-record-btn"
            >
                {processing ? (
                    <span className="loading-spinner" />
                ) : recording ? (
                    <>
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                background: "white",
                                borderRadius: "50%",
                                display: "inline-block",
                                marginRight: "6px",
                                animation: "pulse 1s infinite",
                            }}
                        />
                        Stop
                    </>
                ) : (
                    "🎙 Record"
                )}
            </button>

            <span style={{ fontSize: "12.5px", color: recording ? "#ef4444" : "var(--text-muted)" }}>
                {processing
                    ? "AI processing…"
                    : recording
                        ? "Recording… click Stop when done"
                        : "Record a voice note"}
            </span>

            {transcript && (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    &quot;{transcript}&quot;
                </span>
            )}
        </div>
    );
}
