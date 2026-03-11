export default function NoteLoading() {
    return (
        <div className="editor-shell" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Top bar skeleton */}
            <div style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 24px",
                borderBottom: "1px solid var(--border)",
                gap: "12px",
                flexShrink: 0,
            }}>
                <div className="skeleton" style={{ height: "20px", width: "180px", borderRadius: "6px" }} />
                <div style={{ flex: 1 }} />
                <div className="skeleton" style={{ height: "28px", width: "64px", borderRadius: "6px" }} />
                <div className="skeleton" style={{ height: "28px", width: "64px", borderRadius: "6px" }} />
            </div>

            {/* Title skeleton */}
            <div style={{ padding: "40px 48px 0", maxWidth: "760px", width: "100%", alignSelf: "center" }}>
                <div className="skeleton" style={{ height: "36px", width: "55%", borderRadius: "8px", marginBottom: "32px" }} />
                {/* Content lines */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="skeleton" style={{ height: "16px", width: "100%", borderRadius: "5px" }} />
                    <div className="skeleton" style={{ height: "16px", width: "92%", borderRadius: "5px" }} />
                    <div className="skeleton" style={{ height: "16px", width: "78%", borderRadius: "5px" }} />
                    <div style={{ height: "8px" }} />
                    <div className="skeleton" style={{ height: "16px", width: "88%", borderRadius: "5px" }} />
                    <div className="skeleton" style={{ height: "16px", width: "65%", borderRadius: "5px" }} />
                </div>
            </div>
        </div>
    );
}
