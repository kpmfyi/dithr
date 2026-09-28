'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { advanceTime, families, GENERATOR_VERSION, presets, timeLimit, validateRecipe, type Backend, type Recipe } from '../src/seedbank/recipes';
import type { Runtime } from '../src/seedbank/renderer';
import { findDemo } from '../src/demos/catalog';
import { defaultLocks, defaultScope, roll, type Locks, type RollScope } from '../src/workbench/exploration';
import { seriesOf, studiesIn } from '../src/workbench/series';
import { recipeFromHash, recipeHash } from '../src/workbench/share';
import { paletteTheme } from '../src/workbench/theme';
import { applyPalette } from '../src/workbench/exploration';
import type { OutputSettings } from '../src/workbench/export';
import { palettePresets } from '../src/workbench/palettes';
import { useRecipeHistory } from './components/use-recipe-history';
import { ShapeControls } from './components/tune-shape';
import { ColorControls } from './components/tune-color';
import { FrameControls } from './components/tune-frame';
import { StudyDrawer } from './components/study-drawer';
import { PaletteDrawer, applyFilter, emptyFilter, type PaletteFilter } from './components/palette-drawer';
import { ExportDrawer, downloadFile, type RecordState } from './components/export-panel';
import { PaletteRail } from './components/palette-rail';
import { Icon } from './components/icons';
import { SiteCredit } from './components/site-credit';

