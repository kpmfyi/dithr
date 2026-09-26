'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

/** Modal side sheet: Escape closes, focus moves in on open and back on close. */
export function Drawer({ title, onClose, tools, footer, children, label }: { title: string; label?: string; onClose: () => void; tools?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // Runs once per opening: parent re-renders (the playback clock) must not move focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null, root = panel.current;
    root?.querySelector<HTMLElement>('input, button:not(.drawer-close)')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    // Keep Tab inside the dialog while it is open.
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href]')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key, true); root?.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', key, true); root?.removeEventListener('keydown', trap); opener?.focus?.(); };
  }, []);
  return <>
    <button type="button" className="scrim" tabIndex={-1} aria-label="Close panel" onClick={onClose}/>
    <div className="drawer" role="dialog" aria-modal="true" aria-label={label ?? title} ref={panel}>
      <div className="drawer-head"><h2>{title}</h2><button className="btn icon-btn drawer-close" aria-label="Close" onClick={onClose}><Icon name="close"/></button></div>
      {tools ? <div className="drawer-tools">{tools}</div> : <div/>}
      <div className="drawer-body">{children}</div>
      {footer ? <div className="drawer-foot">{footer}</div> : <div/>}
    </div>
  </>;
}
