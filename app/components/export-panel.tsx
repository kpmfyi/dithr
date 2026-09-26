'use client';
import { useRef, useState } from 'react';
import { parseRecipe, serializeRecipe, type Recipe } from '../../src/seedbank/recipes';
import { createZip, exampleHtml, exportReadme, integrationCode, reactCode, typescriptCode, type OutputSettings } from '../../src/workbench/export';
import { Drawer } from './drawer';
import { Icon } from './icons';

export function downloadFile(blob: Blob, name: string) {
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export const sizePresets = [
  { label: 'HD 16:9', w: 1920, h: 1080 }, { label: 'Square', w: 1080, h: 1080 }, { label: 'Portrait 4:5', w: 1080, h: 1350 },
  { label: 'Story 9:16', w: 1080, h: 1920 }, { label: 'Landscape 3:2', w: 1920, h: 1280 }, { label: 'Banner 3:1', w: 1800, h: 600 },
  { label: 'Largest 3:2', w: 2048, h: 1365 }, { label: 'Thumbnail', w: 640, h: 360 },
] as const;
export type RecordState = { phase: 'idle' | 'recording' | 'encoding'; progress: number };
type Tab = 'image' | 'video' | 'code' | 'recipe';
type Props = {
  recipe: Recipe; output: OutputSettings; setOutput: (o: OutputSettings) => void; busy: boolean; ready: boolean;
  onStill: (scale: number) => void; onFreeze: () => void; onRecord: (seconds: number, fps: number) => void; onCancelRecord: () => void; record: RecordState;
  videoFormat: string; onImport: (recipe: Recipe) => void; onShare: () => void; onMessage: (s: string) => void; onClose: () => void;
};
export function ExportDrawer({ recipe, output, setOutput, busy, ready, onStill, onFreeze, onRecord, onCancelRecord, record, videoFormat, onImport, onShare, onMessage, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('image');
  const [scale, setScale] = useState(1);
  const [seconds, setSeconds] = useState(10);
  const [fps, setFps] = useState(60);
  const [packing, setPacking] = useState(false);
  const [format, setFormat] = useState<'javascript' | 'react' | 'typescript' | 'recipe'>('javascript');
  const [failure, setFailure] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const code = format === 'javascript' ? integrationCode(recipe, output) : format === 'react' ? reactCode(recipe, output) : format === 'typescript' ? typescriptCode(recipe, output) : serializeRecipe(recipe);
  const filename = { javascript: 'main.js', react: 'Shader.tsx', typescript: 'integration.ts', recipe: `${recipe.id}.json` }[format];
  const blocked = busy || packing || record.phase !== 'idle';
  const dims = (w: number, h: number) => setOutput({ ...output, width: w, height: h });
  const bundle = async () => {
    setPacking(true); setFailure('');
    try {
      const [runtime, source] = await Promise.all([fetch('/export/seedbank.js'), fetch('/export/source.json')]);
      if (!runtime.ok || !source.ok) throw new Error('The code bundle is missing from this build. Run npm run build:export, then try again.');
      const sources = await source.json() as Record<string, string>, encoder = new TextEncoder();
      const files = [{ name: 'seedbank.js', data: new Uint8Array(await runtime.arrayBuffer()) }];
      const contents: Record<string, string> = { ...sources, 'main.js': integrationCode(recipe, output), 'Shader.tsx': reactCode(recipe, output), 'integration.ts': typescriptCode(recipe, output), 'index.html': exampleHtml(output), 'recipe.json': serializeRecipe(recipe), 'output.json': JSON.stringify(output, null, 2), 'README.md': exportReadme(recipe, output) };
      for (const [name, text] of Object.entries(contents)) files.push({ name, data: encoder.encode(text) });
      downloadFile(new Blob([createZip(files)], { type: 'application/zip' }), `${recipe.id}-shader.zip`);
      onMessage('Downloaded the runnable project. Unzip it and serve the folder over HTTP.');
    } catch (e) { setFailure((e as Error).message); } finally { setPacking(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(code); onMessage('Code copied.'); } catch { setFailure('The clipboard is unavailable here. Select the code below and copy it, or download the file.'); } };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try { if (f.size > 16384) throw new Error('Recipe files are 16 KB at most.'); onImport(parseRecipe(await f.text())); }
    catch (e) { setFailure(`Import failed: ${(e as Error).message}`); }
  };
  const pixels = { width: output.width * scale, height: output.height * scale };
  const frozen = <p className="hint">Starts from the frozen moment, <span className="tabular">{recipe.time.toFixed(3)} s</span>. <button className="btn btn-ghost" style={{ minHeight: 0, padding: 0, textDecoration: 'underline' }} disabled={blocked || !ready} onClick={onFreeze}>Use the current live frame</button></p>;
  const sizes = <section>
    <h3>Size</h3>
    <div className="size-presets">{sizePresets.map(p => <button key={p.label} className="btn" aria-pressed={output.width === p.w && output.height === p.h} disabled={blocked} onClick={() => dims(p.w, p.h)}>{p.label}<small>{p.w}×{p.h}</small></button>)}</div>
    <div className="dims">
      <label>Width<input aria-label="Export width" type="number" min={16} max={2048} value={output.width} disabled={blocked} onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 16 && n <= 2048) dims(n, output.height); }}/></label>
      <span className="times">×</span>
      <label>Height<input aria-label="Export height" type="number" min={16} max={2048} value={output.height} disabled={blocked} onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 16 && n <= 2048) dims(output.width, n); }}/></label>
    </div>
    <p className="hint">16 to 2048 px per side. The preview follows this shape.</p>
  </section>;
  return <Drawer title="Export" label="Export" onClose={onClose}
    tools={<div className="chips" role="tablist" aria-label="Export format">{(['image', 'video', 'code', 'recipe'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className="btn" onClick={() => setTab(t)}>{{ image: 'Image', video: 'Video', code: 'Code', recipe: 'Recipe & link' }[t]}</button>)}</div>}>
    {tab === 'image' && <div className="export-grid">
      {sizes}
      <section>
        <h3>Pixel scale</h3>
        <div className="chips" role="group" aria-label="Pixel scale">{[1, 2, 3, 4].map(n => <button key={n} className="btn" aria-pressed={scale === n} disabled={blocked || output.width * n > 8192 || output.height * n > 8192} onClick={() => setScale(n)}>{n}×</button>)}</div>
        <p className="hint">Enlarges every pixel with hard edges, so large prints and 4K wallpapers stay crisp.</p>
        <div className="export-summary"><strong className="tabular">{pixels.width} × {pixels.height} px</strong> PNG</div>
        {frozen}
        <div className="export-row"><button className="btn btn-fill" disabled={blocked || !ready} onClick={() => onStill(scale)}><Icon name="download"/> Download PNG</button></div>
      </section>
    </div>}
    {tab === 'video' && <div className="export-grid">
      {sizes}
      <section>
        <h3>Clip</h3>
        <div className="chips" role="group" aria-label="Clip length">{[5, 10, 20, 30].map(n => <button key={n} className="btn" aria-pressed={seconds === n} disabled={blocked} onClick={() => setSeconds(n)}>{n} s</button>)}</div>
        <div className="chips" role="group" aria-label="Frame rate" style={{ marginTop: 8 }}>{[30, 60].map(n => <button key={n} className="btn" aria-pressed={fps === n} disabled={blocked} onClick={() => setFps(n)}>{n} fps</button>)}</div>
        <div className="export-summary"><strong className="tabular">{output.width} × {output.height}</strong>, {seconds} s at {fps} fps, {videoFormat ? videoFormat.toUpperCase() : 'no recorder in this browser'}</div>
        {frozen}
        <p className="hint">Recording plays the study in real time, so keep this tab visible. Slow devices record fewer distinct frames. The studies never repeat, so clips do not loop seamlessly.</p>
        <div className="export-row">
          {record.phase === 'idle' ? <button className="btn btn-fill" disabled={blocked || !ready || !videoFormat} onClick={() => onRecord(seconds, fps)}>Record {seconds} s video</button>
            : <><button className="btn" onClick={onCancelRecord}>Stop</button><span className="hint" style={{ margin: 0 }}>{record.phase === 'recording' ? `Recording ${Math.round(record.progress * 100)}%` : 'Finishing the file…'}</span></>}
        </div>
        {record.phase !== 'idle' && <div className="progress" role="progressbar" aria-valuenow={Math.round(record.progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${record.progress * 100}%` }}/></div>}
      </section>
    </div>}
    {tab === 'code' && <div className="export-grid">
      <section>
        <h3>Runnable project</h3>
        <p className="hint" style={{ marginTop: 0 }}>A ZIP with an HTML page, a bundled runtime, a React component, TypeScript sources, your exact recipe and the dependency license. No CDN or install needed; serve the folder over HTTP.</p>
        <label className="check"><input type="checkbox" checked={output.animate} disabled={blocked} onChange={e => setOutput({ ...output, animate: e.target.checked })}/> Animate on load (paused for reduced motion)</label>
        <label className="field-row">Renderer<select className="select" aria-label="Export renderer" value={output.backend} disabled={blocked} onChange={e => setOutput({ ...output, backend: e.target.value as OutputSettings['backend'] })}><option value="auto">Automatic</option><option value="webgl2">WebGL2</option><option value="webgpu">WebGPU only</option></select></label>
        <div className="export-row"><button className="btn btn-fill" onClick={bundle} disabled={blocked}><Icon name="download"/> {packing ? 'Preparing files…' : 'Download code + source'}</button></div>
        <p className="hint">These are feedback shaders: they need the included multipass runtime, not just a fragment shader.</p>
      </section>
      <section>
        <h3>Snippet</h3>
        <div className="export-row" style={{ marginTop: 0 }}><select className="select" aria-label="Code format" value={format} onChange={e => setFormat(e.target.value as typeof format)}><option value="javascript">JavaScript</option><option value="react">React component</option><option value="typescript">TypeScript</option><option value="recipe">Recipe JSON</option></select>
          <button className="btn" onClick={copy}>Copy code</button><button className="btn" onClick={() => downloadFile(new Blob([code], { type: 'text/plain' }), filename)}>Download {filename}</button></div>
        <textarea className="code-box" aria-label="Export code" readOnly spellCheck={false} value={code} style={{ marginTop: 10 }}/>
      </section>
    </div>}
    {tab === 'recipe' && <div className="export-grid">
      <section>
        <h3>Share link</h3>
        <p className="hint" style={{ marginTop: 0 }}>The link holds the whole recipe, so anyone who opens it sees exactly this study, seed, settings, colors and frozen moment. Nothing is uploaded.</p>
        <div className="export-row"><button className="btn btn-fill" onClick={onShare}><Icon name="link"/> Copy share link</button></div>
        <h3 style={{ marginTop: 24 }}>Recipe file</h3>
        <div className="export-row" style={{ marginTop: 0 }}><button className="btn" onClick={() => downloadFile(new Blob([serializeRecipe(recipe)], { type: 'application/json' }), `${recipe.id}.json`)}>Download recipe</button>
          <button className="btn" onClick={() => file.current?.click()}>Import recipe</button><input ref={file} type="file" accept=".json,application/json" className="sr-only" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/></div>
      </section>
      <section><h3>Recipe</h3><pre className="code-box recipe-code" style={{ minHeight: 0, margin: 0 }}>{serializeRecipe(recipe)}</pre></section>
    </div>}
    {failure && <p className="error-note" role="alert">{failure}</p>}
  </Drawer>;
}
