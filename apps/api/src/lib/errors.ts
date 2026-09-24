/** An expected, client-facing failure. Routes turn it into `{ error: code, message }`. */
export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'GameError';
  }
}
