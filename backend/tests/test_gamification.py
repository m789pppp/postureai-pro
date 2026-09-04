"""
Corvus — the XP/achievement rules behind the Progress screen.

These pin PROPERTIES, not outputs, because the defects they replace were all
property violations that looked fine in any single response:

  - XP fell. `avg_score * bonus` and live-streak terms meant a slipping average
    or one missed day reduced the total, so the panel could show a LOWER level
    than the day before. A level you can lose for taking a day off is a
    punishment wearing a game mechanic's clothes.
  - Earning an achievement reduced XP. Newly-earned achievements added their xp
    in the same call; on the NEXT call they were in `earned_achievements`, the
    loop `continue`d past them, and nothing added their xp back.
  - `perfect_week` had no evaluation branch anywhere, so it was unreachable for
    every user since it shipped.
  - Night Owl / Early Bird were decided by the SERVER's clock at the moment the
    panel was opened, with no reference to any session.

The XP mirror below is a re-implementation, so on its own it could drift from
the handler and still pass — that is how the first version of this file
certified monotonicity while the shipped weekly-challenge reward was still
non-monotonic. Two things guard against that now:

  - `_xp_events` and `ACHIEVEMENTS` are read out of backend.py by AST rather
    than copied, and
  - `TestHandlerSource` asserts against the real function bodies: that every
    XP term is gated on a high-water mark or a persisted counter, that the
    privacy defaults are the safe ones, and that no `name` field can be built
    in aggregate mode. Those read the shipped code, not the mirror.

Run: cd backend && pytest tests/test_gamification.py -v
"""
import ast, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

_SRC = os.path.join(os.path.dirname(__file__), "..", "backend.py")


