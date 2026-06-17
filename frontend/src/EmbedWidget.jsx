/**
 * EmbedWidget.jsx — Corvus public leaderboard embed
 * <iframe src="https://app.corvus.com/embed/leaderboard?org=ORGID&theme=dark" />
 * B2B viral: companies can embed their team leaderboard in Notion, Confluence, Slack tabs
 */
import { useState, useEffect } from "react";
import { apiFetch } from "./services/api.js";

const MOCK_BOARD = [
  { rank:1, name:"Karim M.",   score:94, streak:14, grade:"A", dept:"Engineering" },
  { rank:2, name:"Sarah J.",   score:88, streak:7,  grade:"B", dept:"Design" },
  { rank:3, name:"Priya S.",   score:84, streak:5,  grade:"B", dept:"Product" },
  { rank:4, name:"Chris P.",   score:79, streak:3,  grade:"C", dept:"Sales" },
  { rank:5, name:"Mohamed A.", score:73, streak:2,  grade:"C", dept:"Marketing" },
];

function getMedal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function getScoreColor(score) {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

export default function EmbedWidget() {
  const params   = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const orgId    = params.get("org")   || "";
  const theme    = params.get("theme") || "dark";
  const limit    = parseInt(params.get("limit") || "5");
  const showDept = params.get("dept") !== "false";

  const [board,   setBoard]   = useState(MOCK_BOARD.slice(0, limit));
  const [org,     setOrg]     = useState({ name: "Corvus Team", logo: null });
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";
  const bg     = isDark ? "#0f172a" : "#ffffff";
  const card   = isDark ? "#1e293b" : "#f8fafc";
  const text   = isDark ? "#f1f5f9" : "#0f172a";
  const dim    = isDark ? "#64748b" : "#94a3b8";
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    apiFetch(`/leaderboard?org_id=${orgId}&limit=${limit}`)
      .then((data) => {
        if (data.ok && data.leaderboard?.length) {
          setBoard(data.leaderboard);
        }
        if (data.org_name) setOrg({ name: data.org_name, logo: data.org_logo });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, limit]);

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: bg, minHeight: "100vh", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {org.logo && <img src={org.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />}
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: text }}>{org.name}</div>
            <div style={{ fontSize: 11, color: dim }}>Posture Leaderboard</div>
          </div>
        </div>
        <a href="https://corvus.com" target="_blank" rel="noreferrer"
           style={{ fontSize: 10, color: dim, textDecoration: "none" }}>
          Powered by Corvus 🧘
        </a>
      </div>

      {/* Board */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {board.map((member) => (
          <div key={member.rank} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: card, borderRadius: 12, padding: "12px 14px",
            border: `1px solid ${member.rank === 1 ? "rgba(251,191,36,0.4)" : border}`,
          }}>
            {/* Rank */}
            <div style={{ width: 32, textAlign: "center", fontSize: member.rank <= 3 ? 20 : 13,
              fontWeight: member.rank > 3 ? 700 : 400, color: dim, flexShrink: 0 }}>
              {getMedal(member.rank)}
            </div>

            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: "50%",
              background: `linear-gradient(135deg,#6366f1,#0ea5e9)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {member.name[0]}
            </div>

            {/* Name + dept */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: text, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</div>
              {showDept && member.dept && (
                <div style={{ fontSize: 10, color: dim }}>{member.dept}</div>
              )}
            </div>

            {/* Streak */}
            {member.streak > 0 && (
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>
                🔥 {member.streak}d
              </div>
            )}

            {/* Score */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: getScoreColor(member.score) }}>
                {member.score}
              </div>
              <div style={{ fontSize: 9, color: dim }}>score</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <a href={`https://app.corvus.com?ref=embed&org=${orgId}`}
           target="_blank" rel="noreferrer"
           style={{ fontSize: 12, color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
          Join the leaderboard →
        </a>
      </div>
    </div>
  );
}
