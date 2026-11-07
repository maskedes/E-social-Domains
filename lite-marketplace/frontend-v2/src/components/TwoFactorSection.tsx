import React, { useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  multiFactor,
  TotpMultiFactorGenerator,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { ShieldCheck, ShieldCheckIcon, KeyRound, X, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import s from './AccountExtras.module.css';

/* ── Two-factor authentication section (Firebase MFA, TOTP) ── */
/* Shows current enrollment status; enabling requires TOTP MFA to be active in
   the Firebase console (Authentication → Sign-in method → Multi-Factor).     */
export const TwoFactorSection: React.FC<{ user: FirebaseUser }> = ({ user }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<'enroll' | 'disable' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [justEnrolled, setJustEnrolled] = useState(false);

  // Reload enrolled factors each time the account screen mounts
  useEffect(() => {
    try {
      const factors = multiFactor(user).enrolledFactors || [];
      setEnrolled(factors.length > 0);
    } catch {
      setEnrolled(false);
    }
  }, [user]);

  const beginEnrollment = async () => {
    setBusy('enroll');
    setError(null);
    try {
      // re-authenticate first (do whatever the user types; password field used again)
      const pw = window.prompt('Re-enter your password to start 2FA enrollment:');
      if (!pw) { setBusy(null); return; }
      const cred = EmailAuthProvider.credential(user.email || '', pw);
      await reauthenticateWithCredential(user, cred);

      const session = await multiFactor(user).getSession();
      const gen = await TotpMultiFactorGenerator.generateSecret(session as any);
      setSecret(gen.secretKey); // base32 secret, typeable into any TOTP app
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        /operation-required|mfa|multi-factor|not-en|disabled|not enabled/i.test(msg)
          ? `${t('twoFactorMfaFailed')}\n\n${t('twoFactorConsoleHint')}`
          : msg
      );
      setBusy(null);
    }
  };

  const verifyAndEnable = async () => {
    if (!secret) return;
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code.'); return; }
    setBusy('enroll');
    setError(null);
    try {
      const session = await multiFactor(user).getSession();
      const secretObj = { secretKey: secret, generateQrCodeUrl: () => '' } as any;
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secretObj,
        code.trim(),
      );
      await multiFactor(user).enroll(assertion, 'Authenticator');
      setEnrolled(true);
      setJustEnrolled(true);
      setSecret(null);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    setBusy('disable');
    setError(null);
    try {
      const factors = multiFactor(user).enrolledFactors;
      if (factors && factors[0]) {
        await multiFactor(user).unenroll(factors[0]);
      }
      setEnrolled(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (enrolled === null) {
    return (
      <div className={s.settingRow}>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('twoFactor')}</span>
          <span className={s.settingDesc}>…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={s.settingRow}>
      <div className={s.settingInfo}>
        <span className={s.settingTitle}>{t('twoFactor')}</span>
        <span className={s.settingDesc}>{enrolled ? t('twoFactorEnabled') : t('twoFactorDesc')}</span>
      </div>
      {!enrolled ? (
        <button className={s.actionMini} onClick={beginEnrollment} disabled={busy !== null}>
          {busy === 'enroll' ? t('twoFactorTesting') : t('twoFactorEnable')}
        </button>
      ) : (
        <button className={s.actionMini} style={{ color: '#ef4444', borderColor: '#fecaca', background: '#fff5f5' }} onClick={disable} disabled={busy !== null}>
          {busy === 'disable' ? t('twoFactorTesting') : t('twoFactorDisable')}
        </button>
      )}

      {/* Inline enrollment panel */}
      {secret && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t('twoFactorScanQr')}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', wordBreak: 'break-all' }}>
            {secret}
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>Open Google Authenticator / Authy / 1Password.</li>
            <li>Choose <strong>Enter a setup key</strong>.</li>
            <li>Account: <code>{user.email}</code> — Key: the one above — type: Time based.</li>
            <li>Enter the 6-digit code it shows below, then click Verify.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className={s.actionMini}
              style={{ fontFamily: 'monospace', letterSpacing: 2, textAlign: 'center', width: 130 }}
              placeholder="000 000"
              inputMode="numeric"
              maxLength={7}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') verifyAndEnable(); }}
            />
            <button className={s.actionMini} onClick={verifyAndEnable} disabled={busy === 'enroll' || code.trim().length < 6}>
              {busy === 'enroll' ? t('twoFactorTesting') : t('twoFactorVerify')}
            </button>
            <button className={s.actionMini} style={{ background: 'transparent' }} onClick={() => { setSecret(null); setCode(''); }}>
              {t('cancelBtn') || 'Cancel'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#854d0e', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <KeyRound size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t('twoFactorBackupCodes')}</span>
          </div>
        </div>
      )}

      {justEnrolled && (
        <div style={{ width: '100%', fontSize: 12.5, color: '#166534', display: 'flex', gap: 6, padding: '8px 0' }}>
          <Check size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {t('twoFactorDone')}
        </div>
      )}

      {error && <div className={s.connectError} style={{ whiteSpace: 'pre-wrap', width: '100%' }}>{error}</div>}
    </div>
  );
};