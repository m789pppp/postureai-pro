-- ============================================================
-- PostureAI Pro — PostgreSQL Production Schema v1
-- Supabase-compatible · Multi-tenant · Enterprise-grade
-- ============================================================
-- Usage:
--   psql $DATABASE_URL -f schema.sql
--   Or run via Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ── ORGANIZATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  slug          CITEXT      UNIQUE NOT NULL,
  domain        TEXT,                    -- auto-join domain
  plan          TEXT        NOT NULL DEFAULT 'starter'
                            CHECK (plan IN ('starter','professional','business','enterprise')),
  plan_status   TEXT        NOT NULL DEFAULT 'trialing'
                            CHECK (plan_status IN ('trialing','active','past_due','canceled','paused')),
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  max_seats     INTEGER     NOT NULL DEFAULT 5,
  used_seats    INTEGER     NOT NULL DEFAULT 0,
  -- Billing
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  -- Branding (white-label)
  logo_url      TEXT,
  primary_color TEXT,
  brand_name    TEXT,
  -- Settings
  sso_enabled   BOOLEAN DEFAULT FALSE,
  sso_provider  TEXT,
  sso_config    JSONB,
  -- Metadata
  country       TEXT        DEFAULT 'EG',
  currency      TEXT        DEFAULT 'EGP',
  timezone      TEXT        DEFAULT 'Africa/Cairo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations (slug);
CREATE INDEX idx_organizations_plan ON organizations (plan, plan_status);
CREATE INDEX idx_organizations_stripe_sub ON organizations (stripe_subscription_id);

-- ── USERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid    TEXT        UNIQUE,          -- Firebase UID (bridge during migration)
  email           CITEXT      UNIQUE NOT NULL,
  email_verified  BOOLEAN     DEFAULT FALSE,
  name            TEXT,
  avatar_url      TEXT,
  -- Auth
  password_hash   TEXT,                        -- bcrypt (email/password auth)
  google_id       TEXT UNIQUE,
  -- Organization
  org_id          UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  role            TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner','admin','hr_manager','member','viewer')),
  -- Product
  tier            TEXT        NOT NULL DEFAULT 'starter'
                              CHECK (tier IN ('starter','professional','business','enterprise')),
  is_trial        BOOLEAN     DEFAULT TRUE,
  trial_ends_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  -- Profile
  company         TEXT,
  job_title       TEXT,
  phone           TEXT,
  language        TEXT        DEFAULT 'en',
  timezone        TEXT        DEFAULT 'Africa/Cairo',
  -- Admin flags (NEVER set client-side)
  is_admin        BOOLEAN     DEFAULT FALSE,
  is_hr_manager   BOOLEAN     DEFAULT FALSE,
  is_blocked      BOOLEAN     DEFAULT FALSE,
  -- MFA
  mfa_enabled     BOOLEAN     DEFAULT FALSE,
  mfa_secret      TEXT,
  backup_codes    TEXT[],
  -- Onboarding
  onboarding_done BOOLEAN     DEFAULT FALSE,
  onboarding_steps JSONB      DEFAULT '[]',
  -- Gamification
  xp_total        INTEGER     DEFAULT 0,
  streak_days     INTEGER     DEFAULT 0,
  streak_last_at  DATE,
  -- Email sequences
  email_welcome_sent  BOOLEAN DEFAULT FALSE,
  email_day2_sent     BOOLEAN DEFAULT FALSE,
  email_day5_sent     BOOLEAN DEFAULT FALSE,
  email_day7_sent     BOOLEAN DEFAULT FALSE,
  -- Stripe (individual billing)
  stripe_customer_id  TEXT UNIQUE,
  -- Metadata
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_org_id ON users (org_id, role);
CREATE INDEX idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX idx_users_tier ON users (tier, is_trial);
CREATE INDEX idx_users_stripe ON users (stripe_customer_id);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,  -- null for org subs
  plan                    TEXT NOT NULL,
  billing_cycle           TEXT NOT NULL DEFAULT 'monthly'
                          CHECK (billing_cycle IN ('monthly','yearly')),
  status                  TEXT NOT NULL DEFAULT 'trialing'
                          CHECK (status IN ('trialing','active','past_due','canceled','paused','incomplete')),
  -- Stripe
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  stripe_price_id         TEXT,
  -- PayMob (MENA)
  paymob_order_id         TEXT,
  paymob_transaction_id   TEXT,
  -- Dates
  trial_start             TIMESTAMPTZ,
  trial_end               TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  -- Pricing
  currency                TEXT DEFAULT 'USD',
  amount_cents            INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sub_owner_check CHECK (org_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX idx_subscriptions_org ON subscriptions (org_id, status);
CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions (stripe_subscription_id);

-- ── INVOICES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  org_id              UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_invoice_id   TEXT UNIQUE,
  paymob_order_id     TEXT,
  number              TEXT,                    -- invoice number
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','open','paid','void','uncollectible')),
  currency            TEXT DEFAULT 'USD',
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents   INTEGER DEFAULT 0,
  tax_cents           INTEGER DEFAULT 0,
  -- Metadata
  pdf_url             TEXT,
  hosted_url          TEXT,
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices (org_id, status);
CREATE INDEX idx_invoices_user ON invoices (user_id, paid_at DESC);

-- ── SESSIONS (posture tracking) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  -- Score
  avg_score       SMALLINT    CHECK (avg_score BETWEEN 0 AND 100),
  min_score       SMALLINT,
  max_score       SMALLINT,
  grade           TEXT,                        -- A/B/C/D/F
  -- Posture metrics
  neck_avg_deg    REAL,
  shoulder_sym    REAL,
  head_forward_mm REAL,
  eye_strain_min  REAL,
  blink_rate      REAL,
  screen_dist_cm  REAL,
  -- Session info
  mode            TEXT DEFAULT 'laptop',       -- laptop|phone|side
  duration_sec    INTEGER DEFAULT 0,
  frame_count     INTEGER DEFAULT 0,
  alert_count     SMALLINT DEFAULT 0,
  -- AI
  ai_summary      TEXT,
  recommendations JSONB DEFAULT '[]',
  -- PDF
  pdf_url         TEXT,
  -- Metadata
  device_info     JSONB DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions (user_id, started_at DESC);
CREATE INDEX idx_sessions_org ON sessions (org_id, started_at DESC);
CREATE INDEX idx_sessions_score ON sessions (avg_score, started_at DESC);

-- ── USAGE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL   PRIMARY KEY,
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,            -- session_started|report_generated|api_call|etc
  quantity    INTEGER     DEFAULT 1,
  metadata    JSONB       DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_org ON usage_events (org_id, event_type, occurred_at DESC);
CREATE INDEX idx_usage_user ON usage_events (user_id, occurred_at DESC);

-- Monthly usage aggregate (materialized view updated by cron)
CREATE TABLE IF NOT EXISTS usage_monthly (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  year        SMALLINT NOT NULL,
  month       SMALLINT NOT NULL,
  event_type  TEXT NOT NULL,
  total       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, user_id, year, month, event_type)
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  icon        TEXT,
  action_url  TEXT,
  is_read     BOOLEAN     DEFAULT FALSE,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

-- ── AUDIT LOGS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL   PRIMARY KEY,
  org_id      UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  resource    TEXT,
  resource_id TEXT,
  ip_address  INET,
  user_agent  TEXT,
  details     JSONB       DEFAULT '{}',
  severity    TEXT        DEFAULT 'info'
              CHECK (severity IN ('info','warning','critical')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs (org_id, occurred_at DESC);
CREATE INDEX idx_audit_user ON audit_logs (user_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_logs (action, occurred_at DESC);
CREATE INDEX idx_audit_severity ON audit_logs (severity, occurred_at DESC)
  WHERE severity IN ('warning','critical');

-- ── API KEYS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  key_hash    TEXT        UNIQUE NOT NULL,     -- SHA-256 of the actual key
  key_prefix  TEXT        NOT NULL,            -- first 8 chars for display
  scopes      TEXT[]      DEFAULT ARRAY['read'],
  is_active   BOOLEAN     DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org ON api_keys (org_id, is_active);
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = TRUE;

-- ── TEAM INVITES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invites (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  email       CITEXT      NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'member',
  token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_token ON team_invites (token) WHERE status = 'pending';
CREATE INDEX idx_invites_org ON team_invites (org_id, status);

-- ── WEBHOOKS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  events      TEXT[]      NOT NULL DEFAULT ARRAY['session.completed'],
  secret      TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active   BOOLEAN     DEFAULT TRUE,
  last_error  TEXT,
  last_fired_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FEATURE FLAGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT        UNIQUE NOT NULL,
  description TEXT,
  enabled     BOOLEAN     DEFAULT FALSE,
  rollout_pct SMALLINT    DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  conditions  JSONB       DEFAULT '{}',        -- plan/org/user overrides
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default flags
INSERT INTO feature_flags (key, description, enabled, rollout_pct) VALUES
  ('gemini_ai',           'Gemini AI posture narrative',       TRUE,  100),
  ('ai_coach_chat',       'AI Coach chat interface',           TRUE,  100),
  ('heatmaps',            'Posture heatmap visualization',     TRUE,  100),
  ('gamification',        'XP/streaks/achievements',           TRUE,  100),
  ('scim_provisioning',   'SCIM v2 identity provisioning',     FALSE, 0),
  ('advanced_analytics',  'Predictive churn/risk analytics',   TRUE,  100),
  ('white_label',         'White-label branding',              FALSE, 0),
  ('mfa_totp',            'TOTP two-factor auth',              TRUE,  100),
  ('siem_integration',    'SIEM audit log streaming',          FALSE, 0)
ON CONFLICT (key) DO NOTHING;

-- ── SETTINGS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);

INSERT INTO platform_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('signup_enabled',   'true'),
  ('trial_days',       '14'),
  ('support_email',    '"support@postureai.io"')
ON CONFLICT (key) DO NOTHING;

-- ── UPDATED_AT triggers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['organizations','users','subscriptions','invoices'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_%1$s ON %1$s;
       CREATE TRIGGER trg_updated_%1$s
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at();', tbl
    );
  END LOOP;
END $$;

-- ── Row Level Security (Supabase) ─────────────────────────────────
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- Users can only see their own organization's data
-- NOTE: Replace auth.uid() with your actual auth function if not using Supabase Auth
CREATE POLICY "users_own_org" ON users
  USING (id = auth.uid() OR org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "sessions_own" ON sessions
  USING (user_id = auth.uid() OR org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ));

CREATE POLICY "notifications_own" ON notifications
  USING (user_id = auth.uid());

-- ── Helpful views ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW org_health_summary AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  o.plan,
  COUNT(DISTINCT u.id) AS total_users,
  COUNT(DISTINCT CASE WHEN u.last_seen_at > NOW()-INTERVAL '7 days' THEN u.id END) AS active_7d,
  AVG(s.avg_score) FILTER (WHERE s.started_at > NOW()-INTERVAL '30 days') AS avg_score_30d,
  COUNT(s.id) FILTER (WHERE s.started_at > NOW()-INTERVAL '30 days') AS sessions_30d
FROM organizations o
LEFT JOIN users u ON u.org_id = o.id
LEFT JOIN sessions s ON s.org_id = o.id
GROUP BY o.id, o.name, o.plan;

COMMENT ON TABLE organizations IS 'Multi-tenant organization accounts';
COMMENT ON TABLE users IS 'User accounts — admin flags must only be set server-side';
COMMENT ON TABLE subscriptions IS 'Billing subscriptions (Stripe + PayMob)';
COMMENT ON TABLE sessions IS 'Posture analysis sessions with full metrics';
COMMENT ON TABLE audit_logs IS 'ISO27001-compliant immutable audit trail';
