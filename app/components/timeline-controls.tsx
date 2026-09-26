'use client';
import { useState } from 'react';
import { timeLimit, type Recipe } from '../../src/seedbank/recipes';
import { stepTime, timelineWindow } from '../../src/workbench/timeline';
import { NumberField, fill } from './fields';
type Props = { recipe: Recipe; time: number; busy: boolean; onSeek: (time: number) => void; begin: () => void; end: () => void };
export function TimelineControls({ recipe, time, busy, onSeek, begin, end }: Props) {
  const [span, setSpan] = useState(10), [anchor, setAnchor] = useState<number | null>(null);
  const window = timelineWindow(recipe.family, anchor ?? time, span);
  const seek = (n: number) => onSeek(stepTime(recipe.family, n, 0));
  const value = Math.max(window.start, Math.min(window.end, time));
  return <div className="timeline" aria-label="Timeline" role="group">
    <label className="field-row" style={{ marginTop: 0 }}>Window<select className="select" aria-label="Timeline window" value={span} disabled={busy} onChange={e => { setSpan(Number(e.target.value)); setAnchor(null); }}><option value={10}>10 seconds</option><option value={60}>1 minute</option><option value={300}>5 minutes</option></select></label>
    <input type="range" aria-label="Scrub time" min={window.start} max={window.end} step={1 / 60} value={value} disabled={busy} style={fill(value, window.start, window.end)}
      onPointerDown={() => { setAnchor(time); begin(); }} onPointerUp={() => { end(); setAnchor(null); }} onPointerCancel={() => { end(); setAnchor(null); }}
      onKeyDown={() => { if (anchor === null) { setAnchor(time); begin(); } }} onKeyUp={() => { end(); setAnchor(null); }} onBlur={() => { end(); setAnchor(null); }} onChange={e => seek(Number(e.target.value))}/>
    <div className="bounds"><span>{window.start.toLocaleString()} s</span><span>{window.end.toLocaleString()} s</span></div>
    <div className="actions">
      <button className="btn" aria-label="Previous frame" disabled={busy || time <= 0} onClick={() => { end(); seek(stepTime(recipe.family, time, -1 / 60)); }}>−1 frame</button>
      <button className="btn" aria-label="Next frame" disabled={busy || time >= timeLimit(recipe.family)} onClick={() => { end(); seek(stepTime(recipe.family, time, 1 / 60)); }}>+1 frame</button>
      <button className="btn" disabled={busy || time >= timeLimit(recipe.family)} onClick={() => { end(); seek(stepTime(recipe.family, time, 10)); }}>+10 s</button>
      <label className="goto" htmlFor="timeline-time-input">Go to<NumberField id="timeline-time-input" label="Go to time in seconds" value={+time.toFixed(3)} min={0} max={timeLimit(recipe.family)} step={0.001} disabled={busy} begin={begin} end={end} onChange={seek}/></label>
    </div>
  </div>;
}
