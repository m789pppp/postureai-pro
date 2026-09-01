# Setting the deployment up — the short version

Everything below is done in the Vercel dashboard:
**Project → Settings → Environment Variables → Production**.
After the last one, redeploy (Deployments → ⋯ → Redeploy) and run the check at
the bottom. Nothing here requires a code change; the code is already waiting
for these.

> **Never paste any of these values into a chat, a commit, or a screenshot.**
> Two of them (the service-account JSON and the Kashier key) are live
> credentials. If one is ever exposed, revoke it at the source rather than
> hoping.

---

## 1. The two that are actually required

Without these, every signed-in API call returns 401 and the server cannot
verify a single user. This is the difference between "the site loads" and "the
site works".

| Variable | Value |
|---|---|
| `FLASK_ENV` | `production` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole service-account JSON, pasted as one line |

**Where the JSON comes from:** Firebase Console → your project → ⚙ Project
settings → Service accounts → **Generate new private key**. That downloads a
`.json` file. Open it, copy the entire contents including the outer `{` and
`}`, and paste it as the value.

You do **not** need to set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` or
`FIREBASE_PRIVATE_KEY` separately. They are fields inside that JSON, and
`api/_lib/env.js` now reads them out of it at startup. Setting the private key
by hand is the single most common way this breaks — it is a multi-line PEM and
dashboard fields mangle the newlines, which fails later with an unhelpful
"Invalid PEM formatted message". Let the JSON carry it.

**Check the project id inside that JSON matches the project the frontend
writes to.** `frontend/src/firebase.js` falls back to a hardcoded config when
the `VITE_FIREBASE_*` variables are unset, so a mismatch here means the server
and the browser are talking to two different databases and nothing lines up.

---

## 2. Email — nothing sends today

Invites, the welcome mail and the weekly report all silently do nothing.
Pick **one** of these two.

**Resend** (simplest, free tier is enough for a pilot):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | from resend.com → API Keys |
| `EMAIL_FROM` | e.g. `Corvus <noreply@yourdomain>` |

Resend needs a verified sending domain. If you do not have one yet, their
`onboarding@resend.dev` sender works for testing but will land in spam — fine
for the pilot's own account, not for inviting a supervisor.

**Or SMTP**, if you already have a mailbox:

| Variable | Value |
|---|---|
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | your provider's settings |

Gmail requires an app password, not your account password, and the backend
refuses `smtp.gmail.com` in production without one configured properly.

---

## 3. Payments — no provider is configured

Right now every checkout path fails. Kashier is the one the UI is actually
built around (card + Vodafone Cash, which is what matters for Egypt):

| Variable | Value |
|---|---|
| `KASHIER_MERCHANT_ID` | from the Kashier dashboard |
| `KASHIER_API_KEY` | from the Kashier dashboard |
| `KASHIER_MODE` | `test` while you are trying it, `live` when real |

Start in `test` mode and put a card through it once before believing it works.

**For the pilot itself you probably do not need this at all** — the pilot is
free individual accounts. If payments are not part of what you are showing,
leave this until after. What you should not do is leave the pricing page
advertising plans that cannot be bought.

---

## 4. Two that prevent specific bad days

| Variable | Why |
|---|---|
| `REDIS_URL` | Without it, rate limiting is per-process — on serverless that means effectively none. Easiest route: Vercel → Storage → Upstash Redis, which sets the variable for you. |
| `VITE_SENTRY_DSN` | Without it, a crash in front of a real user is invisible to you. During a pilot that is the difference between fixing something that evening and hearing about it in a meeting. |

---

## 5. Check it worked

Redeploy first — environment variables only apply to a new deployment.

```bash
npm run preflight https://postureai-pro-omega-nine.vercel.app
```

**`0 failed` is the target.** The warnings tell you what is still switched off
and what each one disables, so you can decide what matters before the pilot.

Two things this script cannot see, and you have to confirm yourself:

1. `firestore.rules` reached the project. `deploy.yml` pushes it, but only once
   `FIREBASE_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID` exist as
   **repository secrets** (GitHub → Settings → Secrets → Actions — separate
   from the Vercel variables above). Check the Actions run; do not assume.
2. `aggregate_only` is set on the pilot organisation:
   `node scripts/set-pilot-privacy.mjs <company_id>`. It defaults to off, and
   until it is on, a dashboard shows individual participants rather than
   aggregates.

---

## 6. The one that is not a variable

None of the above is the same as knowing the thing works. Sign up on the live
site with a real account, run a full session in front of your own camera, and
look at the score and the history afterwards. That has still never been done,
and no amount of configuration substitutes for doing it once.
