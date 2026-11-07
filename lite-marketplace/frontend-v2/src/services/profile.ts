/**
 * Firestore-backed user profile & creator-program service.
 *
 * Collections used:
 *   users/{uid}                    — points, invites, role, tier
 *   programApplications/{uid_pr}   — applications for programs (creator, ambassador…)
 *   moderatorApplications/{uid_rl} — applications for moderator positions
 */
import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/* ── Types ─────────────────────────────────────────────────────── */

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  points: number;
  invites: number;
  bonusSlots: number;
  role: string;
  programs: string[];
  moderatorRoles: string[];
  createdAt?: unknown;
}

export type ProgramId =
  | 'creator'
  | 'ambassador'
  | 'beta-tester'
  | 'translator'
  | 'community-support';

export interface ProgramDefinition {
  id: ProgramId;
  titleKey: string;
  descKey: string;
  reward: string;
  points: number;
}

export const PROGRAMS: ProgramDefinition[] = [
  {
    id: 'creator',
    titleKey: 'programCreator',
    descKey: 'programCreatorDesc',
    reward: 'rewardCommunityTitle',
    points: 100,
  },
  {
    id: 'ambassador',
    titleKey: 'programAmbassador',
    descKey: 'programAmbassadorDesc',
    reward: 'rewardSwagTitle',
    points: 200,
  },
  {
    id: 'beta-tester',
    titleKey: 'programBetaTester',
    descKey: 'programBetaTesterDesc',
    reward: 'rewardEarlyTitle',
    points: 50,
  },
  {
    id: 'translator',
    titleKey: 'programTranslator',
    descKey: 'programTranslatorDesc',
    reward: 'rewardBadgeTitle',
    points: 75,
  },
  {
    id: 'community-support',
    titleKey: 'programSupport',
    descKey: 'programSupportDesc',
    reward: 'rewardPointsTitle',
    points: 80,
  },
];

export interface ModeratorPosition {
  id: string;
  titleKey: string;
  teamKey: string;
  seats: number;
  pointsPerWeek: number;
}

export const MODERATOR_POSITIONS: ModeratorPosition[] = [
  { id: 'community-moderator', titleKey: 'modCommunity', teamKey: 'modTeamCommunity', seats: 4, pointsPerWeek: 150 },
  { id: 'abuse-moderator', titleKey: 'modAbuse', teamKey: 'modTeamAbuse', seats: 2, pointsPerWeek: 200 },
  { id: 'forum-moderator', titleKey: 'modForum', teamKey: 'modTeamForum', seats: 3, pointsPerWeek: 100 },
  { id: 'marketplace-moderator', titleKey: 'modMarketplace', teamKey: 'modTeamMarketplace', seats: 2, pointsPerWeek: 175 },
];

/* ── Tier system ───────────────────────────────────────────────── */

export interface Tier {
  nameKey: string;
  minPoints: number;
}

const TIERS: Tier[] = [
  { nameKey: 'tierBronze', minPoints: 0 },
  { nameKey: 'tierSilver', minPoints: 500 },
  { nameKey: 'tierGold', minPoints: 2000 },
  { nameKey: 'tierPlatinum', minPoints: 5000 },
];

export function getTier(points: number): { nameKey: string; index: number; next: Tier | null; progress: number } {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].minPoints) index = i;
  }
  const next = index < TIERS.length - 1 ? TIERS[index + 1] : null;
  const progress = next
    ? Math.min(100, Math.round(((points - TIERS[index].minPoints) / (next.minPoints - TIERS[index].minPoints)) * 100))
    : 100;
  return { nameKey: TIERS[index].nameKey, index, next, progress };
}

/* ── Profile hooks & mutations ─────────────────────────────────── */

export const REWARD_PER_INVITE = 50;

/** Creates the profile doc on first sign-in, returns its reference. */
export function ensureProfile(user: User) {
  const ref = doc(db, 'users', user.uid);
  return getDoc(ref).then(async (snap) => {
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        points: 0,
        invites: 0,
        bonusSlots: 0,
        role: 'member',
        programs: [],
        moderatorRoles: [],
        createdAt: serverTimestamp(),
      });
    }
    return ref;
  });
}

/** Live profile for the signed-in user. */
export function useProfile(uid: string | null | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { profile, loading };
}

export async function applyToProgram(user: User, programId: ProgramId, motivation: string) {
  await setDoc(
    doc(db, 'programApplications', `${user.uid}_${programId}`),
    {
      uid: user.uid,
      email: user.email ?? '',
      programId,
      motivation,
      status: 'pending',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function applyToModerator(user: User, positionId: string, motivation: string) {
  await setDoc(
    doc(db, 'moderatorApplications', `${user.uid}_${positionId}`),
    {
      uid: user.uid,
      email: user.email ?? '',
      positionId,
      motivation,
      status: 'pending',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Lists this user's application statuses (used to show "Applied ✓"). */
export async function getMyApplications(uid: string) {
  const [programs, moderators] = await Promise.all([
    getDocs(query(collection(db, 'programApplications'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'moderatorApplications'), where('uid', '==', uid))),
  ]);
  const programIds = new Set(programs.docs.map((d) => d.data().programId as string));
  const moderatorIds = new Set(moderators.docs.map((d) => d.data().positionId as string));
  return { programIds, moderatorIds };
}
