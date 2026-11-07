import React, { useState } from 'react';
import {
  Globe,
  Moon,
  Sun,
  Bell,
  Clock,
  Smartphone,
  BarChart3,
  ShieldCheck,
  LogOut,
  Link2,
  Mail,
  Check,
} from 'lucide-react';
import { TranslationKey } from '../translations';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  linkWithPopup,
  unlink,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';
import s from './AccountExtras.module.css';

/* ── Connect accounts ──────────────────────────────────────────── */

interface ProviderDef {
  id: string;
  nameKey: TranslationKey;
  icon: React.ReactNode;
  color: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'google.com',
    nameKey: 'provGoogle',
    icon: (
      // Google "G" logomark
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.2C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
    ),
    color: 'currentColor',
  },
  {
    id: 'github.com',
    nameKey: 'provGithub',
    icon: (
      // GitHub octocat mark
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    color: 'currentColor',
  },
  {
    id: 'apple.com',
    nameKey: 'provApple',
    icon: (
      // Apple logo
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
      </svg>
    ),
    color: 'currentColor',
  },
  {
    id: 'microsoft.com',
    nameKey: 'provMicrosoft',
    icon: (
      // Simple four-square Microsoft logomark
      <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden>
        <rect width="6.8" height="6.8" fill="#f25022" />
        <rect x="8.2" width="6.8" height="6.8" fill="#7fba00" />
        <rect y="8.2" width="6.8" height="6.8" fill="#00a4ef" />
        <rect x="8.2" y="8.2" width="6.8" height="6.8" fill="#ffb900" />
      </svg>
    ),
    color: 'currentColor',
  },
];

const buildProvider = (id: string) => {
  switch (id) {
    case 'google.com': return new GoogleAuthProvider();
    case 'github.com': return new GithubAuthProvider();
    case 'apple.com': return new OAuthProvider('apple.com');
    case 'microsoft.com': return new OAuthProvider('microsoft.com');
    default: return new OAuthProvider(id);
  }
};

