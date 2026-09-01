"""
An unset FLASK_ENV must mean the SAFE behaviour, not the debug behaviour.

This is not hypothetical. FLASK_ENV is not set on the Vercel deployment —
GET /api/health on production returns {"env": "development"} — and three
separate security decisions used `os.getenv("FLASK_ENV", "development")`,
so absence of configuration silently selected:

  * full Python tracebacks in API error responses (~177 call sites), and
  * skipping HMAC/signature validation on the PayMob and Stripe webhooks.

These tests pin the corrected rule: verbose/insecure behaviour requires
FLASK_ENV to say so explicitly.
"""
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import backend as be  # noqa: E402


# ── The decision rule ─────────────────────────────────────────────────────
DEV_VALUES  = ["development", "dev", "debug", "local", "test",
               "Development", "  DEV  "]
SAFE_VALUES = ["", "production", "prod", "staging", "PRODUCTION",
               "anything-else", "producton"]  # note the typo: still safe


def _verbose_for(value):
    """Re-evaluate the module's rule for a given FLASK_ENV value."""
    env = (value or "").strip().lower()
    return env in ("development", "dev", "debug", "local", "test")


@pytest.mark.parametrize("value", DEV_VALUES)
def test_explicit_dev_values_enable_verbose(value):
    assert _verbose_for(value) is True


@pytest.mark.parametrize("value", SAFE_VALUES)
def test_everything_else_is_treated_as_production(value):
    assert _verbose_for(value) is False, (
        f"FLASK_ENV={value!r} must NOT enable verbose errors or skip signature checks"
    )


def test_unset_is_safe():
    """The case that was actually live: the variable simply absent."""
    assert _verbose_for(None) is False


def test_module_rule_matches_this_helper():
    """The helper above must mirror what backend.py actually computes."""
    assert be._VERBOSE_ERRORS == _verbose_for(os.getenv("FLASK_ENV"))


def test_a_typo_does_not_open_the_door():
    """
    The old rule was `== "production"`, so `FLASK_ENV=prodution` fell through
    to development. The new rule fails the other way: a typo is still safe.
    """
    assert _verbose_for("prodution") is False


# ── safe_error's actual output ────────────────────────────────────────────
def _body(monkeypatch, verbose):
    monkeypatch.setattr(be, "_VERBOSE_ERRORS", verbose)
    with be.app.test_request_context("/api/anything"):
        resp, status = be.safe_error(ValueError("secret internal detail"))
        return resp.get_json(), status


def test_safe_error_hides_internals_when_not_explicitly_dev(monkeypatch):
    body, status = _body(monkeypatch, False)
    assert status == 500
    assert "trace" not in body
    assert "secret internal detail" not in str(body)
    assert body["error"] == "Internal server error"


def test_safe_error_still_helps_when_explicitly_dev(monkeypatch):
    body, _ = _body(monkeypatch, True)
    assert "trace" in body
    assert "secret internal detail" in body["error"]


# ── The authentication bypass ─────────────────────────────────────────────
#
# Confirmed live on production before this was fixed:
#
#   GET /api/user/activity
#   Authorization: Bearer obviously-not-a-valid-jwt
#   -> 200 {"events":[],"ok":true}
#
# _verify_token returned a fixed "dev-user-local" for ANY token string
# whenever Firebase Admin was unconfigured and FLASK_ENV was not exactly
# "production". Both were true: FIREBASE_SERVICE_ACCOUNT_JSON was unset
# (/api/ready reported firebase: not_configured) and FLASK_ENV was unset.
import auth.middleware as mw  # noqa: E402


def test_auth_module_uses_the_explicit_dev_rule():
    assert mw.IS_EXPLICIT_DEV == _verbose_for(os.getenv("FLASK_ENV"))


def test_unconfigured_firebase_rejects_any_token(monkeypatch):
    """No Firebase Admin and no explicit dev flag => nobody is authenticated."""
    monkeypatch.setattr(mw, "_firebase_ok", False)
    monkeypatch.setattr(mw, "IS_EXPLICIT_DEV", False)
    monkeypatch.setattr(mw, "_token_cache", {})
    assert mw._verify_token("obviously-not-a-valid-jwt") is None
    assert mw._verify_token("eyJhbGciOiJIUzI1NiJ9.e30.x") is None


def test_dev_user_still_available_when_explicitly_declared(monkeypatch):
    """The convenience is kept — it just has to be asked for."""
    monkeypatch.setattr(mw, "_firebase_ok", False)
    monkeypatch.setattr(mw, "IS_EXPLICIT_DEV", True)
    monkeypatch.setattr(mw, "_token_cache", {})
    user = mw._verify_token("any-token")
    assert user is not None and user["uid"] == "dev-user-local"


def test_empty_token_is_never_accepted(monkeypatch):
    monkeypatch.setattr(mw, "_firebase_ok", False)
    monkeypatch.setattr(mw, "IS_EXPLICIT_DEV", True)
    assert mw._verify_token("") is None


# ── Health / readiness must not report a broken deployment as fine ────────
import routes.health as health  # noqa: E402


ALL_FIREBASE = ["FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_PROJECT_ID",
                "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]


def _clear(monkeypatch):
    for k in list(health.REQUIRED_ENV) + list(health.OPTIONAL_ENV) + ALL_FIREBASE + ["SMTP_HOST"]:
        monkeypatch.delenv(k, raising=False)


def test_health_reports_missing_env_by_name_only(monkeypatch):
    _clear(monkeypatch)
    cfg = health._config_report()
    assert cfg["ok"] is False
    # Every required name, plus the three the JS handlers need when there is
    # no service-account JSON to derive them from.
    assert set(cfg["missing_env"]) == set(health.REQUIRED_ENV) | set(ALL_FIREBASE[1:])
    # names and explanations only — no values anywhere in the payload
    assert all(isinstance(v, str) for v in cfg["why"].values())


def test_service_account_json_covers_the_three_derived_vars(monkeypatch):
    """
    The point of api/_lib/env.js: one variable, not four. Health must not
    keep demanding the three fields that are derived from the JSON, or it
    reports a correctly configured deployment as broken.
    """
    _clear(monkeypatch)
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", '{"project_id":"p"}')
    cfg = health._config_report()
    assert cfg["missing_env"] == [], cfg["missing_env"]
    assert cfg["ok"] is True


def test_health_config_ok_when_set_individually(monkeypatch):
    """A deployment that sets the three by hand, with no JSON, is also fine."""
    _clear(monkeypatch)
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", "{}")
    for k in ALL_FIREBASE[1:]:
        monkeypatch.setenv(k, "x")
    assert health._config_report()["ok"] is True


def test_degraded_list_names_what_each_missing_var_switches_off(monkeypatch):
    _clear(monkeypatch)
    names = [d["name"] for d in health._config_report()["degraded"]]
    assert "REDIS_URL" in names and "KASHIER_API_KEY" in names
    assert all(d["disables"] for d in health._config_report()["degraded"])


def test_smtp_satisfies_email_instead_of_resend(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    names = [d["name"] for d in health._config_report()["degraded"]]
    assert "RESEND_API_KEY" not in names


def test_a_configured_deployment_reports_nothing_degraded(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", '{"project_id":"p"}')
    for k in health.OPTIONAL_ENV:
        monkeypatch.setenv(k, "x")
    cfg = health._config_report()
    assert cfg["ok"] is True and cfg["degraded"] == []
