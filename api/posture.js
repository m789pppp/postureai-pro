// Router: /api/posture-api/* → 3 handlers
import analyze from "./_handlers/posture-api/analyze.js";
import keys    from "./_handlers/posture-api/keys.js";
import usage   from "./_handlers/posture-api/usage.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/analyze")) return analyze(req, res);
  if (path.endsWith("/keys"))    return keys(req, res);
  if (path.endsWith("/usage"))   return usage(req, res);
  res.status(404).json({ error: "Not found" });
}
