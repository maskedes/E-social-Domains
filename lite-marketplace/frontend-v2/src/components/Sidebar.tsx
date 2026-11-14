import React, { useState } from 'react';
import {
  Globe, LayoutDashboard, Gift, PlusCircle,
  Key, FileText, PenTool,
  User, LogOut
} from 'lucide-react';
import { auth } from '../firebase';
import styles from '../AppLayout.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  currentScreen: string;
  setScreen: (screen: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, setScreen }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'domain-list', label: t('domainList'), icon: Globe },
    { id: 'register', label: t('register'), icon: PlusCircle },
    { id: 'referrals', label: t('referrals'), icon: Gift },
    { id: 'creator', label: t('creator'), icon: PenTool },
    { id: 'api-keys', label: t('apiKeys'), icon: Key },
    { id: 'api-doc', label: t('apiDoc'), icon: FileText },
    { id: 'account', label: t('account'), icon: User },
  ];

  return (
    <div className={styles.sidebar}>
      <nav
        className={`${styles.sidebarPanel} ${styles.collapsed}`}
        aria-label="Main navigation"
        aria-expanded={false}
      >
        <div style={{ height: 8 }} aria-hidden="true" />

        <div className={styles.scrollNav}>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`${styles.navItem} ${currentScreen === item.id ? styles.active : ''}`}
              onClick={() => setScreen(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScreen(item.id); }}
            >
              <item.icon size={14} className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
            </div>
          ))}
          <div
            className={`${styles.navItem} ${styles.logout}`}
            onClick={() => auth.signOut()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') auth.signOut(); }}
          >
            <LogOut size={14} className={styles.navIcon} />
            <span className={styles.navLabel}>{t('logout')}</span>
          </div>
        </div>
      </nav>
    </div>
  );
};
