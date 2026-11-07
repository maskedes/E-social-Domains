import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface WalletTx {
  id: string;
  type: 'deposit' | 'withdraw' | 'purchase' | 'referral';
  amount: number; // positive = credit, negative = debit
  label: string;
  createdAt?: unknown;
}

export class WalletError extends Error {
  constructor(public code: 'insufficient' | 'invalid' | 'unknown') {
    super(code);
  }
}

export const subscribeBalance = (
  uid: string,
  cb: (balance: number) => void,
  onError?: () => void,
) =>
  onSnapshot(
    doc(db, 'users', uid),
    (snap) => cb(typeof snap.data?.()?.walletBalance === 'number' ? snap.data()!.walletBalance : 0),
    () => { cb(0); onError?.(); },
  );

export const subscribeTransactions = (
  uid: string,
  cb: (txs: WalletTx[] | null) => void,
) => {
  const q = query(
    collection(db, 'users', uid, 'walletTransactions'),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as WalletTx[]),
    () => cb([]),
  );
};

type OpMode = 'deposit' | 'withdraw';

/** Atomically moves the balance and appends a transaction record. */
export async function walletOperation(
  uid: string,
  mode: OpMode,
  amount: number,
  label: string,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new WalletError('invalid');
  const signed = mode === 'deposit' ? amount : -amount;

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const snap = await tx.get(ref);
    const current = typeof snap.data?.()?.walletBalance === 'number' ? snap.data()!.walletBalance : 0;
    const next = Math.round((current + signed) * 100) / 100;
    if (next < 0) throw new WalletError('insufficient');
    tx.set(ref, { walletBalance: next }, { merge: true });
    tx.set(
      doc(collection(db, 'users', uid, 'walletTransactions')),
      {
        type: mode,
        amount: signed,
        label,
        createdAt: serverTimestamp(),
      },
    );
  });
}
