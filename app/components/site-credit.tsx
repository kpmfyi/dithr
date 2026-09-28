'use client';
import { useEffect, useRef } from 'react';

/** Maker credit, shown under the tune panel and at the foot of /demos. */
export const MAKER_URL = 'https://kpm.fyi';

const CELL = 7; // CSS pixels per mosaic cell
const NEUTRAL = ['#2a2a2a', '#3a3a3a', '#555555', '#7a7a7a', '#a3a3a3'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A slowly drifting, ordered-dither band field painted with the active palette. */
function paint(canvas: HTMLCanvasElement, colors: readonly string[], t: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = .5 + .27 * Math.sin(x * .11 + t * .7 + y * .55) + .23 * Math.sin(x * .043 - t * .4 + y * .9);
    const scaled = Math.min(.999, Math.max(0, v)) * (colors.length - 1);
    const i = Math.floor(scaled);
    ctx.fillStyle = scaled - i > (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16 ? colors[i + 1] : colors[i];
    ctx.fillRect(x, y, 1, 1);
  }
}

export function SiteCredit({ className = '', palette }: { className?: string; palette?: readonly string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = palette?.join('') ?? '';
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const colors = palette && palette.length > 1 ? palette : NEUTRAL;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, timer = 0;
    const size = () => { el.width = Math.max(1, Math.ceil(el.clientWidth / CELL)); el.height = Math.max(1, Math.ceil(el.clientHeight / CELL)); paint(el, colors, t); };
    const tick = () => { if (!document.hidden) { t += .12; paint(el, colors, t); } };
    size();
    const observer = new ResizeObserver(size); observer.observe(el);
    if (!still) timer = window.setInterval(tick, 120);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className={`site-credit ${className}`}>
    <canvas ref={canvas} className="credit-field" aria-hidden="true"/>
    <span className="maker">Made by <a href={MAKER_URL} target="_blank" rel="noopener noreferrer">kpm.fyi</a></span>
  </div>;
}
