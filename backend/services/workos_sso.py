"""
workos_sso.py — Corvus Enterprise SSO via WorkOS
Handles SAML 2.0, OIDC, Google Workspace, Azure AD, Okta, OneLogin
WorkOS provides a unified SSO API so we don't implement each IdP separately.
"""
import os, logging
from flask import redirect, request, jsonify

log = logging.getLogger("corvus.sso")

WORKOS_API_KEY      = os.getenv("WORKOS_API_KEY", "")
WORKOS_CLIENT_ID    = os.getenv("WORKOS_CLIENT_ID", "")
APP_URL             = os.getenv("APP_URL", "https://app.corvus.com")

def _wos():
    """Lazy-import WorkOS client."""
    try:
        import workos
        workos.api_key   = WORKOS_API_KEY
        workos.client_id = WORKOS_CLIENT_ID
        return workos
    except ImportError:
        raise RuntimeError("workos package not installed. Run: pip install workos")


def register_workos_routes(app, require_auth, require_admin, firestore, audit, log_fn):
    """Register all SSO routes on the Flask app."""

    @app.route("/api/auth/sso/authorize", methods=["GET"])
    def sso_authorize():
        """
        Initiate SSO login. Called when user enters their work email.
        Returns a redirect URL to the IdP (Identity Provider).
        """
        try:
            domain = request.args.get("domain", "")
            org_id = request.args.get("org_id", "")
            if not domain and not org_id:
                return jsonify({"error": "domain or org_id required"}), 400

            wos = _wos()
            # Determine connection for this domain/org
            connections = wos.sso.list_connections(domain=domain) if domain else wos.sso.list_connections()
            if not connections.get("data"):
                return jsonify({"error": "No SSO connection found for this domain", "domain": domain}), 404

            connection_id = connections["data"][0]["id"]
            redirect_uri  = f"{APP_URL}/api/auth/sso/callback"

            auth_url = wos.sso.get_authorization_url(
                connection=connection_id,
                redirect_uri=redirect_uri,
                state=org_id or domain,
            )
            log.info(f"SSO authorize: domain={domain} connection={connection_id}")
            return jsonify({"ok": True, "auth_url": auth_url, "connection_id": connection_id})
        except Exception as e:
            log.error(f"SSO authorize error: {e}")
            return jsonify({"error": str(e)}), 500


    @app.route("/api/auth/sso/callback", methods=["GET"])
    def sso_callback():
        """
        WorkOS redirects here after successful IdP authentication.
        Exchange code for profile → create/update Firebase user → issue token.
        """
        try:
            code  = request.args.get("code", "")
            state = request.args.get("state", "")
            if not code:
                return redirect(f"{APP_URL}/auth?error=sso_no_code")

            wos     = _wos()
            profile = wos.sso.get_profile_and_token(code)
            p       = profile.get("profile", {})

            email      = p.get("email", "")
            first_name = p.get("first_name", "")
            last_name  = p.get("last_name", "")
            idp_id     = p.get("id", "")
            org_id     = p.get("organization_id", "") or state

            if not email:
                return redirect(f"{APP_URL}/auth?error=sso_no_email")

            # Create or update user in Firebase
            import firebase_admin.auth as _fb_auth
            try:
                fb_user = _fb_auth.get_user_by_email(email)
                uid = fb_user.uid
            except _fb_auth.UserNotFoundError:
                fb_user = _fb_auth.create_user(
                    email=email,
                    display_name=f"{first_name} {last_name}".strip(),
                    email_verified=True,
                )
                uid = fb_user.uid

            # Set custom claims: sso=True, org_id, role
            db  = firestore.client()
            user_doc = db.collection("users").document(uid).get()
            role = "user"
            if user_doc.exists:
                role = user_doc.to_dict().get("role", "user")
            else:
                # New SSO user — create Firestore profile
                db.collection("users").document(uid).set({
                    "email":      email,
                    "name":       f"{first_name} {last_name}".strip(),
                    "company_id": org_id,
                    "sso":        True,
                    "sso_idp_id": idp_id,
                    "plan":       "enterprise",
                    "role":       "user",
                    "created_at": __import__("datetime").datetime.utcnow().isoformat(),
                })

            _fb_auth.set_custom_user_claims(uid, {
                "sso": True, "company_id": org_id, "role": role, "plan": "enterprise"
            })

            # Create a custom token for the client to exchange
            custom_token = _fb_auth.create_custom_token(uid)

            audit(uid, "sso_login", "auth", {"email": email, "org_id": org_id, "idp_id": idp_id})
            log.info(f"SSO login success: uid={uid} email={email} org={org_id}")

            # Redirect client with token — frontend exchanges for ID token
            import base64 as _b64
            token_b64 = _b64.urlsafe_b64encode(custom_token).decode()
            return redirect(f"{APP_URL}/auth/sso-complete?token={token_b64}&uid={uid}")

        except Exception as e:
            log.error(f"SSO callback error: {e}")
            return redirect(f"{APP_URL}/auth?error=sso_failed&msg={str(e)[:80]}")


    @app.route("/api/admin/sso/connections", methods=["GET"])
    @require_auth
    @require_admin
    def list_sso_connections():
        """List all SSO connections for admin panel."""
        try:
            wos = _wos()
            org_id = request.args.get("org_id", "")
            result = wos.sso.list_connections(organization_id=org_id) if org_id else wos.sso.list_connections()
            return jsonify({"ok": True, "connections": result.get("data", []), "count": result.get("list_metadata", {}).get("total_count", 0)})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/api/admin/sso/connections", methods=["POST"])
    @require_auth
    @require_admin
    def create_sso_connection():
        """
        Create a new SSO connection for an enterprise org.
        Supports: GoogleSAML, OktaSAML, AzureSAML, GenericSAML, MicrosoftOIDC, GitHubOAuth
        """
        try:
            wos  = _wos()
            data = request.get_json(force=True) or {}
            required = ["name", "type", "domains"]
            missing  = [f for f in required if not data.get(f)]
            if missing:
                return jsonify({"error": f"Missing: {', '.join(missing)}"}), 400

            connection = wos.sso.create_connection(
                name=data["name"],
                type=data["type"],
                domains=data["domains"],
                organization_id=data.get("org_id", ""),
            )
            audit(request.environ.get("uid",""), "sso_connection_created", "enterprise",
                  {"name": data["name"], "type": data["type"]})
            return jsonify({"ok": True, "connection": connection})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/api/auth/sso/check-domain", methods=["GET"])
    def check_sso_domain():
        """
        Check if a domain has SSO configured.
        Called on the login page when user types their email.
        """
        try:
            domain = request.args.get("domain", "").lower().strip()
            if not domain or "." not in domain:
                return jsonify({"sso_available": False})

            wos = _wos()
            connections = wos.sso.list_connections(domain=domain)
            has_sso = bool(connections.get("data"))

            return jsonify({
                "sso_available": has_sso,
                "domain":        domain,
                "connection_type": connections["data"][0].get("type","") if has_sso else None,
            })
        except Exception as e:
            # Non-fatal — if WorkOS is down, just return no SSO
            return jsonify({"sso_available": False, "error": str(e)})

    log.info("✅ WorkOS SSO routes registered")
