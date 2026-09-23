'use client';
import { useCallback, useEffect, useState } from 'react';
import { demos, findDemo } from '../../src/demos/catalog';
import { families, isCrisp, isDamage, isEntropy, isIntricacy, serializeRecipe } from '../../src/seedbank/recipes';
import { ShaderSurface, type SurfaceReport } from './ShaderSurface';
import { Scene } from './Scenes';
import './demos.css';

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

  return <div className="app-shell demo-shell">
    <header className="masthead"><a className="brand" href="/" aria-label="Shader Seedbank home"><span className="brand-mark">✳</span><span>shader<span className="brand-secondary">seedbank</span></span></a><span className="header-note">Sharp pixels. Restless signals.</span><nav className="demo-nav" aria-label="Seedbank"><a href="/">The studies</a><a href="/demos" aria-current="page">In context <span>{demos.length}</span></a></nav></header>
    <main>
      <div className="intro demo-intro"><div><div className="eyebrow"><span className="tiny-dot"/> FIELD APPLICATIONS / 01—{demos.length}</div><h1>Good texture. <em>Right place.</em></h1><p>{demos.length} studies, out in the world. A considered home for every shader.</p></div><a href="#all-demos" className="text-link">Explore all {demos.length} contexts <span>↓</span></a></div>
      <section className="active-demo" id="active-demo" aria-label="Selected usage demo">
        <div className="demo-heading"><div><span className="eyebrow">{families[selected.family].number} / {families[selected.family].name.toUpperCase()}</span><h2>{!isCrisp(selected.family) && 'Deprecated · '}{selected.title}</h2></div><div className="demo-selector"><label className="visually-hidden" htmlFor="demo-select">Choose a usage demo</label><select id="demo-select" value={selected.family} onChange={event => choose(event.target.value)}>{!isCrisp(selected.family) && <option value={selected.family}>Archive / {families[selected.family].name}</option>}{demos.map(demo => <option value={demo.family} key={demo.family}>{families[demo.family].number} / {families[demo.family].name}</option>)}</select><button aria-label="Previous usage demo" onClick={() => choose(demos[index < 0 ? demos.length - 1 : (index + demos.length - 1) % demos.length].family)}>←</button><button aria-label="Next usage demo" onClick={() => choose(demos[(index + 1) % demos.length].family)}>→</button></div></div>
        <div className="demo-workspace"><div className="demo-preview">
          <div className={`usage-stage scene-${selected.family}${isDamage(selected.family) || isEntropy(selected.family) || isIntricacy(selected.family) ? ' scene-damage' : ''}`} data-family={selected.family} key={selected.family} role="group" aria-label={`${selected.title} composition`}>
            <Scene family={selected.family} surface={mounted ? <ShaderSurface demo={selected} playing={playing} reset={reset} onReport={onReport}/> : null}/>
          </div>
          <div className="demo-transport"><button disabled={!report.ready} onClick={() => setPlaying(value => !value)} aria-label={playing ? 'Pause demo motion' : 'Play demo motion'}><span>{playing ? 'Ⅱ' : '▶'}</span> {playing ? 'Pause motion' : 'Play motion'}</button><button disabled={!report.ready} onClick={() => { setPlaying(false); setReset(value => value + 1); }}>Reset still ↺</button><span className="demo-render-state" role="status">{report.error ? 'Still preview · live renderer unavailable' : report.ready ? `${playing ? 'LIVE' : 'FROZEN'} / ${report.backend?.toUpperCase()}` : 'Preparing surface…'}</span></div>
          <div className="demo-preview-caption"><span>Fictional art direction / live shader + HTML & CSS</span><span>{selected.context}</span></div>
          {report.error && <p className="demo-error">{report.error} The saved surface is shown instead.</p>}
        </div><aside className="demo-notes" aria-label="Usage guidance"><span className="context-tag">{selected.category} / {families[selected.family].name}</span><h3>Why it belongs here.</h3><p>{selected.purpose}</p><div className="usage-note"><span>01 / PLACEMENT</span><p>{selected.placement}</p></div><div className="usage-note"><span>02 / ART DIRECTION</span><p>{selected.tuning}</p></div><div className="demo-palette" aria-label="Curated palette">{selected.recipe.palette.map(hex => <span key={hex} style={{ background: hex }} title={hex}><span className="visually-hidden">{hex}</span></span>)}<span className="palette-note">A recipe for this context</span></div><a className="primary-button" href={`/?demo=${selected.family}`}>Edit this recipe <span>↗</span></a><button className="demo-download" onClick={downloadRecipe}>Download tuned recipe ↓</button></aside></div>
        {notice && <p className="demo-error" role="status">{notice}</p>}
        <details className="integration-notes"><summary>Use this surface in your project <span>Recipe, motion & integration +</span></summary><div className="integration-body"><div><span className="eyebrow">MOTION & MATERIAL</span><p>{selected.motion}</p><p>These demos render one surface at a time and pause outside the viewport or in a hidden tab. Reduced motion starts on the saved still.</p><p>Download the tuned JSON, then load it with the standalone renderer. The recipe contains the surface; the composition is HTML and CSS. See <a href="/consumer/index.html">the independent consumer ↗</a> for a working integration.</p></div><pre><code>{code}</code></pre></div></details>
      </section>
      <section id="all-demos" className="demo-gallery" aria-labelledby="gallery-title"><div className="gallery-heading"><div><span className="eyebrow">THE APPLICATION INDEX</span><h2 id="gallery-title">{demos.length} ways to <em>put it to work.</em></h2></div><p>Choose a context to see it in motion<br/>and explore the decisions behind it.</p></div><div className="context-grid">{demos.map(demo => <a className="context-card" href={`/demos?study=${demo.family}`} key={demo.family} aria-current={demo === selected ? 'true' : undefined} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); choose(demo.family, true); } }}><div className="context-thumbnail"><img src={`/context-previews/${demo.family}.png`} alt={`${demo.title} — ${demo.context}`} loading="lazy" width="960" height="640"/><span>{families[demo.family].number} / {families[demo.family].name}</span></div><div className="context-card-copy"><span><strong>{demo.title}</strong><small>{demo.context}</small></span><span className="context-arrow">↗</span></div></a>)}</div></section>
    </main><footer><span>SHADER SEEDBANK <span className="footer-star">✳</span> GROW SOMETHING UNEXPECTED.</span><span>{demos.length} studies. {demos.length} places to begin.</span></footer>
  </div>;
}
