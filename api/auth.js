// Router: /api/auth/* 
import mfa    from "./_handlers/auth/mfa.js";
import whoami from "./_handlers/misc/whoami.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.includes("/whoami")) return whoami(req, res);
  return mfa(req, res);
}
