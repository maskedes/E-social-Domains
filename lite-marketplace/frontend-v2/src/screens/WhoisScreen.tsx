import React, { useState } from 'react';
import { Search, ArrowRight, Database } from 'lucide-react';
import styles from './Screens.module.css';

export const WhoisScreen: React.FC = () => {
    const [domain, setDomain] = useState('');

    return (
        <div className={styles.screen}>
            <div className={styles.pageHeader}>
                <div className={styles.topBarLabel}>WHOIS LOOKUP</div>
                <h1 className={styles.pageTitle}>WHOIS Lookup</h1>
                <p className={styles.subText}>Parsed WHOIS record from the live registry.</p>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>WHOIS Lookup</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            className={styles.input} 
                            placeholder="example.us.kg, foo.dpdns.org..." 
                            style={{ paddingLeft: '48px' }}
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                        />
                    </div>
                    <button className={styles.buttonInline} style={{ height: '54px' }}>
                        Lookup <ArrowRight size={18} />
                    </button>
                </div>
                <p className={styles.infoText} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Queries like <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>whois example.dpdns.org</code> may not work directly.
                    <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>whois example.dpdns.org</code>
                </p>
            </div>

            <div className={styles.card}>
                <p className={styles.infoText}>
                    Until mainstream WHOIS clients support this, please manually specify the WHOIS server. For RFC 1036 clients, use the <strong>-h</strong> flag like this: <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>-h</code>
                </p>
                <div className={styles.codeBlock}>
                    whois -h whois.digitalplat.org "domainname"
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardTitle}>
                    <Database size={20} style={{ color: '#64748b' }} /> RDAP Server
                </div>
                <p className={styles.infoText}>
                    RDAP provides structured domain registration data over HTTPS. Use it when you need JSON output for scripts, automation, or integrations.
                </p>
                
                <div className={styles.iconLabel}>Server</div>
                <div className={styles.codeBlock}>https://rdap.digitalplat.org</div>

                <div className={styles.iconLabel}>Browser Usage</div>
                <div className={styles.codeBlock}>https://rdap.digitalplat.org/domain/domainname</div>

                <div className={styles.iconLabel}>Command Line</div>
                <div className={styles.codeBlock}>curl https://rdap.digitalplat.org/domain/domainname</div>

                <p className={styles.subText} style={{ marginTop: '24px', fontSize: '12px' }}>
                    Replace <code style={{ fontStyle: 'italic' }}>domainname</code> with your full domain, for example <code style={{ fontStyle: 'italic' }}>example.us.kg</code>.
                </p>
            </div>
        </div>
    );
};
