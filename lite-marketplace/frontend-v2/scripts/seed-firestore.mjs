/**
 * Firestore schema seeding script — Dashboard App (domains-41de5)
 * Usage:  node scripts/seed-firestore.mjs
 *
 * Creates the full schema with demo documents:
 *   users/{uid}                       — profile + points + tier
 *   users/{uid}/walletTransactions    — sample deposit/referral
 *   apiKeys                           — sample key (hash + prefix)
 *   invitations                       — sample referral invite
 *   programApplications               — sample program application
 *   moderatorApplications             — sample moderator application
 *
 * Signs in anonymously (Anonymous provider must be enabled in Firebase Auth).
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, collection, addDoc, serverTimestamp,
} from 'firebase/firestore';

/* ── load .env ────────────────────────────────────────────────── */
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
// Named database "default" (the console-created one) — not the implicit "(default)" DB.
const db = getFirestore(app, 'default');

/* ── helper ───────────────────────────────────────────────────── */
async function step(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    return true;
  } catch (err) {
    console.error(`  ❌ ${label} → ${err.code || err.message}`);
    return false;
  }
}

/* ── seed ─────────────────────────────────────────────────────── */
console.log('Signing in anonymously…');
const cred = await signInAnonymously(auth);
const uid = cred.user.uid;
console.log(`Signed in as ${uid}\n`);

let ok = 0, fail = 0;
const track = (r) => (r ? ok++ : fail++);

// 1) users/{uid}
console.log('users/{uid}:');
track(await step('create user profile doc', () =>
  setDoc(doc(db, 'users', uid), {
    uid,
    email: cred.user.email || 'demo@esocial.domains',
    displayName: 'Demo User',
    photoURL: '',
    points: 75,
    tier: 'Bronze',
    role: 'member',
    invites: 1,
    bonusSlots: 3,
    programs: ['creator'],
    moderatorRoles: [],
    createdAt: serverTimestamp(),
  }, { merge: true }),
));

// 2) users/{uid}/walletTransactions
console.log('users/{uid}/walletTransactions:');
track(await step('deposit +50 (sign-up bonus)', () =>
  addDoc(collection(db, 'users', uid, 'walletTransactions'), {
    type: 'deposit', amount: 50, label: 'Sign-up bonus', createdAt: serverTimestamp(),
  }),
));
track(await step('referral +25 (invited a friend)', () =>
  addDoc(collection(db, 'users', uid, 'walletTransactions'), {
    type: 'referral', amount: 25, label: 'Referral reward', createdAt: serverTimestamp(),
  }),
));

// 3) apiKeys
console.log('apiKeys:');
track(await step('demo API key (hash + prefix)', () =>
  addDoc(collection(db, 'apiKeys'), {
    uid,
    name: 'Demo CLI key',
    prefix: 'edes_sk_demo1234567',
    keyHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    revoked: false,
    createdAt: serverTimestamp(),
  }),
));

// 4) invitations
console.log('invitations:');
track(await step('sample pending invitation', () =>
  addDoc(collection(db, 'invitations'), {
    inviterId: uid,
    inviteeEmail: 'friend@example.com',
    status: 'pending',
    inviteLink: `https://esocial.domains/?ref=${uid}`,
    createdAt: serverTimestamp(),
  }),
));

// 5) programApplications
console.log('programApplications:');
track(await step('creator program application', () =>
  addDoc(collection(db, 'programApplications'), {
    userId: uid,
    programId: 'creator',
    status: 'pending',
    submittedAt: serverTimestamp(),
    coverLetter: 'I want to join the creator program.',
  }),
));

// 6) moderatorApplications
console.log('moderatorApplications:');
track(await step('community moderator application', () =>
  addDoc(collection(db, 'moderatorApplications'), {
    userId: uid,
    positionId: 'community-moderator',
    status: 'pending',
    submittedAt: serverTimestamp(),
    motivation: 'I am active in the community and want to help.',
  }),
));

console.log(`\n🏁 Seeding complete: ${ok} succeeded, ${fail} failed.`);
if (fail > 0) {
  console.log('ℹ️  Failures are usually security rules. In test mode everything should pass.');
}
process.exit(0);
