// Router: /api/auth/* → mfa handler (dispatches internally by sub-path)
import mfa from "./_handlers/auth/mfa.js";
export default async function handler(req, res) { return mfa(req, res); }
