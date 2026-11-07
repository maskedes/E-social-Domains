import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    OAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase";
import styles from './AuthScreen.module.css';

/* ── Brand icons (inline SVG) ─────────────────────────────────────── */

const GoogleIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

const AppleIcon: React.FC = () => (
    <svg viewBox="0 0 384 512" width="18" height="18" aria-hidden="true" fill="currentColor">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
);

const GitHubIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

/* ── Screen ───────────────────────────────────────────────────────── */

type Mode = 'signin' | 'signup';

export const AuthScreen: React.FC = () => {
    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const friendlyError = (err: any): string => {
        const code: string = err?.code || '';
        if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request'))
            return 'Sign-in window was closed before finishing.';
        if (code.includes('operation-not-allowed'))
            return 'This sign-in provider is not enabled yet. Enable it in the Firebase console (Authentication → Sign-in method).';
        if (code.includes('unauthorized-domain'))
            return 'This domain is not authorized in the Firebase console (Authentication → Settings → Authorized domains).';
        if (code.includes('account-exists-with-different-credential'))
            return 'An account already exists with the same email but a different sign-in method.';
        if (code.includes('invalid-email'))
            return 'Please enter a valid email address.';
        if (code.includes('weak-password'))
            return 'Password should be at least 6 characters.';
        if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
            return 'Incorrect email or password.';
        if (code.includes('email-already-in-use'))
            return 'An account with this email already exists. Try signing in instead.';
        if (code.includes('too-many-requests'))
            return 'Too many attempts. Please wait a moment and try again.';
        if (code.includes('network-request-failed'))
            return 'Network error. Check your connection and try again.';
        return err?.message || 'Something went wrong. Please try again.';
    };

    const handleEmailAuth = async () => {
        if (!email || !pass) {
            setError('Please enter your email and password.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            if (mode === 'signin') {
                await signInWithEmailAndPassword(auth, email, pass);
            } else {
                await createUserWithEmailAndPassword(auth, email, pass);
            }
        } catch (err: any) {
            setError(friendlyError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleSocial = async (
        provider: GoogleAuthProvider | GithubAuthProvider | OAuthProvider,
        label: string
    ) => {
        setError(null);
        setLoading(true);
        try {
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(friendlyError(err));
        } finally {
            setLoading(false);
        }
    };

    const socials = [
        { label: 'Google', icon: <GoogleIcon />, btnClass: styles.googleBtn, disabledClass: styles.googleBtnDisabled, build: () => new GoogleAuthProvider() },
        { label: 'Apple', icon: <AppleIcon />, btnClass: styles.appleBtn, disabledClass: styles.appleBtnDisabled, build: () => new OAuthProvider('apple.com') },
        { label: 'GitHub', icon: <GitHubIcon />, btnClass: styles.githubBtn, disabledClass: styles.githubBtnDisabled, build: () => new GithubAuthProvider() },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.logoBadge} aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                            <ellipse cx="12" cy="12" rx="4.5" ry="10" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M2 12h20M4.5 6.5h15M4.5 17.5h15" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                    </div>
                    <h1 className={styles.title}>E-Social Domains</h1>
                    <p className={styles.subtitle}>
                        Your digital identity — <strong>free domains</strong> for everyone
                    </p>
                </div>

                <div className={styles.modeToggle} role="tablist" aria-label="Authentication mode">
                    <button
                        role="tab"
                        aria-selected={mode === 'signin'}
                        className={mode === 'signin' ? styles.tabActive : styles.tab}
                        onClick={() => { setMode('signin'); setError(null); }}
                    >
                        Sign In
                    </button>
                    <button
                        role="tab"
                        aria-selected={mode === 'signup'}
                        className={mode === 'signup' ? styles.tabActive : styles.tab}
                        onClick={() => { setMode('signup'); setError(null); }}
                    >
                        Create Account
                    </button>
                </div>

                {error && (
                    <div className={styles.errorBanner} role="alert">
                        {error}
                    </div>
                )}

                <form
                    className={styles.formGroup}
                    onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleEmailAuth(); }}
                >
                    <input
                        type="email"
                        placeholder="Email address"
                        className={styles.input}
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        aria-label="Email"
                        autoComplete="email"
                    />
                    <div className={styles.passwordWrap}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            className={styles.input}
                            value={pass}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPass(e.target.value)}
                            aria-label="Password"
                            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        />
                        <button
                            type="button"
                            className={styles.passwordToggle}
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                            title={showPassword ? 'Hide password' : 'Show password'}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <button
                        type="submit"
                        className={styles.buttonPrimary}
                        disabled={loading}
                    >
                        {loading
                            ? 'Please wait…'
                            : mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className={styles.divider}>or continue with</div>

                <div className={styles.socialGrid} role="group" aria-label="Social sign-in">
                    {socials.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            className={s.btnClass}
                            onClick={() => handleSocial(s.build(), s.label)}
                            disabled={loading}
                            aria-label={`Continue with ${s.label}`}
                            title={`Continue with ${s.label}`}
                        >
                            {s.icon}
                            <span>{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
