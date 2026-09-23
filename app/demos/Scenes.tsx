import type { ReactNode } from 'react';
import { families, isPixelSorter, isDeparture, isDamage, isEntropy, isIntricacy, type Family } from '../../src/seedbank/recipes';

// The shader supplies only light or material. All typography, geometry, and interface
// elements are independent DOM/SVG layers, so they remain sharp and accessible.
export function Scene({ family, surface }: { family: Family; surface: ReactNode }) {
  if (isDeparture(family) || isDamage(family) || isEntropy(family) || isIntricacy(family)) return <>
    <div className="departure-surface scene-surface">{surface}</div>
    <div className="departure-edition"><span>SEEDBANK / {isIntricacy(family) ? 'INTRICACY STUDIES' : isEntropy(family) ? 'ENTROPY STUDIES' : isDamage(family) ? 'DAMAGE STUDIES' : 'DEPARTURES'}</span><span>{families[family].number} — 2026</span></div>
    <div className="departure-caption"><span>STUDIES IN MOTION</span><h3>{families[family].name}</h3><p>{families[family].subtitle}</p></div>
  </>;
  if (isPixelSorter(family)) return <>
    <div className="lcd-poster-surface scene-surface">{surface}</div><div className="lcd-poster-rail"/>
    <div className="lcd-poster-head"><span>AFTERIMAGE / MOVING IMAGE EDITIONS</span><span>EDITION {families[family].number}</span></div>
    <div className="lcd-poster-date"><span>Image</span><span>in motion</span></div>
    <h3 className="lcd-poster-title"><span>{families[family].name}</span><span>afterimage</span></h3>
    <div className="lcd-poster-foot"><span>IMAGE / SOUND / STATIC</span><span>SIGNAL STUDIES · 2026</span></div>
  </>;
  switch (family) {
    case 'caustics': return <>
      <div className="pool-water scene-surface">{surface}<div className="pool-steps"/><span className="pool-coordinate">34° 01′ N / 118° 29′ W</span></div>
      <div className="scene-copy bathhouse-copy"><span className="scene-brand">T I D E / BATHHOUSE</span><h3>The art<br/>of slowing<br/><em>down.</em></h3><p>Salt water. Warm stone.<br/>A little time that belongs to you.</p><div className="scene-rule"/><span className="scene-micro">A SANCTUARY AT THE WATER’S EDGE</span></div><span className="scene-bottom">01 / THE TIDAL POOL <span>32°C · SALT WATER</span></span>
    </>;
    case 'phosphor': return <>
      <div className="instrument-heading"><span className="scene-brand">FORMANT®</span><span className="scene-micro">EXPERIMENTAL SOUND OBJECTS / 002</span></div>
      <div className="instrument"><div className="instrument-top"><b>SIGNAL / 01</b><span>● ANALOG SPIRIT</span></div><div className="instrument-screen scene-surface">{surface}<span className="screen-label">TRACE A · FREE RUN</span></div><div className="instrument-controls">{['FREQUENCY', 'TIMBRE', 'LEVEL'].map((label, i) => <div key={label}><span className={`knob knob-${i}`}/><span>{label}</span></div>)}<div className="instrument-readout"><strong>0440</strong><span>CONCEPT OSCILLATOR / Hz</span></div></div></div>
      <div className="instrument-caption"><h3>A signal<br/><em>you can feel.</em></h3><p>Light, rhythm, repetition.<br/>An instrument with a pulse.</p></div>
    </>;
    case 'halftone': return <>
      <div className="poster-meta"><b>FORM & FREQUENCY</b><span>AN INDEPENDENT ARTS WEEKENDER</span></div><div className="poster-field scene-surface">{surface}</div><h3 className="poster-title">FORM<br/><span>&</span><br/>FREQ.</h3><div className="poster-date">17—19<br/><span>OCTOBER / VOL. 08</span></div><div className="poster-bottom"><span>PRINT / SOUND / MOVING IMAGE</span><b>COME CURIOUS.</b></div>
    </>;
    case 'ink': return <>
      <span className="publisher scene-brand">STILLWATER / EDITIONS</span><div className="book-shadow"/><div className="poetry-book"><div className="book-art scene-surface">{surface}</div><div className="book-spine"/><span className="book-number">POETRY / 014</span><h3>Where<br/>water<br/><em>remembers</em></h3><span className="book-author">ELIN MORROW</span><span className="book-foot">Notes on what we carry.</span></div><div className="book-note"><span className="scene-micro">THE POETRY SERIES</span><p>Some things stay<br/>long after<br/>the tide.</p><span>014 — 01</span></div>
    </>;
    case 'iridescence': return <>
      <span className="scene-brand object-brand">OTHERSPACE / MEMBERS CLUB</span><div className="foil-intro"><span className="scene-micro">A DIFFERENT KIND OF BELONGING</span><h3>A little<br/><em>otherworldly.</em></h3></div><div className="membership-card"><div className="card-foil scene-surface">{surface}</div><span className="card-wordmark">o<span>⊹</span></span><span className="card-edition">OTHERSPACE<br/>FOUNDING EDITION</span><div className="card-bottom"><span>MEMBER / 00483</span><span>EST. 2026</span></div><div className="card-chip"/></div><span className="scene-bottom">A SPACE FOR THE UNEXPECTED <span>YOUR INVITATION TO MORE.</span></span>
    </>;
    case 'shafts': return <>
      <div className="gallery-light scene-surface">{surface}</div><div className="gallery-column column-left"/><div className="gallery-column column-right"/><div className="gallery-shade"/><div className="gallery-meta"><span className="scene-brand">OPEN / SPACE</span><span className="scene-micro">AN EXHIBITION IN THREE ROOMS</span></div><h3 className="gallery-title">Room<br/>for <em>light.</em></h3><div className="gallery-foot"><span>ON THE THINGS<br/>WE CANNOT HOLD</span><span>ROOM 01<br/>LIGHT & ATMOSPHERE</span></div><div className="gallery-floor"/>
    </>;
    case 'aurora': return <>
      <div className="northern-sky scene-surface">{surface}</div><div className="sky-shade"/><div className="mountain far"/><div className="mountain near"/><div className="expedition-meta"><span className="scene-brand">NORTH OF ORDINARY</span><span className="scene-micro">69° N / TROMSØ</span></div><h3 className="northern-title">Stay up<br/><em>for the sky.</em></h3><div className="expedition-bottom"><span className="expedition-line"/><div><span className="scene-micro">THE NORTHERN LIGHTS JOURNAL</span><p>Long nights. Unforgettable light.</p></div><span className="expedition-number">N° 04</span></div>
    </>;
    case 'moire': return <>
      <div className="record-meta"><span className="scene-brand">OFFSET / RECORDS</span><span className="scene-micro">STEREO / 33⅓ RPM</span></div><div className="record-type"><span className="scene-micro">ELSEWHERE ENSEMBLE</span><h3>PHASE<br/>SHIFT<span>—</span></h3><p>Two rhythms.<br/>A third possibility.</p><span className="record-index">OF—008 / SIDE A</span></div><div className="record-disc scene-surface">{surface}<div className="disc-label"><span>OFFSET</span><b>A</b><i/></div></div><div className="record-baseline"/>
    </>;
    case 'contours': return <>
      <div className="trail-map scene-surface">{surface}<svg className="trail-route" viewBox="0 0 500 600" aria-label="Illustrated switchback route" role="img"><path className="trail-outline" d="M135 460 C35 380 210 380 185 300 S390 315 330 220 S260 115 380 100"/><path className="trail-path" d="M135 460 C35 380 210 380 185 300 S390 315 330 220 S260 115 380 100"/><circle cx="135" cy="460" r="10"/><circle cx="380" cy="100" r="10"/><text x="155" y="490">TRAILHEAD</text><text x="280" y="73">THE RIDGE / 1,840 M</text></svg><span className="map-scale">ILLUSTRATED ROUTE ━━━ N ↑</span></div><div className="trail-copy scene-copy"><span className="scene-brand">WAYFARER / FIELD GUIDE</span><span className="scene-micro trail-kicker">WALK N° 032</span><h3>Take the<br/><em>long way.</em></h3><p>The ridge loop.<br/>A day above the everyday.</p><div className="trail-stats"><div><strong>12.4</strong><span>KILOMETRES</span></div><div><strong>680</strong><span>METRES UP</span></div></div><span className="scene-micro">MODERATE / A FULL DAY OUT</span></div>
    </>;
    case 'weave': return <>
      <div className="textile-copy scene-copy"><span className="scene-brand">COMMON THREAD</span><span className="scene-micro textile-kicker">THE EVERYDAY COLLECTION</span><h3>The fabric<br/><em>of quiet.</em></h3><p>A closer look at the things<br/>we live with every day.</p><div className="material-spec"><span>04 / SILT</span><strong>Warp. Weft. Warmth.</strong><span>WOVEN TEXTILE / MATERIAL CONCEPT</span></div></div><div className="fabric-shadow"/><div className="fabric-swatch"><div className="fabric-texture scene-surface">{surface}</div><div className="fabric-seam"/><div className="fabric-tag"><b>ct.</b><span>SILT / N° 04<br/>COMMON THREAD</span></div></div><span className="textile-foot scene-micro">SMALL DETAILS. A DIFFERENT FEEL.</span>
    </>;
    case 'dunes': return <>
      <div className="desert-image scene-surface">{surface}<span className="desert-image-label">A STUDY IN WIND & TIME</span></div><div className="journal-copy scene-copy"><span className="scene-brand">ELSEWHERE / JOURNAL</span><span className="scene-micro journal-kicker">VOL. 07 — THE SLOW ISSUE</span><h3>Elsewhere<br/>starts<br/><em>here.</em></h3><p>In a landscape that never<br/>stands still, we learn to.</p><span className="journal-index">THE DESERT CHAPTER<br/>WORDS FROM THE OPEN ROAD</span></div><span className="journal-page">028 — 029</span>
    </>;
    case 'ripples': return <>
      <span className="scene-brand calm-brand">STILL / A SPACE TO PAUSE</span><div className="calm-copy"><span className="scene-micro">STEP OUT OF THE CURRENT</span><h3>Less noise.<br/><em>More here.</em></h3><p>Nothing to finish.<br/>Nowhere else to be.</p><div className="calm-session"><span className="session-mark">◌</span><span>Rain on still water<small>A VISUAL PAUSE</small></span></div></div><div className="water-lens scene-surface">{surface}<div className="lens-rim"/></div><span className="scene-bottom">TAKE A MOMENT <span>LET THE REST WAIT.</span></span>
    </>;
    case 'starfield': return <>
      <div className="deep-space scene-surface">{surface}</div><div className="space-shade"/><div className="orbit-line"/><div className="planet-horizon"/><div className="mission-meta"><span className="scene-brand">ORBITAL / ARCHIVE</span><span className="scene-micro">TRANSMISSION 001</span></div><div className="space-title"><span className="scene-micro">A JOURNEY THROUGH THE QUIET</span><h3>Somewhere,<br/><em>beyond.</em></h3></div><div className="mission-marker"><i/><span>THE PALE BLUE DOT<br/>YOU ARE HERE</span></div><div className="mission-foot"><span>CHAPTER 01 / DEPARTURE</span><span>∞ / THE UNKNOWN AWAITS</span></div>
    </>;
    case 'marble': return <>
      <div className="furniture-copy scene-copy"><span className="scene-brand">FORME / OBJECTS FOR LIVING</span><span className="scene-micro furniture-kicker">THE PEBBLE TABLE</span><h3>Stone,<br/><em>softened.</em></h3><p>A quiet weight.<br/>A softer way to gather.</p><div className="material-spec"><span>FINISH / VERDE PALE</span><strong>One continuous gesture.</strong><span>MINERAL SURFACE / MATERIAL CONCEPT</span></div></div><div className="table-shadow"/><div className="table-pedestal"/><div className="table-edge"/><div className="table-top scene-surface">{surface}</div><span className="furniture-caption scene-micro">PEBBLE 01 / THE MATERIAL EDIT</span>
    </>;
    case 'glass': return <>
      <div className="window-wall"/><div className="window-light"/><div className="glass-copy scene-copy"><span className="scene-brand">LEADED / GLASS STUDIO</span><span className="scene-micro glass-kicker">SPACES WITH A SOUL</span><h3>Light,<br/>beautifully<br/><em>divided.</em></h3><p>A thousand small colors.<br/>One entirely different room.</p><span className="scene-micro glass-spec">THE GARDEN WINDOW / STUDY 015</span></div><div className="window-frame"><div className="window-pane scene-surface">{surface}<div className="window-mullion vertical"/><div className="window-mullion horizontal"/></div><div className="window-sill"/></div>
    </>;
    case 'broken-lcd': return <>
      <div className="lcd-poster-surface scene-surface">{surface}</div><div className="lcd-poster-rail"/>
      <div className="lcd-poster-head"><span>AFTERIMAGE / DIGITAL ARTS WEEK</span><span>EDITION 016</span></div>
      <div className="lcd-poster-date"><span>October</span><span>12—14 · 2026</span></div>
      <h3 className="lcd-poster-title"><span>Signal</span><span>afterimage</span></h3>
      <div className="lcd-poster-foot"><span>IMAGE / SOUND / STATIC</span><span>SAN FRANCISCO · CA</span></div>
    </>;
  }
}
