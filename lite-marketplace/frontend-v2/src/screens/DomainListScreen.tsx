import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Loader2 } from 'lucide-react';

interface DomainListProps {
  user: User | null;
}

export const DomainListScreen: React.FC<DomainListProps> = ({ user }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'domains'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDomains(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredDomains = domains.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <div className={styles.topBarLabel}>{t('domainManagement')}</div>
        <h1 className={styles.pageTitle}>{t('domainList')}</h1>
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h2 className={styles.cardTitle}>{t('yourDomains')}</h2>
            <p className={styles.subText}>{t('manageSearchDomains')}</p>
          </div>
          <div className={styles.sideBox}>
            <div className={styles.iconLabel} style={{ marginTop: 0 }}>{t('standardUsage')}</div>
            <p className={styles.infoText} style={{ fontSize: '13px', marginTop: '4px' }}>
              {t('standardUsageDesc')}
            </p>
          </div>
        </div>

        <div className={styles.alertBar}>
          <span>{t('multiDomainNote')}</span>
          <button className={styles.buttonOutline}>{t('buyPaidSlots')}</button>
        </div>

        <div className={styles.searchBarRow}>
          <div style={{ position: 'relative', width: '350px' }}>
            <Search size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              className={styles.input} 
              placeholder={t('searchDomains')} 
              style={{ padding: '12px 16px 12px 44px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className={styles.domainStatus}>
              {t('perPage')}: 
              <select className={styles.select} style={{ width: 'auto', padding: '6px 32px 6px 12px', margin: '0 8px', fontSize: '13px' }}>
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </div>
            <div className={styles.domainStatus}>
              {t('showingDomains').replace('{count}', filteredDomains.length.toString())}
            </div>
          </div>
        </div>

        <div className={styles.domainList}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Loader2 className={styles.spin} />
            </div>
          ) : filteredDomains.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No domains found.
            </div>
          ) : (
            filteredDomains.map((domain) => (
              <div key={domain.id} className={styles.domainItem}>
                <div className={styles.domainName}>{domain.name}</div>
                <div className={styles.domainStatus}>{domain.status}</div>
              </div>
            ))
          )}
        </div>

        {filteredDomains.length > 0 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn}>1</button>
          </div>
        )}
      </div>
    </div>
  );
};
