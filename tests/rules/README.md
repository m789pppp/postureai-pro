# Firestore security-rules tests

These run the real `firestore.rules` against the Firestore emulator and assert
what it does and does not permit. Every test corresponds either to a bug that
was fixed or to a statement made in the ethics / data-protection submission —
so a failure here means a document that goes to a review committee is false.

## Run

```bash
cd tests/rules
npm install
npm test
```

Requires Java (the emulator is a JVM process). Exits non-zero on any failure.

## What is covered

- **Session isolation** — a participant reads only their own sessions; another
  signed-in user and an anonymous caller are both refused.
- **Invites** — an unrelated signed-in user can neither read nor list the
  invites collection. A duplicate rule block used to grant a blanket
  `allow read: if isAuthenticated()`, which silently cancelled the hardened,
  company-scoped rule above it and leaked every organisation's invited emails.
- **Consent records** — the owner can read, grant and withdraw their own;
  another user can do neither; and nobody can delete one, so a withdrawal
  cannot be made to disappear.
- **Privilege escalation** — a user cannot raise their own `tier`, make
  themselves `is_hr` or `is_admin`, or join a company by editing their profile.
  (This is also why the client-side tier write after payment is denied by
  design, and why company signup needs a server-side endpoint.)

## Which file is actually tested

The one real `/firestore.rules`, always. `npm test` runs the emulator from the
repo root (the Firebase CLI refuses a rules file outside the project
directory), and `rules.test.mjs` reads the same path — so there is no copy to
keep in sync.

It used to be a copy checked into this directory that you were asked to
refresh by hand. That is exactly the arrangement where a suite keeps passing
against a version nobody is running any more, so it is gone.

## Correct is not the same as live

Passing here says the rules file is right, not that it is what Firestore is
enforcing. Deployment is now part of `.github/workflows/deploy.yml`, which
pushes `firestore.rules` on every merge to `main` — but only once
`FIREBASE_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID` are set as
repository secrets. Until they are, that job fails loudly on every deploy and
the live rules are still whatever was last pushed by hand.

To deploy them yourself right now:

```bash
npx firebase-tools deploy --only firestore:rules --project <your-project-id>
```
