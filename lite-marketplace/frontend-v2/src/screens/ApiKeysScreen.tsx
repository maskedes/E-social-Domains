import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { KeyRound, Copy, Check, Trash2, Plus, Eye, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import styles from './Screens.module.css';
import apiStyles from './ApiKeys.module.css';
import { useLanguage } from '../contexts/LanguageContext';

interface ApiKeysProps {
  user: User;
}

interface ApiKeyDoc {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  createdAt?: unknown;
  revoked?: boolean;
}

interface NewKey {
  id: string;
  name: string;
  fullKey: string;
  prefix: string;
}

/* ── Key generation ────────────────────────────────────────────── */

const randomBase64Url = (bytes: number) => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = '';
  buf.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const generateKey = async (uid: string, name: string): Promise<NewKey> => {
  const fullKey = `edes_sk_${randomBase64Url(30)}`;
  const keyHash = await sha256Hex(fullKey);
  const prefix = fullKey.slice(0, 16);
  const ref = await addDoc(collection(db, 'apiKeys'), {
    uid,
    name,
    prefix,
    keyHash,
    revoked: false,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name, fullKey, prefix };
};

/* ── Screen ────────────────────────────────────────────────────── */

export const ApiKeysScreen: React.FC<ApiKeysProps> = ({ user }) => {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<ApiKeyDoc[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'apiKeys'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setKeys(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ApiKeyDoc[]);
    }, () => setKeys([]));
    return unsub;
  }, [user.uid]);

  const handleCreate = async () => {
    if (!keyName.trim()) {
      setFormError(t('keyNameRequired'));
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const key = await generateKey(user.uid, keyName.trim().slice(0, 40));
      setNewKey(key);
      setShowForm(false);
      setKeyName('');
      setCopied(false);
      setRevealed(true);
    } catch (err) {
      setFormError(t('keyCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    await deleteDoc(doc(db, 'apiKeys', id));
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (id === 'new') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const activeKeys = (keys || []).filter((k) => !k.revoked);
  const loadingKeys = keys === null;

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('apiKeys')}</h1>
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loadingKeys && (
        <div className={styles.centeredEmpty}>
          <div className={styles.emptyIconBadge}><KeyRound size={28} /></div>
          <h2 className={styles.emptyTitle}>{t('loading')}</h2>
        </div>
      )}

      {/* ── Empty state: no API keys yet ────────────────────────── */}
      {!loadingKeys && keys!.length === 0 && (
        <div className={styles.centeredEmpty}>
          <div className={styles.emptyIconBadge}>
            <KeyRound size={30} />
          </div>
          <h2 className={styles.emptyTitle}>{t('noApiKeysYet')}</h2>
          <p className={styles.emptyText}>{t('noApiKeysDesc')}</p>
          <button className={apiStyles.generateBtn} onClick={() => { setShowForm(true); setFormError(null); }}>
            <Plus size={16} /> {t('generateApiKey')}
          </button>
        </div>
      )}

      {/* ── Keys list ───────────────────────────────────────────── */}
      {!loadingKeys && keys!.length > 0 && (
        <div className={apiStyles.keysSection}>
          <div className={apiStyles.keysHead}>
            <span className={apiStyles.keysCount}>
              {activeKeys.length} {t('activeKeys')}
            </span>
            <button className={apiStyles.generateBtnSmall} onClick={() => { setShowForm(true); setFormError(null); }}>
              <Plus size={15} /> {t('generateApiKey')}
            </button>
          </div>

          {activeKeys.map((key) => (
            <div className={apiStyles.keyRow} key={key.id}>
              <div className={apiStyles.keyIcon}><KeyRound size={16} /></div>
              <div className={apiStyles.keyInfo}>
                <div className={apiStyles.keyName}>{key.name}</div>
                <div className={apiStyles.keyFieldRow}>
                  <div className={styles.codeBlock} style={{ marginTop: 0, padding: '8px 12px', fontSize: 12, flex: 1 }}>
                    {key.prefix}••••••••••••••••••••••••
                  </div>
                  <button
                    className={apiStyles.iconBtn}
                    title={t('revealNote')}
                    onClick={() => copy(key.prefix, key.id)}
                    style={copiedKey === key.id ? { background: '#22c55e', borderColor: '#22c55e', color: '#fff' } : undefined}
                  >
                    {copiedKey === key.id ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                  <button className={apiStyles.iconBtnDanger} title={t('revokeKey')} onClick={() => deleteKey(key.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────── */}
      {showForm && (
        <div className={styles.centeredEmpty} style={{ minHeight: '40vh' }}>
          <h2 className={styles.emptyTitle}>{t('generateApiKey')}</h2>
          <p className={styles.emptyText}>{t('keyNameHint')}</p>
          <input
            type="text"
            className={styles.input}
            style={{ width: '320px', textAlign: 'center' }}
            placeholder={t('keyNamePlaceholder')}
            value={keyName}
            maxLength={40}
            onChange={(e) => setKeyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          {formError && <p className={apiStyles.formError}>{formError}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={apiStyles.generateBtn} onClick={handleCreate} disabled={creating}>
              {creating ? t('generating') : t('createKey')}
            </button>
            <button className={apiStyles.cancelBtn} onClick={() => setShowForm(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* ── One-time key reveal ─────────────────────────────────── */}
      {newKey && (
        <div className={apiStyles.modalBackdrop} onClick={() => setNewKey(null)}>
          <div className={apiStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={apiStyles.modalIcon}><ShieldCheck size={22} /></div>
            <h3 className={apiStyles.modalTitle}>{t('keyCreatedTitle')}</h3>
            <p className={apiStyles.modalText}>{t('keyCreatedWarning')}</p>
            <div className={apiStyles.keyReveal}>
              <code className={apiStyles.keyRevealText}>
                {revealed ? newKey.fullKey : `${newKey.prefix}${'•'.repeat(30)}`}
              </code>
              <button className={apiStyles.iconBtn} title={t('revealNote')} onClick={() => setRevealed((v) => !v)}>
                <Eye size={15} />
              </button>
              <button
                className={apiStyles.iconBtn}
                onClick={() => copy(newKey.fullKey, 'new')}
                style={copied ? { background: '#22c55e', borderColor: '#22c55e', color: '#fff' } : undefined}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <button className={apiStyles.doneBtn} onClick={() => setNewKey(null)}>{t('done')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