export const ConnectAccounts: React.FC<{ user: FirebaseUser }> = ({ user }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(user.providerData.map((p) => p.providerId));
  const emailOnly = user.providerData.length === 1 && linkedIds.has('password');

  const connect = async (p: ProviderDef) => {
    setBusy(p.id);
    setError(null);
    try {
      await linkWithPopup(user, buildProvider(p.id));
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setError(
        code.includes('already-linked')
          ? t('connectAlreadyLinked')
          : code.includes('credential-already-in-use')
            ? t('connectInUse')
            : code.includes('popup')
              ? t('connectPopupClosed')
              : t('connectFailed'),
      );
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (p: ProviderDef) => {
    if (user.providerData.length <= 1) {
      setError(t('unlinkLast'));
      return;
    }
    setBusy(p.id);
    setError(null);
    try {
      await unlink(user, p.id);
    } catch {
      setError(t('connectFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.connectRow}>
      {emailOnly && (
        <div className={s.connectRowItem}>
          <span className={s.provIcon} style={{ color: 'currentColor' }}><Mail size={16} /></span>
          <span className={s.provName}>{t('provEmail')}</span>
          <span className={s.connectedBadge}><Check size={12} /> {t('connected')}</span>
        </div>
      )}
      {PROVIDERS.map((p) => {
        const isLinked = linkedIds.has(p.id);
        return (
          <div className={s.connectRowItem} key={p.id}>
            <span className={s.provIcon} style={{ color: p.color }}>{p.icon}</span>
            <span className={s.provName}>{t(p.nameKey)}</span>
            {isLinked ? (
              <button
                className={s.disconnectBtn}
                onClick={() => disconnect(p)}
                disabled={busy !== null}
                title={t('disconnect')}
              >
                {t('connected')}
              </button>
            ) : (
              <button
                className={s.connectBtn}
                onClick={() => connect(p)}
                disabled={busy !== null}
              >
                {busy === p.id ? t('connecting') : <><Link2 size={13} /> {t('connect')}</>}
              </button>
            )}
          </div>
        );
      })}
      {error && <div className={s.connectError}>{error}</div>}
    </div>
  );
};

/* ── More settings ─────────────────────────────────────────────── */

export const MoreSettings: React.FC<{ user: FirebaseUser }> = ({ user }) => {
  const { t, language, setLanguage } = useLanguage();
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark-theme'),
  );
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark-theme', next);
  };

  const resetPassword = async () => {
    if (!user.email) return;
    setPwBusy(true);
    setPwError(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPwSent(true);
    } catch {
      setPwError(t('pwResetFailed'));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className={s.settingsList}>
      {/* Appearance */}
      <div className={s.settingRow}>
        <span className={s.setIcon}>{dark ? <Moon size={16} /> : <Sun size={16} />}</span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('darkMode')}</span>
          <span className={s.settingDesc}>{t('darkModeDesc')}</span>
        </div>
        <button
          className={`${s.switch} ${dark ? s.switchOn : ''}`}
          onClick={toggleDark}
          aria-pressed={dark}
        >
          <span className={s.knob} />
        </button>
      </div>

      {/* Language */}
      <div className={s.settingRow}>
        <span className={s.setIcon}><Globe size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('language')}</span>
          <span className={s.settingDesc}>{t('languageDesc')}</span>
        </div>
        <div className={s.langRow}>
          {(['en', 'fr'] as const).map((l) => (
            <button
              key={l}
              className={`${s.langBtn} ${language === l ? s.langBtnActive : ''}`}
              onClick={() => setLanguage(l)}
            >
              {l === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div className={s.settingRow}>
        <span className={s.setIcon}><Clock size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('timezone')}</span>
          <span className={s.settingDesc}>{t('timezoneDesc')}</span>
        </div>
        <select
          className={`${s.timezoneSelect} ${s.langBtn}`}
          defaultValue="UTC (London)"
        >
          <option>UTC (London)</option>
          <option>EST (New York)</option>
          <option>PST (Los Angeles)</option>
          <option>WAT (Lagos)</option>
        </select>
      </div>

      {/* Notifications */}
      <div className={s.settingRow}>
        <span className={s.setIcon}><Mail size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('emailNotif')}</span>
          <span className={s.settingDesc}>{t('emailNotifsDesc')}</span>
        </div>
        <button
          className={`${s.switch} ${emailNotifs ? s.switchOn : ''}`}
          onClick={() => setEmailNotifs((v) => !v)}
          aria-pressed={emailNotifs}
        >
          <span className={s.knob} />
        </button>
      </div>
      <div className={s.settingRow}>
        <span className={s.setIcon}><Smartphone size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('pushNotif')}</span>
          <span className={s.settingDesc}>{t('pushNotifDesc')}</span>
        </div>
        <button
          className={`${s.switch} ${pushNotifs ? s.switchOn : ''}`}
          onClick={() => setPushNotifs((v) => !v)}
          aria-pressed={pushNotifs}
        >
          <span className={s.knob} />
        </button>
      </div>
      <div className={s.settingRow}>
        <span className={s.setIcon}><BarChart3 size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('weeklyReports')}</span>
          <span className={s.settingDesc}>{t('weeklyReportsDesc')}</span>
        </div>
        <button
          className={`${s.switch} ${weeklyReports ? s.switchOn : ''}`}
          onClick={() => setWeeklyReports((v) => !v)}
          aria-pressed={weeklyReports}
        >
          <span className={s.knob} />
        </button>
      </div>{/* Product updates */}
      <div className={s.settingRow}>
        <span className={s.setIcon}><Bell size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('productUpdates')}</span>
          <span className={s.settingDesc}>{t('productUpdatesDesc')}</span>
        </div>
        <button
          className={`${s.switch} ${productUpdates ? s.switchOn : ''}`}
          onClick={() => setProductUpdates((v) => !v)}
          aria-pressed={productUpdates}
        >
          <span className={s.knob} />
        </button>
      </div>

      {/* Security */}
      <div className={s.settingRow}>
        <span className={s.setIcon}><ShieldCheck size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('security')}</span>
          <span className={s.settingDesc}>
            {user.email ? t('securityDesc') : t('securitySocialDesc')}
          </span>
        </div>
        {user.email && (
          <button className={s.actionMini} onClick={resetPassword} disabled={pwBusy}>
            {pwSent ? t('pwSent') : pwBusy ? t('busy') : t('changePassword')}
          </button>
        )}
      </div>
      {pwSent && <div className={s.connectError} style={{ color: '#22c55e' }}>{t('pwSentDesc')}</div>}
      {pwError && <div className={s.connectError}>{pwError}</div>}

      {/* Session */}
      <div className={s.settingRow}>
        <span className={s.setIconDanger}><LogOut size={16} /></span>
        <div className={s.settingInfo}>
          <span className={s.settingTitle}>{t('signOutTitle')}</span>
          <span className={s.settingDesc}>{t('signOutDesc')}</span>
        </div>
        <button className={s.signOutBtn} onClick={() => signOut(auth)}>
          {t('signOut')}
        </button>
      </div>
    </div>
  );
};
