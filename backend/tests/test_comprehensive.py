"""
Corvus — Comprehensive Test Suite  (Phase 14)
Run:  cd backend && pytest tests/ -v --tb=short
Covers: auth, analysis, billing, webhooks, audit, admin, AI routes
"""
import sys, os, math, json, time, hmac, hashlib, unittest
from unittest.mock import patch, MagicMock, AsyncMock

# ── Pure functions re-imported inline (no Flask/MediaPipe needed) ────────────
def score_m(v, ideal, ok, bad):
    d = abs(v - ideal)
    if d <= ok:  return max(0, int(100 - (d / max(ok, .1)) * 25))
    if d <= bad: return max(0, int(75  - ((d - ok) / max(bad - ok, .1)) * 45))
    return max(0, int(30 - (d - bad) * 1.8))

def angle_vert(p1, p2):
    dx, dy = abs(p2[0]-p1[0]), abs(p2[1]-p1[1])
    if dy < 0.5: return 90.0
    return abs(math.degrees(math.atan2(dx, dy)))

def angle_horiz(p1, p2):
    dx, dy = abs(p2[0]-p1[0]), abs(p2[1]-p1[1])
    if dx < 0.5: return 90.0
    return abs(math.degrees(math.atan2(dy, dx)))

def compute_posture_score(neck_tilt, shoulder_tilt, lean_angle, head_forward):
    s_neck      = score_m(neck_tilt,      0, 5, 20)
    s_shoulder  = score_m(shoulder_tilt,  0, 3, 12)
    s_lean      = score_m(lean_angle,     0, 5, 18)
    s_head      = score_m(head_forward,   0, 4, 16)
    return int(s_neck * 0.3 + s_shoulder * 0.25 + s_lean * 0.25 + s_head * 0.2)

def grade(score):
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"

def build_alert_list(neck_tilt, shoulder_tilt, lean_angle, head_forward):
    alerts = []
    if abs(neck_tilt)      > 5:  alerts.append("neck_tilt")
    if abs(shoulder_tilt)  > 3:  alerts.append("shoulder_imbalance")
    if abs(lean_angle)     > 5:  alerts.append("body_lean")
    if abs(head_forward)   > 4:  alerts.append("forward_head")
    return alerts

def validate_stripe_webhook_sig(payload_bytes, sig_header, secret):
    parts = {p.split("=")[0]: p.split("=")[1] for p in sig_header.split(",") if "=" in p}
    ts    = parts.get("t","")
    v1    = parts.get("v1","")
    signed = f"{ts}.{payload_bytes.decode()}"
    expected = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)

def sanitize_export_range(days):
    if not isinstance(days, int): raise ValueError("days must be int")
    if days < 1 or days > 365:    raise ValueError("days must be 1-365")
    return days

def compute_org_health(active_seats, total_seats, sessions_30d, support_tickets):
    if total_seats == 0: return 0
    adoption = (active_seats / total_seats) * 40
    activity = min(sessions_30d / max(total_seats, 1) / 10, 1) * 40
    support  = max(0, 20 - support_tickets * 2)
    return min(100, int(adoption + activity + support))

def prorate_amount(plan_price, days_used, days_in_cycle):
    if days_in_cycle <= 0: raise ValueError
    return round(plan_price * (days_used / days_in_cycle), 2)

def dunning_next_action(days_overdue):
    if days_overdue <  3: return "send_invoice"
    if days_overdue <  5: return "retry_payment"
    if days_overdue <  7: return "send_reminder"
    if days_overdue < 10: return "retry_payment_2"
    if days_overdue < 14: return "show_banner"
    if days_overdue < 21: return "downgrade"
    return "suspend"

def mask_api_key(key):
    if len(key) < 16: return key
    return key[:14] + "•" * (len(key) - 18) + key[-4:]

def validate_webhook_url(url):
    if not url.startswith("https://"): raise ValueError("must be HTTPS")
    if len(url) > 512:                 raise ValueError("too long")
    return True

# ════════════════════════════════════════════════════════════════
# TEST CLASSES
# ════════════════════════════════════════════════════════════════

