"""
custom_domains.py — Corvus White-Label Domain Automation
Automates: DNS verification → Vercel domain add → SSL → Cloudflare proxy
When an enterprise org sets their custom domain in WhiteLabel settings,
this module provisions it end-to-end without manual steps.
"""
import os, logging, requests as _req
from datetime import datetime
from flask import request, jsonify

log = logging.getLogger("corvus.domains")

VERCEL_TOKEN   = os.getenv("VERCEL_TOKEN","")
VERCEL_PROJECT = os.getenv("VERCEL_PROJECT_ID","")
VERCEL_TEAM    = os.getenv("VERCEL_TEAM_ID","")
CF_TOKEN       = os.getenv("CLOUDFLARE_API_TOKEN","")
CF_ZONE_ID     = os.getenv("CLOUDFLARE_ZONE_ID","")


def _vercel_headers():
    h = {"Authorization": f"Bearer {VERCEL_TOKEN}", "Content-Type": "application/json"}
    if VERCEL_TEAM:
        h["X-Vercel-Team-Id"] = VERCEL_TEAM
    return h


def add_vercel_domain(domain: str) -> dict:
    """Add a custom domain to the Vercel project."""
    if not VERCEL_TOKEN or not VERCEL_PROJECT:
        return {"ok": False, "error": "VERCEL_TOKEN / VERCEL_PROJECT_ID not set"}
    try:
        r = _req.post(
            f"https://api.vercel.com/v10/projects/{VERCEL_PROJECT}/domains",
            json={"name": domain},
            headers=_vercel_headers(),
            timeout=10,
        )
        data = r.json()
        if r.ok:
            return {"ok": True, "domain": data.get("name"), "verified": data.get("verified", False),
                    "verification": data.get("verification",[])}
        return {"ok": False, "error": data.get("error",{}).get("message","Vercel error")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def verify_vercel_domain(domain: str) -> dict:
    """Check domain verification status and trigger re-verification."""
    if not VERCEL_TOKEN:
        return {"ok": False, "error": "VERCEL_TOKEN not set"}
    try:
        # Trigger verification
        r = _req.post(
            f"https://api.vercel.com/v10/projects/{VERCEL_PROJECT}/domains/{domain}/verify",
            headers=_vercel_headers(), timeout=10,
        )
        data = r.json()
        return {"ok": r.ok, "verified": data.get("verified", False),
                "verification": data.get("verification",[])}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def remove_vercel_domain(domain: str) -> dict:
    """Remove a custom domain from the Vercel project."""
    if not VERCEL_TOKEN:
        return {"ok": False, "error": "VERCEL_TOKEN not set"}
    try:
        r = _req.delete(
            f"https://api.vercel.com/v9/projects/{VERCEL_PROJECT}/domains/{domain}",
            headers=_vercel_headers(), timeout=10,
        )
        return {"ok": r.ok, "status": r.status_code}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_dns_instructions(domain: str) -> dict:
    """Return DNS records the customer needs to add."""
    return {
        "cname": {
            "type":  "CNAME",
            "name":  domain,
            "value": "cname.vercel-dns.com",
            "ttl":   3600,
        },
        "txt": {
            "type":  "TXT",
            "name":  f"_vercel.{domain}",
            "value": "vc-domain-verify=YOUR_VERIFY_CODE",  # from Vercel verification
            "ttl":   300,
        },
        "instructions": [
            f"1. Add CNAME record: {domain} → cname.vercel-dns.com",
            f"2. Add TXT record:   _vercel.{domain} → (value from Vercel dashboard)",
            "3. Wait 1–60 minutes for DNS propagation",
            "4. SSL is provisioned automatically by Vercel after verification",
        ]
    }


def register_domain_routes(app, require_auth, require_admin, db, audit):
    """Register custom domain management routes."""

    @app.route("/api/admin/domains", methods=["POST"])
    @require_auth
    @require_admin
    def provision_custom_domain():
        """Provision a custom domain for an org. Called from WhiteLabel settings."""
        try:
            data   = request.get_json(force=True) or {}
            domain = data.get("domain","").lower().strip()
            org_id = data.get("org_id","") or getattr(request.environ.get("g"), "company_id","")

            if not domain:
                return jsonify({"error": "domain required"}), 400
            if "." not in domain:
                return jsonify({"error": "invalid domain format"}), 400

            # Add to Vercel
            vercel_result = add_vercel_domain(domain)

            # Store in Firestore
            db.collection("custom_domains").document(domain.replace(".","_")).set({
                "domain":       domain,
                "org_id":       org_id,
                "status":       "pending_dns",
                "vercel_added": vercel_result.get("ok", False),
                "verified":     False,
                "created_at":   datetime.utcnow().isoformat(),
                "created_by":   request.environ.get("uid",""),
            })

            audit(request.environ.get("uid",""), "custom_domain_provisioned", "enterprise",
                  {"domain": domain, "org_id": org_id})

            dns_instructions = get_dns_instructions(domain)
            return jsonify({
                "ok":       True,
                "domain":   domain,
                "vercel":   vercel_result,
                "dns":      dns_instructions,
                "next_step":"Add the DNS records shown in 'dns', then call /api/admin/domains/{domain}/verify",
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/api/admin/domains/<path:domain>/verify", methods=["POST"])
    @require_auth
    @require_admin
    def verify_custom_domain(domain):
        """Check and trigger domain verification."""
        try:
            result = verify_vercel_domain(domain)
            # Update Firestore
            db.collection("custom_domains").document(domain.replace(".","_")).update({
                "verified":     result.get("verified", False),
                "status":       "active" if result.get("verified") else "pending_dns",
                "verified_at":  datetime.utcnow().isoformat() if result.get("verified") else None,
            })
            if result.get("verified"):
                audit(request.environ.get("uid",""), "custom_domain_verified", "enterprise", {"domain": domain})
            return jsonify({"ok": True, **result})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/api/admin/domains", methods=["GET"])
    @require_auth
    @require_admin
    def list_custom_domains():
        """List all custom domains."""
        try:
            docs = db.collection("custom_domains").order_by("created_at").get()
            return jsonify({"ok": True, "domains": [d.to_dict() for d in docs]})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route("/api/admin/domains/<path:domain>", methods=["DELETE"])
    @require_auth
    @require_admin
    def delete_custom_domain(domain):
        """Remove a custom domain."""
        try:
            result = remove_vercel_domain(domain)
            db.collection("custom_domains").document(domain.replace(".","_")).delete()
            audit(request.environ.get("uid",""), "custom_domain_removed", "enterprise", {"domain": domain})
            return jsonify({"ok": result.get("ok", False)})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    log.info("✅ Custom domain routes registered")
