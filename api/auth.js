// Router: /api/auth/* 
import mfa    from "./_handlers/auth/mfa.js";
import whoami from "./_handlers/misc/whoami.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.includes("/whoami")) return whoami(req, res);
  return mfa(req, res);
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
