/**
 * /api/account — account management + metrics router
 * DELETE /api/account?action=delete
 * GET    /api/account?action=revenue
 */
import deleteHandler  from "./account/delete.js";
import revenueHandler from "./metrics/revenue.js";
export default async function handler(req, res) {
  const action = req.query.action || (req.method === "DELETE" ? "delete" : "revenue");
  if (action === "delete" || req.method === "DELETE") return deleteHandler(req, res);
  return revenueHandler(req, res);
}
