'use client';
import type { Backend, Recipe } from '../../src/seedbank/recipes';
import type { OutputSettings } from '../../src/workbench/export';
import { TimelineControls } from './timeline-controls';
import { fill } from './fields';

export const aspects = [
  { id: '3:2', label: 'Landscape 3:2', w: 3, h: 2 }, { id: '16:9', label: 'Wide 16:9', w: 16, h: 9 }, { id: '1:1', label: 'Square', w: 1, h: 1 },
  { id: '4:5', label: 'Portrait 4:5', w: 4, h: 5 }, { id: '9:16', label: 'Story 9:16', w: 9, h: 16 }, { id: '3:1', label: 'Banner 3:1', w: 3, h: 1 },
] as const;
export const aspectOf = (o: { width: number; height: number }) => aspects.find(a => Math.abs(o.width / o.height - a.w / a.h) < .004)?.id ?? 'custom';
type Props = {
  recipe: Recipe; time: number; busy: boolean; ready: boolean; begin: () => void; end: () => void;
  onSeek: (time: number) => void; onFreeze: () => void;
  output: OutputSettings; setOutput: (o: OutputSettings) => void; previewEdge: number; setPreviewEdge: (n: number) => void;
  backend: Backend; setBackend: (b: Backend) => void; actualBackend: string;
};
export function FrameControls({ recipe, time, busy, ready, begin, end, onSeek, onFreeze, output, setOutput, previewEdge, setPreviewEdge, backend, setBackend, actualBackend }: Props) {
  const current = aspectOf(output);
  const setAspect = (w: number, h: number) => { const edge = Math.max(output.width, output.height); setOutput({ ...output, width: Math.round(edge * w / Math.max(w, h)), height: Math.round(edge * h / Math.max(w, h)) }); };
  return <>
    <section className="tune-section" aria-label="Canvas shape">
      <header><h2>Canvas</h2></header>
      <div className="size-presets" role="group" aria-label="Canvas aspect ratio">{aspects.map(a => <button key={a.id} className="btn" aria-pressed={current === a.id} disabled={busy} onClick={() => setAspect(a.w, a.h)}>{a.label}</button>)}</div>
      <p className="hint">{output.width} × {output.height} px. Exact export sizes are in Export.</p>
      <label className="hue-field">Preview detail <output>{previewEdge} px</output><input aria-label="Preview resolution" type="range" min={320} max={1600} step={160} value={previewEdge} style={fill(previewEdge, 320, 1600)} disabled={busy} onChange={e => setPreviewEdge(Number(e.target.value))}/></label>
      <p className="hint">Longest edge of the live preview. Lower is faster on slow devices; it never changes the recipe.</p>
      <label className="field-row">Renderer<select className="select" aria-label="Renderer backend" value={backend} disabled={busy} onChange={e => setBackend(e.target.value as Backend)}><option value="auto">Automatic</option><option value="webgpu">WebGPU</option><option value="webgl2">WebGL2</option></select></label>
      <p className="hint">Using {actualBackend}. Small pixel differences between devices are expected.</p>
    </section>
    <section className="tune-section" aria-label="Time">
      <header><h2>Time</h2><button className="btn" disabled={!ready || busy} onClick={onFreeze} title="Use the current moment for PNG, video start and code exports">Freeze this frame</button></header>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>Frozen at <span className="tabular">{recipe.time.toFixed(3)} s</span>. Exports start from the frozen moment. These studies never loop, so every second is a different frame.</p>
      <TimelineControls recipe={recipe} time={time} busy={busy || !ready} onSeek={onSeek} begin={begin} end={end}/>
    </section>
  </>;
}
