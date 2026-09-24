import { TeamTaskspace } from '../types/auth.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalizedValue?: string;
}

/**
 * Validates Team ID format.
 */
export function validateTeamIdFormat(rawTeamId: string): ValidationResult {
  if (!rawTeamId || typeof rawTeamId !== 'string') {
    return {
      isValid: false,
      error: 'Team ID is required.',
    };
  }

  const trimmed = rawTeamId.trim().toUpperCase();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Team ID must be at least 3 characters.',
    };
  }

  if (trimmed.length > 30) {
    return {
      isValid: false,
      error: 'Team ID must not exceed 30 characters.',
    };
  }

  const validFormatRegex = /^[A-Z0-9_-]+$/;
  if (!validFormatRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Team ID can only contain letters, numbers, hyphens (-), and underscores (_).',
    };
  }

  return {
    isValid: true,
    normalizedValue: trimmed,
  };
}

/**
 * Generates a clean, unique Team ID.
 */
export function generateTeamId(teamName?: string): string {
  const prefix = teamName
    ? teamName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 6)
    : 'TEAM';

  const basePrefix = prefix.length >= 3 ? prefix : 'TEAM';
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${basePrefix}-${randomSuffix}`;
}

/**
 * Known registered team taskspaces
 */
export const DEFAULT_TASKSPACES: TeamTaskspace[] = [
  {
    teamId: 'TEAM-ALPHA',
    name: 'Core Intelligence',
    description: 'Foundational multi-agent pipelines.',
    ownerEmail: 'lead@adavya.ai',
    membersCount: 8,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    teamId: 'TEAM-DEV',
    name: 'Platform Engineering',
    description: 'Distributed infrastructure and runtime.',
    ownerEmail: 'dev@adavya.ai',
    membersCount: 5,
    createdAt: '2026-02-01T12:00:00Z',
  },
];
