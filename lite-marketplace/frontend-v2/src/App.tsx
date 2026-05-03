import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AuthScreen } from './screens/AuthScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { WhoisScreen } from './screens/WhoisScreen';
import { ReferralsScreen } from './screens/ReferralsScreen';
import { DomainListScreen } from './screens/DomainListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import styles from './AppLayout.module.css';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('register');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className={styles.loading}>{t('initializing')}</div>;
  if (!user) return <AuthScreen />;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <DashboardScreen user={user} />;
      case 'register': return <RegisterScreen user={user} />;
      case 'whois': return <WhoisScreen />;
      case 'referrals': return <ReferralsScreen user={user} />;
      case 'domain-list': return <DomainListScreen user={user} />;
      case 'settings': return <SettingsScreen />;
      case 'account': return <AccountScreen user={user} setScreen={setCurrentScreen} />;
      case 'edit-profile': return <EditProfileScreen user={user} setScreen={setCurrentScreen} />;
      default: return <div><h1>{currentScreen.replace('-', ' ')}</h1><p>Module coming soon...</p></div>;
    }
  };

  return (
    <div className={styles.appContainer}>
      <Sidebar currentScreen={currentScreen} setScreen={setCurrentScreen} />
      <div className={styles.contentWrapper}>
        <TopNav user={user} setScreen={setCurrentScreen} />
        <main className={styles.mainContent}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
};

export default App;
