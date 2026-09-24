import React from 'react';
import { CheckCircle2, Hourglass } from 'lucide-react';
import { POSE_INFO, SLOT_LABEL, type Task03CaptainView } from '@adavya/shared';
import { Card } from '../../components/ui.js';
import { CaptainLog, type PanelProps } from '../Monitor.js';
import { PoseFigure } from './PoseFigure.js';

/** Pose relay: each performer's pose, reference figure and live verification. */
export const Task03Panel: React.FC<PanelProps<Task03CaptainView>> = ({ view }) => (
  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
    <Card title="Poses" aside={`${view.completedCount} / ${view.performers.length} verified`}>
      <ul className="grid gap-3 sm:grid-cols-3">
        {view.performers.map((p) => (
          <li
            key={p.uid}
            className={`flex flex-col items-center gap-2 rounded-[12px] border p-4 text-center ${
              p.completed ? 'border-emerald-700/60 bg-emerald-950/30' : 'border-zinc-800 bg-zinc-950/70'
            }`}
          >
            <span className="text-[13px] font-medium text-zinc-300">{p.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">{SLOT_LABEL[p.slot]}</span>
            <PoseFigure pose={p.poseId} className={`h-24 w-20 ${p.completed ? 'text-emerald-400' : 'text-zinc-200'}`} />
            <span className="text-sm font-semibold text-white">{p.poseName}</span>
            <span className="text-[11px] leading-snug text-zinc-400">{POSE_INFO[p.poseId].description}</span>
            <span className={`mt-auto flex items-center gap-1 text-[11px] font-medium ${p.completed ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {p.completed ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <Hourglass aria-hidden="true" className="h-3.5 w-3.5" />}
              {p.completed ? 'Verified' : 'Waiting'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">Players do not see pose names or any feedback. Describe the pose in words only.</p>
    </Card>
    <CaptainLog log={view.log} />
  </div>
);
