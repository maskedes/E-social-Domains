import React, { useRef, useState } from 'react';
import { updateProfile, User as FirebaseUser } from 'firebase/auth';
import { User, ShieldCheck, ArrowLeft, Camera, ImageDown, Trash2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import styles from './Screens.module.css';
import pf from './EditProfile.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';

interface EditProfileProps {
  user: FirebaseUser | null;
  setScreen: (screen: string) => void;
}

/** Center-crops any image file into a square 256px JPEG data URL. */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  const s = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Persists the photoURL in the users/{uid} Firestore doc as well. */
export async function savePhotoToProfile(uid: string, photoURL: string) {
  await setDoc(doc(db, 'users', uid), { photoURL }, { merge: true });
}

export const EditProfileScreen: React.FC<EditProfileProps> = ({ user, setScreen }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user?.photoURL || '');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // original photo from the linked Google account (providerData never changes)
  const googlePhoto =
    user?.providerData.find((p) => p.providerId.includes('google'))?.photoURL || '';

  const initials = (user?.displayName || user?.email?.split('@')[0] || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const applyPhoto = async (url: string) => {
    if (!user) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await updateProfile(user, { photoURL: url });
      await savePhotoToProfile(user.uid, url);
      setPhotoUrl(url);
    } catch (err) {
      setPhotoError(t('updateError'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(t('photoNotImage'));
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await applyPhoto(dataUrl);
    } catch (err) {
      setPhotoError(t('photoInvalid'));
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName });
      toast.updated(t('updateSuccess'));
      setScreen('account');
    } catch (error) {
      console.error(error);
      toast.error(t('updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.pageHeader}>
        <button
          onClick={() => setScreen('account')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '12px', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back to Account
        </button>
        <h1 className={styles.pageTitle}>{t('editProfile')}</h1>
      </div>

      <div className={styles.centeredProfile}>
        {/* ── Profile picture ───────────────────────────────────── */}
        <div className={pf.photoSection}>
          <div className={pf.avatarWrap}>
            {photoUrl ? (
              <img src={photoUrl} alt="avatar" className={pf.avatarImg} />
            ) : (
              <div className={pf.avatarInitials}>{initials}</div>
            )}
            <span className={pf.cameraBadge}>
              <Camera size={13} />
            </span>
          </div>

          <div className={pf.photoActions}>
            <div className={pf.photoTitle}>{t('profilePicture')}</div>
            <div className={pf.photoBtns}>
              {googlePhoto && (
                <button
                  className={pf.photoBtn}
                  onClick={() => applyPhoto(googlePhoto)}
                  disabled={photoBusy || photoUrl === googlePhoto}
                  title={t('useGooglePhoto')}
                >
                  <ImageDown size={14} /> {t('useGooglePhoto')}
                </button>
              )}
              <button
                className={pf.photoBtn}
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                <Camera size={14} /> {t('uploadPhoto')}
              </button>
              {photoUrl && (
                <button
                  className={`${pf.photoBtn} ${pf.photoBtnDanger}`}
                  onClick={() => applyPhoto('')}
                  disabled={photoBusy}
                >
                  <Trash2 size={14} /> {t('removePhoto')}
                </button>
              )}
            </div>
            {photoBusy && <div className={pf.photoHint}>{t('saving')}</div>}
            {photoError && <div className={pf.photoError}>{photoError}</div>}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePickFile}
        />

        <div className={styles.cardTitle}>
          <ShieldCheck size={20} style={{ color: 'var(--accent-primary)' }} />
          {t('profileDetails')}
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>
            <User size={14} style={{ marginRight: '6px' }} />
            {t('fullName')}
          </label>
          <input
            type="text"
            className={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your Name"
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.statLabel}>Email (Read-only)</label>
          <input
            type="text"
            className={styles.input}
            value={user?.email || ''}
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
        </div>

        <div className={styles.divider} />

        <button
          className={styles.buttonPrimary}
          style={{ width: 'auto', padding: '12px 32px', marginTop: '24px' }}
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? 'Saving...' : t('saveChanges')}
        </button>
      </div>
    </div>
  );
};
