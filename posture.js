/**
 * /api/posture — Posture API router
 * POST /api/posture?action=analyze
 * POST /api/posture?action=keys
 * GET  /api/posture?action=usage
 */
import analyzeHandler from "./posture-api/analyze.js";
import keysHandler    from "./posture-api/keys.js";
import usageHandler   from "./posture-api/usage.js";
export default async function handler(req, res) {
  const action = req.query.action || (req.method === "GET" ? "usage" : "analyze");
  if (action === "usage")   return usageHandler(req, res);
  if (action === "keys")    return keysHandler(req, res);
  return analyzeHandler(req, res);
}
