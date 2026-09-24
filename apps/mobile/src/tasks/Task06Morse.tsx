import React, { useRef, useState } from 'react';
import { pressSymbol } from '@adavya/shared';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

const MAX_SYMBOLS = 8;

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

/**
 * Blank tap pad: a short tap is a dot, press-and-hold is a dash. The player
 * submits the letter when done. The phone never knows the word or whose turn it
 * is; the captain sees whether the submission was accepted.
 */
export const Task06Morse: React.FC<TaskProps> = ({ send, paused, online }) => {
  const [buffer, setBuffer] = useState('');
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const pressStart = useRef<number | null>(null);
  const submission = useRef(0);
  const blocked = paused || !online;

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    if (blocked || busy) return;
    pressStart.current = performance.now();
    setPressed(true);
  };

  const up = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pressStart.current === null) return;
    const symbol = pressSymbol(performance.now() - pressStart.current);
    pressStart.current = null;
    setPressed(false);
    vibrate(symbol === '.' ? 40 : 160);
    setNotice(null);
    setBuffer((b) => (b.length >= MAX_SYMBOLS ? b : b + symbol));
  };

  const cancel = () => {
    pressStart.current = null;
    setPressed(false);
  };

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await send('morse', { morse: buffer }, { dedupeKey: `letter-${submission.current}:${buffer}` });
      submission.current += 1;
      setBuffer('');
      setNotice({ tone: 'info', text: 'Letter sent. Watch your captain.' });
    } catch (err) {
      setNotice({ tone: 'error', text: errorText(err, 'Could not send. Try again.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`morse-pad ${pressed ? 'pressed' : ''}`}
        role="button"
        aria-label="Morse pad: tap for dot, hold for dash"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <p className="morse-buffer" aria-live="polite">{buffer || ' '}</p>
      <div className="row">
        <button type="button" className="btn secondary" disabled={!buffer || busy} onClick={() => setBuffer((b) => b.slice(0, -1))}>
          Undo
        </button>
        <button type="button" className="btn secondary" disabled={!buffer || busy} onClick={() => setBuffer('')}>
          Clear
        </button>
      </div>
      <button type="button" className="btn big" disabled={!buffer || busy || blocked} onClick={submit}>
        {busy ? 'Sending…' : 'Submit Letter'}
      </button>
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
    </>
  );
};
