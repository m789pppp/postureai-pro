/**
 * /api/cert — certificate router
 * GET  /api/cert?action=verify&id=CRV-xxx
 * POST /api/cert?action=issue
 */
import issueHandler  from "./cert/issue.js";
import verifyHandler from "./cert/verify.js";
export default async function handler(req, res) {
  const action = req.query.action || (req.method === "GET" ? "verify" : "issue");
  if (action === "verify" || req.method === "GET") return verifyHandler(req, res);
  return issueHandler(req, res);
}
