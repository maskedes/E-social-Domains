import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { Globe, CreditCard, Zap } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  user: User | null;
}

export const DashboardScreen: React.FC<DashboardProps> = ({ user }) => {
  const { t } = useLanguage();
  const [domainCount, setDomainCount] = useState<number | string>('--');

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
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <Globe size={16} /> {t('activeIdentities')}
          </div>
          <div className={styles.statVal}>{domainCount}</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <CreditCard size={16} /> {t('walletBalance')}
          </div>
          <div className={styles.statVal}>$0.00</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <Zap size={16} /> {t('referrals')}
          </div>
          <div className={styles.statVal}>0</div>
        </div>
      </div>
    </div>
  );
};
