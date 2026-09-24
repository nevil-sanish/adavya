/** Runtime settings read after the entry point loads .env. */

export function allowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN || 'iiitkottayam.ac.in').trim().toLowerCase();
}

/** True for a single-label mailbox at exactly the allowed domain (no subdomains, no suffix tricks). */
export function isAllowedEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = allowedEmailDomain().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^[^@\\s]+@${domain}$`).test(email.trim().toLowerCase());
}

/** The competition new teams are created in. */
export function activeCompetitionId(): string {
  return (process.env.COMPETITION_ID || 'main').trim();
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** A member whose heartbeat is older than this is treated as disconnected. */
export function presenceStaleMs(): number {
  const value = Number(process.env.PRESENCE_STALE_MS);
  return Number.isFinite(value) && value > 0 ? value : 45_000;
}
