import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { activeCompetitionId } from '../config/env.js';
import { GameError } from '../lib/errors.js';
import { runGameTransaction } from '../lib/transaction.js';
import { fourDigitCode } from '../lib/random.js';
import { refs } from '../game/refs.js';
import { PLAYER_SLOTS, REQUIRED_MEMBERS, type CompetitionDoc, type MemberDoc, type TeamDoc, type UserDoc } from '../game/types.js';

const CODE_ATTEMPTS = 25;

export const displayNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(40, 'Name must be at most 40 characters');
export const teamNameSchema = z.string().trim().min(2, 'Team name must be at least 2 characters').max(40, 'Team name must be at most 40 characters');
export const teamCodeSchema = z.string().trim().regex(/^\d{4}$/, 'Team code is exactly four digits');

/* --------------------------------- profile -------------------------------- */

/** Loads the profile, creating it on first sign-in. Never overwrites an existing profile. */
export async function loadOrCreateProfile(db: Firestore, uid: string, email: string, name?: string): Promise<UserDoc> {
  const ref = refs(db).user(uid);
  return runGameTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data() as UserDoc;
    const fallback = email.split('@')[0];
    const parsed = displayNameSchema.safeParse(name ?? '');
    const profile = {
      uid,
      email,
      displayName: parsed.success ? parsed.data : fallback.slice(0, 40).padEnd(2, '_'),
      competitionId: null,
      teamId: null,
      role: null,
      slot: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(ref, profile);
    return profile as unknown as UserDoc;
  });
}

/** Display names may change until the captain starts the competition. */
export async function updateDisplayName(db: Firestore, uid: string, rawName: unknown): Promise<{ displayName: string }> {
  const parsed = displayNameSchema.safeParse(rawName);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0].message);
  const displayName = parsed.data;
  const r = refs(db);

  await runGameTransaction(db, async (tx) => {
    const user = (await tx.get(r.user(uid))).data() as UserDoc | undefined;
    if (!user) throw new GameError('PROFILE_NOT_FOUND', 'Sign in again to create your profile.', 404);
    if (user.competitionId && user.teamId) {
      const team = (await tx.get(r.team(user.competitionId, user.teamId))).data() as TeamDoc | undefined;
      if (team && team.status !== 'LOBBY') throw new GameError('TEAM_LOCKED', 'Names are locked once the competition starts.', 409);
      tx.update(r.member(user.competitionId, user.teamId, uid), { displayName });
    }
    tx.update(r.user(uid), { displayName, updatedAt: FieldValue.serverTimestamp() });
  });
  return { displayName };
}

/* ---------------------------------- teams --------------------------------- */

function newMember(uid: string, displayName: string, role: MemberDoc['role'], slot: MemberDoc['slot']) {
  return {
    uid,
    displayName,
    role,
    slot,
    joinedAt: FieldValue.serverTimestamp(),
    isConnected: true,
    lastSeenAt: FieldValue.serverTimestamp(),
  };
}

/**
 * The creator becomes the permanent captain. A four-digit code is reserved in
 * teamDirectory inside the same transaction; taken codes are skipped, and a
 * concurrent creator racing for the same code is retried by Firestore.
 */
