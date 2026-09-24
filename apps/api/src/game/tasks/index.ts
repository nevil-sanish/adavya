import type { TaskId } from '../types.js';
import { task01 } from './task01.js';
import { task02 } from './task02.js';
import { task03 } from './task03.js';
import { task04 } from './task04.js';
import { task05 } from './task05.js';
import { task06 } from './task06.js';
import type { TaskModule } from './types.js';

export const TASKS: Record<TaskId, TaskModule> = { task01, task02, task03, task04, task05, task06 };

export function taskModule(taskId: string): TaskModule | undefined {
  return (TASKS as Record<string, TaskModule>)[taskId];
}
