"""HR roster must not carry individual scores unless the organisation opted in."""
import ast
import pathlib

SRC = (pathlib.Path(__file__).resolve().parents[1] / "backend.py").read_text(encoding="utf-8")


def _load_roster_rows():
    tree = ast.parse(SRC)
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_roster_rows")
    ns = {}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "backend.py", "exec"), ns)
    return ns["_roster_rows"]


USERS = [
    ("u2", {"name": "Bassem", "email": "b@x.com", "avg_score": 41, "sessions_count": 9, "department": "Sales"}),
    ("u1", {"name": "amira", "email": "a@x.com", "avg_score": 77, "sessions_count": 3, "dept": "Ops"}),
]


def test_aggregate_mode_has_no_scores():
    rows = _load_roster_rows()(USERS, True)
    assert [r["id"] for r in rows] == ["u1", "u2"]
    for r in rows:
        assert "avg_score" not in r and "sessions_count" not in r
    assert rows[0]["department"] == "Ops"


def test_individual_mode_includes_scores():
    rows = _load_roster_rows()(USERS, False)
    assert rows[1]["avg_score"] == 41 and rows[1]["sessions_count"] == 9


def test_endpoint_reads_privacy_default_on():
    i = SRC.index("def company_roster")
    body = SRC[i:SRC.index("\n@app.route", i)]
    assert '_org.get("aggregate_only", True)' in body
    assert "_roster_rows(" in body
