/**
 * /api/session — session management router
 * GET  /api/session?action=health
 * POST /api/session?action=start
 * POST /api/session?action=snapshot
 */
import startHandler   from "./session/start.js";
import healthHandler  from "./session/health.js";
import snapshotHandler from "./session/snapshot.js";

export default async function handler(req, res) {
  const action = req.query.action || (req.method === "GET" ? "health" : "start");
  if (action === "health" || req.method === "GET") return healthHandler(req, res);
  if (action === "snapshot") return snapshotHandler(req, res);
  return startHandler(req, res);
}