export async function createTeam(
  db: Firestore,
  uid: string,
  rawTeamName: unknown,
  generateCode: () => string = fourDigitCode
): Promise<{ teamId: string; teamCode: string; competitionId: string }> {
  const parsed = teamNameSchema.safeParse(rawTeamName);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0].message);
  const teamName = parsed.data;
  const cid = activeCompetitionId();
  const r = refs(db);

  return runGameTransaction(db, async (tx) => {
    const user = (await tx.get(r.user(uid))).data() as UserDoc | undefined;
    if (!user) throw new GameError('PROFILE_NOT_FOUND', 'Sign in again to create your profile.', 404);
    if (user.teamId) throw new GameError('ALREADY_IN_TEAM', 'You already belong to a team.', 409);
    const comp = (await tx.get(r.competition(cid))).data() as CompetitionDoc | undefined;
    if (!comp) {
      throw new GameError(
        'COMPETITION_NOT_SET_UP',
        `The competition "${cid}" has not been set up yet. An organizer must run the setup script (npm run setup in apps/api).`,
        409
      );
    }
    if (comp.status === 'CLOSED') throw new GameError('COMPETITION_NOT_OPEN', 'Team registration is closed.', 409);

    let teamCode: string | null = null;
    for (let i = 0; i < CODE_ATTEMPTS && !teamCode; i++) {
      const candidate = generateCode();
      if (!(await tx.get(r.teamDirectory(candidate))).exists) teamCode = candidate;
    }
    if (!teamCode) throw new GameError('CODE_EXHAUSTED', 'Could not reserve a team code. Try again.', 503);

    const teamRef = r.teams(cid).doc();
    const team = {
      teamId: teamRef.id,
      competitionId: cid,
      teamCode,
      teamName,
      captainUid: uid,
      status: 'LOBBY',
      memberCount: 1,
      requiredMembers: REQUIRED_MEMBERS,
      currentTaskId: null,
      createdAt: FieldValue.serverTimestamp(),
      lockedAt: null,
      completedAt: null,
    };
    tx.set(r.teamDirectory(teamCode), { competitionId: cid, teamId: teamRef.id, createdAt: FieldValue.serverTimestamp() });
    tx.set(teamRef, team);
    tx.set(r.member(cid, teamRef.id, uid), newMember(uid, user.displayName, 'CAPTAIN', 'captain'));
    tx.update(r.user(uid), { competitionId: cid, teamId: teamRef.id, role: 'CAPTAIN', slot: 'captain', updatedAt: FieldValue.serverTimestamp() });
    return { teamId: teamRef.id, teamCode, competitionId: cid };
  });
}

/**
 * Joins by code while the team is in the lobby. Slots are permanent and
 * assigned in order; the team document serializes concurrent joins.
 */
export async function joinTeam(db: Firestore, uid: string, rawCode: unknown): Promise<{ teamId: string; slot: string; competitionId: string }> {
  const parsed = teamCodeSchema.safeParse(rawCode);
  if (!parsed.success) throw new GameError('VALIDATION_ERROR', parsed.error.errors[0].message);
  const r = refs(db);

  return runGameTransaction(db, async (tx) => {
    const user = (await tx.get(r.user(uid))).data() as UserDoc | undefined;
    if (!user) throw new GameError('PROFILE_NOT_FOUND', 'Sign in again to create your profile.', 404);
    const entry = (await tx.get(r.teamDirectory(parsed.data))).data() as { competitionId: string; teamId: string } | undefined;
    if (!entry) throw new GameError('TEAM_NOT_FOUND', 'No team has that code.', 404);

    if (user.teamId) {
      if (user.teamId === entry.teamId && user.slot) return { teamId: entry.teamId, slot: user.slot, competitionId: entry.competitionId };
      throw new GameError('ALREADY_IN_TEAM', 'You already belong to a team.', 409);
    }
    if (entry.competitionId !== activeCompetitionId()) throw new GameError('COMPETITION_MISMATCH', 'That team is not in the current competition.', 409);

    const teamRef = r.team(entry.competitionId, entry.teamId);
    const [teamSnap, membersSnap] = await Promise.all([tx.get(teamRef), tx.get(r.members(entry.competitionId, entry.teamId))]);
    const team = teamSnap.data() as TeamDoc | undefined;
    if (!team) throw new GameError('TEAM_NOT_FOUND', 'No team has that code.', 404);
    if (team.status !== 'LOBBY') throw new GameError('TEAM_LOCKED', 'This team has already started.', 409);
    const taken = new Set(membersSnap.docs.map((d) => (d.data() as MemberDoc).slot));
    const slot = PLAYER_SLOTS.find((s) => !taken.has(s));
    if (!slot || membersSnap.size >= REQUIRED_MEMBERS) throw new GameError('TEAM_FULL', 'This team already has four members.', 409);

    tx.set(r.member(entry.competitionId, entry.teamId, uid), newMember(uid, user.displayName, 'PLAYER', slot));
    tx.update(teamRef, { memberCount: membersSnap.size + 1 });
    tx.update(r.user(uid), {
      competitionId: entry.competitionId,
      teamId: entry.teamId,
      role: 'PLAYER',
      slot,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { teamId: entry.teamId, slot, competitionId: entry.competitionId };
  });
}