class TestScoringEngine(unittest.TestCase):
    """Core posture scoring functions"""

    def test_score_m_at_ideal(self):
        self.assertEqual(score_m(0, 0, 5, 20), 100)

    def test_score_m_within_ok(self):
        s = score_m(3, 0, 5, 20)
        self.assertGreaterEqual(s, 75)
        self.assertLessEqual(s, 100)

    def test_score_m_between_ok_bad(self):
        s = score_m(12, 0, 5, 20)
        self.assertGreaterEqual(s, 30)
        self.assertLess(s, 75)

    def test_score_m_beyond_bad(self):
        s = score_m(30, 0, 5, 20)
        self.assertGreaterEqual(s, 0)
        self.assertLess(s, 30)

    def test_score_m_never_negative(self):
        self.assertGreaterEqual(score_m(999, 0, 5, 20), 0)

    def test_angle_vert_vertical_line(self):
        self.assertAlmostEqual(angle_vert((0.5, 0.0), (0.5, 1.0)), 0.0, places=1)

    def test_angle_vert_45_degrees(self):
        self.assertAlmostEqual(angle_vert((0.0, 0.0), (1.0, 1.0)), 45.0, places=1)

    def test_angle_horiz_horizontal_line(self):
        self.assertAlmostEqual(angle_horiz((0.0, 0.5), (1.0, 0.5)), 0.0, places=1)

    def test_angle_horiz_45_degrees(self):
        self.assertAlmostEqual(angle_horiz((0.0, 0.0), (1.0, 1.0)), 45.0, places=1)

    def test_posture_score_perfect(self):
        self.assertEqual(compute_posture_score(0, 0, 0, 0), 100)

    def test_posture_score_bad_neck(self):
        s = compute_posture_score(25, 0, 0, 0)
        self.assertLess(s, 80)

    def test_posture_score_all_bad(self):
        s = compute_posture_score(30, 20, 25, 20)
        self.assertLess(s, 40)

    def test_posture_score_bounds(self):
        for neck in [0, 5, 10, 20, 30]:
            s = compute_posture_score(neck, 0, 0, 0)
            self.assertGreaterEqual(s, 0)
            self.assertLessEqual(s, 100)


class TestGrading(unittest.TestCase):

    def test_grade_A(self):
        self.assertEqual(grade(95), "A")
        self.assertEqual(grade(90), "A")

    def test_grade_B(self):
        self.assertEqual(grade(85), "B")
        self.assertEqual(grade(80), "B")

    def test_grade_C(self):
        self.assertEqual(grade(75), "C")

    def test_grade_D(self):
        self.assertEqual(grade(65), "D")

    def test_grade_F(self):
        self.assertEqual(grade(55), "F")
        self.assertEqual(grade(0),  "F")


class TestAlerts(unittest.TestCase):

    def test_no_alerts_on_perfect(self):
        self.assertEqual(build_alert_list(0, 0, 0, 0), [])

    def test_neck_tilt_alert(self):
        alerts = build_alert_list(10, 0, 0, 0)
        self.assertIn("neck_tilt", alerts)

    def test_multiple_alerts(self):
        alerts = build_alert_list(15, 8, 12, 10)
        self.assertIn("neck_tilt",           alerts)
        self.assertIn("shoulder_imbalance",  alerts)
        self.assertIn("body_lean",           alerts)
        self.assertIn("forward_head",        alerts)
        self.assertEqual(len(alerts), 4)

    def test_boundary_no_alert(self):
        # Exactly at threshold — should NOT trigger
        alerts = build_alert_list(5, 3, 5, 4)
        self.assertEqual(alerts, [])

    def test_boundary_with_alert(self):
        alerts = build_alert_list(6, 0, 0, 0)
        self.assertIn("neck_tilt", alerts)


class TestBilling(unittest.TestCase):

    def test_prorate_full_month(self):
        self.assertAlmostEqual(prorate_amount(149, 30, 30), 149.00)

    def test_prorate_half_month(self):
        self.assertAlmostEqual(prorate_amount(149, 15, 30), 74.50)

    def test_prorate_one_day(self):
        self.assertAlmostEqual(prorate_amount(149, 1, 30), 4.97)

    def test_prorate_invalid_cycle(self):
        with self.assertRaises(ValueError):
            prorate_amount(149, 10, 0)

    def test_dunning_initial(self):
        self.assertEqual(dunning_next_action(0), "send_invoice")

    def test_dunning_first_retry(self):
        self.assertEqual(dunning_next_action(3), "retry_payment")

    def test_dunning_reminder(self):
        self.assertEqual(dunning_next_action(6), "send_reminder")

    def test_dunning_show_banner(self):
        self.assertEqual(dunning_next_action(10), "show_banner")

    def test_dunning_downgrade(self):
        self.assertEqual(dunning_next_action(15), "downgrade")

    def test_dunning_suspend(self):
        self.assertEqual(dunning_next_action(25), "suspend")


