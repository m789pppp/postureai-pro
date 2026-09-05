"""
Corvus — the composite-index fallback that keeps per-user, time-ranged screens
working when `firebase deploy --only firestore:indexes` has not been run.

Why this matters enough to test: twenty-six endpoints run `where uid == me AND
<time field> >= cutoff`. Every one needs a composite index, and a composite
index does not ship with the code — it comes from a separate deploy command.
When it is missing Firestore raises FAILED_PRECONDITION, which reached users as
"try again shortly": advice that is false, because it fails identically
forever. Symptom Correlation, Progress, streaks and score history were all dark
at once for that one reason.

The fallback must produce the SAME rows the indexed query would, or it trades
a broken screen for a lying one.

Run: cd backend && pytest tests/test_uid_range_docs.py -v
"""
import ast, os, sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
_SRC = os.path.join(os.path.dirname(__file__), "..", "backend.py")


def _load(name):
    """Execute just the helper out of backend.py — importing the module runs
    Flask setup and the Firebase admin init."""
    src = open(_SRC, encoding="utf-8").read()
    tree = ast.parse(src)
    wanted = {"uid_range_docs", "_is_missing_index_error", "_day_key"}
    ns = {"sys": sys, "datetime": datetime, "timedelta": timedelta,
          "_MISSING_INDEX_SEEN": set(), "db": None, "firestore": None}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in wanted:
            exec(compile(ast.Module([node], []), "<helper>", "exec"), ns)
    return ns[name], ns


uid_range_docs, NS = _load("uid_range_docs")
is_missing = NS["_is_missing_index_error"]


class _FakeDb:
    """`db.collection()` returns a FRESH reference every call in the real
    client. Modelling it as `return self` made the fallback query inherit the
    failed query's composite flag — the stub, not the helper, was wrong, and
    it would have made every assertion below pass or fail for the wrong
    reason."""
    def __init__(self, rows, allow_composite=False):
        self._rows = rows; self._allow = allow_composite
    def collection(self, name): return _FakeQuery(self._rows, self._allow)


class _FakeQuery:
    """Firestore query stub that raises FAILED_PRECONDITION for a composite
    query and serves the plain `uid ==` query normally — exactly the split a
    project with un-deployed indexes sees."""
    def __init__(self, rows, allow_composite=False):
        self._rows = rows; self._allow = allow_composite
        self._composite = False; self._limit = None; self.uid = None
        self._order = None; self._desc = False
    def where(self, field, op, val):
        if field == "uid": self.uid = val
        else: self._composite = True
        self._filters = getattr(self, "_filters", []) + [(field, op, val)]
        return self
    def order_by(self, field, direction=None, **k):
        self._composite = True; self._order = field; self._desc = (direction == "DESC"); return self
    def limit(self, n): self._limit = n; return self
    def stream(self):
        if self._composite and not self._allow:
            raise Exception("400 The query requires an index. FAILED_PRECONDITION: "
                            "https://console.firebase.google.com/project/x/firestore/indexes?create_composite=abc")
        # Apply the recorded filters and ordering for real, so the parity test
        # below compares two genuine result sets. A stub that ignored the range
        # on the indexed path would have "proved" parity by making the indexed
        # side wrong.
        rows = list(self._rows)
        for field, op, val in getattr(self, "_filters", []):
            if   op == "==": rows = [r for r in rows if r.get(field) == val]
            elif op == ">=": rows = [r for r in rows if r.get(field) is not None and r[field] >= val]
            elif op == "<":  rows = [r for r in rows if r.get(field) is not None and r[field] <  val]
        if self._order:
            rows.sort(key=lambda r: r.get(self._order), reverse=self._desc)
        return [_Doc(r) for r in (rows[:self._limit] if self._limit else rows)]


class _Doc:
    def __init__(self, d): self._d = d
    def to_dict(self): return dict(self._d)


def _run(rows, *, allow_composite, **kw):
    NS["db"] = _FakeDb(rows, allow_composite)
    class _FS:
        class Query: DESCENDING = "DESC"
    NS["firestore"] = _FS
    NS["_MISSING_INDEX_SEEN"] = set()
    return uid_range_docs("sessions", "me", "created_at", **kw)


NOW = datetime(2026, 9, 5)
DAY = timedelta(days=1)
# Deliberately NOT in date order. Firestore returns the un-indexed `uid ==`
# query in its own arbitrary order, so a fixture that happens to be sorted
# would let a limit-before-sort bug pass — the newest rows silently missing
# from a chart of recent sessions, which is invisible until someone counts.
ROWS = [
    {"uid": "me",    "created_at": NOW - 40 * DAY, "avg_score": 50},   # outside a 7d window
    {"uid": "me",    "created_at": NOW - 5 * DAY,  "avg_score": 60},
    {"uid": "other", "created_at": NOW - 1 * DAY,  "avg_score": 99},   # someone else
    {"uid": "me",    "created_at": NOW - 1 * DAY,  "avg_score": 70},
]


