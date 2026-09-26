/** Maker credit and an optional tip link, shown under the tune panel and at the foot of /demos. */
export const MAKER_URL = 'https://kpm.fyi';
// The donation page. Change this one value to point the link elsewhere.
export const DONATE_URL = 'https://ko-fi.com/kpmfyi';

// A 12×12 pixel cup. The coffee takes the palette accent and the steam takes
// two palette roles, so the icon re-colors with every roll like the rest of the chrome.
const cup = ['..#..#......', '...#..#.....', '..#..#......', '............', '.########...', '.#......###.', '.#......#.#.', '.#......#.#.', '.#......###.', '..#....#....', '...####.....', '............'];
const coffee = ['............', '............', '............', '............', '............', '..######....', '..######....', '..######....', '..######....', '...####.....', '............', '............'];
const path = (rows: string[], rowFrom = 0, rowTo = 12) => rows.flatMap((row, y) => y < rowFrom || y >= rowTo ? [] : [...row].map((c, x) => c === '#' ? `M${x} ${y}h1v1h-1z` : '')).join('');

function Cup() {
  return <svg className="credit-cup" width="16" height="16" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path className="steam" d={path(cup, 0, 3)}/>
    <path d={path(cup, 4)} fill="currentColor"/>
    <path d={path(coffee)} fill="var(--accent)"/>
  </svg>;
}

export function SiteCredit({ className = '' }: { className?: string }) {
  return <div className={`site-credit ${className}`}>
    <span className="maker">Made by <a href={MAKER_URL} target="_blank" rel="noopener">kpm.fyi</a></span>
    <a className="tip" href={DONATE_URL} target="_blank" rel="noopener"><Cup/>Buy me a coffee</a>
  </div>;
}
