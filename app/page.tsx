'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceTime, timeLimit, isCrisp, deprecatedPresets, families, parseRecipe, presets, serializeRecipe, validateRecipe, type Backend, type Recipe } from '../src/seedbank/recipes';
import type { Runtime } from '../src/seedbank/renderer';
import { findDemo } from '../src/demos/catalog';
import { ExplorationControls, NumberField } from './components/exploration-controls';
import { useRecipeHistory } from './components/use-recipe-history';

const STORAGE = 'shader-seedbank.recipes.v1';
function download(blob: Blob, name: string) { const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export default function Seedbank() {
  const history = useRecipeHistory(presets[0]);
  const { recipe, setRecipe, begin, end } = history;
  const [backend, setBackend] = useState<Backend>('auto');
  const [actualBackend, setActualBackend] = useState('CONNECTING');
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'collection' | 'saved' | 'archive'>('collection');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState(recipe.time);
  const [measurement, setMeasurement] = useState<Awaited<ReturnType<Runtime['measure']>> | null>(null);
  const [showRecipe, setShowRecipe] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const current = useRef(recipe);
  const clock = useRef(recipe.time);
  const renderedRecipe = useRef<Recipe | null>(null);
  const seek = useRef(false);
  current.current = recipe;
  const info = families[recipe.family];
  const shelf = tab === 'collection' ? presets : tab === 'archive' ? deprecatedPresets : saved;
  const visibleStudies = shelf.filter(item => `${families[item.family].name} ${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    const context = new URLSearchParams(location.search).get('demo');
    if (context) {
      const demo = findDemo(context);
      if (demo) { setRecipe(validateRecipe(demo.recipe)); setPlaying(false); setStatus(`Loaded the tuned recipe for “${demo.title}”.`); }
      else setStatus('That usage recipe could not be found. Showing the first study.');
    }
    try { const data = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (!Array.isArray(data) || data.length > 48) throw new Error(); setSaved(data.map(validateRecipe)); }
    catch { setStatus('Stored presets could not be read. Import a recipe to recover a copy.'); }
  }, [setRecipe]);
  useEffect(() => {
    let stopped = false;
    let owned: Runtime | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false); setError(''); setMeasurement(null); setActualBackend('CONNECTING');
    // A canvas context cannot switch between WebGPU and WebGL. React keys the canvas by backend.
    const target = canvas.current!;
    import('../src/seedbank/renderer').then(({ createSeedbank }) => createSeedbank(target, current.current, backend)).then(instance => {
      owned = instance;
      if (stopped) { instance.dispose(); return; }
      runtime.current = instance;
      instance.setRecipe(current.current);
      const resize = () => {
        if (!frame.current) return;
        const { width, height } = frame.current.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / Math.max(width, height));
        instance.resize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
        instance.render(clock.current);
      };
      resize(); observer = new ResizeObserver(resize); observer.observe(frame.current!);
      setActualBackend(instance.backend.toUpperCase()); if (instance.fallbackReason) setStatus('WebGPU device check failed here. Using WebGL2.'); setReady(true);
    }).catch(e => { if (!stopped) { setError(String(e.message || e)); setActualBackend('UNAVAILABLE'); } });
    return () => { stopped = true; observer?.disconnect(); if (runtime.current === owned) runtime.current = null; owned?.dispose(); };
  }, [backend]);
  useEffect(() => {
    const previous = renderedRecipe.current;
    const jump = seek.current || !previous || previous.family !== recipe.family || previous.id !== recipe.id || previous.time !== recipe.time;
    const changed = !previous || previous.family !== recipe.family || previous.seed !== recipe.seed || previous.time !== recipe.time || JSON.stringify(previous.parameters) !== JSON.stringify(recipe.parameters) || JSON.stringify(previous.palette) !== JSON.stringify(recipe.palette);
    renderedRecipe.current = recipe; seek.current = false;
    if (!changed && !jump) return; // Naming a study must not restart its feedback.
    if (jump) { clock.current = recipe.time; setTime(recipe.time); }
    setMeasurement(null);
    try { runtime.current?.setRecipe(recipe); runtime.current?.render(clock.current); }
    catch (e) { setError((e as Error).message); }
  }, [recipe]);
  useEffect(() => {
    if (!ready || !playing || busy) return;
    let request = 0, previous = performance.now(), display = 0;
    const tick = (now: number) => {
      if (!document.hidden) {
        clock.current = advanceTime(current.current.family, clock.current, Math.min((now - previous) / 1000, 0.05));
        try { runtime.current?.render(clock.current); } catch (e) { setError((e as Error).message); setPlaying(false); return; }
        if (now - display > 200) { setTime(clock.current); display = now; }
      }
      previous = now; request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, ready, busy]);

  const choose = useCallback((next: Recipe) => { end(); seek.current = true; setRecipe(validateRecipe(next)); setStatus(''); setShowRecipe(false); }, [end, setRecipe]);
  const travel = (direction: 'undo' | 'redo') => { seek.current = true; history[direction](); setStatus(direction === 'undo' ? 'Returned to the previous recipe.' : 'Restored the next recipe.'); };
  const save = () => {
    try {
      const item = validateRecipe({ ...recipe, id: `saved-${crypto.randomUUID().slice(0, 8)}`, review: 'candidate' });
      if (saved.length >= 48) throw new Error('Your local shelf is full (48 presets). Remove one before saving.');
      const next = [item, ...saved]; localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); setStatus(`Saved “${item.name}” on this device.`);
    } catch (e) { setStatus((e as Error).message); }
  };
  const remove = (id: string) => {
    const next = saved.filter(item => item.id !== id);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); setStatus('Removed from this device.'); } catch { setStatus('Storage is unavailable.'); }
  };
  const importFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try { if (file.size > 16384) throw new Error('Recipe is too large (16 KB maximum).'); choose(parseRecipe(await file.text())); setStatus('Recipe imported. Save it to keep it on this device.'); }
    catch (e) { setStatus(`Import failed: ${(e as Error).message}`); }
  }, [choose]);
  const exportStill = async () => {
    if (!runtime.current || busy) return;
    setBusy(true); setPlaying(false);
    try {
      const blob = await runtime.current.capture(recipe.time);
      clock.current = recipe.time; setTime(recipe.time);
      download(blob, `${recipe.id}-t${recipe.time.toFixed(3)}.png`);
      setStatus(`Exported frozen frame at ${recipe.time.toFixed(3)}s. Download its recipe to recreate it.`);
    } catch (e) { setStatus((e as Error).message); } finally { setBusy(false); }
  };
  const measure = async () => {
    if (!runtime.current || busy) return;
    setBusy(true); setPlaying(false);
    try { const report = await runtime.current.measure(); setMeasurement(report); setTime(recipe.time); clock.current = recipe.time; setStatus('Measurement complete. CPU submission time is not GPU execution time.'); }
    catch (e) { setStatus((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="app-shell">
    <header className="masthead"><a className="brand" href="/" aria-label="Shader Seedbank home"><span className="brand-mark">✳</span><span>shader<span className="brand-secondary">seedbank</span></span></a><div className="header-note">Sharp pixels. Restless signals.</div><nav className="workbench-nav" aria-label="Seedbank"><a className="text-link" href="/demos">In context <span>↗</span></a><a className="text-link" href="/consumer/index.html" target="_blank" rel="noreferrer">Open consumer <span>↗</span></a></nav></header>
    <main>
      <div className="intro"><div><div className="eyebrow"><span className="tiny-dot"/> SIGNAL STUDIES / VOL. 003</div><h1>Small seeds. <em>Infinite surfaces.</em></h1><p>Sharp pixels, damaged signals, and unpredictable motion. Reroll, refine, and keep a frame.</p></div><div className="edition"><strong>{String(presets.length).padStart(2, '0')}</strong><span>active studies<br/>endlessly restless pixels</span></div></div>
      <div className="workspace">
        <aside className="collection"><div className="section-heading">THE COLLECTION <a className="study-index-link" href="/studies/index.html" aria-label="View all studies as a contact sheet">01—{String(presets.length).padStart(2, '0')} ↗</a></div><div className="shelf-tabs" role="tablist" aria-label="Preset shelf"><button role="tab" aria-selected={tab === 'collection'} onClick={() => { setTab('collection'); setQuery(''); }}>Studies</button><button role="tab" aria-selected={tab === 'saved'} onClick={() => { setTab('saved'); setQuery(''); }}>Saved <span>{saved.length}</span></button><button role="tab" aria-selected={tab === 'archive'} onClick={() => { setTab('archive'); setQuery(''); }}>Archive <span>{deprecatedPresets.length}</span></button></div>
          {tab === 'archive' && <p className="empty-shelf archive-note">Deprecated studies. Earlier soft effects, retained for saved recipes.</p>}
          <label className="shelf-search"><span className="visually-hidden">Search studies</span><input type="search" placeholder="Find a study…" value={query} onChange={e => setQuery(e.target.value)}/><span>{visibleStudies.length}/{shelf.length}</span></label>
          <div className="preset-list">{visibleStudies.map(item => <div className="preset-wrap" key={item.id}><button className={`preset-card ${recipe.family === item.family && (tab !== 'saved' || recipe.id === item.id) ? 'selected' : ''}`} onClick={() => choose(item)} disabled={busy}><div className={`preset-image ${item.family}`}><img src={`/previews/${item.family}.png`} alt="" loading="lazy" style={{ imageRendering: isCrisp(item.family) ? 'pixelated' : undefined }}/><span className="image-number">{families[item.family].number}</span></div><div className="preset-caption"><span><strong>{tab !== 'saved' ? families[item.family].name : item.name}</strong><small>{tab !== 'saved' ? item.tags.join(' / ') : `seed ${item.seed}`}</small></span><span className="select-arrow">↗</span></div></button>{tab === 'saved' && <button className="remove-preset" aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}>Remove</button>}</div>)}{query && visibleStudies.length === 0 && <p className="empty-shelf">No matching studies.<button className="clear-search" onClick={() => setQuery('')}>Clear search</button></p>}{tab === 'saved' && saved.length === 0 && !query && <p className="empty-shelf">A place for the good ones.<br/>Adjust a study and save your first preset.</p>}</div>
          <div className="collection-footer"><span className="tiny-dot"/> All studies are editable.<br/><span>Saved presets stay on this device.</span></div>
        </aside>
        <section className="studio" aria-label="Effect preview"><div className="studio-top"><span><span className="live-dot"/>{playing ? 'LIVE STUDY' : 'FROZEN STUDY'}</span><span>{actualBackend}</span></div><div className="canvas-frame" ref={frame}><canvas key={backend} ref={canvas} style={{ imageRendering: isCrisp(recipe.family) ? 'pixelated' : undefined }} aria-label={`${info.name} animated shader preview`}/>{!ready && !error && <div className="canvas-message">Warming up the light…</div>}{error && <div className="canvas-message error"><strong>Unable to render</strong><p>{error}</p><button onClick={() => setBackend('webgl2')}>Try WebGL2</button></div>}<div className="preview-caption"><span>STUDY {info.number}</span><h2>{info.subtitle}</h2></div><span className="corner-mark top-left"/><span className="corner-mark bottom-right"/></div><div className="transport"><button className="play-button" disabled={!ready || busy} aria-label={playing ? 'Pause animation' : 'Play animation'} onClick={() => setPlaying(p => !p)}>{playing ? 'Ⅱ' : '▶'}</button><span className="time-readout">{time.toFixed(2)} <small>s</small></span><button className="freeze-button" disabled={!ready || busy} onClick={() => { end(); setPlaying(false); setRecipe(r => ({ ...r, time: +clock.current.toFixed(3) })); }}>Freeze this frame</button><button className="reset-button" disabled={busy} onClick={() => { setPlaying(false); clock.current = recipe.time; setTime(recipe.time); runtime.current?.render(recipe.time); }} aria-label="Return to recipe time">↺</button></div><div className="study-description"><div><span className="eyebrow">{info.name.toUpperCase()} / {recipe.name}</span><p>{!isCrisp(recipe.family) && <strong>Deprecated · </strong>}{info.description}</p></div><a className="study-context-link" href={`/demos?study=${recipe.family}`}>See in context ↗</a></div></section>
        <aside className="inspector"><div className="section-heading">CULTIVATE <span>↗</span></div>
          <ExplorationControls {...history} busy={busy} undo={() => travel('undo')} redo={() => travel('redo')} onMessage={setStatus}/>
          <div className="frozen-time"><span>Frozen time</span><span><NumberField label="Frozen time in seconds" min={0} max={timeLimit(recipe.family)} step={0.001} value={recipe.time} disabled={busy} begin={begin} end={end} onChange={value => { setPlaying(false); setRecipe(r => ({ ...r, time: value })); }}/><small>s</small></span></div>
          <button className="primary-button" onClick={save} disabled={busy}>Save preset <span>＋</span></button><div className="export-actions"><button disabled={!ready || busy} onClick={exportStill}>Export PNG ↗</button><button onClick={() => download(new Blob([serializeRecipe(recipe)], { type: 'application/json' }), `${recipe.id}.json`)}>Recipe ↓</button></div><button className="import-button" onClick={() => input.current?.click()}>Import a recipe</button><input ref={input} type="file" accept=".json,application/json" className="visually-hidden" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/>
        </aside>
      </div>
      <div role="status" aria-live="polite" className={`status-line ${status ? 'has-message' : ''}`}>{status || 'A recipe keeps the seed, settings, palette, and frozen time together.'}</div>
      <section className="notebook"><div className="notebook-intro"><span className="eyebrow">THE FIELD NOTES</span><h3>Keep the recipe.<br/><em>Know the cost.</em></h3></div><div className="note"><span className="note-number">01 / REPRODUCIBLE</span><h4>A moment you can return to.</h4><p>PNG exports use your frozen time. Download the matching recipe to recreate the study in another session.</p><button className="text-link" onClick={() => setShowRecipe(v => !v)}>{showRecipe ? 'Hide recipe' : 'Inspect recipe'} ↗</button></div><div className="note"><span className="note-number">02 / MEASURED HERE</span><h4>{measurement ? `${measurement.medianMs.toFixed(2)} ms / submission` : 'Every device tells a different story.'}</h4>{measurement ? <p>{measurement.backend.toUpperCase()} · {measurement.width} × {measurement.height}<br/>60 frames · p95 {measurement.p95Ms.toFixed(2)} ms<br/>CPU time; GPU completion is not measured.</p> : <p>Measure this study in your browser. Results record the backend, adapter, resolution, and sampling conditions.</p>}<div className="measurement-actions"><button className="text-link" disabled={!ready || busy} onClick={measure}>{busy ? 'Working…' : 'Measure render'} ↗</button>{measurement && <button className="text-link" onClick={() => download(new Blob([JSON.stringify({ recipe, ...measurement }, null, 2)], { type: 'application/json' }), `${recipe.id}-measurement.json`)}>Report ↓</button>}</div></div><div className="note backend-note"><span className="note-number">03 / PORTABLE</span><h4>Same recipe, two backends.</h4><label className="backend-label">Render with<select aria-label="Renderer backend" value={backend} disabled={busy} onChange={e => setBackend(e.target.value as Backend)}><option value="auto">Auto select</option><option value="webgpu">WebGPU</option><option value="webgl2">WebGL2</option></select></label><p>Pixel-level differences across devices are expected.</p></div></section>
      {showRecipe && <pre className="recipe-code">{serializeRecipe(recipe)}</pre>}
    </main><footer><span>SHADER SEEDBANK <span className="footer-star">✳</span> GROW SOMETHING UNEXPECTED.</span><span>{presets.length} studies. Still growing.</span></footer>
  </div>;
}
