/**
 * Firestore document shapes.
 *
 * Layout:
 *   teams/{team_id}                      -> TeamDoc
 *   rounds/round1/teams/{teamID}         -> Round1Doc
 *   rounds/round2/teams/{teamID}         -> Round2Doc
 *   questions/{questionId}               -> QuestionDoc   (round 2 questions)
 */

export const MAX_TEAM_MEMBERS = 3;

export type RoundId = 'round1' | 'round2';

export type RoundStatus = 'not_started' | RoundId | 'completed';

export interface TeamDoc {
  team_name: string;
  team_id: string;
  captain_id: string;
  /** Up to 3 member ids, captain included. */
  members_id: string[];
  round_status: RoundStatus;
  score: number;
}

/** Each position is 0 or 1. */
export type Round1Sequence = [0 | 1, 0 | 1, 0 | 1];

export interface Round1Doc {
  teamID: string;
  sequence: Round1Sequence;
  /** Keyed by member id; null until that member has acted. */
  playerActions: Record<string, 0 | 1 | null>;
}

/** Each position is a word. */
export type Round2Sequence = [string, string, string];

export interface Round2Doc {
  teamID: string;
  cluesGenerated: string[];
  sequence: Round2Sequence;
}

export interface QuestionDoc {
  question: string;
  /** [x, y] coordinates. */
  location: [number, number];
  /** The word that answers this question. */
  word: string;
}

export interface RoundDocMap {
  round1: Round1Doc;
  round2: Round2Doc;
}
