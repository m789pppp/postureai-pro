/**
 * Firestore rules verification against the emulator.
 *
 * Each test corresponds to a specific claim made in the DPIA / ethics
 * submission, or to a bug that was fixed. If one of these fails, a statement
 * in a document that goes to an ethics committee is false.
 */
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-corvus",
  firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${String(e.message).slice(0, 160)}`); fail++; }
};

// ── Seed data with rules bypassed ────────────────────────────────────────
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/alice"), { email: "alice@tkh.edu.eg", name: "Alice", tier: "standard", company_id: "acme" });
  await setDoc(doc(db, "users/bob"),   { email: "bob@tkh.edu.eg",   name: "Bob",   tier: "standard", company_id: "other" });
  await setDoc(doc(db, "sessions/s1"), { uid: "alice", avg_score: 71 });
  await setDoc(doc(db, "sessions/s2"), { uid: "bob",   avg_score: 64 });
  await setDoc(doc(db, "invites/i1"),  { email: "new@acme.com", company_id: "acme", role: "employee" });
  await setDoc(doc(db, "user_consent/alice"), { uid: "alice", camera: { granted: true, version: "2026-08-30" } });
});

const alice = env.authenticatedContext("alice", { email: "alice@tkh.edu.eg" }).firestore();
const bob   = env.authenticatedContext("bob",   { email: "bob@tkh.edu.eg" }).firestore();
const anon  = env.unauthenticatedContext().firestore();

console.log("\nSession data — \"no participant can see another participant's data\"");
await t("owner reads own session",        () => assertSucceeds(getDoc(doc(alice, "sessions/s1"))));
await t("other user CANNOT read session", () => assertFails(getDoc(doc(bob,   "sessions/s1"))));
await t("anonymous CANNOT read session",  () => assertFails(getDoc(doc(anon,  "sessions/s1"))));
await t("owner writes own session",       () => assertSucceeds(setDoc(doc(alice, "sessions/new1"), { uid: "alice", avg_score: 80 })));
await t("cannot write session as another user", () => assertFails(setDoc(doc(bob, "sessions/new2"), { uid: "alice", avg_score: 99 })));

console.log("\nInvites — the duplicate-rule leak that was removed");
await t("unrelated user CANNOT read an invite", () => assertFails(getDoc(doc(bob, "invites/i1"))));
await t("unrelated user CANNOT list invites",   () => assertFails(getDocs(collection(bob, "invites"))));

console.log("\nConsent records — the DPIA says these exist and are the participant's own");
await t("owner reads own consent",          () => assertSucceeds(getDoc(doc(alice, "user_consent/alice"))));
await t("owner writes own consent",         () => assertSucceeds(setDoc(doc(alice, "user_consent/alice"),
                                                  { uid: "alice", camera: { granted: true, version: "2026-08-30" } }, { merge: true })));
await t("owner records a withdrawal",       () => assertSucceeds(setDoc(doc(alice, "user_consent/alice"),
                                                  { uid: "alice", camera: { granted: false, revoked_at: "now" } }, { merge: true })));
await t("other user CANNOT read consent",   () => assertFails(getDoc(doc(bob, "user_consent/alice"))));
await t("other user CANNOT write consent",  () => assertFails(setDoc(doc(bob, "user_consent/alice"), { uid: "alice", camera: { granted: true } }, { merge: true })));
await t("consent record CANNOT be deleted", () => assertFails(deleteDoc(doc(alice, "user_consent/alice"))));

console.log("\nPrivilege escalation — why the paid-tier write is denied by design");
await t("user CANNOT raise own tier",   () => assertFails(updateDoc(doc(alice, "users/alice"), { tier: "elite" })));
await t("user CANNOT make self HR",     () => assertFails(updateDoc(doc(alice, "users/alice"), { is_hr: true })));
await t("user CANNOT make self admin",  () => assertFails(updateDoc(doc(alice, "users/alice"), { is_admin: true })));
await t("user CANNOT join a company",   () => assertFails(updateDoc(doc(alice, "users/alice"), { company_id: "acme2" })));
await t("user CAN edit own name",       () => assertSucceeds(updateDoc(doc(alice, "users/alice"), { name: "Alice B" })));

console.log("\nProfiles");
await t("user reads own profile",           () => assertSucceeds(getDoc(doc(alice, "users/alice"))));
await t("unrelated user CANNOT read profile", () => assertFails(getDoc(doc(bob, "users/alice"))));

console.log(`\n${"─".repeat(56)}\n${pass} passed · ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
