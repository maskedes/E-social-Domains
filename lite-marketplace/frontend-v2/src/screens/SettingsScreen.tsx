import React, { useState } from 'react';
import { Settings, Bell, Globe, Moon, Mail, Smartphone, BarChart3 } from 'lucide-react';
import styles from './Screens.module.css';
import { useLanguage } from '../contexts/LanguageContext';

export const SettingsScreen: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(true);

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('settings')}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Preferences Card */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
            {t('preferences')}
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.statLabel}>
              <Globe size={14} style={{ marginRight: '6px' }} />
              Language
            </label>
            <select 
              className={styles.select} 
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'fr')}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.statLabel}>
              <Moon size={14} style={{ marginRight: '6px' }} />
              {t('timezone')}
            </label>
            <select className={styles.select}>
              <option>UTC (London)</option>
              <option>EST (New York)</option>
              <option>PST (Los Angeles)</option>
              <option>WAT (Lagos)</option>
            </select>
          </div>
        </div>

        {/* Notifications Card */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Bell size={20} style={{ color: 'var(--accent-primary)' }} />
            {t('notificationSettings')}
          </div>

          <div className={styles.toggleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{t('emailNotif')}</div>
                <div className={styles.subText} style={{ fontSize: '12px' }}>Weekly digests and domain updates.</div>
              </div>
            </div>
            <label className={styles.toggle}>
              <input 
                type="checkbox" 
                className={styles.toggleInput} 
                checked={emailNotif}
                onChange={() => setEmailNotif(!emailNotif)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <div className={styles.toggleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Smartphone size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{t('pushNotif')}</div>
                <div className={styles.subText} style={{ fontSize: '12px' }}>Browser notifications for urgent actions.</div>
              </div>
            </div>
            <label className={styles.toggle}>
              <input 
                type="checkbox" 
                className={styles.toggleInput} 
                checked={pushNotif}
                onChange={() => setPushNotif(!pushNotif)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>

          <div className={styles.toggleRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart3 size={18} style={{ color: 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{t('weeklyReports')}</div>
                <div className={styles.subText} style={{ fontSize: '12px' }}>Summarized reports on domain performance.</div>
              </div>
            </div>
            <label className={styles.toggle}>
              <input 
                type="checkbox" 
                className={styles.toggleInput} 
                checked={weeklyReports}
                onChange={() => setWeeklyReports(!weeklyReports)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
