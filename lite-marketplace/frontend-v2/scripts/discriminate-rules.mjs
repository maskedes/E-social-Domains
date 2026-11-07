/**
 * Rules discriminator — signs in as a fresh anonymous user and runs a matrix of
 * reads/writes/deletes to determine which live ruleset Firestore evaluates:
 *   A) permissive  (admin read/write: request.auth != null)
 *   B) granular    (own-doc only)
 *   C) locked      (everything denied)
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, getDocs, deleteDoc,
  collection, setDoc, serverTimestamp,
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
const db = getFirestore(app, 'default');
const cred = await signInAnonymously(getAuth(app));
const myUid = cred.user.uid;
console.log(`uid: ${myUid}\n`);

async function attempt(label, fn) {
  try {
    const r = await fn();
    console.log(`✅ ${label}${r ? ' → ' + r : ''}`);
    return true;
  } catch (e) {
    console.log(`❌ ${label} → ${e.code}`);
    return false;
  }
}

// 1. read own users doc
const own = await attempt('getDoc users/{me}', async () => {
  const s = await getDoc(doc(db, 'users', myUid));
  return s.exists() ? 'exists' : 'missing';
});

// 2. read apiKeys collection (any doc)
const anyRead = await attempt('getDocs apiKeys (any)', async () => {
  const s = await getDocs(collection(db, 'apiKeys'));
  return `${s.size} docs, first=${s.docs[0]?.id ?? 'none'}`;
});

// 3. create own apiKeys doc
const created = await attempt('create apiKeys/{me_test}', async () => {
  await setDoc(doc(db, 'apiKeys', `probe_${myUid}`), {
    uid: myUid, name: 'probe', prefix: 'probe', keyHash: 'probe', revoked: false, createdAt: serverTimestamp(),
  });
  return 'created';
});

// 4. delete own apiKeys doc
const selfDelete = await attempt('delete apiKeys/{me_test}', async () => {
  await deleteDoc(doc(db, 'apiKeys', `probe_${myUid}`));
  return 'deleted';
});

// 5. try delete first FOREIGN apiKeys doc
let foreignDelete = false;
try {
  const s = await getDocs(collection(db, 'apiKeys'));
  foreignDelete = await attempt('delete apiKeys/{foreign}', async () => {
    await deleteDoc(s.docs[0].ref);
    return 'deleted ' + s.docs[0].id;
  });
} catch { }

console.log('\nVerdict:');
const permissive = anyRead && foreignDelete;
const granular = !anyRead && own && selfDelete;
console.log(`ownRead=${own} anyRead=${anyRead} create=${created} selfDelete=${selfDelete} foreignDelete=${foreignDelete}`);
console.log(permissive ? '→ rules behave PERMISSIVE (auth != null)' : granular ? '→ rules behave GRANULAR (own-doc only)' : '→ rules behave LOCKED/DENY');
process.exit(0);
