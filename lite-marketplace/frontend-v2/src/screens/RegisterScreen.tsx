import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface RegisterProps {
  user: User | null;
}

export const RegisterScreen: React.FC<RegisterProps> = ({ user }) => {
  const { t } = useLanguage();
  const [domainName, setDomainName] = useState('');
  const [extension, setExtension] = useState('us.kg');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!domainName || !user) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'domains'), {
        name: `${domainName}.${extension}`,
        userId: user.uid,
        status: 'permanent / free',
        createdAt: serverTimestamp(),
      });
      alert('Domain registered successfully!');
      setDomainName('');
    } catch (error) {
      console.error("Error registering domain: ", error);
      alert('Failed to register domain.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('register')}</h1>
      </div>
      
      <div className={`${styles.card} ${styles.maxWidth500}`}>
        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>{t('identityName')}</label>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="e.g. username" 
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
          />
        </div>
        
        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>{t('countryExtension')}</label>
          <select 
            className={styles.select} 
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
          >
            <option value="us.kg">.us.kg</option>
            <option value="uk.kg">.uk.kg</option>
            <option value="fr.kg">.fr.kg</option>
          </select>
        </div>
        
        <button 
          className={styles.buttonPrimary} 
          onClick={handleRegister}
          disabled={loading || !domainName}
        >
          {loading ? 'Processing...' : t('finalizeRegistration')}
        </button>
      </div>
    </div>
  );
};
