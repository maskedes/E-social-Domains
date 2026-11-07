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
import { DomainSettingsScreen } from './screens/DomainSettingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { CreatorProgramScreen } from './screens/CreatorProgramScreen';
import { LanguageProvider } from './contexts/LanguageProvider';
import { useLanguage } from './contexts/LanguageContext';
import { ToastProvider } from './components/Toast';
import { ComingSoonScreen } from './screens/ComingSoonScreen';
import { ApiKeysScreen } from './screens/ApiKeysScreen';
import { ensureProfile } from './services/profile';
import styles from './AppLayout.module.css';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </LanguageProvider>
  );
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('register');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // make sure every signed-in user has a profile doc with points
        ensureProfile(u).catch(() => { /* profile creation can be retried later */ });
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className={styles.loading}>{t('initializing')}</div>;
  if (!user) return <AuthScreen />;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <DashboardScreen user={user} onNavigate={setCurrentScreen} />;
      case 'register': return <RegisterScreen user={user} />;
      case 'whois': return <WhoisScreen />;
      case 'referrals': return <ReferralsScreen user={user} />;
      case 'domain-list': return <DomainListScreen user={user} onOpenSettings={(d) => { setSelectedDomain(d); setCurrentScreen('domain-settings'); }} />;
      case 'domain-settings': return <DomainSettingsScreen domain={selectedDomain} onBack={() => setCurrentScreen('domain-list')} />;
      case 'settings': return <SettingsScreen user={user} />;
      case 'account': return <AccountScreen user={user} setScreen={setCurrentScreen} />;
      case 'edit-profile': return <EditProfileScreen user={user} setScreen={setCurrentScreen} />;
      case 'subscriptions': return <ComingSoonScreen title={t('subscriptions')} />;
      case 'buy-slots': return <ComingSoonScreen title={t('buySlots')} />;
      case 'credits': return <ComingSoonScreen title={t('credits')} />;
      case 'api-keys': return <ApiKeysScreen user={user} />;
      case 'api-doc': return <ComingSoonScreen title={t('apiDoc')} description="Interactive API documentation with Swagger UI will be available here." />;
      case 'creator': return <CreatorProgramScreen user={user} />;
      default: return <ComingSoonScreen title={currentScreen.replace('-', ' ')} />;
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
