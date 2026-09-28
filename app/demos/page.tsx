'use client';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { demos, findDemo } from '../../src/demos/catalog';
import { families, isCrisp, isDamage, isEntropy, isMechanism, isSynthesis, isIntricacy, isPattern, isRaster, isMatter, isLogic, serializeRecipe } from '../../src/seedbank/recipes';
import { paletteTheme } from '../../src/workbench/theme';
import { Icon } from '../components/icons';
import { PaletteRail } from '../components/palette-rail';
import { ShaderSurface, type SurfaceReport } from './ShaderSurface';
import { Scene } from './Scenes';
import './demos.css';
import './context.css';
import { SiteCredit } from '../components/site-credit';

export default function UsageDemos() {
  const [selected, setSelected] = useState(demos[0]);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reset, setReset] = useState(0);
  const [report, setReport] = useState<SurfaceReport>({ ready: false });
  const [notice, setNotice] = useState('');
  const index = demos.indexOf(selected);

  useEffect(() => {
    const readLocation = () => {
      const family = new URLSearchParams(location.search).get('study');
      const demo = findDemo(family) || demos[0];
      setSelected(demo); setPlaying(demo.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches);
      setNotice(family && !findDemo(family) ? 'That demo could not be found. Showing Broken LCD.' : '');
      setMounted(true);
    };
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged = () => { if (preference.matches) setPlaying(false); };
    readLocation(); window.addEventListener('popstate', readLocation); preference.addEventListener('change', motionChanged);
    return () => { window.removeEventListener('popstate', readLocation); preference.removeEventListener('change', motionChanged); };
  }, []);

  const choose = (family: string, scroll = false) => {
    const demo = findDemo(family);
    if (!demo) return;
    if (demo !== selected) {
      setSelected(demo); setReport({ ready: false }); setReset(0); setNotice('');
      setPlaying(demo.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches);
      history.pushState(null, '', `/demos?study=${demo.family}`);
    }
    if (scroll) document.getElementById('active-demo')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  const onReport = useCallback((next: SurfaceReport) => setReport(next), []);
  const downloadRecipe = () => {
    const url = URL.createObjectURL(new Blob([serializeRecipe(selected.recipe)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${selected.recipe.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const code = `import { createSeedbank, parseRecipe } from './src/seedbank';

// Place the downloaded recipe beside your page.
const response = await fetch('./${selected.recipe.id}.json');
if (!response.ok) throw new Error('Recipe could not be loaded');
const recipe = parseRecipe(await response.text());
const surface = await createSeedbank(canvas, recipe, 'auto');
surface.resize(960, 640);
surface.render(recipe.time); // the curated frozen moment

// Your app owns animation, resize, and visibility.
// Call surface.dispose() when removing the canvas.`;

  const theme = paletteTheme(selected.recipe.palette);
  const themeStyle = { '--p0': theme.roles[0], '--p1': theme.roles[1], '--p2': theme.roles[2], '--p3': theme.roles[3], '--p4': theme.roles[4], '--accent': theme.accent, '--on-accent': theme.onAccent, '--accent-text': theme.accentText } as CSSProperties;
  const info = families[selected.family];
  return <div className="studio context-page" style={themeStyle}>
    <header className="topbar">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="wordmark" href="/" aria-label="Dithr studio"><span className="wordmark-pixels" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i}/>)}</span><span className="wordmark-text">dithr</span></a>
      <nav className="topnav" aria-label="Dithr">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn" href="/">Studio</a>
        <a className="btn" href="/demos" aria-current="page">In context <span className="count">{demos.length}</span></a>
      </nav>
      <div className="topactions"><a className="btn btn-fill" href={`/?demo=${selected.family}`}>Edit this recipe</a></div>
    </header>
    <main className="context-main">
      <div className="context-intro">
        <h1>In context</h1>
        <p>Every study placed in a fictional layout: a sleeve, a stage screen, a poster, a cover. The shader supplies the surface; type and interface stay in sharp HTML. Each comes with notes on placement and a tuned recipe.</p>
      </div>
      <section className="active-demo" id="active-demo" aria-label="Selected usage demo">
        <div className="context-heading">
          <div><h2>{info.name}</h2><p><span className="series-name">{info.number}</span> {!isCrisp(selected.family) && 'Archived study. '}{selected.context}</p></div>
          <div className="stepper">
            <label className="sr-only" htmlFor="demo-select">Choose a usage demo</label>
            <select id="demo-select" className="select" value={selected.family} onChange={event => choose(event.target.value)}>{!isCrisp(selected.family) && <option value={selected.family}>Archive / {info.name}</option>}{demos.map(demo => <option value={demo.family} key={demo.family}>{families[demo.family].number} {families[demo.family].name}</option>)}</select>
            <button className="btn icon-btn" aria-label="Previous usage demo" onClick={() => choose(demos[index < 0 ? demos.length - 1 : (index + demos.length - 1) % demos.length].family)}><Icon name="left"/></button>
            <button className="btn icon-btn" aria-label="Next usage demo" onClick={() => choose(demos[(index + 1) % demos.length].family)}><Icon name="right"/></button>
          </div>
        </div>
        <div className="context-workspace">
          <div className="context-preview">
            <div className={`usage-stage scene-${selected.family}${isDamage(selected.family) || isEntropy(selected.family) || isIntricacy(selected.family) || (isSynthesis(selected.family) || isMechanism(selected.family)) || isLogic(selected.family) ? ' scene-damage' : ''}${isPattern(selected.family) ? ' scene-pattern' : isRaster(selected.family) ? ' scene-raster' : isMatter(selected.family) ? ' scene-matter' : ''}`} data-family={selected.family} key={selected.family} role="group" aria-label={`${selected.title} composition`}>
              <Scene family={selected.family} surface={mounted ? <ShaderSurface demo={selected} playing={playing} reset={reset} onReport={onReport}/> : null}/>
            </div>
            <div className="context-transport">
              <button className="btn" disabled={!report.ready} onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause demo motion' : 'Play demo motion'}><Icon name={playing ? 'pause' : 'play'}/>{playing ? 'Pause motion' : 'Play motion'}</button>
              <button className="btn" disabled={!report.ready} onClick={() => { setPlaying(false); setReset(value => value + 1); }} aria-label="Reset still"><Icon name="reset"/>Back to the still</button>
              <span className="context-state" role="status">{report.error ? 'Showing a saved still; the live renderer is unavailable here.' : report.ready ? `${playing ? 'Live' : 'Paused'}, ${report.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}` : 'Preparing the surface…'}</span>
              <span className="context-credit">Fictional art direction</span>
            </div>
            {report.error && <p className="error-note">{report.error} The saved surface is shown instead.</p>}
          </div>
          <aside className="context-notes" aria-label="Usage guidance">
            <h3>Why it belongs here</h3><p>{selected.purpose}</p>
            <h4>Placement</h4><p>{selected.placement}</p>
            <h4>Tuning</h4><p>{selected.tuning}</p>
            <h4>Motion</h4><p>{selected.motion}</p>
            <div className="context-palette"><PaletteRail colors={selected.recipe.palette}/><span>The tuned palette for this layout</span></div>
            <div className="export-row"><a className="btn btn-fill" href={`/?demo=${selected.family}`}>Edit this recipe</a><button className="btn" onClick={downloadRecipe}>Download tuned recipe</button></div>
          </aside>
        </div>
        {notice && <p className="error-note" role="status">{notice}</p>}
        <details className="integration-notes"><summary>Use this surface in your project</summary><div className="integration-body"><div><p>These pages render one surface at a time and pause outside the viewport or in a hidden tab. Reduced motion starts on the saved still.</p><p>Download the tuned recipe, then load it with the standalone renderer. The recipe holds the surface; the layout is HTML and CSS. For a complete project with a runnable page and React component, use Export in the studio. <a href="/consumer/index.html">A minimal standalone integration</a> is also available.</p></div><pre className="code-box"><code>{code}</code></pre></div></details>
      </section>
      <section id="all-demos" className="context-gallery" aria-labelledby="gallery-title">
        <h2 id="gallery-title">All {demos.length} layouts</h2>
        <div className="study-grid">{demos.map(demo => <a className="study-card" href={`/demos?study=${demo.family}`} key={demo.family} aria-current={demo === selected ? 'true' : undefined} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); choose(demo.family, true); } }}>
          <img src={`/context-previews/${demo.family}.png`} alt={`${demo.title}, ${demo.context}`} loading="lazy" width="960" height="640"/>
          <strong><span>{families[demo.family].number}</span>{families[demo.family].name}</strong><small>{demo.context}</small>
        </a>)}</div>
      </section>
      <SiteCredit className="context-credit" palette={selected.recipe.palette}/>
    </main>
  </div>;
}
