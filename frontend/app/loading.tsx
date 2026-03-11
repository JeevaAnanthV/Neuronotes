export default function Loading() {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            flex: 1,
            flexDirection: "column",
            gap: "16px",
            color: "var(--text-muted)",
        }}>
            {/* Animated skeleton rows */}
            <div style={{
                width: "100%",
                maxWidth: "600px",
                padding: "40px 48px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
            }}>
                <div className="skeleton" style={{ height: "32px", width: "45%", borderRadius: "8px" }} />
                <div className="skeleton" style={{ height: "16px", width: "60%", borderRadius: "6px" }} />
                <div style={{ height: "24px" }} />
                <div className="skeleton" style={{ height: "80px", width: "100%", borderRadius: "10px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "8px" }}>
                    <div className="skeleton" style={{ height: "160px", borderRadius: "10px" }} />
                    <div className="skeleton" style={{ height: "160px", borderRadius: "10px" }} />
                    <div className="skeleton" style={{ height: "160px", borderRadius: "10px" }} />
                </div>
            </div>
        </div>
    );
}
