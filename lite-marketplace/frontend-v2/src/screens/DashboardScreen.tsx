import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { Globe, CreditCard, Zap, Gem, Star } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useProfile, getTier } from '../services/profile';

interface DashboardProps {
  user: User | null;
  onNavigate?: (screen: string) => void;
}

export const DashboardScreen: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const { t } = useLanguage();
  const [domainCount, setDomainCount] = useState<number | string>('--');
  const { profile } = useProfile(user?.uid);
  const tier = getTier(profile?.points ?? 0);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'domains'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDomainCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('dashboard')}</h1>
      </div>

      <div className={styles.statsGrid}>
        <button
          className={`${styles.statCard} ${styles.statCardClickable}`}
          onClick={() => onNavigate?.('domain-list')}
          title="Open Domain List"
        >
          <div className={styles.statLabel}>
            <Globe size={16} /> {t('activeIdentities')}
          </div>
          <div className={styles.statVal}>{domainCount}</div>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardClickable}`}
          onClick={() => onNavigate?.('credits')}
          title="Open Credits"
        >
          <div className={styles.statLabel}>
            <CreditCard size={16} /> {t('walletBalance')}
          </div>
          <div className={styles.statVal}>$0.00</div>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardClickable}`}
          onClick={() => onNavigate?.('referrals')}
          title="Open Referrals"
        >
          <div className={styles.statLabel}>
            <Zap size={16} /> {t('peopleInvited')}
          </div>
          <div className={styles.statVal}>{profile?.invites ?? 0}</div>
        </button>

        <button
          className={`${styles.statCard} ${styles.statCardClickable}`}
          onClick={() => onNavigate?.('creator')}
          title="Open Creator Program"
        >
          <div className={styles.statLabel}>
            <Gem size={16} /> {t('dashboardPoints')}
          </div>
          <div className={styles.statVal}>
            {(profile?.points ?? 0).toLocaleString()}
          </div>
          <div className={styles.statSubLabel}>
            <Star size={11} /> {t(tier.nameKey as Parameters<typeof t>[0])}
          </div>
        </button>
      </div>
    </div>
  );
};
