/** Maker credit, shown under the tune panel and at the foot of /demos. */
export const MAKER_URL = 'https://kpm.fyi';

export function SiteCredit({ className = '' }: { className?: string }) {
  return <div className={`site-credit ${className}`}>
    <span className="maker">Made by <a href={MAKER_URL} target="_blank" rel="noopener">kpm.fyi</a></span>
  </div>;
}
