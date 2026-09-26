const bayer4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cache = new Map<string, string>();
/** A 4×4 Bayer ramp from `from` to `to`, as a tiling SVG data URI (3px dither pixels). */
function fade(from: string, to: string) {
  const key = from + to;
  let url = cache.get(key);
  if (!url) {
    let rects = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const coverage = (x + .5) / 4, threshold = (bayer4[y * 4 + x] + .5) / 16;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${coverage > threshold ? to : from}"/>`;
    }
    url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" shape-rendering="crispEdges">${rects}</svg>`)}")`;
    cache.set(key, url);
  }
  return url;
}
/** The palette in the shaders' own language: flat roles joined by stationary dither. */
export function PaletteRail({ colors, className, inactiveFrom }: { colors: readonly string[]; className?: string; inactiveFrom?: number }) {
  return <span className={`rail${className ? ` ${className}` : ''}`} aria-hidden="true">
    {colors.map((color, i) => <span key={i} style={{ display: 'contents' }}>
      {i > 0 && <i className={`rail-fade${inactiveFrom !== undefined && i >= inactiveFrom ? ' inactive' : ''}`} style={{ backgroundImage: fade(colors[i - 1], color) }}/>}
      <i className={inactiveFrom !== undefined && i >= inactiveFrom ? 'inactive' : undefined} style={{ background: color }}/>
    </span>)}
  </span>;
}
