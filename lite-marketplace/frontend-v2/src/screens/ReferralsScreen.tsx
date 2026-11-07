import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { Copy, Check, Gem, TrendingUp, Users } from 'lucide-react';
import { db } from '../firebase';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useProfile, getTier, REWARD_PER_INVITE } from '../services/profile';

interface ReferralsProps {
  user: User;
}

interface InvitationRecord {
  newUid: string;
  newEmail?: string;
  createdAt?: unknown;
}

/**
 * Capture an incoming ?ref=<inviterUid> URL param:
 * the FIRST time this (new) user signs in, record the invitation.
 * The Cloud Function (functions/index.js) then awards points to both
 * sides server-side so points can't be faked from the client.
 */
async function captureReferralCode(user: User) {
  const params = new URLSearchParams(window.location.search);
  const inviterId = params.get('ref');
  if (!inviterId || inviterId === user.uid) return;

  // invitation doc is keyed by the new user — one-time only
  const inviteRef = doc(db, 'invitations', user.uid);
  const snap = await getDoc(inviteRef);
  if (snap.exists()) return;
  await setDoc(inviteRef, {
    inviterId,
    newUid: user.uid,
    newEmail: user.email ?? '',
    createdAt: serverTimestamp(),
  });

  // clean the URL so refreshing doesn't produce confusing UX
  params.delete('ref');
  const qs = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

export const ReferralsScreen: React.FC<ReferralsProps> = ({ user }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const { profile } = useProfile(user.uid);
  const [invites, setInvites] = useState<InvitationRecord[]>([]);

  useEffect(() => {
    captureReferralCode(user).catch(() => { /* referral capture is best-effort */ });
  }, [user]);

  useEffect(() => {
    const q = query(
      collection(db, 'invitations'),
      where('inviterId', '==', user.uid),
    );
    return onSnapshot(q, (snap) => {
      setInvites(snap.docs.map((d) => d.data() as InvitationRecord));
    }, () => { /* ignore listener errors */ });
  }, [user.uid]);

  const points = profile?.points ?? 0;
  const tier = getTier(points);
  const invitedCount = profile?.invites ?? invites.length;

  // Generate referral link (full uid keeps it globally unique)
  const referralCode = user.uid;
  const referralLink = `https://esocialzdomains.eu.org/signup?ref=${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const next = tier.next;

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
          <div className={styles.statLabel}>
            <Users size={16} /> {t('peopleInvited')}
          </div>
          <div className={styles.statVal}>{invitedCount}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <Gem size={16} /> {t('pointsBalance')}
          </div>
          <div className={styles.statVal}>{points.toLocaleString()}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <TrendingUp size={16} /> {t(tier.nameKey as Parameters<typeof t>[0])}
          </div>
          <div className={styles.statVal}>
            {next ? `${tier.progress}%` : 'MAX'}
          </div>
          <p className={styles.subText}>
            {next
              ? `${(REWARD_PER_INVITE)} pts · ${t('nextTier')}: ${t(next.nameKey as Parameters<typeof t>[0])} (${next.minPoints.toLocaleString()})`
              : t('maxTier')}
          </p>
        </div>
      </div>

      {invites.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <Users size={16} /> {t('referralHistory')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invites.map((inv) => (
              <div key={inv.newUid} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '10px',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {inv.newEmail || `${inv.newUid.slice(0, 8)}…`}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>+{REWARD_PER_INVITE} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
