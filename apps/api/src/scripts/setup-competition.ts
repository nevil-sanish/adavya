/**
 * Creates or updates the active competition.
 *
 *   npm run setup -- [--name "Tech Fest"] [--locations config/locations.json] [--assignment config/assignment.json] [--open]
 *
 * --locations   replaces the ten Task 2 locations from a JSON array
 * --assignment  sets the default Task 2 assignment (five locations, three correct, the word);
 *               per-team assignments are set in the admin page
 * --open       sets the competition ACTIVE so captains can start
 */
import fs from 'fs';
import { activeCompetitionId } from '../config/env.js';
import { ensureCompetition, setAssignment, setLocations, updateCompetition } from '../services/admin.service.js';
import { DEFAULT_ASSIGNMENT } from '../game/tasks/task02.js';
import { flag, scriptDb, target } from './cli.js';

const db = scriptDb();
const cid = activeCompetitionId();
console.log(`Setting up competition "${cid}" on ${target()}`);

await ensureCompetition(db, cid, flag('name'));
if (flag('name')) await updateCompetition(db, cid, { name: flag('name') });

const locationsFile = flag('locations');
if (locationsFile) {
  await setLocations(db, cid, { locations: JSON.parse(fs.readFileSync(locationsFile, 'utf8')) });
  console.log(`Loaded Task 2 locations from ${locationsFile}`);
}
const assignmentFile = flag('assignment');
if (assignmentFile) {
  await setAssignment(db, cid, DEFAULT_ASSIGNMENT, JSON.parse(fs.readFileSync(assignmentFile, 'utf8')));
  console.log(`Set the default Task 2 assignment from ${assignmentFile}`);
}
if (flag('open')) {
  await updateCompetition(db, cid, { status: 'ACTIVE' });
  console.log('Competition is ACTIVE.');
}
console.log('Done.');
process.exit(0);
