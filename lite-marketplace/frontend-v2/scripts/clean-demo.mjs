/**
 * Cleanup script — removes ONLY the demo documents created by scripts/seed-firestore.mjs.
 * Usage: node scripts/clean-demo.mjs
 *
 * Targets the anonymous enrolled/deployed demo UIDs used during seeding; real users'
 * documents are never touched. Requires temporarily permissive security rules
 * (allow read, write: if request.auth != null) — restore the granular rules afterwards.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, getDocs, deleteDoc,
  collection, query, where, writeBatch,
} from 'firebase/firestore';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app, 'default');

/* Demo anonymous UIDs used by previous seed runs (safe to hardcode: sessions that
 * failed with NOT_FOUND wrote nothing). Real users are never in this list. */
const DEMO_UIDS = [
  'JS2YcTsnTlPsWLMJqHvq18b3wDs2',
  'Xmkn2F5KoHOm3FDP3LdD6i1QUxG2',
  'kBtm6cVRomdaJhBhj5gF9lqfi623',
  'E61pHENI3sXzOJ8jwkBVaiPWoK23',
];

let del = 0;
async function killDoc(ref) {
  await deleteDoc(ref);
  del++;
  console.log(`  🗑  ${ref.path}`);
}

/** query a collection by one of two field names restricted to DEMO_UIDS (Firestore `in` limit is 10) */
async function byFields(col, fields) {
  const snaps = await Promise.all(
    fields.map((f) =>
      getDocs(query(collection(db, col), where(f, 'in', DEMO_UIDS))).catch(() => emptySnap()),
    ),
  );
  const map = new Map();
  for (const snap of snaps) if (snap) for (const d of snap.docs) map.set(d.id, d.ref);
  return map;
}
const emptySnap = () => Promise.resolve({ docs: [] });

console.log('Signing in anonymously…');
await signInAnonymously(auth);
console.log('Deleting demo documents…');

/* 1) users/{uid} + walletTransactions subcollection */
for (const uid of DEMO_UIDS) {
  const txs = await getDocs(collection(db, 'users', uid, 'walletTransactions')).catch(() => ({ docs: [] }));
  for (const t of txs.docs) await killDoc(t.ref);
  const uref = doc(db, 'users', uid);
  const usnap = await getDoc(uref).catch(() => null);
  if (usnap && usnap.exists()) await killDoc(uref);
}

/* 2) apiKeys (seed field: uid) */
for (const [, ref] of await byFields('apiKeys', ['uid'])) await killDoc(ref);

/* 3) invitations (seed field: inviterId) */
for (const [, ref] of await byFields('invitations', ['inviterId', 'uid'])) await killDoc(ref);

/* 4) programApplications (seed field: userId; app field: uid) */
for (const [, ref] of await byFields('programApplications', ['userId', 'uid'])) await killDoc(ref);

/* 5) moderatorApplications (seed field: userId; app field: uid) */
for (const [, ref] of await byFields('moderatorApplications', ['userId', 'uid'])) await killDoc(ref);

console.log(`\n🏁 Cleanup complete: ${del} documents deleted.`);
process.exit(0);
