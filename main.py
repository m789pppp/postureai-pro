"""
Vercel Python entrypoint for the Flask backend.

Loads the real Flask `app` object from backend/backend.py (16,000+
lines — see backend/app.py's own docstring for why backend.py, not a
thinner file, is the actual application) by explicit file path rather
than a dotted `backend.xxx` import.

That distinction matters: Vercel resolves `tool.vercel.entrypoint`
(or an auto-detected root file) by importing a Python module path.
Doing that as `backend.app` or `backend.backend` first makes Python
register `backend` itself as a namespace package (backend/ has no
__init__.py, so this happens implicitly) — and at that point
backend/app.py's own `from backend import app` no longer means "the
top-level backend.py file", it means "an attribute of the backend
package", which doesn't exist, so Python falls back to resolving it
as the `backend.app` submodule — i.e. itself, returned as a plain
module object instead of the Flask app. (Confirmed by reproducing it:
`importlib.import_module("backend.app").app` comes back as
`<module 'backend.app'>`, not a Flask instance.)

Loading backend/backend.py by file path with importlib.util sidesteps
that class of bug entirely — nothing here ever imports anything named
`backend` or `backend.anything`, so there's no package to collide with.
"""
import importlib.util
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")

# backend/backend.py imports sibling modules with flat, absolute names
# (e.g. `from scoring_utils import ...`, `from auth.middleware import
# ...`) that assume backend/ itself is on sys.path — the same
# requirement Render's `rootDir: backend` config satisfies. Vercel's
# working directory is the repo root, so this has to be done explicitly.
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

_spec = importlib.util.spec_from_file_location(
    "corvus_backend_impl", os.path.join(_BACKEND_DIR, "backend.py")
)
_module = importlib.util.module_from_spec(_spec)
sys.modules["corvus_backend_impl"] = _module
_spec.loader.exec_module(_module)

# Vercel's Python runtime looks for a top-level `app` (WSGI/ASGI) in
# this file — see pyproject.toml's [tool.vercel] entrypoint.
app = _module.app
