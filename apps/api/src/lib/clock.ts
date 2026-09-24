/** Server clock used for completion ranking. Tests replace it to simulate timing. */
let source: () => number = () => Date.now();

export function nowMs(): number {
  return source();
}

export function setClock(fn: (() => number) | null): void {
  source = fn ?? (() => Date.now());
}
