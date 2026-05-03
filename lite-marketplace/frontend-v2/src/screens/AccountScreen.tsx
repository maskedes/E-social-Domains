import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Mail, Calendar, ShieldCheck } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface AccountProps {
  user: FirebaseUser | null;
  setScreen: (screen: string) => void;
}

export const AccountScreen: React.FC<AccountProps> = ({ user, setScreen }) => {
  const { t } = useLanguage();

  if (!user) return null;

  const creationDate = user.metadata.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString() 
    : 'Unknown';

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('account')}</h1>
      </div>

      <div className={styles.card} style={{ maxWidth: '600px' }}>
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
          <button className={styles.buttonOutline} style={{ width: 'auto', padding: '10px 24px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};
