/**
 * DiagPanel — small on-screen readout of diag.js, shown only with the "diag" experiment.
 * For testers: press Copy and paste the text into a message.
 */
import { useEffect, useState } from "react";
import { diagSnapshot } from "./diag.js";

export default function DiagPanel() {
  const [snap, setSnap] = useState(() => diagSnapshot());
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  useEffect(() => { const t = setInterval(() => setSnap(diagSnapshot()), 1000); return () => clearInterval(t); }, []);
  const text = JSON.stringify(snap, null, 1);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text is selectable */ }
  };
  const stalled = snap.msSinceLastFrame != null && snap.msSinceLastFrame > 3000;
  const row = { display: "flex", justifyContent: "space-between", gap: 10 };
  return (
    <div dir="ltr" style={{ position: "fixed", insetInlineStart: 8, insetBlockEnd: 8, zIndex: 9999, inlineSize: open ? 300 : "auto", maxBlockSize: "60vh", overflow: "auto",
      background: "rgba(2,8,16,.92)", color: "#e2e8f0", border: "1px solid rgba(148,163,184,.35)", borderRadius: 10, padding: 8, font: "11px/1.5 ui-monospace, monospace" }}>
      <div style={{ ...row, alignItems: "center", marginBlockEnd: open ? 6 : 0 }}>
        <strong>diag</strong>
        <span>
          <button onClick={copy} style={{ font: "inherit", marginInlineEnd: 6 }}>{copied ? "Copied" : "Copy"}</button>
          <button onClick={() => setOpen(o => !o)} style={{ font: "inherit" }}>{open ? "–" : "+"}</button>
        </span>
      </div>
      {open && (
        <>
          <div style={row}><span>analyses/s</span><span style={{ color: stalled ? "#f87171" : snap.analysesPerSec < 5 ? "#fbbf24" : "#34d399" }}>{stalled ? "STALLED" : snap.analysesPerSec}</span></div>
          <div style={row}><span>pipeline</span><span style={{ textAlign: "end", wordBreak: "break-all" }}>{snap.pipeline || "—"}</span></div>
          <div style={row}><span>experiments</span><span>{snap.experiments || "none"}</span></div>
          <div style={row}><span>head pitch</span><span>{snap.headPitchMethod || "—"}</span></div>
          <div style={row}><span>third model</span><span>{snap.rtmw || "—"}</span></div>
          <div style={{ marginBlockStart: 4, color: snap.errors.length ? "#f87171" : "#94a3b8" }}>
            {snap.errors.length ? snap.errors.map((e, i) => <div key={i}>✕ {e}</div>) : "no script errors"}
          </div>
          <pre style={{ display: "none" }}>{text}</pre>
        </>
      )}
    </div>
  );
}
