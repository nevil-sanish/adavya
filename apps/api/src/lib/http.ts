import type { NextFunction, Request, Response } from 'express';
import { GameError } from './errors.js';

/** Wraps an async handler: GameErrors become `{ error, message }` with their status. */
export function route<Req extends Request>(fn: (req: Req, res: Response) => Promise<unknown>) {
  return (req: Req, res: Response, next: NextFunction) => {
    fn(req, res).catch((err: unknown) => {
      if (err instanceof GameError) {
        res.status(err.status).json({ error: err.code, message: err.message });
        return;
      }
      // gRPC ABORTED: the transaction lost every retry to contention. Safe for the client to retry.
      if ((err as { code?: unknown })?.code === 10) {
        res.status(503).json({ error: 'BUSY', message: 'The server is busy. Please try again.' });
        return;
      }
      next(err);
    });
  };
}
