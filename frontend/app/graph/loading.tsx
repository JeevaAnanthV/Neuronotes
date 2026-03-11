export default function GraphLoading() {
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
            <div style={{ position: "relative", width: "200px", height: "160px" }}>
                {/* Animated graph placeholder */}
                <svg width="200" height="160" viewBox="0 0 200 160" style={{ opacity: 0.15 }}>
                    <line x1="100" y1="80" x2="40" y2="40" stroke="var(--accent-primary)" strokeWidth="1.5" />
                    <line x1="100" y1="80" x2="160" y2="40" stroke="var(--accent-primary)" strokeWidth="1.5" />
                    <line x1="100" y1="80" x2="50" y2="130" stroke="var(--accent-primary)" strokeWidth="1.5" />
                    <line x1="100" y1="80" x2="155" y2="125" stroke="var(--accent-primary)" strokeWidth="1.5" />
                    <circle cx="100" cy="80" r="10" fill="var(--accent-primary)" />
                    <circle cx="40" cy="40" r="7" fill="var(--accent-primary)" />
                    <circle cx="160" cy="40" r="7" fill="var(--accent-primary)" />
                    <circle cx="50" cy="130" r="6" fill="var(--accent-primary)" />
                    <circle cx="155" cy="125" r="6" fill="var(--accent-primary)" />
                </svg>
            </div>
            <div style={{ fontSize: "13px" }}>Building knowledge graph…</div>
        </div>
    );
}
