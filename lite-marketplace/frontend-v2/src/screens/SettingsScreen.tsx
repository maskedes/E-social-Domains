import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Link2, Settings as SettingsIcon } from 'lucide-react';
import styles from './Screens.module.css';
import { ConnectAccounts, MoreSettings } from '../components/AccountExtras';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsProps {
  user: FirebaseUser | null;
}

export const SettingsScreen: React.FC<SettingsProps> = ({ user }) => {
  const { t } = useLanguage();

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('settings')}</h1>
      </div>

      <div className={styles.settingsColumn}>
        {user ? (
          <>
            {/* ── Connected accounts ─────────────────────────────── */}
            <div className={styles.sectionTitle}>
              <Link2 size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>{t('connectAccounts')}</span>
            </div>
            <ConnectAccounts user={user} />

            {/* ── Preferences / notifications / security ─────────── */}
            <div className={styles.sectionTitle} style={{ marginTop: 12 }}>
              <SettingsIcon size={20} style={{ color: 'var(--accent-primary)' }} />
              <span>{t('preferences')}</span>
            </div>
            <MoreSettings user={user} />
          </>
        ) : (
          <p className={styles.emptyText} style={{ textAlign: 'center' }}>
            {t('signinToUse')}
          </p>
        )}
      </div>
    </div>
  );
};
