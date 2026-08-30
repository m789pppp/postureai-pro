/**
 * Vercel Serverless — MFA endpoints
 * POST /api/auth/mfa/totp/setup
 * POST /api/auth/mfa/totp/verify
 * POST /api/auth/mfa/sms/send
 * POST /api/auth/mfa/sms/verify
 * POST /api/auth/mfa/disable
 * POST /api/auth/mfa/backup-codes/regenerate
 *
 * Uses Firebase Auth built-in MFA (TOTP) for TOTP
 * SMS uses Firestore OTP storage (no Twilio needed for demo)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

// ── Base32 (RFC 4648) ────────────────────────────────────────────
// Node has no "base32" encoding. generateTOTPSecret() used to call
// Buffer.toString("base32") and totpCode() Buffer.from(secret,"base32");
// both throw `TypeError: Unknown encoding: base32`, so /totp/setup returned
// a 500 and TOTP enrolment was impossible. Implemented here rather than
// pulling in a dependency for ~20 lines.
const _B32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += _B32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += _B32_ALPHA[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = _B32_ALPHA.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── TOTP helpers using speakeasy-style (RFC 6238) ────────────────
function generateTOTPSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function generateBackupCodes(n = 8) {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-")
  );
}

function totpCode(secret, timeStep) {
  const key     = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const hmac    = crypto.createHmac("sha1", key).update(counter).digest();
  const offset  = hmac[hmac.length - 1] & 0xf;
  const otp     = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1000000;
  return String(otp).padStart(6, "0");
}

function verifyTOTP(secret, code) {
  const now = Math.floor(Date.now() / 30000);
  // Allow ±1 step (90s window)
  for (let step = -1; step <= 1; step++) {
    if (totpCode(secret, now + step) === code.trim()) return true;
  }
  return false;
}

async function requireAuth(req, auth) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) throw Object.assign(new Error("Authentication required"), { status: 401 });
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  process.env.VITE_APP_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { auth, db } = getAdmin();
  const path = req.url.split("?")[0];

  try {
    const uid = await requireAuth(req, auth);

    // ── TOTP Setup ────────────────────────────────────────────────
    if (path.endsWith("/totp/setup")) {
      const secret = generateTOTPSecret();
      const email  = (await auth.getUser(uid)).email || uid;
      const uri    = `otpauth://totp/Corvus:${encodeURIComponent(email)}?secret=${secret}&issuer=Corvus%20PostureAI`;

      // Store secret temporarily (not enabled yet)
      await db.collection("mfa_pending").doc(uid).set({
        uid, secret, created_at: new Date().toISOString(),
      });

      return res.json({ secret, uri });
    }

    // ── TOTP Verify ───────────────────────────────────────────────
    if (path.endsWith("/totp/verify")) {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: "code required" });

      const pending = (await db.collection("mfa_pending").doc(uid).get()).data();
      if (!pending?.secret) return res.status(400).json({ error: "No pending TOTP setup — call /totp/setup first" });

      if (!verifyTOTP(pending.secret, code)) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      const backup_codes = generateBackupCodes(8);
      const hashed_codes = backup_codes.map(c => crypto.createHash("sha256").update(c).digest("hex"));

      await db.collection("users").doc(uid).update({
        mfa_enabled: true, mfa_method: "totp",
        mfa_totp_secret: pending.secret,
        mfa_backup_codes: hashed_codes,
        mfa_enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await db.collection("mfa_pending").doc(uid).delete();

      return res.json({ ok: true, backup_codes });
    }

    // ── SMS Send ──────────────────────────────────────────────────
    if (path.endsWith("/sms/send")) {
      const { phone } = req.body || {};
      if (!phone) return res.status(400).json({ error: "phone required" });

      // Check Twilio env vars
      const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
      const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER;

      const otp     = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Store OTP in Firestore
      await db.collection("mfa_otp").doc(uid).set({
        uid, phone, otp: crypto.createHash("sha256").update(otp).digest("hex"),
        expires_at: expires, created_at: new Date().toISOString(),
      });

      if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        // Send real SMS via Twilio
        const body = encodeURIComponent(`Your Corvus verification code is: ${otp}. Valid for 5 minutes.`);
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method:  "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
              "Content-Type":  "application/x-www-form-urlencoded",
            },
            body: `To=${encodeURIComponent(phone)}&From=${encodeURIComponent(TWILIO_FROM)}&Body=${body}`,
            signal: AbortSignal.timeout(10000),
          }
        );
        if (!twilioRes.ok) {
          const d = await twilioRes.json().catch(() => ({}));
          console.error("[MFA SMS] Twilio error:", d.message);
          return res.status(503).json({ error: "SMS service unavailable — use Authenticator App instead" });
        }
      } else {
        // No Twilio configured — return OTP in response (demo mode)
        console.warn("[MFA SMS] No Twilio configured — demo mode, returning OTP in response");
        return res.json({ ok: true, demo: true, otp, note: "Demo mode — Twilio not configured" });
      }

      return res.json({ ok: true });
    }

    // ── SMS Verify ────────────────────────────────────────────────
    if (path.endsWith("/sms/verify")) {
      const { code, phone } = req.body || {};
      if (!code) return res.status(400).json({ error: "code required" });

      const otpDoc = (await db.collection("mfa_otp").doc(uid).get()).data();
      if (!otpDoc) return res.status(400).json({ error: "No OTP found — request a new code" });
      if (new Date(otpDoc.expires_at) < new Date()) return res.status(400).json({ error: "Code expired" });

      const hashed = crypto.createHash("sha256").update(code.trim()).digest("hex");
      if (hashed !== otpDoc.otp) return res.status(400).json({ error: "Invalid code" });

      const backup_codes = generateBackupCodes(8);
      const hashed_codes = backup_codes.map(c => crypto.createHash("sha256").update(c).digest("hex"));

      await db.collection("users").doc(uid).update({
        mfa_enabled: true, mfa_method: "sms", mfa_phone: phone || otpDoc.phone,
        mfa_backup_codes: hashed_codes,
        mfa_enabled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      await db.collection("mfa_otp").doc(uid).delete();

      return res.json({ ok: true, backup_codes });
    }

    // ── Disable MFA ───────────────────────────────────────────────
    if (path.endsWith("/disable")) {
      await db.collection("users").doc(uid).update({
        mfa_enabled: false, mfa_method: null,
        mfa_totp_secret: null, mfa_backup_codes: [],
        mfa_phone: null, updated_at: new Date().toISOString(),
      });
      return res.json({ ok: true });
    }

    // ── Regenerate Backup Codes ───────────────────────────────────
    if (path.endsWith("/backup-codes/regenerate")) {
      const backup_codes = generateBackupCodes(8);
      const hashed_codes = backup_codes.map(c => crypto.createHash("sha256").update(c).digest("hex"));
      await db.collection("users").doc(uid).update({
        mfa_backup_codes: hashed_codes, updated_at: new Date().toISOString(),
      });
      return res.json({ ok: true, backup_codes });
    }

    // ── MFA Login Verify ─────────────────────────────────────────
    if (path.endsWith("/login-verify")) {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: "code required" });

      const userDoc = (await db.collection("users").doc(uid).get()).data();
      if (!userDoc?.mfa_enabled) return res.json({ ok: true }); // MFA not enabled

      if (userDoc.mfa_method === "totp") {
        if (!verifyTOTP(userDoc.mfa_totp_secret || "", code)) {
          return res.status(401).json({ error: "Invalid code" });
        }
      } else if (userDoc.mfa_method === "sms") {
        const otpDoc = (await db.collection("mfa_otp").doc(uid).get()).data();
        if (!otpDoc || new Date(otpDoc.expires_at) < new Date()) {
          return res.status(401).json({ error: "Code expired — request new" });
        }
        const hashed = crypto.createHash("sha256").update(code.trim()).digest("hex");
        if (hashed !== otpDoc.otp) return res.status(401).json({ error: "Invalid code" });
        await db.collection("mfa_otp").doc(uid).delete();
      }

      return res.json({ ok: true });
    }

    return res.status(404).json({ error: "Unknown MFA endpoint" });

  } catch (e) {
    if (e.status === 401 || e.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Authentication required" });
    }
    console.error("[MFA]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
