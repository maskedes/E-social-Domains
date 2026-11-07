import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, RefreshCw, ArrowRightLeft, Save, Trash2, ShieldCheck } from 'lucide-react';
import styles from './Toast.module.css';

// ─────────────────────────────────────────────────────────────
// Popup card system: success / error / info toasts + confirm dialogs
// Usage:
//   const toast = useToast();
//   toast.success('Domain registered successfully!');
//   toast.error('Failed to save.');
//   toast.transfer('example.eu.org');               // themed shortcut
//   const ok = await toast.confirm({                  // returns Promise<boolean>
//     title: 'Delete record?', message: 'This cannot be undone.',
//     kind: 'danger', confirmLabel: 'Delete',
//   });
// ─────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface ToastEntry {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  icon?: 'check' | 'alert' | 'info' | 'transfer' | 'save' | 'update' | 'delete';
}

interface ConfirmOptions {
  title: string;
  message?: string;
  kind?: 'danger' | 'primary';
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: 'transfer' | 'delete' | 'update' | 'save' | 'shield';
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, message?: string, icon?: ToastEntry['icon']) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  /** themed popup cards for domain actions */
  registered: (domain: string) => void;
  deleted: (title: string, message?: string) => void;
  transferred: (domain: string, to?: string) => void;
  updated: (title: string, message?: string) => void;
  saved: (title: string, message?: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

const ICONS: Record<NonNullable<ToastEntry['icon']>, React.ElementType> = {
  check: CheckCircle2,
  alert: AlertCircle,
  info: Info,
  transfer: ArrowRightLeft,
  save: Save,
  update: RefreshCw,
  delete: Trash2,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { id: number; resolve: (v: boolean) => void }) | null
  >(null);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string, icon?: ToastEntry['icon']) => {
      const id = idRef.current++;
      setItems(prev => [...prev.slice(-3), { id, kind, title, message, icon }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss]
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, id: idRef.current++, resolve });
      }),
    []
  );

  const settle = (v: boolean) => {
    if (confirmState) {
      confirmState.resolve(v);
      setConfirmState(null);
    }
  };

  const value: ToastContextValue = {
    toast: push,
    success: (t, m) => push('success', t, m, 'check'),
    error: (t, m) => push('error', t, m, 'alert'),
    info: (t, m) => push('info', t, m, 'info'),
    // Domain-action themed popup cards
    registered: (d) => push('success', 'Domain registered 🎉', `${d} is now on your account.`, 'check'),
    deleted: (t, m) => push('success', t, m ?? '', 'delete'),
    transferred: (d, to) => push('info', 'Transfer initiated', `${d}${to ? ` → ${to}` : ''} — you'll receive a confirmation email once accepted.`, 'transfer'),
    updated: (t, m) => push('success', t, m, 'update'),
    saved: (t, m) => push('success', t, m, 'save'),
    confirm,
  };

  const kindOfConfirm = confirmState?.kind ?? 'primary';
  const ConfirmIcon =
    confirmState?.icon === 'delete' ? Trash2
    : confirmState?.icon === 'transfer' ? ArrowRightLeft
    : confirmState?.icon === 'update' ? RefreshCw
    : confirmState?.icon === 'save' ? Save
    : confirmState?.icon === 'shield' ? ShieldCheck
    : kindOfConfirm === 'danger' ? AlertCircle : Info;

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* stacked popup cards, top-right */}
      <div className={styles.stack}>
        {items.map(t => {
          const Icon = ICONS[t.icon ?? (t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check')];
          return (
            <div key={t.id} className={`${styles.card} ${styles[t.kind]}`} role="status">
              <div className={styles.iconWrap}>
                <Icon size={20} />
              </div>
              <div className={styles.body}>
                <div className={styles.title}>{t.title}</div>
                {t.message && <div className={styles.message}>{t.message}</div>}
              </div>
              <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
              <div className={styles.progress} />
            </div>
          );
        })}
      </div>

      {/* confirmation dialog card */}
      {confirmState && (
        <div className={styles.overlay} onClick={() => settle(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={`${styles.dlgIcon} ${styles[kindOfConfirm]}`}>
              <ConfirmIcon size={22} />
            </div>
            <h3 className={styles.dlgTitle}>{confirmState.title}</h3>
            {confirmState.message && <p className={styles.dlgMessage}>{confirmState.message}</p>}
            <div className={styles.dlgActions}>
              <button className={styles.btnCancel} onClick={() => settle(false)}>
                {confirmState.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={kindOfConfirm === 'danger' ? styles.btnDanger : styles.btnConfirm}
                onClick={() => settle(true)}
                autoFocus
              >
                {confirmState.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