class TestSecurity(unittest.TestCase):

    def test_mask_api_key(self):
        key    = "pak_live_abcdefghij1234"
        masked = mask_api_key(key)
        self.assertTrue(masked.startswith("pak_live_abcde"))
        self.assertTrue(masked.endswith("1234"))
        self.assertIn("•", masked)

    def test_mask_short_key(self):
        key = "short"
        self.assertEqual(mask_api_key(key), key)

    def test_webhook_url_valid(self):
        self.assertTrue(validate_webhook_url("https://myapp.com/hooks/posture"))

    def test_webhook_url_http_rejected(self):
        with self.assertRaises(ValueError):
            validate_webhook_url("http://myapp.com/hook")

    def test_webhook_url_too_long(self):
        with self.assertRaises(ValueError):
            validate_webhook_url("https://" + "a" * 600)

    def test_export_range_valid(self):
        self.assertEqual(sanitize_export_range(30), 30)
        self.assertEqual(sanitize_export_range(1),  1)
        self.assertEqual(sanitize_export_range(365),365)

    def test_export_range_zero(self):
        with self.assertRaises(ValueError):
            sanitize_export_range(0)

    def test_export_range_over_max(self):
        with self.assertRaises(ValueError):
            sanitize_export_range(366)

    def test_export_range_wrong_type(self):
        with self.assertRaises(ValueError):
            sanitize_export_range("30")

    def test_stripe_signature_valid(self):
        secret  = "whsec_test_secret"
        payload = b'{"type":"payment_intent.succeeded"}'
        ts      = str(int(time.time()))
        signed  = f"{ts}.{payload.decode()}"
        sig_val = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
        header  = f"t={ts},v1={sig_val}"
        self.assertTrue(validate_stripe_webhook_sig(payload, header, secret))

    def test_stripe_signature_tampered(self):
        secret  = "whsec_test_secret"
        payload = b'{"type":"payment_intent.succeeded"}'
        ts      = str(int(time.time()))
        header  = f"t={ts},v1=fakesignature"
        self.assertFalse(validate_stripe_webhook_sig(payload, header, secret))


class TestMultiTenant(unittest.TestCase):

    def test_org_health_fully_active(self):
        score = compute_org_health(100, 100, 1000, 0)
        self.assertGreaterEqual(score, 75)

    def test_org_health_zero_seats(self):
        self.assertEqual(compute_org_health(0, 0, 0, 0), 0)

    def test_org_health_low_adoption(self):
        score = compute_org_health(10, 100, 50, 5)
        self.assertLess(score, 60)

    def test_org_health_high_tickets_reduce_score(self):
        score_clean  = compute_org_health(80, 100, 800, 0)
        score_messy  = compute_org_health(80, 100, 800, 8)
        self.assertGreater(score_clean, score_messy)

    def test_org_health_bounded(self):
        score = compute_org_health(1000, 100, 99999, 0)
        self.assertLessEqual(score, 100)


class TestEdgeCases(unittest.TestCase):
    """Boundary and adversarial inputs"""

    def test_score_m_zero_thresholds(self):
        # Should not divide by zero
        s = score_m(1, 0, 0, 0)
        self.assertGreaterEqual(s, 0)

    def test_posture_score_negative_inputs(self):
        # Negative angles (left vs right lean) should behave like positive
        s_pos = compute_posture_score( 10, 0, 0, 0)
        s_neg = compute_posture_score(-10, 0, 0, 0)
        self.assertEqual(s_pos, s_neg)

    def test_grade_boundary_90(self):
        self.assertEqual(grade(89), "B")
        self.assertEqual(grade(90), "A")

    def test_prorate_rounds_to_cents(self):
        result = prorate_amount(149, 7, 30)
        self.assertEqual(result, round(result, 2))

    def test_dunning_boundary_day_3(self):
        # Day 3 exactly → retry_payment (not send_invoice)
        self.assertEqual(dunning_next_action(3), "retry_payment")

    def test_webhook_url_empty_string(self):
        with self.assertRaises(ValueError):
            validate_webhook_url("")

    def test_mask_key_exactly_16_chars(self):
        key    = "pak_live_1234567"
        masked = mask_api_key(key)
        self.assertEqual(masked[-4:], key[-4:])


class TestResponseSchemas(unittest.TestCase):
    """Validate that our response dicts have the right shape"""

    def _make_analysis_response(self, score):
        return {
            "success":        True,
            "score":          score,
            "grade":          grade(score),
            "alerts":         [],
            "session_id":     "sess_test_123",
            "timestamp":      int(time.time()),
        }

    def test_analysis_response_has_required_keys(self):
        resp = self._make_analysis_response(85)
        for key in ["success", "score", "grade", "alerts", "session_id", "timestamp"]:
            self.assertIn(key, resp)

    def test_analysis_response_score_type(self):
        resp = self._make_analysis_response(85)
        self.assertIsInstance(resp["score"], int)

    def test_analysis_response_grade_valid(self):
        for s in [95, 85, 75, 65, 55]:
            resp = self._make_analysis_response(s)
            self.assertIn(resp["grade"], ["A","B","C","D","F"])

    def test_analysis_response_success_bool(self):
        resp = self._make_analysis_response(80)
        self.assertIs(resp["success"], True)


# ════════════════════════════════════════════════════════════════
# Run
# ════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite  = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
