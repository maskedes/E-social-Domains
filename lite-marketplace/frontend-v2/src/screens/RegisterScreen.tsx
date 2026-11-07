import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { EXTENSIONS, DEFAULT_EXTENSION } from '../data/extensions';

interface RegisterProps {
  user: User | null;
}

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'error';

const ACK_ITEMS = [
  'I accept the EU.org domain policy (no spam, no phishing, standards-compliant nameservers).',
  'I understand that direct .eu.org domains are reviewed manually by eu.org staff and approval is not guaranteed.',
  'I will provide valid contact information and keep working nameservers on my domain.',
];

export const RegisterScreen: React.FC<RegisterProps> = ({ user }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [domainName, setDomainName] = useState('');
  const [extension, setExtension] = useState(DEFAULT_EXTENSION);
  const [loading, setLoading] = useState(false);
  const [acks, setAcks] = useState<boolean[]>(ACK_ITEMS.map(() => false));
  const [check, setCheck] = useState<CheckState>('idle');
  const [checkMsg, setCheckMsg] = useState('');

  const name = domainName.trim().toLowerCase();
  const nameValid = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(name);
  const fqdn = `${name}.${extension}`;
  const allAcked = acks.every(Boolean);
  const chosen = EXTENSIONS.find(e => e.name === extension);

  const handleCheck = async () => {
    if (!nameValid) {
      setCheck('error');
      setCheckMsg('Use 3–63 characters: lowercase letters, numbers or hyphens.');
      return;
    }
    if (!chosen?.active) {
      setCheck('error');
      setCheckMsg(`${extension} is still pending eu.org approval — not registrable yet.`);
      return;
    }
    setCheck('checking');
    setCheckMsg('');
    try {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(fqdn)}&type=NS`,
        { signal: AbortSignal.timeout(8000) },
      );
      const data = await res.json();
      if (data.Status === 3) {
        setCheck('available');
        setCheckMsg(`${fqdn} is available 🎉`);
      } else if ((data.Answer?.length ?? 0) > 0 || data.Status === 2) {
        setCheck('taken');
        setCheckMsg(`${fqdn} is already taken.`);
      } else {
        setCheck('available');
        setCheckMsg(`${fqdn} looks available 🎉`);
      }
    } catch {
      setCheck('error');
      setCheckMsg('Availability check failed — please try again.');
    }
  };

  const handleRegister = async () => {
    if (!name || !user || check !== 'available') return;
    setLoading(true);
    try {
      // Refuse duplicates — the same domain must never be written twice
      const existing = await getDocs(
        query(collection(db, 'domains'), where('name', '==', fqdn), where('userId', '==', user.uid))
      );
      if (!existing.empty) {
        toast.error(`${fqdn} is already registered`, `It's on your account — check the Domain List.`);
        setCheck('idle');
        setCheckMsg('');
        return;
      }
      await addDoc(collection(db, 'domains'), {
        name: fqdn,
        userId: user.uid,
        status: 'permanent / free',
        createdAt: serverTimestamp(),
      });
      // A record points at the platform default; change it in Domain settings
      const recordContent = '41.75.184.138';
      try {
        await fetch('/api/dns/records', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'A', name: fqdn, content: recordContent, ttl: 300, proxied: false }),
        }).then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            console.warn('DNS record creation failed (domain saved, DNS pending):', body.error ?? r.status);
          }
        });
      } catch (dnsErr) {
        console.warn('DNS record creation failed (domain saved, DNS pending):', dnsErr);
      }
      toast.registered(fqdn);
      setDomainName('');
      setCheck('idle');
      setCheckMsg('');
    } catch (error) {
      console.error('Error registering domain: ', error);
      toast.error('Registration failed', (error as Error).message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('register')}</h1>
      </div>

      <div className={styles.registerWide}>
        {/* Flat input row — no card box */}
        <div className={styles.registerRow}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="your-name"
            aria-label="Identity name"
            value={domainName}
            onChange={(e) => { setDomainName(e.target.value); setCheck('idle'); setCheckMsg(''); }}
          />
          <select
            className={styles.compactSelect}
            aria-label="Domain extension"
            value={extension}
            onChange={(e) => { setExtension(e.target.value); setCheck('idle'); setCheckMsg(''); }}
          >
            {EXTENSIONS.map((ext) => (
              <option key={ext.name} value={ext.name} disabled={!ext.active}>
                {ext.name.replace('.eu.org', '')}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.checkButton}
            onClick={handleCheck}
            disabled={check === 'checking' || !domainName}
          >
            {check === 'checking' ? 'Checking…' : 'Check availability'}
          </button>
        </div>

        {/* Policy acknowledgements — flat, directly under the input box */}
        <div className={styles.ackList}>
          {ACK_ITEMS.map((text, i) => (
            <label key={i} className={styles.ackItem}>
              <input
                type="checkbox"
                checked={acks[i]}
                onChange={() => setAcks(a => a.map((v, j) => (j === i ? !v : v)))}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>

        {checkMsg && (
          <div className={`${styles.resultLine} ${check === 'available' ? styles.resultOk : styles.resultBad}`}>
            {checkMsg}
          </div>
        )}

        {check === 'available' && (
          <button
            className={styles.buttonPrimary}
            onClick={handleRegister}
            disabled={loading || !allAcked}
          >
            {loading ? 'Processing...' : allAcked ? `Register ${fqdn}` : 'Accept the policies above to register'}
          </button>
        )}
      </div>
    </div>
  );
};