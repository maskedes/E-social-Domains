import { 
  LayoutDashboard, Globe, Gift, PlusCircle, CreditCard, 
  ShoppingCart, Coins, Search, Key, FileText, PenTool, 
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
    { id: 'referrals', label: t('referrals'), icon: Gift },
    { id: 'register', label: t('register'), icon: PlusCircle },
    { id: 'subscriptions', label: t('subscriptions'), icon: CreditCard },
    { id: 'buy-slots', label: t('buySlots'), icon: ShoppingCart },
    { id: 'credits', label: t('credits'), icon: Coins },
    { id: 'whois', label: t('whois'), icon: Search },
    { id: 'api-keys', label: t('apiKeys'), icon: Key },
    { id: 'api-doc', label: t('apiDoc'), icon: FileText },
    { id: 'creator', label: t('creator'), icon: PenTool },
    { id: 'account', label: t('account'), icon: User },
  ];

  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>{t('welcomeTitle')}</div>
      <div className={styles.scrollNav}>
        {navItems.map((item) => (
          <div 
            key={item.id}
            className={`${styles.navItem} ${currentScreen === item.id ? styles.active : ''}`}
            onClick={() => setScreen(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </div>
        ))}
        <div className={`${styles.navItem} ${styles.logout}`} onClick={() => auth.signOut()}>
          <LogOut size={20} />
          <span>{t('logout')}</span>
        </div>
      </div>
    </nav>
  );
};