def _literal(name):
    """Pull a top-level literal assignment out of backend.py without importing
    it (importing runs Flask app setup and the Firebase admin init)."""
    tree = ast.parse(open(_SRC, encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name) and tgt.id == name:
                    return ast.literal_eval(node.value)
    raise AssertionError(f"{name} not found at module level in backend.py")


XP_EVENTS    = _literal("_xp_events")
ACHIEVEMENTS = _literal("ACHIEVEMENTS")
ACH_BY_ID    = {a["id"]: a for a in ACHIEVEMENTS}


WC_XP_REWARD = 150


def compute_xp(sessions_n, avg_score, streak, calibrated, referrals_n,
               earned=(), best_avg_prev=0, best_streak_prev=0,
               session_hours=(), perfect_week=False,
               ever_cal_prev=False, wc_completed=0, wc_complete_now=False,
               wc_already_claimed=False):
    """Mirrors compute_gamification()'s XP + achievement evaluation, INCLUDING
    the weekly-challenge reward — which the first version of this mirror left
    out, and which was the one remaining term that could take XP away."""
    best_avg    = max(int(best_avg_prev or 0), avg_score)
    best_streak = max(int(best_streak_prev or 0), streak)
    ever_cal    = bool(ever_cal_prev) or calibrated

    xp = sessions_n * XP_EVENTS["session_complete"]
    if best_avg >= 80: xp += XP_EVENTS["score_80_plus"] * max(0, sessions_n - 5)
    if best_avg >= 90: xp += XP_EVENTS["score_90_plus"] * max(0, sessions_n - 20)
    if ever_cal:          xp += XP_EVENTS["calibration_done"]
    if best_streak >= 7:  xp += XP_EVENTS["7_day_streak"]
    if best_streak >= 30: xp += XP_EVENTS["30_day_streak"]

    all_earned = list(dict.fromkeys(a for a in earned if isinstance(a, str)))
    for _id in all_earned:
        a = ACH_BY_ID.get(_id)
        if a: xp += a["xp"]

    did_late  = any(h >= 22 or h <= 1 for h in session_hours)
    did_early = any(2 <= h <= 7 for h in session_hours)

    for ach in ACHIEVEMENTS:
        if ach["id"] in all_earned: continue
        req, ok = ach["req"], False
        if "sessions"      in req and sessions_n  >= req["sessions"]:   ok = True
        if "avg_score"     in req and best_avg    >= req["avg_score"]:  ok = True
        if "streak"        in req and best_streak >= req["streak"]:     ok = True
        if "calibrated"    in req and ever_cal    == req["calibrated"]: ok = True
        if "referrals"     in req and referrals_n >= req["referrals"]:  ok = True
        if "late_session"  in req and did_late:                         ok = True
        if "early_session" in req and did_early:                        ok = True
        if ok:
            all_earned.append(ach["id"]); xp += ach["xp"]

    # perfect_week is decided in the weekly-challenge block, once the seven
    # per-day totals exist.
    if perfect_week and "perfect_week" not in all_earned:
        all_earned.append("perfect_week"); xp += ACH_BY_ID["perfect_week"]["xp"]

    # The weekly challenge pays for every week ever completed, read back from
    # a persisted counter — not only for the call that happens to be the one
    # claiming it.
    if wc_complete_now and not wc_already_claimed:
        wc_completed += 1
    xp += WC_XP_REWARD * wc_completed

    return xp, all_earned, best_avg, best_streak, ever_cal, wc_completed


class TestXPIsMonotonic:
    def test_a_broken_streak_does_not_remove_xp(self):
        """Day 7 of a streak, then day 8 missed. The streak resets to 0; the XP
        must not. Under the old code this dropped 200 in one call."""
        xp7, earned, ba, bs, ec, wc = compute_xp(20, 82, streak=7, calibrated=True, referrals_n=0)
        xp8, *_ = compute_xp(20, 82, streak=0, calibrated=True, referrals_n=0,
                                  earned=earned, best_avg_prev=ba, best_streak_prev=bs)
        assert xp8 >= xp7

    def test_a_slipping_average_does_not_remove_xp(self):
        xp_a, earned, ba, bs, ec, wc = compute_xp(30, 91, streak=3, calibrated=True, referrals_n=0)
        xp_b, *_ = compute_xp(30, 62, streak=3, calibrated=True, referrals_n=0,
                                   earned=earned, best_avg_prev=ba, best_streak_prev=bs)
        assert xp_b >= xp_a

    def test_earning_an_achievement_does_not_reduce_the_next_call(self):
        """The call that earns something and the call right after it must not
        go backwards — this is the exact regression that made the bar drop as a
        reward for earning a badge."""
        first, earned, ba, bs, ec, wc = compute_xp(10, 88, streak=7, calibrated=True, referrals_n=1)
        assert earned, "nothing was earned; the fixture is not exercising the path"
        second, *_ = compute_xp(10, 88, streak=7, calibrated=True, referrals_n=1,
                                     earned=earned, best_avg_prev=ba, best_streak_prev=bs)
        assert second == first

    def test_xp_never_falls_across_a_declining_career(self):
        """Sessions only ever accumulate; every other input degrades."""
        earned, ba, bs, ec, wc, prev = [], 0, 0, False, 0, -1
        # calibrated=False from the third step on: a user who clears a
        # calibration to redo it, or whose calibData has not hydrated yet.
        for n, avg, streak, cal in [(1, 95, 1, True), (5, 88, 5, True), (12, 70, 12, False),
                                    (20, 55, 0, False), (25, 51, 0, False)]:
            xp, earned, ba, bs, ec, wc = compute_xp(n, avg, streak, cal, 0,
                                            earned=earned, best_avg_prev=ba, best_streak_prev=bs,
                                            ever_cal_prev=ec, wc_completed=wc)
            assert xp >= prev, f"XP fell at sessions={n}: {prev} -> {xp}"
            prev = xp

    def test_a_duplicated_earned_list_does_not_pay_twice(self):
        clean, *_ = compute_xp(5, 70, 0, False, 0, earned=["first_session"])
        dupes, *_ = compute_xp(5, 70, 0, False, 0,
                                    earned=["first_session", "first_session", "first_session"])
        assert clean == dupes

    def test_completing_the_weekly_challenge_does_not_cost_xp_on_reopen(self):
        """The reward used to be added only inside the branch that WROTE the
        claim flag, so the call that completed the challenge returned 150 more
        than every call after it. Reopening the panel demoted the user."""
        claiming, earned, ba, bs, ec, wc = compute_xp(
            40, 82, streak=7, calibrated=True, referrals_n=0,
            wc_complete_now=True, wc_already_claimed=False)
        assert wc == 1, "the claim must be counted, not just paid once"
        reopened, *_ = compute_xp(
            40, 82, streak=7, calibrated=True, referrals_n=0,
            earned=earned, best_avg_prev=ba, best_streak_prev=bs,
            ever_cal_prev=ec, wc_completed=wc,
            wc_complete_now=True, wc_already_claimed=True)
        assert reopened == claiming

    def test_a_completed_week_keeps_paying_in_later_weeks(self):
        done, earned, ba, bs, ec, wc = compute_xp(
            40, 82, 7, True, 0, wc_complete_now=True)
        next_week, *_ = compute_xp(
            42, 82, 0, True, 0, earned=earned, best_avg_prev=ba, best_streak_prev=bs,
            ever_cal_prev=ec, wc_completed=wc, wc_complete_now=False)
        assert next_week >= done

    def test_clearing_a_calibration_does_not_cost_xp(self):
        """calibration_done was the last term gated on the LIVE flag while
        every other one moved to a high-water mark."""
        with_cal, earned, ba, bs, ec, wc = compute_xp(10, 70, 0, True, 0)
        assert "calibrated" in earned
        without,  *_ = compute_xp(10, 70, 0, False, 0, earned=earned,
                                  best_avg_prev=ba, best_streak_prev=bs, ever_cal_prev=ec)
        assert without == with_cal
        # …and even with a stale/empty achievement list, which is how the
        # client can arrive before its profile listener has fired.
        cold, *_ = compute_xp(10, 70, 0, False, 0, ever_cal_prev=ec)
        assert cold == with_cal


class TestAchievementsAreReachable:
    def test_every_achievement_can_be_earned_by_some_input(self):
        """`perfect_week` had a requirement and no branch — unreachable for
        every user since it shipped. Nothing in the list may be dead."""
        _, earned, *_ = compute_xp(
            50, 90, streak=30, calibrated=True, referrals_n=5,
            session_hours=[23, 6], perfect_week=True)
        missing = [a["id"] for a in ACHIEVEMENTS if a["id"] not in earned]
        assert missing == [], f"unreachable achievements: {missing}"

    def test_night_owl_needs_a_late_SESSION_not_a_late_visit(self):
        """Opening the panel at 23:00 with no sessions must earn nothing."""
        _, earned, *_ = compute_xp(0, 0, 0, False, 0, session_hours=[])
        assert "night_owl" not in earned
        assert "early_bird" not in earned

    def test_night_owl_and_early_bird_come_from_session_hours(self):
        _, late, *_  = compute_xp(1, 70, 0, False, 0, session_hours=[23])
        _, early, *_ = compute_xp(1, 70, 0, False, 0, session_hours=[6])
        assert "night_owl" in late and "early_bird" not in late
        assert "early_bird" in early and "night_owl" not in early

    def test_no_single_session_hour_earns_both_badges(self):
        """22:00-01:59 is late, 02:00-07:59 is early. Driven through the real
        evaluation rather than by restating the condition."""
        for h in range(24):
            _, earned, *_ = compute_xp(1, 70, 0, False, 0, session_hours=[h])
            assert not ("night_owl" in earned and "early_bird" in earned), \
                f"hour {h} earned both badges"
        # and every hour of the day falls in at most one window, none in both
        covered = set()
        for h in range(24):
            _, earned, *_ = compute_xp(1, 70, 0, False, 0, session_hours=[h])
            if "night_owl" in earned or "early_bird" in earned: covered.add(h)
        assert covered == {22, 23, 0, 1, 2, 3, 4, 5, 6, 7}

    def test_a_brand_new_account_earns_nothing(self):
        xp, earned, *_ = compute_xp(0, 0, 0, False, 0)
        assert earned == []
        assert xp == 0


class TestLeaderboardPrivacy:
    """Mirrors compute_leaderboard()'s filtering. The old handler ranked the
    roster the CLIENT posted, with no aggregate_only check and no k-anonymity
    floor — the same named-employee leak /api/company/dashboard was rewritten
    to stop shipping, reachable from the Progress panel's 🏆 tab."""

    ROSTER = [
        {"uid": "a", "avg_score": 88, "sessions_count": 40, "department": "Eng"},
        {"uid": "b", "avg_score": 75, "sessions_count": 12, "department": "Eng"},
        {"uid": "c", "avg_score": 61, "sessions_count": 3,  "department": "Eng"},
        {"uid": "d", "avg_score": 0,  "sessions_count": 0,  "department": "Eng"},
        {"uid": "e", "avg_score": 0,  "sessions_count": 0,  "department": "Sales"},
    ]

    @staticmethod
    def _active(roster):
        return [e for e in roster
                if isinstance(e.get("avg_score"), (int, float))
                and int(e.get("sessions_count") or 0) > 0]

    def test_never_active_accounts_are_excluded(self):
        """createUserProfile seeds sessions_count: 0 / avg_score: 0. Those
        accounts appeared by name, '0 sessions', graded Poor, and dragged the
        department average down with a zero they never earned."""
        active = self._active(self.ROSTER)
        assert [e["uid"] for e in active] == ["a", "b", "c"]
        assert round(sum(e["avg_score"] for e in active) / len(active), 1) == 74.7
        all_avg = sum(e["avg_score"] for e in self.ROSTER) / len(self.ROSTER)
        assert all_avg < 50, "the un-filtered average is the regression being pinned"

    def test_a_group_below_the_floor_shows_nothing_at_all(self):
        """Not 'names hidden, ranks shown': with four colleagues, '3rd of 4'
        plus the company average reconstructs individuals by subtraction."""
        min_group_size = 5
        active = self._active(self.ROSTER)
        assert len(active) < min_group_size
        board = [{"aggregate": True}] if len(active) >= min_group_size else []
        assert board == []

    def test_departments_below_the_floor_are_suppressed(self):
        min_group_size = 5
        depts = {}
        for e in self._active(self.ROSTER):
            depts.setdefault(e["department"], []).append(e["avg_score"])
        shown = [k for k, v in depts.items() if len(v) >= min_group_size]
        suppressed = sum(1 for v in depts.values() if 0 < len(v) < min_group_size)
        assert shown == [] and suppressed == 1



class TestSeasonLength:
    """getCurrentSeason() in Gamification.jsx computed totalDays with a `+ 1`,
    so every quarter was one day longer than it is and the season bar read 99%
    on the last day instead of completing."""

    def test_quarter_lengths_are_real(self):
        import datetime as _dt
        expected = {(2026, 0): 90, (2026, 3): 91, (2026, 6): 92, (2026, 9): 92,
                    (2024, 0): 91}  # leap year Q1
        for (y, qm), want in expected.items():
            start = _dt.datetime(y, qm + 1, 1)
            end_y, end_m = (y + 1, 1) if qm + 4 > 12 else (y, qm + 4)
            end = _dt.datetime(end_y, end_m, 1) - _dt.timedelta(days=1)
            got = round((end - start).total_seconds() / 86400) + 1
            assert got == want, f"{y} Q{qm//3+1}: {got} != {want}"
            # The JS mirror: end is 23:59:59.999 of the last day, so the raw
            # difference already rounds to the day count with NO +1.
            js_end = end + _dt.timedelta(hours=23, minutes=59, seconds=59)
            assert round((js_end - start).total_seconds() / 86400) == want


def _func_source(name):
    """The shipped function body, so the assertions below are about the code
    that runs rather than about the mirror above."""
    tree = ast.parse(open(_SRC, encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return ast.get_source_segment(open(_SRC, encoding="utf-8").read(), node)
    raise AssertionError(f"{name}() not found in backend.py")


class TestHandlerSource:
    """Assertions against the real handlers. The mirror above can drift; these
    cannot — they fail the moment the shipped code stops doing the thing."""

    # These walk the AST rather than grepping the text, so commenting a line
    # out does not satisfy them — the first version of this test passed against
    # a build where the weekly reward had been commented away.
    @staticmethod
    def _xp_terms():
        """Every `xp += …` in compute_gamification, as (guard-names, value-names)."""
        tree = ast.parse(_func_source("compute_gamification").lstrip())
        out = []
        for node in ast.walk(tree):
            if isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name) \
                    and node.target.id == "xp" and isinstance(node.op, ast.Add):
                out.append({n.id for n in ast.walk(node.value) if isinstance(n, ast.Name)})
        return out

    @staticmethod
    def _guards():
        """Names appearing in the `if` tests that gate the XP terms."""
        tree = ast.parse(_func_source("compute_gamification").lstrip())
        names = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.If): continue
            has_xp = any(isinstance(b, ast.AugAssign) and isinstance(b.target, ast.Name)
                         and b.target.id == "xp" for b in node.body)
            if has_xp:
                names |= {n.id for n in ast.walk(node.test) if isinstance(n, ast.Name)}
        return names

    def test_no_xp_term_is_gated_on_a_value_that_can_fall(self):
        """XP terms may be gated on a high-water mark (best_avg / best_streak /
        ever_cal) or a monotonic count — never on the live avg_score, the live
        streak, or the live calibration flag, all three of which go down."""
        guards = self._guards()
        for falls in ("avg_score", "streak", "calibrated"):
            assert falls not in guards, \
                f"an XP term is gated on {falls!r}, which can decrease"
        assert {"best_avg", "best_streak", "ever_cal"} <= guards | set(), \
            f"expected the high-water marks to gate XP; guards were {sorted(guards)}"

    def test_the_weekly_reward_pays_per_week_completed(self):
        """It used to be added only inside the branch that wrote the claim
        flag, so it evaporated on the very next call."""
        terms = self._xp_terms()
        assert any({"WC_XP_REWARD", "wc_completed"} <= t for t in terms), \
            "no `xp += WC_XP_REWARD * wc_completed` term found"
        # …and exactly once. Leaving the old per-claim `xp += WC_XP_REWARD` in
        # place alongside the new term double-pays on the claiming call, which
        # is the same visible bug with the sign flipped: the level goes UP on
        # completion and back DOWN on the next open.
        paying = [t for t in terms if "WC_XP_REWARD" in t]
        assert len(paying) == 1, \
            f"the weekly reward is added in {len(paying)} places; it must be exactly one"

    def test_the_high_water_marks_are_maxima_of_stored_and_live(self):
        src = _func_source("compute_gamification")
        assert "best_avg    = max(" in src and "best_streak = max(" in src
        assert "ever_cal    = bool(" in src

    def test_achievements_are_persisted_by_union_not_overwrite(self):
        """A whole-array write deletes badges whenever the client's copy is
        stale — and this endpoint never reads the stored list."""
        src = _func_source("compute_gamification")
        assert "firestore.ArrayUnion" in src
        assert '_persist["achievements"] = all_earned' not in src

    def test_perfect_week_has_an_evaluation_branch(self):
        """It shipped with a requirement and no branch anywhere, unreachable
        for every user."""
        src = _func_source("compute_gamification")
        assert "perfect_week" in src and "_prev_qualified" in src, \
            "perfect_week must be evaluated, and over a window that does not " \
            "require the user to open the panel on Sunday night"

    def test_time_of_day_badges_do_not_read_the_server_clock(self):
        src = _func_source("compute_gamification")
        assert "datetime.now().hour" not in src
        assert "_session_hours" in src

    def test_legacy_week_claims_are_still_recognised(self):
        """The claim key format changed; without this every already-completed
        week re-claims and re-pays exactly once on deploy."""
        src = _func_source("compute_gamification")
        assert "week_key_legacy" in src
        assert "in (week_key, week_key_legacy)" in src

    def test_leaderboard_privacy_defaults_are_the_safe_ones(self):
        src = _func_source("compute_leaderboard")
        assert '_org.get("aggregate_only", True)' in src, "default must be ON"
        assert '_org.get("min_group_size", 5)' in src
        # the roster comes from the caller's own company, never the request body
        assert 'data.get("employees"' not in src
        assert '.where("company_id", "==", company_id)' in src

    def test_leaderboard_never_builds_a_name_in_aggregate_mode(self):
        """`name` may only be produced inside the else-branch of
        `if aggregate_only:`."""
        src = _func_source("compute_leaderboard")
        tree = ast.parse(src.lstrip())
        agg_ifs = [n for n in ast.walk(tree)
                   if isinstance(n, ast.If)
                   and isinstance(n.test, ast.Name) and n.test.id == "aggregate_only"]
        assert agg_ifs, "the aggregate_only branch is gone"
        for node in agg_ifs:
            body_src = "\n".join(ast.dump(b) for b in node.body)
            assert "'name'" not in body_src and '"name"' not in body_src, \
                "a named row is reachable under aggregate_only"

    def test_never_active_accounts_are_filtered_out(self):
        src = _func_source("compute_leaderboard")
        assert 'int(e.get("sessions_count") or 0) > 0' in src

    def test_nothing_comparative_survives_suppression(self):
        """Below the floor the response must not carry my_rank or the total —
        "3rd of 4" plus a company average reconstructs the rest."""
        src = _func_source("compute_leaderboard")
        assert "_suppressed_all" in src
        assert '"my_rank":            None if _suppressed_all else my_rank' in src
        assert '"total":              0 if _suppressed_all else len(ranked)' in src

    def test_every_early_return_carries_min_group_size(self):
        """The client interpolates it into its suppression copy; a response
        without it rendered the literal word "undefined" to the user."""
        src = _func_source("compute_leaderboard")
        assert '"min_group_size": mgs' in src
        # exactly one place builds the empty shape — the shared `_empty`
        # helper — so an early return cannot quietly omit a field again.
        assert src.count('return jsonify({"leaderboard": []') == 1
        assert src.count("return _empty(") >= 3

    def test_heatmap_buckets_in_the_users_timezone(self):
        src = _func_source("compute_heatmap")
        assert "tz_offset_min" in src
        assert "timedelta(minutes=tz_off)" in src
        # a session that genuinely scored 0 is data, not missing data
        assert "isinstance(sc, (int, float))" in src
        assert "if not ts or not sc:" not in src
