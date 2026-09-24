import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseIdToken } from '../config/firebase.js';
import { adminEmails, allowedEmailDomain, isAllowedEmail } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    picture?: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header. Bearer token required.',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token not provided.',
    });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const email = decoded.email?.toLowerCase().trim();

    if (!email) {
      res.status(403).json({
        error: 'MISSING_EMAIL',
        message: 'Google account does not contain a verified email address.',
      });
      return;
    }

    if (!decoded.email_verified || !isAllowedEmail(email)) {
      res.status(403).json({
        error: 'INSTITUTION_EMAIL_REQUIRED',
        message: `Please sign in with your verified @${allowedEmailDomain()} Google account.`,
      });
      return;
    }

    req.user = {
      uid: decoded.uid,
      email,
      name: decoded.name,
      picture: decoded.picture,
    };

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid authentication token.';
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message,
    });
  }
}

/** Must run after requireAuth. Admins are listed by email in ADMIN_EMAILS. */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || !adminEmails().has(req.user.email)) {
    res.status(403).json({ error: 'ADMIN_ONLY', message: 'Administrator access required.' });
    return;
  }
  next();
}
