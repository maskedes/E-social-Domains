import React, { useState } from 'react';
import {
  User as FirebaseUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';
import { TranslationKey } from '../translations';
import s from './PasswordModal.module.css';
import { useLanguage } from '../contexts/LanguageContext';

export const ChangePasswordModal: React.FC<{
  user: FirebaseUser;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const { t } = useLanguage();
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!hasPassword) {
      // OAuth-only account: set a password through the email reset link
      if (!user.email) return;
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, user.email);
        setDone(true);
      } catch {
        setError(t('pwResetFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (next.length < 6) { setError(t('pwWeak')); return; }
    if (next !== confirm) { setError(t('pwMismatch')); return; }

    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email || '', current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, next);
      setDone(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setError(
        code.includes('wrong-password')
          ? t('pwWrongCurrent')
          : code.includes('too-many-requests')
            ? t('pwTooMany')
            : code.includes('requires-recent-login')
              ? t('pwReauthNeeded')
              : t('pwChangeFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const field = (
    value: string,
    setter: (v: string) => void,
    labelKey: TranslationKey,
    autoFocus?: boolean,
  ) => (
    <div className={s.field}>
      <label className={s.fieldLabel}>{t(labelKey)}</label>
      <input
        type="password"
        className={s.fieldInput}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setter(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
    </div>
  );

  return (
    <div className={s.backdrop} onClick={() => !busy && onClose()}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={s.modalTitle}>
          {hasPassword ? t('changePassword') : t('pwSetForSocial')}
        </h3>

        {done ? (
          <>
            <p className={s.modalText} style={{ color: '#22c55e' }}>
              {hasPassword ? t('pwChanged') : t('pwResetSentCheck')}
            </p>
            <button className={s.confirmBtn} onClick={onClose}>{t('done')}</button>
          </>
        ) : (
          <>
            {hasPassword ? (
              <>
                <p className={s.modalText}>{t('pwChangeHint')}</p>
                {field(current, setCurrent, 'pwCurrent', true)}
                {field(next, setNext, 'pwNew')}
                {field(confirm, setConfirm, 'pwConfirm')}
              </>
            ) : (
              <p className={s.modalText}>{t('pwSocialHint')}</p>
            )}

            {error && <div className={s.modalError}>{error}</div>}

            <div className={s.modalBtns}>
              <button className={s.confirmBtn} onClick={submit} disabled={busy}>
                {busy ? t('busy') : hasPassword ? t('pwUpdate') : t('pwSendLink')}
              </button>
              <button className={s.cancelBtn} onClick={() => !busy && onClose()}>
                {t('cancelBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
