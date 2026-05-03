import React, { useState } from 'react';
import { updateProfile, User as FirebaseUser } from 'firebase/auth';
import { User, ShieldCheck, ArrowLeft } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface EditProfileProps {
  user: FirebaseUser | null;
  setScreen: (screen: string) => void;
}

export const EditProfileScreen: React.FC<EditProfileProps> = ({ user, setScreen }) => {
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName });
      alert(t('updateSuccess'));
      setScreen('account');
    } catch (error) {
      console.error(error);
      alert(t('updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <button 
          onClick={() => setScreen('account')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '12px', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back to Account
        </button>
        <h1 className={styles.pageTitle}>{t('editProfile')}</h1>
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
          <input 
            type="text" 
            className={styles.input} 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your Name"
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>Email (Read-only)</label>
          <input 
            type="text" 
            className={styles.input} 
            value={user?.email || ''} 
            disabled 
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
        </div>

        <div className={styles.divider} />
        
        <button 
          className={styles.buttonPrimary} 
          style={{ width: 'auto', padding: '12px 32px', marginTop: '24px' }}
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? 'Saving...' : t('saveChanges')}
        </button>
      </div>
    </div>
  );
};
