# Firestore security-rules tests

These run the real `firestore.rules` against the Firestore emulator and assert
what it does and does not permit. Every test corresponds either to a bug that
was fixed or to a statement made in the ethics / data-protection submission —
so a failure here means a document that goes to a review committee is false.

## Run

```bash
cd tests/rules
cp ../../firestore.rules .      # test the real file, not a copy that drifted
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

## Keeping it honest

`firestore.rules` is copied in rather than symlinked so the test is explicit
about which file it checked. Copy it again after editing the rules, or the
suite passes against a stale version.

Nothing in CI deploys the rules file. Passing tests here say the rules are
correct, not that they are live — deploy with
`firebase deploy --only firestore:rules` and confirm.
