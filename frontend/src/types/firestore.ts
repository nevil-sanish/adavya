/**
 * Firestore document shapes.
 *
 * Layout:
 *   teams/{team_id}                      -> TeamDoc
 *   rounds/round1/teams/{teamID}         -> Round1Doc
 *   rounds/round2/teams/{teamID}         -> Round2Doc
 *   rounds/round3/teams/{teamID}         -> Round3Doc
 *   questions/{questionId}               -> QuestionDoc   (round 2 questions)
 */

export const MAX_TEAM_MEMBERS = 3;

export type RoundId = 'round1' | 'round2' | 'round3';

export type RoundStatus = 'not_started' | RoundId | 'completed';

export interface TeamDoc {
  team_name: string;
  team_id: string;
  captain_id: string;
  /** Up to 3 member ids, captain included. */
  members_id: string[];
  round_status: RoundStatus;
  score: number;
  /** Set when the Round 2 word sequence is verified. */
  finished_at?: string;
}

/** Each position is 0 or 1. */
export type Round1Sequence = [0 | 1, 0 | 1, 0 | 1];

export interface Round1Doc {
  teamID: string;
  sequence: Round1Sequence;
  /** Keyed by member id; null until that member has acted. */
  playerActions: Record<string, 0 | 1 | null>;
  /** Code the field phones reveal after a correct sequence; checked server-side only. */
  code: string;
  completedAt?: string;
}

/** Each position is a word. */
export type Round2Sequence = [string, string, string];

export interface Round2Doc {
  teamID: string;
  /** Clue texts shown to HQ, one per campus location. */
  cluesGenerated: string[];
  /** Correct word order; checked server-side only. */
  sequence: Round2Sequence;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number | null;
}

export interface QuestionDoc {
  question: string;
  /** [x, y] coordinates. */
  location: [number, number];
  /** The word that answers this question. */
  word: string;
}

/** Pose ids shared with the phone app. */
export type PoseId = 't_pose' | 'both_hands_up' | 'one_hand_up_one_down';

/** Performer slots in Round 3; Player A communicates from the monitor. */
export type PoseSlot = 'B' | 'C' | 'D';

export interface Round3Doc {
  teamID: string;
  /** Pose each performer must hold, randomised per team by the server. */
  assignments: Record<PoseSlot, PoseId>;
  /** Set to true by the phone app once MediaPipe confirms the pose was held. */
  verified: Record<PoseSlot, boolean>;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number | null;
}

export interface RoundDocMap {
  round1: Round1Doc;
  round2: Round2Doc;
  round3: Round3Doc;
}
