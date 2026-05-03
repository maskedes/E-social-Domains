import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Copy, Check } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface ReferralsProps {
  user: User | null;
}

export const ReferralsScreen: React.FC<ReferralsProps> = ({ user }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  // Generate a dynamic referral code based on user's UID (shortened)
  const referralCode = user?.uid.substring(0, 8).toUpperCase() || 'GUEST';
  const referralLink = `https://dash.domain.digitalplat.org/signup?ref=${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <div className={styles.topBarLabel}>{t('growth')}</div>
        <h1 className={styles.pageTitle}>{t('referrals')}</h1>
        <p className={styles.subText}>{t('referralSubtitle')}</p>
      </div>

      <div className={styles.card}>
        <p className={styles.infoText} style={{ marginBottom: '16px' }}>
          {t('shareLinkNote')}
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className={styles.codeBlock} style={{ flex: 1, marginTop: 0, padding: '16px' }}>
            {referralLink}
          </div>
          <button 
            className={styles.buttonInline} 
            style={{ 
              height: '54px', 
              background: copied ? '#22c55e' : 'linear-gradient(to right, var(--accent-primary), var(--accent-secondary))' 
            }}
            onClick={copyToClipboard}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied!' : t('copyLink')}
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('peopleInvited')}</div>
          <div className={styles.statVal}>1</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t('bonusSlotsEarned')}</div>
          <div className={styles.statVal}>1</div>
        </div>
      </div>
    </div>
  );
};
