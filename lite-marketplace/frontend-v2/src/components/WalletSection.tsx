import React, { useEffect, useState } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, ShoppingBag, Gift } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  subscribeBalance,
  subscribeTransactions,
  walletOperation,
  WalletError,
  WalletTx,
} from '../services/wallet';
import styles from '../screens/Screens.module.css';
import w from './Wallet.module.css';
import { useLanguage } from '../contexts/LanguageContext';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TxIcon: React.FC<{ type: string }> = ({ type }) => {
  const map = {
    deposit: <ArrowDownLeft size={14} />,
    withdraw: <ArrowUpRight size={14} />,
    purchase: <ShoppingBag size={14} />,
    referral: <Gift size={14} />,
  } as Record<string, React.ReactNode>;
  return <span className={w.txIcon}>{map[type] ?? <Wallet size={14} />}</span>;
};

export const WalletSection: React.FC<{ user: FirebaseUser }> = ({ user }) => {
  const { t } = useLanguage();
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<WalletTx[] | null>(null);
  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => subscribeBalance(user.uid, setBalance),
    [user.uid],
  );
  useEffect(
    () => subscribeTransactions(user.uid, setTxs),
    [user.uid],
  );

  const openModal = (mode: 'deposit' | 'withdraw') => {
    setModal(mode);
    setAmount('');
    setError(null);
  };

  const submit = async () => {
    if (!modal) return;
    const value = parseFloat(amount.replace(',', '.'));
    setBusy(true);
    setError(null);
    try {
      await walletOperation(user.uid, modal, value, modal === 'deposit' ? t('walletTopUp') : t('walletWithdraw'));
      setModal(null);
    } catch (err) {
      setError(
        err instanceof WalletError && err.code === 'insufficient'
          ? t('walletInsufficient')
          : err instanceof WalletError && err.code === 'invalid'
            ? t('walletInvalidAmount')
            : t('walletOpFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={w.walletSection}>
      <div className={w.balanceRow}>
        <span className={w.balanceIcon}><Wallet size={16} /></span>
        <span className={w.balanceLabel}>{t('walletAvailable')}</span>
        <span className={w.balanceValue}>{money(balance)}</span>
      </div>

      <div className={w.walletActions}>
        <button className={w.actionBtn} onClick={() => openModal('deposit')}>
          <Plus size={15} /> {t('walletTopUp')}
        </button>
        <button className={w.actionBtn} onClick={() => openModal('withdraw')}>
          <ArrowUpRight size={15} /> {t('walletWithdraw')}
        </button>
      </div>

      {txs === null ? (
        <div className={styles.emptyText} style={{ textAlign: 'center' }}>{t('loading')}</div>
      ) : txs.length === 0 ? (
        <div className={w.txCentred}>
          <span className={w.txIcon}><Wallet size={14} /></span>
          {t('walletNoTx')}
        </div>
      ) : (
        <div className={w.txList}>
          {txs.slice(0, 5).map((tx) => (
            <div className={w.txRow} key={tx.id}>
              <TxIcon type={tx.type} />
              <div className={w.txInfo}>
                <span className={w.txLabel}>{tx.label}</span>
                <span className={w.txDate}>
                  {tx.createdAt && typeof (tx.createdAt as { toDate?: () => Date }).toDate === 'function'
                    ? (tx.createdAt as { toDate: () => Date }).toDate().toLocaleDateString()
                    : ''}
                </span>
              </div>
              <span className={`${w.txAmount} ${tx.amount >= 0 ? w.amountCredit : w.amountDebit}`}>
                {tx.amount >= 0 ? '+' : '−'}{money(Math.abs(tx.amount))}
              </span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className={w.backdrop} onClick={() => !busy && setModal(null)}>
          <div className={w.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={w.modalTitle}>
              {modal === 'deposit' ? t('walletTopUp') : t('walletWithdraw')}
            </h3>
            <p className={w.modalText}>{t('walletAmountHint')}</p>
            <input
              className={w.amountInput}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <div className={w.quickRow}>
              {[10, 25, 100].map((v) => (
                <button key={v} className={w.quickBtn} onClick={() => setAmount(String(v))}>
                  ${v}
                </button>
              ))}
            </div>
            {error && <div className={w.modalError}>{error}</div>}
            <div className={w.modalBtns}>
              <button className={w.confirmBtn} onClick={submit} disabled={busy || !amount}>
                {busy ? t('walletProcessing') : modal === 'deposit' ? t('walletTopUp') : t('walletWithdraw')}
              </button>
              <button className={w.cancelBtn} onClick={() => !busy && setModal(null)}>
                {t('cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
