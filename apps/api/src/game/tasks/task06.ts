import { z } from 'zod';
import { shuffled } from '../../lib/random.js';
import { DEFAULT_MORSE_WORDS, MORSE, isThreeLetterWord } from '../morse.js';
import type { TaskModule } from './types.js';

interface Task06Config {
  words: string[];
}

interface Position {
  index: number;
  assignedPlayerUid: string;
  letter: string;
  morse: string;
}

interface MorseAttempt {
  position: number;
  morse: string;
  byName: string;
  result: 'ACCEPTED' | 'WRONG_PLAYER' | 'WRONG_MORSE';
  at: number;
}

/**
 * Morse word relay. A three-letter word; each position belongs to a different
 * player (hidden). Players tap dots/dashes on a blank screen and submit a letter;
 * the captain sees the word, every submission and its red/green result.
 */
export const task06: TaskModule<Task06Config> = {
  taskId: 'task06',
  taskType: 'MORSE_RELAY',
  title: 'Morse Word Relay',
  description: 'Tap out the target word in Morse, one letter per player, in order.',
  defaultConfig: { words: DEFAULT_MORSE_WORDS },
  configSchema: z.object({
    words: z
      .array(z.string().trim().toUpperCase().refine(isThreeLetterWord, 'Words must be exactly three letters A-Z'))
      .min(1),
  }),

  init(ctx, config) {
    const word = shuffled(config.words)[0];
    const owners = shuffled(ctx.players);
    const positions: Position[] = [...word].map((letter, index) => ({
      index,
      assignedPlayerUid: owners[index].uid,
      letter,
      morse: MORSE[letter],
    }));
    return {
      privateState: { word, positions },
      captainView: { taskType: 'MORSE_RELAY', word, currentPosition: 0, acceptedMorse: [], attempts: [], log: [] },
    };
  },

  actions: {
    morse: {
      roles: ['PLAYER'],
      input: z.object({ morse: z.string().regex(/^[.-]{1,8}$/, 'Morse must be dots and dashes') }),
      prepare(ctx, input: { morse: string }) {
        // Players only learn that the letter was received; the captain sees the verdict.
        const response = { received: true };
        const positions = ctx.privateState.positions as Position[];
        const index = ctx.captainView.currentPosition as number;
        const target = positions[index];
        if (!target) return { response, mutating: false };

        const result: MorseAttempt['result'] =
          ctx.caller.uid !== target.assignedPlayerUid ? 'WRONG_PLAYER' : input.morse !== target.morse ? 'WRONG_MORSE' : 'ACCEPTED';
        const attempt: MorseAttempt = { position: index, morse: input.morse, byName: ctx.caller.displayName, result, at: Date.now() };
        const attempts = [...(ctx.captainView.attempts as MorseAttempt[]), attempt].slice(-30);

        if (result !== 'ACCEPTED') {
          return { response, mutating: true, captainPatch: { attempts } };
        }
        const nextPosition = index + 1;
        return {
          response,
          mutating: true,
          captainPatch: {
            attempts,
            currentPosition: nextPosition,
            acceptedMorse: [...(ctx.captainView.acceptedMorse as string[]), input.morse],
          },
          complete: nextPosition === positions.length,
        };
      },
    },
  },
};
