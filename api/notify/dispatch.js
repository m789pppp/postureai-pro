/**
 * Vercel Serverless — Notification Dispatcher
 * POST /api/notify/dispatch
 * Body: NotificationQueue entry
 * Routes to: in_app (Firestore) | slack | teams | jira
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return { db: getFirestore(), auth: getAuth() };
}

// ── Channel dispatchers ──────────────────────────────────────────

async function dispatchInApp(db, entry, orgId) {
  const notif = {
    type:       entry.type,
    payload:    entry.payload || {},
    channels:   entry.channels || ["in_app"],
    created_at: new Date().toISOString(),
    read:       false,
    org_id:     orgId || null,
  };

  const recipients = entry.payload?.recipients || "all";

  if (recipients === "all" && orgId) {
    // Broadcast to org
    await db.collection("orgs").doc(orgId)
      .collection("notifications").add(notif);
  } else if (recipients === "hr_admins" && orgId) {
    const snap = await db.collection("users")
      .where("company_id", "==", orgId)
      .where("user_type", "==", "hr_admin")
      .limit(50).get();
    const batch = db.batch();
    snap.docs.forEach(u => {
      const ref = db.collection("users").doc(u.id)
        .collection("notifications").doc();
      batch.set(ref, notif);
    });
    if (!snap.empty) await batch.commit();
  } else if (entry.payload?.uid) {
    // Single user
    await db.collection("users").doc(entry.payload.uid)
      .collection("notifications").add(notif);
  } else if (orgId) {
    // Fallback: org-level
    await db.collection("orgs").doc(orgId)
      .collection("notifications").add(notif);
  }

  return { channel: "in_app", ok: true };
}

async function dispatchSlack(config, entry) {
  if (!config?.webhook_url) return { channel: "slack", ok: false, error: "no_webhook_url" };

  const meta = {
    burnout_alert:    { emoji: "🔥", color: "#ef4444" },
    posture_warning:  { emoji: "⚠️", color: "#f59e0b" },
    weekly_digest:    { emoji: "📊", color: "#1a56db" },
    achievement:      { emoji: "🏆", color: "#10b981" },
    session_reminder: { emoji: "⏰", color: "#0891b2" },
    risk_alert:       { emoji: "🚨", color: "#ef4444" },
    ai_insight:       { emoji: "🧠", color: "#7c3aed" },
    team_milestone:   { emoji: "🎯", color: "#10b981" },
  };

  const m = meta[entry.type] || { emoji: "🔔", color: "#1a56db" };
  const text = entry.payload?.text || entry.payload?.body || entry.type;
  const user = entry.payload?.user || "";

  const payload = {
    channel:  config.channel || "#general",
    username: config.bot_name || "Corvus PostureAI",
    icon_emoji: ":health_worker:",
    attachments: [{
      color: m.color,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: m.emoji + " *" + (entry.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())) + "*" +
                  (user ? "\n👤 " + user : "") +
                  "\n" + text,
          },
        },
        entry.payload?.score != null ? {
          type: "context",
          elements: [{ type: "mrkdwn", text: "Score: *" + entry.payload.score + "/100* | " + new Date().toLocaleString("en-GB") }],
        } : null,
        { type: "divider" },
      ].filter(Boolean),
    }],
  };

  const res = await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { channel: "slack", ok: false, error: "http_" + res.status + ": " + body.slice(0, 100) };
  }
  return { channel: "slack", ok: true };
}

async function dispatchTeams(config, entry) {
  if (!config?.webhook_url) return { channel: "teams", ok: false, error: "no_webhook_url" };

  const text = entry.payload?.text || entry.payload?.body || entry.type;
  const user = entry.payload?.user || "";

  const payload = {
    "@type":    "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "1A56DB",
    summary:    "Corvus Notification",
    sections: [{
      activityTitle:    "Corvus PostureAI",
      activitySubtitle: new Date().toLocaleString("en-GB"),
      activityText:     (user ? "👤 **" + user + "**\n\n" : "") + text,
      markdown: true,
    }],
    potentialAction: [{
      "@type": "OpenUri",
      name:    "Open Dashboard",
      targets: [{ os: "default", uri: process.env.VITE_APP_URL || "https://postureai-pro-omega-nine.vercel.app" }],
    }],
  };

  const res = await fetch(config.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    return { channel: "teams", ok: false, error: "http_" + res.status };
  }
  return { channel: "teams", ok: true };
}

async function dispatchJira(config, entry) {
  if (!config?.base_url || !config?.api_token || !config?.project_key) {
    return { channel: "jira", ok: false, error: "missing_jira_config" };
  }

  const text = entry.payload?.text || entry.payload?.body || entry.type;
  const user = entry.payload?.user || "unknown";
  const summary = "[Corvus] " + entry.type.replace(/_/g, " ") + " — " + user;

  const payload = {
    fields: {
      project:   { key: config.project_key },
      summary,
      description: {
        type:    "doc",
        version: 1,
        content: [{
          type:    "paragraph",
          content: [{ type: "text", text: text + "\n\nGenerated by Corvus PostureAI at " + new Date().toISOString() }],
        }],
      },
      issuetype: { name: config.issue_type || "Task" },
    },
  };

  const credentials = Buffer.from("corvus@postureai.io:" + config.api_token).toString("base64");
  const res = await fetch(config.base_url.replace(/\/$/, "") + "/rest/api/3/issue", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Basic " + credentials,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { channel: "jira", ok: false, error: body?.errorMessages?.[0] || "http_" + res.status };
  }
  const data = await res.json();
  return { channel: "jira", ok: true, issue_key: data.key };
}

// ── Main handler ─────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  process.env.VITE_APP_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // Auth: require Firebase token
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Authentication required" });

  let uid, orgId;
  try {
    const { auth, db } = getAdmin();
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;

    // Get user's company_id for in-app routing
    const userSnap = await db.collection("users").doc(uid).get();
    orgId = userSnap.exists ? userSnap.data()?.company_id || null : null;

    const entry = req.body || {};
    if (!entry.type) return res.status(400).json({ error: "entry.type required" });

    const channels = entry.channels || ["in_app"];
    const results  = [];

    // Get integration configs for this org (saved by NotificationsHub)
    let integCfg = {};
    if (orgId) {
      const integSnap = await db.collection("orgs").doc(orgId)
        .collection("settings").doc("integrations").get();
      if (integSnap.exists) integCfg = integSnap.data() || {};
    }

    // Dispatch to each channel in parallel
    const dispatches = channels.map(async ch => {
      try {
        switch (ch) {
          case "in_app":
            return await dispatchInApp(db, entry, orgId);
          case "slack":
            return await dispatchSlack(integCfg.slack?.field_values, entry);
          case "teams":
            return await dispatchTeams(integCfg.teams?.field_values, entry);
          case "jira":
            return await dispatchJira(integCfg.jira?.field_values, entry);
          default:
            return { channel: ch, ok: false, error: "unsupported_channel" };
        }
      } catch (e) {
        return { channel: ch, ok: false, error: e.message };
      }
    });

    const channelResults = await Promise.all(dispatches);
    const allOk = channelResults.every(r => r.ok);

    // Log dispatch to Firestore
    await db.collection("notification_logs").add({
      entry_id:   entry.id || null,
      type:       entry.type,
      channels,
      results:    channelResults,
      dispatched_by: uid,
      org_id:     orgId,
      ok:         allOk,
      created_at: new Date().toISOString(),
    });

    return res.json({ ok: allOk, results: channelResults });

  } catch (err) {
    console.error("[notify/dispatch]", err);
    if (err.code === "auth/id-token-expired") return res.status(401).json({ error: "Session expired" });
    return res.status(500).json({ error: err.message });
  }
}
