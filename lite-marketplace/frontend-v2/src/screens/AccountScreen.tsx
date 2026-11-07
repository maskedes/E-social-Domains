import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Mail, Calendar, ShieldCheck, Wallet } from 'lucide-react';
import styles from './Screens.module.css';
import { WalletSection } from '../components/WalletSection';
import { ChangePasswordModal } from '../components/PasswordModal';
import { TwoFactorSection } from '../components/TwoFactorSection';
import { useLanguage } from '../contexts/LanguageContext';

interface AccountProps {
  user: FirebaseUser | null;
  setScreen: (screen: string) => void;
}

export const AccountScreen: React.FC<AccountProps> = ({ user, setScreen }) => {
  const { t } = useLanguage();
  const [pwModal, setPwModal] = useState(false);

  if (!user) return null;

  const creationDate = user.metadata.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString() 
    : 'Unknown';

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('account')}</h1>
      </div>

      <div className={styles.centeredAccount}>
        <div className={styles.accountAvatarRow}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="avatar" className={styles.accountAvatar} />
          ) : (
            <div className={styles.accountAvatar}>
              {(user.displayName || user.email?.split('@')[0] || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* ── Wallet ──────────────────────────────────────────────── */}
        <div className={styles.walletTitleRow}>
          <Wallet size={20} style={{ color: '#22c55e' }} />
          <span>{t('wallet')}</span>
        </div>
        <WalletSection user={user} />

        {/* ── Two-factor authentication ─────────────────────────── */}
        <TwoFactorSection user={user} />

        <div className={styles.divider} style={{ margin: '28px 0 8px' }} />

        <div className={styles.cardTitle}>
          <ShieldCheck size={20} style={{ color: 'var(--accent-primary)' }} />
          {t('profileDetails')}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>
            <User size={14} style={{ marginRight: '6px' }} />
            {t('fullName')}
          </label>
          <div className={styles.infoText} style={{ fontSize: '16px', fontWeight: 600 }}>
            {user.displayName || user.email?.split('@')[0] || 'User'}
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>
            <Mail size={14} style={{ marginRight: '6px' }} />
            {t('emailAddress')}
          </label>
          <div className={styles.infoText} style={{ fontSize: '16px' }}>
            {user.email}
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>
            <Calendar size={14} style={{ marginRight: '6px' }} />
            {t('memberSince')}
          </label>
          <div className={styles.infoText} style={{ fontSize: '16px' }}>
            {creationDate}
          </div>
        </div>

        <div className={styles.divider} />
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button 
            className={styles.buttonPrimary} 
            style={{ width: 'auto', padding: '10px 24px' }}
            onClick={() => setScreen('edit-profile')}
          >
            {t('editProfile')}
          </button>
          <button
            className={styles.buttonOutline}
            style={{ width: 'auto', padding: '10px 24px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            onClick={() => user && setPwModal(true)}
          >
            {t('changePassword')}
          </button>
        </div>
      </div>

      {user && pwModal && (
        <ChangePasswordModal user={user} onClose={() => setPwModal(false)} />
      )}
    </div>
  );
};
