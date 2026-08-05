// Router: /api/cert/* → 2 handlers
import issue  from "./_handlers/cert/issue.js";
import verify from "./_handlers/cert/verify.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/issue"))  return issue(req, res);
  if (path.endsWith("/verify")) return verify(req, res);
  res.status(404).json({ error: "Not found" });
}
