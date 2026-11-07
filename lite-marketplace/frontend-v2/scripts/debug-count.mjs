/** Debug: count docs in each collection, print raw errors. */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, getDocs, collection } from 'firebase/firestore';

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

await signInAnonymously(getAuth(app));
console.log('signed in\n');

for (const col of ['apiKeys', 'invitations', 'programApplications', 'moderatorApplications', 'users']) {
  try {
    const snap = await getDocs(collection(db, col));
    console.log(`${col}: ${snap.size} docs`);
    for (const d of snap.docs) console.log(`   ${d.id} → uid=${d.data().uid ?? d.data().inviterId ?? d.data().userId ?? '?'}`);
  } catch (e) {
    console.log(`${col}: ERROR ${e.code} ${e.message}`);
  }
}
process.exit(0);
