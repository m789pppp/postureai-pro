# PostureAI Pro — Merged Build Notes
**Base:** v17 Audited (best SaaS infrastructure)
**Added from v13:** WorkOS SSO + Custom Domains (backend) + APIChangelog + EmbedWidget (frontend)
**Added from v18:** MRRDashboard + HelpCenter + ShareCard (frontend) + App Store Checklist (mobile)

## New Backend Services (backend/services/)
| File | What it does | Env vars needed |
|------|-------------|-----------------|
| `workos_sso.py` | Enterprise SSO: SAML 2.0, Okta, Azure AD, Google Workspace | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` |
| `custom_domains.py` | White-label domain automation: DNS verify → Vercel → SSL | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `CLOUDFLARE_API_TOKEN` |

## New Frontend Components (frontend/src/)
| File | What it does | How to open |
|------|-------------|-------------|
| `MRRDashboard.jsx` | Revenue metrics: MRR, ARR, ARPU, LTV, churn, cohort retention | `setShowMRR(true)` from AdminDashboard |
| `HelpCenter.jsx` | In-app FAQ, bilingual AR/EN, searchable | `setShowHelp(true)` from nav |
| `APIChangelog.jsx` | Public API changelog with versions and breaking changes | `setShowChangelog(true)` from developer docs |
| `EmbedWidget.jsx` | B2B viral embed: team leaderboard iframe for Notion/Confluence | `/embed/leaderboard?org=ORG_ID&theme=dark` |
| `ShareCard.jsx` | Shareable posture score card | pass profile to component |

## App.jsx Changes
- Added imports for all 4 new frontend components
- Added state: `showMRR`, `showHelp`, `showChangelog`
- Added modal renders for MRRDashboard, HelpCenter, APIChangelog

## Mobile
- `mobile/APP_STORE_CHECKLIST.md` — step-by-step App Store + Play Store submission guide
- `mobile_rn/eas.json` — EAS build profiles for dev/preview/production (iOS + Android)

## To activate WorkOS SSO
1. Sign up at https://workos.com → create an app
2. Set `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` in Railway env vars
3. Configure your IdP (Google Workspace, Azure AD, Okta) in WorkOS dashboard
4. Routes auto-registered: `GET /api/auth/sso/authorize`, `GET /api/auth/sso/callback`, `GET /api/auth/sso/check-domain`

## To activate Custom Domains
1. Set `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` in Railway env vars
2. Routes auto-registered: `POST /api/admin/domains`, `POST /api/admin/domains/{domain}/verify`
3. Enterprise clients set domain in WhiteLabel settings → DNS instructions returned automatically
