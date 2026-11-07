import React from 'react';
import { Construction } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export const ComingSoonScreen: React.FC<ComingSoonProps> = ({ title, description }) => {
  const { t } = useLanguage();

  return (
    <div className={styles.screen}>
      <div className={`${styles.pageHeader} ${styles.pageHeaderCentered}`}>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>

      <div className={styles.centeredEmpty}>
        <div className={styles.emptyIconBadge}>
          <Construction size={30} />
        </div>
        <h2 className={styles.emptyTitle}>{t('comingSoon')}</h2>
        <p className={styles.emptyText}>
          {description || t('comingSoonDesc')}
        </p>
      </div>
    </div>
  );
};