class TestErrorDetection:
    def test_recognises_the_missing_index_error(self):
        assert is_missing(Exception("400 The query requires an index."))
        assert is_missing(Exception("FAILED_PRECONDITION: ..."))

    def test_does_not_swallow_unrelated_errors(self):
        """A permission error or a network failure must propagate. Falling back
        on those would hide a real outage behind a slower code path."""
        assert not is_missing(Exception("403 Missing or insufficient permissions"))
        assert not is_missing(Exception("DEADLINE_EXCEEDED"))


class TestFallbackMatchesTheIndexedQuery:
    def test_the_fallback_is_used_when_the_index_is_missing(self):
        got = _run(ROWS, allow_composite=False, start=NOW - 7 * DAY)
        assert [r["avg_score"] for r in got] == [60, 70]

    def test_and_returns_the_same_rows_the_index_would(self):
        """The point of the fallback is parity. If these disagree, a screen
        that used to be broken is now merely wrong, which is worse."""
        indexed  = _run(ROWS, allow_composite=True,  start=NOW - 7 * DAY)
        fallback = _run(ROWS, allow_composite=False, start=NOW - 7 * DAY)
        assert {r["avg_score"] for r in indexed} == {r["avg_score"] for r in fallback}

    def test_another_users_rows_are_never_returned(self):
        for allow in (True, False):
            got = _run(ROWS, allow_composite=allow, start=NOW - 7 * DAY)
            assert all(r["uid"] == "me" for r in got), "cross-user leak in the fallback"

    def test_the_range_is_actually_applied(self):
        got = _run(ROWS, allow_composite=False, start=NOW - 7 * DAY)
        assert all(r["created_at"] >= NOW - 7 * DAY for r in got)
        assert len(got) == 2, "the 40-day-old row must be filtered out in Python"

    def test_descending_order_is_honoured(self):
        got = _run(ROWS, allow_composite=False, start=NOW - 90 * DAY, desc=True)
        dates = [r["created_at"] for r in got]
        assert dates == sorted(dates, reverse=True)

    def test_ascending_by_default(self):
        got = _run(ROWS, allow_composite=False, start=NOW - 90 * DAY)
        dates = [r["created_at"] for r in got]
        assert dates == sorted(dates)

    def test_limit_applies_after_sorting_not_before(self):
        """Truncating the unsorted fallback rows and *then* sorting would
        return an arbitrary subset — the newest sessions silently missing from
        a chart of recent sessions."""
        got = _run(ROWS, allow_composite=False, start=NOW - 90 * DAY, desc=True, limit=1)
        assert len(got) == 1 and got[0]["avg_score"] == 70, "expected the NEWEST row"

    def test_no_rows_in_range_is_empty_not_an_error(self):
        assert _run(ROWS, allow_composite=False, start=NOW + DAY) == []


class TestStringDatedCollections:
    """symptom_logs stores `date` as "YYYY-MM-DD", not a timestamp — the two
    collections this helper serves use different field types."""

    SROWS = [
        {"uid": "me", "date": "2026-09-04", "symptoms": []},
        {"uid": "me", "date": "2026-08-30", "symptoms": []},
        {"uid": "me", "date": "2026-06-01", "symptoms": []},
    ]

    def _run_s(self, **kw):
        NS["db"] = _FakeDb(self.SROWS, False)
        class _FS:
            class Query: DESCENDING = "DESC"
        NS["firestore"] = _FS
        NS["_MISSING_INDEX_SEEN"] = set()
        return uid_range_docs("symptom_logs", "me", "date", **kw)

    def test_string_dates_compare_correctly(self):
        got = self._run_s(start="2026-08-01")
        assert [r["date"] for r in got] == ["2026-08-30", "2026-09-04"]

    def test_string_dates_sort_descending(self):
        got = self._run_s(start="2026-01-01", desc=True)
        assert [r["date"] for r in got] == ["2026-09-04", "2026-08-30", "2026-06-01"]

    def test_a_symptom_history_query_returns_something(self):
        """The regression: this endpoint returned 500 and the History tab
        rendered 'Couldn't load — try again shortly', permanently."""
        assert len(self._run_s(start="2026-01-01", limit=200, desc=True)) == 3
