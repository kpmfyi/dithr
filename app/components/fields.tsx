'use client';
import { useState } from 'react';
import { Icon } from './icons';

/** Numeric input with a draft: invalid text reverts on blur; valid values apply as typed. */
export function NumberField({ value, onChange, min, max, step, label, disabled, begin, end, id, className }: { id?: string; className?: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; label: string; disabled: boolean; begin: () => void; end: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input id={id} className={className} type="number" inputMode="decimal" aria-label={label} value={draft ?? String(value)} min={min} max={max} step={step} disabled={disabled}
    onFocus={() => { setDraft(String(value)); begin(); }} onBlur={() => { setDraft(null); end(); }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    onChange={e => { const raw = e.target.value; setDraft(raw); const n = Number(raw); if (raw.trim() && Number.isFinite(n) && n >= min && n <= max && (step !== 1 || Number.isInteger(n))) onChange(n); }}/>;
}
/** Six-digit hex with or without '#'; commits on blur or Enter. */
export function HexField({ color, index, onChange, busy, begin, end }: { color: string; index: number; onChange: (hex: string) => void; busy: boolean; begin: () => void; end: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { const raw = (draft ?? color).trim(); const value = raw.startsWith('#') ? raw : `#${raw}`; if (/^#[0-9a-f]{6}$/i.test(value)) onChange(value.toLowerCase()); setDraft(null); end(); };
  return <input className="hex" aria-label={`Palette hex ${index + 1}`} spellCheck={false} maxLength={7} value={draft ?? color} disabled={busy}
    onFocus={() => { setDraft(color); begin(); }} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>;
}
export function Lock({ label, locked, disabled, onClick }: { label: string; locked: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" className="lock" aria-label={`Lock ${label}`} aria-pressed={locked} disabled={disabled} onClick={onClick} title={locked ? `${label} is kept when you roll` : `Keep ${label.toLowerCase()} when you roll`}>
    <Icon name={locked ? 'lock' : 'unlock'}/>
  </button>;
}
/** Percentage used to paint the filled part of a range track. */
export const fill = (value: number, min: number, max: number) => ({ '--fill': `${((value - min) / (max - min)) * 100}%` }) as React.CSSProperties;
