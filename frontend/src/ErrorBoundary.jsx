import { Component } from "react";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error("Corvus Error:", error, info);
    // Report to Sentry if loaded
    try { window.Sentry?.captureException(error, { extra: info }); } catch {}
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    return (
      <div style={{ minHeight: "100vh", background: "#030b14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, background: "rgba(239,68,68,.12)", border: "0.5px solid rgba(239,68,68,.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f0f4f8", marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.6, maxWidth: 340, margin: "0 auto 12px" }}>
            {err?.message || "An unexpected error occurred"}
          </div>
          {err?.stack && (
            <pre style={{ fontSize: 10, color: "#475569", background: "rgba(148,163,184,.04)", border: "0.5px solid rgba(148,163,184,.1)", borderRadius: 8, padding: "10px 12px", textAlign: "left", overflow: "auto", maxHeight: 120, marginBottom: 20, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {err.stack.split("\n").slice(0, 6).join("\n")}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
            <button onClick={() => window.location.reload()}
              style={{ background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 24px", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
              Reload App
            </button>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              style={{ background: "rgba(148,163,184,.08)", border: "0.5px solid rgba(148,163,184,.18)", borderRadius: 9, padding: "11px 18px", fontSize: 13, color: "#94a3b8", cursor: "pointer" }}>
              Try Again
            </button>
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Corvus Error&body=${encodeURIComponent(err?.message||"")}`}
            style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    );
  }
}
