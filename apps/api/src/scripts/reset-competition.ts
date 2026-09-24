/**
 * Deletes competition progress. Configuration is kept.
 *
 *   npm run reset -- --confirm <competitionId> [--keep-teams]
 *
 * --keep-teams  keep teams and rosters, return them to the lobby
 */
import { activeCompetitionId } from '../config/env.js';
import { resetCompetition } from '../services/admin.service.js';
import { flag, scriptDb, target } from './cli.js';

const db = scriptDb();
const cid = activeCompetitionId();
if (flag('confirm') !== cid) {
  console.error(`Refusing to reset. Re-run with --confirm ${cid} to reset "${cid}" on ${target()}.`);
  process.exit(1);
}
const keepTeams = flag('keep-teams') === 'true';
const { teams } = await resetCompetition(db, cid, keepTeams);
console.log(`Reset ${teams} team(s) in "${cid}" on ${target()}${keepTeams ? ' (teams kept in lobby)' : ''}.`);
process.exit(0);