const STORAGE = 'shader-seedbank.recipes.v1';
const scopeNames: [keyof RollScope, string, string][] = [
  ['study', 'Study', 'Pick a different study'], ['palette', 'Palette', 'Pick a palette from the palette pool'],
  ['shape', 'Shape', 'Roll scale, intensity and detail around the study defaults'], ['seed', 'Seed', 'New seed: same look, different events'],
];
const videoTypes = [['video/mp4;codecs=avc1.640028', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm', 'webm']] as const;
const random32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

export default function Studio() {
  const history = useRecipeHistory(presets[0]);
  const { recipe, setRecipe, begin, end, reset } = history;
  const [locks, setLocks] = useState<Locks>(defaultLocks);
  const [scope, setScope] = useState<RollScope>(defaultScope);
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>(emptyFilter);
  const pool = useMemo(() => applyFilter(paletteFilter), [paletteFilter]);
  const [drawer, setDrawer] = useState<null | 'studies' | 'palettes' | 'export'>(null);
  const [tab, setTab] = useState<'shape' | 'color' | 'frame'>('shape');
  const [rollLog, setRollLog] = useState<Recipe[]>([]);
  const [saved, setSaved] = useState<Recipe[]>([]);
  const [backend, setBackend] = useState<Backend>('auto');
  const [actualBackend, setActualBackend] = useState('connecting');
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [time, setTime] = useState(recipe.time);
  const [output, setOutput] = useState<OutputSettings>({ width: 1920, height: 1280, animate: true, backend: 'auto' });
  const [previewEdge, setPreviewEdge] = useState(960);
  const [record, setRecord] = useState<RecordState>({ phase: 'idle', progress: 0 });
  const [videoType, setVideoType] = useState<readonly [string, string] | null>(null);
  const previewSettings = useRef({ output, previewEdge });
  const resizePreview = useRef<(() => void) | null>(null);
  const exporting = useRef(false);
  const recording = useRef<{ stop: () => void } | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const current = useRef(recipe);
  const clock = useRef(recipe.time);
  const renderedRecipe = useRef<Recipe | null>(null);
  const seek = useRef(false);
  useLayoutEffect(() => { current.current = recipe; previewSettings.current = { output, previewEdge }; });
  const info = families[recipe.family];
  const theme = useMemo(() => paletteTheme(recipe.palette), [recipe.palette]);
  const themeStyle = { '--p0': theme.roles[0], '--p1': theme.roles[1], '--p2': theme.roles[2], '--p3': theme.roles[3], '--p4': theme.roles[4], '--accent': theme.accent, '--on-accent': theme.onAccent, '--accent-text': theme.accentText } as CSSProperties;

  // Toasts clear themselves; screen readers still hear them through role=status.
  useEffect(() => { if (!status) return; const id = setTimeout(() => setStatus(''), 4200); return () => clearTimeout(id); }, [status]);
  useEffect(() => {
    setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    setVideoType(typeof MediaRecorder === 'undefined' ? null : videoTypes.find(([type]) => MediaRecorder.isTypeSupported(type)) ?? null);
    let initial: Recipe | null = null;
    const params = new URLSearchParams(location.search);
    try { initial = recipeFromHash(location.hash); if (initial) setStatus('Opened a shared recipe.'); }
    catch (e) { setStatus(`${(e as Error).message} Showing a random study instead.`); }
    const demo = params.get('demo'), study = params.get('study');
    if (!initial && demo) { const found = findDemo(demo); if (found) { initial = validateRecipe(found.recipe); setStatus(`Loaded the tuned recipe for “${found.title}”.`); } }
    if (!initial && study) initial = presets.find(p => p.family === study) ?? null;
    if (!initial) initial = presets[random32() % presets.length];
    reset(initial); clock.current = initial.time; setTime(initial.time);
    try { const data = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (!Array.isArray(data) || data.length > 48) throw new Error(); setSaved(data.map(validateRecipe)); }
    catch { setStatus('Saved presets on this device could not be read.'); }
    setHydrated(true);
  }, [reset]);
  // The address bar always holds the current recipe, so copying it shares the result.
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => { try { window.history.replaceState(null, '', `${location.pathname}${recipeHash(recipe)}`); } catch { /* storage-less embeds */ } }, 350);
    return () => clearTimeout(id);
  }, [recipe, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    let stopped = false, owned: Runtime | null = null, observer: ResizeObserver | null = null;
    setReady(false); setError(''); setActualBackend('connecting');
    // A fresh canvas per renderer: a disposed renderer may lose its context, and a
    // canvas cannot switch between WebGPU and WebGL once a context exists.
    const target = document.createElement('canvas');
    target.setAttribute('role', 'img');
    frame.current!.prepend(target); canvas.current = target;
    import('../src/seedbank/renderer').then(({ createSeedbank }) => createSeedbank(target, current.current, backend)).then(instance => {
      owned = instance;
      if (stopped) { instance.dispose(); return; }
      runtime.current = instance;
      instance.setRecipe(current.current);
      renderedRecipe.current = current.current;
      const resize = () => {
        if (!frame.current || exporting.current) return;
        const { output, previewEdge } = previewSettings.current;
        const ratio = previewEdge / Math.max(output.width, output.height);
        instance.resize(Math.max(1, Math.round(output.width * ratio)), Math.max(1, Math.round(output.height * ratio)));
        instance.render(clock.current);
      };
      resizePreview.current = resize; resize(); observer = new ResizeObserver(resize); observer.observe(frame.current!);
      setActualBackend(instance.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'); setReady(true);
    }).catch(e => { if (!stopped) { setError(String(e.message || e)); setActualBackend('unavailable'); } });
    return () => { stopped = true; observer?.disconnect(); if (runtime.current === owned) { runtime.current = null; resizePreview.current = null; } owned?.dispose(); target.remove(); if (canvas.current === target) canvas.current = null; };
  }, [backend, hydrated]);
  useEffect(() => { canvas.current?.setAttribute('aria-label', `${info.name} animated shader`); }, [info.name, ready]);
  useEffect(() => { resizePreview.current?.(); }, [output.width, output.height, previewEdge]);
  useEffect(() => {
    const previous = renderedRecipe.current;
    const jump = seek.current || !previous || previous.family !== recipe.family || previous.id !== recipe.id || previous.time !== recipe.time;
    const changed = !previous || previous.family !== recipe.family || previous.seed !== recipe.seed || previous.time !== recipe.time || JSON.stringify(previous.parameters) !== JSON.stringify(recipe.parameters) || JSON.stringify(previous.palette) !== JSON.stringify(recipe.palette);
    renderedRecipe.current = recipe; seek.current = false;
    if (!changed && !jump) return; // Renaming must not restart the feedback.
    if (jump) { clock.current = recipe.time; setTime(recipe.time); }
    try { runtime.current?.setRecipe(recipe); runtime.current?.render(clock.current); }
    catch (e) { setError((e as Error).message); }
  }, [recipe]);
  useEffect(() => {
    if (!ready || !playing || busy || record.phase !== 'idle') return;
    let request = 0, previous = performance.now(), display = 0;
    const tick = (now: number) => {
      if (!document.hidden) {
        clock.current = advanceTime(current.current.family, clock.current, Math.min((now - previous) / 1000, .05));
        try { runtime.current?.render(clock.current); } catch (e) { setError((e as Error).message); setPlaying(false); return; }
        if (now - display > 150) { setTime(clock.current); display = now; }
      }
      previous = now; request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, ready, busy, record.phase]);

  const choose = useCallback((next: Recipe) => { end(); seek.current = true; setRecipe(validateRecipe(next)); }, [end, setRecipe]);
  const travel = useCallback((direction: 'undo' | 'redo') => { seek.current = true; history[direction](); }, [history]);
  const navigate = useCallback((direction: number) => { const at = presets.findIndex(p => p.family === current.current.family); const next = presets[(Math.max(0, at) + direction + presets.length) % presets.length]; choose({ ...next, generatorVersion: GENERATOR_VERSION, palette: current.current.palette }); }, [choose]);
  const canRoll = Object.values(scope).some(Boolean);
  const doRoll = useCallback(() => {
    if (busy || record.phase !== 'idle' || !canRoll) return;
    end();
    const next = roll(current.current, scope, random32(), locks, pool, studiesIn(seriesFilter));
    seek.current = true; setRecipe(next); setRollLog(log => [next, ...log.filter(r => r.id !== next.id || JSON.stringify(r.palette) !== JSON.stringify(next.palette))].slice(0, 10));
  }, [busy, record.phase, canRoll, end, scope, locks, pool, seriesFilter, setRecipe]);
  const save = useCallback(() => {
    try {
      const item = validateRecipe({ ...current.current, id: `saved-${crypto.randomUUID().slice(0, 8)}`, review: 'candidate' });
      if (saved.length >= 48) throw new Error('Your saved shelf is full (48). Remove one in Studies › Saved first.');
      const next = [item, ...saved]; localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); setStatus(`Saved “${item.name}” on this device.`);
    } catch (e) { setStatus((e as Error).message); }
  }, [saved]);
  const remove = (id: string) => { const next = saved.filter(item => item.id !== id); try { localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); setStatus('Removed from this device.'); } catch { setStatus('Storage is unavailable in this browser.'); } };
  const share = async () => {
    const link = `${location.origin}${location.pathname}${recipeHash(recipe)}`;
    try { await navigator.clipboard.writeText(link); setStatus('Link copied. It opens this exact recipe.'); } catch { window.history.replaceState(null, '', recipeHash(recipe)); setStatus('Copy the address bar to share this recipe.'); }
  };
  const seekTo = (value: number) => { setPlaying(false); clock.current = value; setTime(value); seek.current = true; setRecipe(r => ({ ...r, time: value })); if (recipe.time === value) runtime.current?.render(value); };
  const freeze = () => { end(); seekTo(Math.min(timeLimit(recipe.family), +clock.current.toFixed(6))); setStatus(`Frozen at ${clock.current.toFixed(3)} s. Exports start here.`); };
  const fullscreen = () => { if (frame.current?.requestFullscreen) void frame.current.requestFullscreen().catch(() => setStatus('Full screen is unavailable here.')); else setStatus('Full screen is unavailable here.'); };
  const exportStill = async (scale: number) => {
    if (!runtime.current || busy) return;
    setBusy(true); setPlaying(false);
    try {
      exporting.current = true;
      runtime.current.resize(output.width, output.height);
      let blob = await runtime.current.capture(recipe.time);
      clock.current = recipe.time; setTime(recipe.time);
      if (scale > 1) {
        // Hard-edged enlargement: every rendered pixel becomes a scale × scale block.
        const bitmap = await createImageBitmap(blob), big = document.createElement('canvas');
        big.width = output.width * scale; big.height = output.height * scale;
        const ctx = big.getContext('2d')!; ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap, 0, 0, big.width, big.height);
        blob = await new Promise<Blob>((resolve, reject) => big.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed.')), 'image/png'));
      }
      downloadFile(blob, `${recipe.id}-${output.width * scale}x${output.height * scale}-t${recipe.time.toFixed(2)}.png`);
      setStatus(`Downloaded a ${output.width * scale} × ${output.height * scale} PNG.`);
    } catch (e) { setStatus((e as Error).message); } finally { exporting.current = false; resizePreview.current?.(); setBusy(false); }
  };
  const recordVideo = (seconds: number, fps: number) => {
    const target = canvas.current, instance = runtime.current;
    if (!target || !instance || !videoType || record.phase !== 'idle') return;
    setPlaying(false); exporting.current = true;
    instance.resize(output.width, output.height);
    const stream = target.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: videoType[0], videoBitsPerSecond: Math.round(Math.min(40e6, Math.max(6e6, output.width * output.height * fps * .12))) });
    const chunks: Blob[] = [];
    let request = 0, cancelled = false;
    const start = performance.now(), from = recipe.time;
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(request); stream.getTracks().forEach(t => t.stop());
      exporting.current = false; resizePreview.current?.(); recording.current = null;
      if (!cancelled && chunks.length) { downloadFile(new Blob(chunks, { type: videoType[0] }), `${recipe.id}-${seconds}s.${videoType[1]}`); setStatus(`Downloaded a ${seconds} s ${videoType[1].toUpperCase()} clip.`); }
      else if (cancelled) setStatus('Recording stopped. Nothing was saved.');
      setRecord({ phase: 'idle', progress: 0 });
    };
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      clock.current = Math.min(timeLimit(recipe.family), from + elapsed);
      try { instance.render(clock.current); } catch (e) { setError((e as Error).message); cancelled = true; recorder.stop(); return; }
      if (elapsed >= seconds) { setRecord({ phase: 'encoding', progress: 1 }); recorder.stop(); return; }
      setRecord({ phase: 'recording', progress: elapsed / seconds });
      request = requestAnimationFrame(tick);
    };
    recording.current = { stop: () => { cancelled = true; if (recorder.state !== 'inactive') recorder.stop(); } };
    recorder.start(500); setRecord({ phase: 'recording', progress: 0 });
    request = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (drawer) return;
      const target = e.target as HTMLElement;
      const typing = target.matches('input, textarea, select, [contenteditable=true]');
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z' && !typing) { e.preventDefault(); travel(e.shiftKey ? 'redo' : 'undo'); return; }
      if ((e.metaKey || e.ctrlKey) && k === 's') { e.preventDefault(); save(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' && target.closest('button, a, summary')) return;
      if (e.key === ' ' || k === 'r') { e.preventDefault(); doRoll(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { if (!target.closest('[role=tablist]')) { e.preventDefault(); navigate(e.key === 'ArrowRight' ? 1 : -1); } }
      else if (k === 'k' || k === 'p') { setTime(clock.current); setPlaying(p => !p); }
      else if (k === 'f') fullscreen();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const tabs = ['shape', 'color', 'frame'] as const;
  return <div className="studio" style={themeStyle}>
    <header className="topbar">
      {/* A full reload is intentional: it starts a fresh session with a new random study. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="wordmark" href="/" aria-label="Dithr, start over"><span className="wordmark-pixels" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i}/>)}</span><span className="wordmark-text">dithr</span></a>
      <nav className="topnav" aria-label="Browse">
        <button className="btn" aria-expanded={drawer === 'studies'} onClick={() => setDrawer('studies')}>Studies <span className="count">{presets.length}</span></button>
        <button className="btn" aria-expanded={drawer === 'palettes'} onClick={() => setDrawer('palettes')}>Palettes <span className="count">{palettePresets.length}</span></button>
        <a className="btn" href={`/demos?study=${recipe.family}`}>In context</a>
      </nav>
      <div className="topactions">
        <button className="btn" onClick={share} title="Copy a link to this exact recipe"><Icon name="link"/><span className="label">Share</span></button>
        <button className="btn" onClick={save} disabled={busy} aria-label="Save preset" title="Save to this device (Ctrl/⌘ S)"><Icon name={saved.some(s => s.family === recipe.family && s.seed === recipe.seed && JSON.stringify(s.palette) === JSON.stringify(recipe.palette) && JSON.stringify(s.parameters) === JSON.stringify(recipe.parameters)) ? 'saved' : 'save'}/><span className="label">Save</span></button>
        <button className="btn btn-fill" onClick={() => { end(); setDrawer('export'); }} aria-label="Export"><Icon name="download"/><span className="label">Export</span></button>
      </div>
    </header>
    <main className="workspace">
      <div className="stage-column">
        <section className="stage" aria-label="Shader preview">
          <div className="stage-fit">
            <div className="canvas-frame" ref={frame} style={{ '--ratio': output.width / output.height } as CSSProperties}>
              {!ready && !error && <div className="canvas-note">Starting the renderer…</div>}
              {error && <div className="canvas-note"><strong>This study could not render.</strong><p>{error}</p><button className="btn" onClick={() => setBackend('webgl2')}>Try WebGL2</button></div>}
              {record.phase !== 'idle' && <div className="recording-badge"><i/>Recording {Math.round(record.progress * 100)}%</div>}
            </div>
          </div>
        </section>
        <div className="identity">
          <div className="identity-name"><h1>{info.name}</h1><p><span className="series-name">{seriesOf(recipe.family)?.name ?? 'Archive'}</span> {info.subtitle}</p></div>
          <div className="stepper"><button className="btn icon-btn" aria-label="Previous study" title="Previous study, keeping your colors (←)" disabled={busy} onClick={() => navigate(-1)}><Icon name="left"/></button><output className="tabular">{info.number} / {presets.length}</output><button className="btn icon-btn" aria-label="Next study" title="Next study, keeping your colors (→)" disabled={busy} onClick={() => navigate(1)}><Icon name="right"/></button></div>
          <div className="transport">
            <button className="btn icon-btn" disabled={!ready || busy || record.phase !== 'idle'} aria-label={playing ? 'Pause animation' : 'Play animation'} title="Play or pause (K)" onClick={() => { setTime(clock.current); setPlaying(p => !p); }}><Icon name={playing ? 'pause' : 'play'}/></button>
            <output className="tabular">{time.toFixed(2)} s</output>
            <button className="btn icon-btn" aria-label="Full screen" title="Full screen (F)" onClick={fullscreen}><Icon name="expand"/></button>
          </div>
        </div>
        <div className="rollbar">
          <button className="roll-button" onClick={doRoll} disabled={busy || !canRoll || record.phase !== 'idle'} aria-keyshortcuts="Space R" title="Roll a new variation (Space)"><span className="roll-label">Roll</span><span className="roll-key" aria-hidden="true">Space</span></button>
          <fieldset className="scope"><legend>Changes</legend>{scopeNames.map(([key, name, hint]) => <button key={key} className="btn" aria-pressed={scope[key]} title={hint} onClick={() => setScope(s => ({ ...s, [key]: !s[key] }))}>{name}</button>)}</fieldset>
          <div className="history"><button className="btn icon-btn" aria-label="Undo recipe change" title="Undo (Ctrl/⌘ Z)" disabled={busy || !history.canUndo} onClick={() => travel('undo')}><Icon name="undo"/></button><button className="btn icon-btn" aria-label="Redo recipe change" title="Redo (Shift Ctrl/⌘ Z)" disabled={busy || !history.canRedo} onClick={() => travel('redo')}><Icon name="redo"/></button></div>
          {rollLog.length > 1 && <div className="roll-log" aria-label="Recent rolls">{rollLog.map(r => <button key={`${r.id}-${r.palette.join('')}`} aria-current={r.id === recipe.id && JSON.stringify(r.palette) === JSON.stringify(recipe.palette)} aria-label={`Return to ${r.name}`} title={r.name} onClick={() => choose(r)}><PaletteRail colors={r.palette}/><span className="tabular">{families[r.family].number}</span></button>)}</div>}
        </div>
      </div>
      <aside className="tune" aria-label="Tune">
        <div className="tune-tabs" role="tablist" aria-label="Tune">{tabs.map(name => <button key={name} role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
          onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'shape' : e.key === 'End' ? 'frame' : tabs[(tabs.indexOf(name) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; end(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}
          onClick={() => { end(); setTab(name); }}>{{ shape: 'Shape', color: 'Color', frame: 'Frame' }[name]}</button>)}</div>
        <div className="tune-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'shape' && <ShapeControls {...history} locks={locks} setLocks={setLocks} busy={busy} onMessage={setStatus}/>}
          {tab === 'color' && <ColorControls {...history} locks={locks} setLocks={setLocks} busy={busy} onMessage={setStatus} openPalettes={() => setDrawer('palettes')} pool={pool}/>}
          {tab === 'frame' && <FrameControls recipe={recipe} time={time} busy={busy} ready={ready} begin={begin} end={end} onSeek={seekTo} onFreeze={freeze} output={output} setOutput={setOutput} previewEdge={previewEdge} setPreviewEdge={setPreviewEdge} backend={backend} setBackend={setBackend} actualBackend={actualBackend}/>}
        </div>
        <SiteCredit palette={recipe.palette}/>
      </aside>
    </main>
    {drawer === 'studies' && <StudyDrawer current={recipe} saved={saved} onChoose={r => { choose(r.id.startsWith('saved-') ? r : { ...r, palette: r.palette }); setDrawer(null); }} onRemove={remove} onClose={() => setDrawer(null)} seriesFilter={seriesFilter} setSeriesFilter={setSeriesFilter}/>}
    {drawer === 'palettes' && <PaletteDrawer recipe={recipe} filter={paletteFilter} setFilter={setPaletteFilter} pool={pool} locked={locks.palette.some(Boolean)} onClose={() => setDrawer(null)}
      onChoose={colors => { end(); setRecipe(r => ({ ...r, review: 'candidate', palette: applyPalette(r.palette, colors, locks.palette) })); }}/>}
    {drawer === 'export' && <ExportDrawer recipe={recipe} output={output} setOutput={setOutput} busy={busy} ready={ready} onStill={exportStill} onFreeze={freeze} onRecord={recordVideo} onCancelRecord={() => recording.current?.stop()} record={record}
      videoFormat={videoType?.[1] ?? ''} onImport={r => { choose(r); setDrawer(null); setStatus('Recipe imported. Save it to keep it on this device.'); }} onShare={share} onMessage={setStatus} onClose={() => setDrawer(null)}/>}
    <div role="status" aria-live="polite" className="toast">{status}</div>
  </div>;
}
