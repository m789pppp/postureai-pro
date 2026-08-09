/**
 * POST /api/billing/prorate
 * Calculates prorated upgrade cost
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if (req.method !== "POST") return res.status(405).json({error:"POST only"});
  const { current_plan, new_plan, billing_cycle="monthly", days_used=0 } = req.body||{};
  const PRICES = { basic:199, professional:499, elite:999, b2b_starter:1499, b2b_growth:3499 };
  const days = billing_cycle==="annual" ? 365 : 30;
  const curr = PRICES[current_plan]||0;
  const next = PRICES[new_plan]||0;
  const remaining_value = curr * ((days - days_used) / days);
  const prorate_amount = Math.max(0, Math.round(next - remaining_value));
  return res.status(200).json({ prorate_amount, currency:"EGP", days_remaining: days-days_used });
}
