"""
Corvus AI Coach — Live QA Test Suite
Run: python test_ai_coach.py --url https://YOUR-BACKEND.railway.app
Tests the coach/chat endpoint exactly like the real UI does.
"""
import sys, json, time, argparse
import urllib.request, urllib.error

def post(url, body, token=""):
    data = json.dumps(body).encode()
    req  = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}"), e.code
    except Exception as ex:
        return {"error": str(ex)}, 0

# ── Sample context (matches what AICoach.jsx sends) ──────────────
CONTEXT_HIGH_RISK = {
    "avg_score": 54, "week_avg": 51, "last_week_avg": 57,
    "trend_pct": -11, "sessions_count": 18, "week_sessions": 4,
    "worst_time": "14:00", "top_alerts": ["Forward Head Posture", "Rounded Shoulders", "Slouching"],
    "has_calibration": True, "tier": "professional",
    "neck_risk": 78, "fatigue_score": 65, "burnout_risk": 52,
    "streak_days": 3, "user_name": "Mohamed"
}

CONTEXT_LOW_RISK = {
    "avg_score": 83, "week_avg": 85, "last_week_avg": 81,
    "trend_pct": 5, "sessions_count": 42, "week_sessions": 6,
    "worst_time": "16:00", "top_alerts": ["Minor Neck Tilt"],
    "has_calibration": True, "tier": "elite",
    "neck_risk": 22, "fatigue_score": 28, "burnout_risk": 18,
    "streak_days": 14, "user_name": "Mohamed"
}

CONTEXT_NEW_USER = {
    "avg_score": 0, "week_avg": 0, "sessions_count": 0, "week_sessions": 0,
    "top_alerts": [], "has_calibration": False, "tier": "standard",
    "neck_risk": 0, "fatigue_score": 0, "burnout_risk": 0,
    "streak_days": 0, "user_name": "Mohamed"
}

TESTS = [
    # (test_name, context, question, lang, checks_must_contain, checks_must_not_contain)
    (
        "🔴 HIGH RISK — درجة 54 — سؤال عن وضعيته",
        CONTEXT_HIGH_RISK,
        "إيه رأيك في وضعيتي؟",
        "ar",
        ["54", "78", "رقبة", "للأمام"],  # must mention score and neck risk
        ["maintain good posture", "I'm an AI"],
    ),
    (
        "🔴 HIGH RISK — neck pain complaint",
        CONTEXT_HIGH_RISK,
        "I've been having neck pain for the past 3 days, especially on the right side",
        "en",
        ["neck", "cervical", "54"],  # should assess pain + reference score
        ["maintain good posture", "I cannot help"],
    ),
    (
        "🟡 MEDIUM — ask for exercise plan",
        CONTEXT_HIGH_RISK,
        "ممكن تديني خطة تمارين لأسبوع؟",
        "ar",
        ["تمرين", "مرات", "ثانية"],  # must have exercise details
        ["I'm an AI", "cannot"],
    ),
    (
        "🟢 LOW RISK — trend question",
        CONTEXT_LOW_RISK,
        "How is my posture trending this week?",
        "en",
        ["85", "5%", "improving"],
        ["poor", "bad", "risk"],
    ),
    (
        "🆕 NEW USER — no data yet",
        CONTEXT_NEW_USER,
        "كيف ابدأ؟",
        "ar",
        ["جلسة", "تحليل"],  # should guide to first session
        ["54", "78"],  # should NOT mention fake scores
    ),
    (
        "❓ OFF-TOPIC — crypto question",
        CONTEXT_HIGH_RISK,
        "What do you think about Bitcoin?",
        "en",
        ["posture", "ergonomics", "help"],  # should redirect
        ["I cannot", "not my specialty", "only discuss"],  # should NOT hard-refuse
    ),
    (
        "⚕️ RED FLAG — radiating arm pain",
        CONTEXT_HIGH_RISK,
        "I have pain shooting down my left arm and my fingers are numb",
        "en",
        ["⚕️", "professional", "consult"],  # must flag red flag
        ["exercise", "stretch"],  # should NOT give exercises for red flag
    ),
    (
        "📊 REPORT REQUEST — full analysis",
        CONTEXT_HIGH_RISK,
        "Give me a full clinical report on my posture",
        "en",
        ["##", "risk", "54", "78", "recommend"],  # must be structured
        ["I cannot", "I'm an AI"],
    ),
]

def run_tests(base_url, token=""):
    url    = base_url.rstrip("/") + "/api/coach/chat"
    passed = 0
    failed = 0
    results = []

    print(f"\n{'='*65}")
    print(f"  Corvus AI Coach — Live QA Test Suite")
    print(f"  Backend: {url}")
    print(f"{'='*65}\n")

    for (name, ctx, question, lang, must_have, must_not) in TESTS:
        print(f"TEST: {name}")
        print(f"  Q: {question[:70]}")

        body = {
            "messages": [{"role": "user", "content": question}],
            "context":  ctx,
            "lang":     lang,
            "max_tokens": 700,
        }

        t0 = time.time()
        resp, status = post(url, body, token)
        elapsed = round(time.time() - t0, 1)
        text = resp.get("text", resp.get("error", ""))

        ok = True
        issues = []

        if status != 200:
            ok = False
            issues.append(f"HTTP {status}: {text[:80]}")
        else:
            # Length check
            words = len(text.split())
            if words < 30:
                ok = False
                issues.append(f"Too short: {words} words")

            # Must-have checks
            for check in must_have:
                if check.lower() not in text.lower():
                    ok = False
                    issues.append(f"Missing: '{check}'")

            # Must-not-have checks
            for check in must_not:
                if check.lower() in text.lower():
                    ok = False
                    issues.append(f"Contains banned phrase: '{check}'")

        if ok:
            passed += 1
            print(f"  ✅ PASS ({elapsed}s) — {len(text.split())} words")
        else:
            failed += 1
            print(f"  ❌ FAIL ({elapsed}s)")
            for issue in issues:
                print(f"     ⚠️  {issue}")

        print(f"  RESPONSE PREVIEW:")
        # Print first 300 chars of response
        preview = text[:300].replace("\n", " ")
        print(f"  {preview}...")
        print()

        results.append({"test": name, "ok": ok, "elapsed": elapsed, "text": text, "issues": issues})

    print(f"{'='*65}")
    print(f"  RESULTS: {passed}/{passed+failed} passed")
    if failed:
        print(f"  FAILED:  {failed} tests")
        for r in results:
            if not r["ok"]:
                print(f"    ❌ {r['test']}")
    print(f"{'='*65}\n")

    # Save full output
    with open("ai_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Full results saved → ai_test_results.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Railway backend URL e.g. https://xxx.railway.app")
    parser.add_argument("--token", default="", help="Firebase ID token (optional)")
    args = parser.parse_args()
    run_tests(args.url, args.token)
