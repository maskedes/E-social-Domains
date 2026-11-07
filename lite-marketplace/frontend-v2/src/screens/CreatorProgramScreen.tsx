import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  PenTool, Megaphone, FlaskConical, Languages, HeartHandshake,
  ShieldCheck, Coins, Gem, Star, Users,
} from 'lucide-react';
import styles from './CreatorProgram.module.css';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useProfile,
  applyToProgram,
  applyToModerator,
  getMyApplications,
  getTier,
  PROGRAMS,
  MODERATOR_POSITIONS,
  REWARD_PER_INVITE,
  ProgramId,
} from '../services/profile';

const PROGRAM_ICONS: Record<string, React.ReactNode> = {
  creator: <PenTool size={19} />,
  ambassador: <Megaphone size={19} />,
  'beta-tester': <FlaskConical size={19} />,
  translator: <Languages size={19} />,
  'community-support': <HeartHandshake size={19} />,
};

export const CreatorProgramScreen: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useLanguage();
  const { profile } = useProfile(user.uid);
  const [applied, setApplied] = useState<{ programIds: Set<string>; moderatorIds: Set<string> }>({
    programIds: new Set(),
    moderatorIds: new Set(),
  });

  const [modal, setModal] = useState<
    | { kind: 'program'; id: ProgramId; title: string }
    | { kind: 'moderator'; id: string; title: string }
    | null
  >();
  const [motivation, setMotivation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const points = profile?.points ?? 0;
  const tier = getTier(points);

  useEffect(() => {
    let cancelled = false;
    getMyApplications(user.uid).then((res) => {
      if (!cancelled) setApplied(res);
    }).catch(() => { /* not fatal */ });
    return () => { cancelled = true; };
  }, [user.uid]);

  const openModal = (m: NonNullable<typeof modal>) => {
    setModal(m);
    setMotivation('');
    setModalError(null);
  };

  const submitApplication = async () => {
    if (!modal) return;
    if (motivation.trim().length < 20) {
      setModalError(t('appTooShort'));
      return;
    }
    setSubmitting(true);
    try {
      if (modal.kind === 'program') {
        await applyToProgram(user, modal.id as ProgramId, motivation.trim());
      } else {
        await applyToModerator(user, modal.id, motivation.trim());
      }
      setApplied((prev) => {
        if (modal.kind === 'program') {
          return { ...prev, programIds: new Set(prev.programIds).add(modal.id) };
        }
        return { ...prev, moderatorIds: new Set(prev.moderatorIds).add(modal.id) };
      });
      setModal(null);
    } catch (err) {
      setModalError(t('applyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.screen}>
      {/* ── Points & tier overview ─────────────────────────────── */}
      <div className={styles.pointsCard}>
        <div className={styles.pointsBalance}>
          <div className={styles.pointsValue}>{points.toLocaleString()}</div>
          <div className={styles.pointsLabel}><Gem size={12} /> {t('pointsBalance')}</div>
        </div>

        <div className={styles.inviteStat}>
          <div className={styles.inviteStatValue}>{profile?.invites ?? 0}</div>
          <div className={styles.pointsLabel}><Users size={12} /> {t('peopleInvited')}</div>
        </div>

        <div className={styles.tierBox}>
          <div className={styles.tierRow}>
            <span className={styles.tierName}>
              <Star size={13} /> {t(tier.nameKey as Parameters<typeof t>[0])}
            </span>
            <span className={styles.tierNext}>
              {tier.next
                ? `${t('nextTier')}: ${t(tier.next.nameKey as Parameters<typeof t>[0])} — ${tier.next.minPoints.toLocaleString()} pts`
                : t('maxTier')}
            </span>
          </div>
          <div className={styles.tierBar}>
            <div className={styles.tierBarFill} style={{ width: `${tier.progress}%` }} />
          </div>
        </div>
      </div>

      {/* ── How to earn points ─────────────────────────────────── */}
      <h2 className={styles.sectionTitle}><Gem size={16} /> {t('earnTitle')}</h2>
      <div className={styles.earnList}>
        <div className={styles.earnItem}>
          <Coins size={16} />
          {t('earnInvite')}
          <span className={styles.earnPts}>+{REWARD_PER_INVITE}</span>
        </div>
        <div className={styles.earnItem}>
          <PenTool size={16} />
          {t('earnContent')}
          <span className={styles.earnPts}>+100</span>
        </div>
        <div className={styles.earnItem}>
          <ShieldCheck size={16} />
          {t('earnModerate')}
          <span className={styles.earnPts}>+100–200<span style={{ fontWeight: 500, textTransform: 'none' }}> /{t('perWeek')}</span></span>
        </div>
      </div>

      {/* ── More programs ──────────────────────────────────────── */}
      <h2 className={styles.sectionTitle}><HeartHandshake size={16} /> {t('programsTitle')}</h2>
      <div className={styles.programGrid}>
        {PROGRAMS.map((p) => (
          <div className={styles.programCard} key={p.id}>
            <div className={styles.programHead}>
              <div className={styles.programIcon}>{PROGRAM_ICONS[p.id]}</div>
              <div className={styles.programTitle}>{t(p.titleKey as Parameters<typeof t>[0])}</div>
            </div>
            <p className={styles.programDesc}>{t(p.descKey as Parameters<typeof t>[0])}</p>
            <div className={styles.programReward}>
              {t(p.reward as Parameters<typeof t>[0])} · +{p.points} {t('onApproval')}
            </div>
            {applied.programIds.has(p.id) || profile?.programs?.includes(p.id) ? (
              <div className={styles.joinedBtn}>{t('applicationSent')}</div>
            ) : (
              <button
                className={styles.joinBtn}
                onClick={() => openModal({ kind: 'program', id: p.id, title: t(p.titleKey as Parameters<typeof t>[0]) })}
              >
                {t('joinProgram')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Moderator positions ────────────────────────────────── */}
      <h2 className={styles.sectionTitle}><ShieldCheck size={16} /> {t('moderatorPositionsTitle')}</h2>
      <div className={styles.modTable}>
        <div className={`${styles.modRow} ${styles.modHead}`}>
          <span>{t('modPositionCol')}</span>
          <span>{t('modTeamCol')}</span>
          <span>{t('modSeatsCol')}</span>
          <span>{t('modRewardCol')}</span>
        </div>
        {MODERATOR_POSITIONS.map((m) => (
          <div className={styles.modRow} key={m.id}>
            <span className={styles.modTitle}>{t(m.titleKey as Parameters<typeof t>[0])}</span>
            <span className={styles.modTeam}>{t(m.teamKey as Parameters<typeof t>[0])}</span>
            <span className={styles.modSeats}>{m.seats} {t('seatsOpen')}</span>
            <span className={styles.modPoints}>
              +{m.pointsPerWeek} <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>/{t('perWeek')}</span>
            </span>
            {applied.moderatorIds.has(m.id) || profile?.moderatorRoles?.includes(m.id) ? (
              <div className={styles.joinedBtn}>{t('applicationSent')}</div>
            ) : (
              <button
                className={styles.joinBtn}
                onClick={() => openModal({ kind: 'moderator', id: m.id, title: t(m.titleKey as Parameters<typeof t>[0]) })}
              >
                {t('applyNow')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Application modal ──────────────────────────────────── */}
      {modal && (
        <div className={styles.modalBackdrop} onClick={() => !submitting && setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{modal.kind === 'program' ? t('joinProgram') : t('applyNow')}: {modal.title}</h3>
            <p className={styles.modalDesc}>
              {modal.kind === 'program' ? t('applyProgramPrompt') : t('applyModeratorPrompt')}
            </p>
            <textarea
              className={styles.modalTextarea}
              value={motivation}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotivation(e.target.value)}
              placeholder={t('motivationPlaceholder')}
              maxLength={1000}
            />
            {modalError && <p className={styles.modalError}>{modalError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => !submitting && setModal(null)}>
                {t('cancel')}
              </button>
              <button className={styles.joinBtn} onClick={submitApplication} disabled={submitting}>
                {submitting ? t('submitting') : t('submitApplication')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
