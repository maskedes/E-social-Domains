import React, { useState } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup,
    signInAnonymously
} from "firebase/auth";
import { auth, providers } from "../firebase";
import styles from './AuthScreen.module.css';

const ProviderIcons = {
  google: (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" fill="#1877F2"/>
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1 1.8 1.8 1.3 2.2-.1.5-.3 1-.5 1.3-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.3.3.6.8.6 1.5v2.2c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 24c-2.8 0-4.6-1.5-6.5-1.5-1.9 0-3.7 1.4-6.3 1.5-1.3 0-4.3-.6-6.4-3.7-4.4-6.3-1-12.7 3.3-12.7 2.1 0 3.8 1.4 5.3 1.4 1.4 0 3.4-1.6 5.8-1.6 2.3 0 4.8 1 6.3 3.4-5.3 2.8-4.4 10.3 1 12.6-1.2 3-3.6 5.6-6.5 5.6C16 23.8 14 22.5 12 22.5S8.1 23.9 6 24M12.6 7.4c.5-2.2 2-4.1 3.8-4.6-.3-2.4-2.1-4.4-4.5-4.5-.4 2.4 1.3 4.8 3.7 5.1C12.8 5.7 12.7 6.6 12.6 7.4" transform="translate(4 -4)"/>
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00a4ef"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
};

export const AuthScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    const loginWith = async (name: keyof typeof providers) => {
        try { await signInWithPopup(auth, providers[name]); } catch(err: any) { alert(err.message); }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Domains on E-Socialz</h1>
                    <p className={styles.subtitle} style={{ fontSize: '13px' }}>
                        <em><strong>free domains</strong></em>
                    </p>
                </div>
                
                <div className={styles.formGroup}>
                    <input 
                        type="email" 
                        placeholder="Email address" 
                        className={styles.input}
                        value={email} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
                        aria-label="Email"
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        className={styles.input}
                        value={pass} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPass(e.target.value)} 
                        aria-label="Password"
                    />
                    <button 
                        className={styles.buttonPrimary} 
                        onClick={() => signInWithEmailAndPassword(auth, email, pass)}
                    >
                        Sign In
                    </button>
                    <button 
                        className={styles.buttonOutline} 
                        onClick={() => createUserWithEmailAndPassword(auth, email, pass)}
                    >
                        Create Account
                    </button>
                </div>
                
                <div className={styles.divider}>or continue with</div>
                
                <div className={styles.socialGrid}>
                    {(Object.keys(providers) as Array<keyof typeof providers>).map(p => (
                        <button key={p} className={styles.socialBtn} onClick={() => loginWith(p)} title={`Login with ${p}`}>
                            {ProviderIcons[p] || p}
                        </button>
                    ))}
                </div>
                
                <button 
                    className={styles.anonBtn} 
                    onClick={() => signInAnonymously(auth)}
                >
                    Browse anonymously
                </button>
            </div>
        </div>
    );
};

