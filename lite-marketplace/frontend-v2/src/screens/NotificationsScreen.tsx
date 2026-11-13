import React from 'react';
import {
  Bell,
  CheckCircle2,
  Globe2,
  Wallet,
  ShieldCheck,
  KeyRound,
  Users,
  ChevronRight,
} from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationsProps {
  setScreen: (screen: string) => void;
}

/* A notification: clicking it jumps to the screen it belongs to */
interface NotificationItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  time: string;
  target: string;
  accent?: string;
}

const SYSTEM: NotificationItem[] = [
  {
    id: 'sys-check',
    icon: <CheckCircle2 size={18} />,
    title: 'System check complete',
    message: 'All nameservers and zones passed their scheduled health check.',
    time: 'Today, 09:50',
    target: 'dashboard',
    accent: '#22c55e',
  },
  {
    id: 'registry',
    icon: <Globe2 size={18} />,
    title: 'Domain registry updated',
    message: 'Registry data was refreshed — delegation status may have changed.',
    time: 'Today, 09:50',
    target: 'domain-list',
    accent: '#0ea5e9',
  },
];

const DOMAIN: NotificationItem[] = [
  {
    id: 'delegation',
    icon: <Globe2 size={18} />,
    title: 'Delegation status: PENDING',
    message: 'esocialzdomains.eu.org is awaiting eu.org approval. Check back later.',
    time: 'Today, 09:50',
    target: 'domain-list',
    accent: '#f59e0b',
  },
];

const ACCOUNT: NotificationItem[] = [
  {
    id: 'wallet',
    icon: <Wallet size={18} />,
    title: 'Wallet balance',
    message: 'Top up or withdraw credits from your account wallet.',
    time: 'This week',
    target: 'account',
    accent: '#22c55e',
  },
  {
    id: 'twofa',
    icon: <ShieldCheck size={18} />,
    title: 'Two-factor authentication',
    message: 'Add a second verification step to protect your account.',
    time: 'This week',
    target: 'account',
    accent: '#0ea5e9',
  },
  {
    id: 'signin',
    icon: <KeyRound size={18} />,
    title: 'Password & sign-in methods',
    message: 'Manage your password and connected Google / GitHub accounts.',
    time: 'This week',
    target: 'account',
    accent: '#8b5cf6',
  },
  {
    id: 'apikeys',
    icon: <KeyRound size={18} />,
    title: 'API keys',
    message: 'Create, copy or revoke the keys that access your EDES DNS zone.',
    time: 'This week',
    target: 'api-keys',
    accent: '#8b5cf6',
  },
  {
    id: 'referrals',
    icon: <Users size={18} />,
    title: 'Referrals & creator program',
    message: 'Invite people to earn points — track your tier progress.',
    time: 'This week',
    target: 'referrals',
    accent: '#f59e0b',
  },
];

const Row: React.FC<{ item: NotificationItem; onClick: () => void }> = ({ item, onClick }) => (
  <button
    onClick={onClick}
    title={`Go to ${item.target.replace('-', ' ')}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      padding: '14px 8px',
      borderBottom: '1px solid #cbd5e1',
      background: 'transparent',
      border: 'none',
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: '#cbd5e1',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left',
    }}
  >
    <span style={{ color: item.accent, flexShrink: 0, display: 'inline-flex' }}>{item.icon}</span>
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.message}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>{item.time}</span>
    </span>
    <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '22px 0 4px' }}>
    {children}
  </div>
);

export const NotificationsScreen: React.FC<NotificationsProps> = ({ setScreen }) => {
  const { t } = useLanguage();
  const go = (target: string) => setScreen(target);

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Bell size={22} style={{ color: 'var(--accent-primary)' }} />
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>{t('notifications')}</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
        Click any notification to jump to the section it belongs to.
      </p>

      <SectionTitle>System</SectionTitle>
      {SYSTEM.map(n => <Row key={n.id} item={n} onClick={() => go(n.target)} />)}

      <SectionTitle>Domains</SectionTitle>
      {DOMAIN.map(n => <Row key={n.id} item={n} onClick={() => go(n.target)} />)}

      <SectionTitle>Account & security</SectionTitle>
      {ACCOUNT.map(n => <Row key={n.id} item={n} onClick={() => go(n.target)} />)}
    </div>
  );
};
