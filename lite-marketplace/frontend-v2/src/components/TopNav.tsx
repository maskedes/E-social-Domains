import React, { useState, useEffect } from 'react';
import { Search, Globe, Bell, Moon, Sun, ChevronDown, User as UserIcon, Settings, LogOut } from 'lucide-react';
import styles from '../AppLayout.module.css';
import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';

interface TopNavProps {
  user: User | null;
  setScreen: (screen: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({ user, setScreen }) => {
  const { t, language, setLanguage } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Extract initials and name from user, or use defaults
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Mask Edes';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'ME';

  // Handle theme toggle
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const handleLangChange = (lang: 'en' | 'fr') => {
    setLanguage(lang);
    setActiveDropdown(null);
  };

  const navigateTo = (screen: string) => {
    setScreen(screen);
    setActiveDropdown(null);
  };

  return (
    <header className={styles.topNav}>
      <div className={styles.topNavLeft}>
        <div style={{ marginRight: '24px', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('welcomeTitle')}
          </h1>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <em><strong>{t('freeDomains')}</strong></em>
          </span>
        </div>
        <div className={styles.topNavSearch}>
          <Search size={16} className={styles.iconColor} />
          <input 
            type="text" 
            placeholder={t('search')} 
            className={styles.topNavInput} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className={styles.cmdBadge}>Cmd+K</div>
        </div>
      </div>
      <div className={styles.topNavRight}>
        {/* Language Dropdown */}
        <div style={{ position: 'relative' }}>
          <button className={styles.topNavBtn} onClick={(e) => toggleDropdown(e, 'lang')}>
            <Globe size={18} />
            <span>{language === 'en' ? 'English' : 'Français'}</span>
            <ChevronDown size={14} />
          </button>
          {activeDropdown === 'lang' && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownItem} onClick={() => handleLangChange('en')}>English</div>
              <div className={styles.dropdownItem} onClick={() => handleLangChange('fr')}>Français</div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button className={styles.topNavIconBtn} onClick={(e) => toggleDropdown(e, 'notif')}>
            <Bell size={18} />
            <div className={styles.notifBadge} />
          </button>
          {activeDropdown === 'notif' && (
            <div className={styles.dropdownMenu} style={{ width: '240px', right: 0 }}>
              <div className={styles.dropdownHeader}>{t('notifications')}</div>
              <div className={styles.dropdownItem}>System check complete</div>
              <div className={styles.dropdownItem}>Domain registry updated</div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button className={styles.topNavIconBtn} onClick={toggleTheme}>
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <button className={styles.topNavProfile} onClick={(e) => toggleDropdown(e, 'profile')}>
            <div className={styles.avatar}>{initials}</div>
            <span>{displayName}</span>
            <ChevronDown size={14} />
          </button>
          {activeDropdown === 'profile' && (
            <div className={styles.dropdownMenu} style={{ right: 0 }}>
              <div className={styles.dropdownItem} onClick={() => navigateTo('account')}>
                <UserIcon size={16} /> {t('myProfile')}
              </div>
              <div className={styles.dropdownItem} onClick={() => navigateTo('settings')}>
                <Settings size={16} /> {t('settings')}
              </div>
              <div className={styles.dividerSmall} />
              <div className={styles.dropdownItem} style={{ color: '#ef4444' }} onClick={() => auth.signOut()}>
                <LogOut size={16} /> {t('logout')}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
