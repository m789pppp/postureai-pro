/**
 * GET /api/health
 * Health check endpoint — replaces Railway /health
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  return res.status(200).json({
    ok: true,
    status: "healthy",
    service: "Corvus PostureAI Pro API",
    ts: new Date().toISOString(),
    version: "v52.0",
  });
}
