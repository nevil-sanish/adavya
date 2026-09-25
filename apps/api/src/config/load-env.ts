import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

/**
 * Loads the repository's single `.env` (repo root). Compiled location is
 * apps/api/dist/config/, four levels below the root. Variables already set in
 * the environment win, so hosts like Render/Cloud Run configure it directly.
 */
export function loadEnv(): void {
  dotenv.config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
}
