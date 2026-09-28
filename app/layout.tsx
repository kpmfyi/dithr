import type { Metadata, Viewport } from 'next';
import './studio.css';
// Set the public origin at build time so share cards use absolute URLs.
// Keep Vercel's environment fallback for existing deployments.
const site = process.env.SEEDBANK_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: 'Dithr: roll and export pixel shaders',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'Dithr', description: 'Roll, tune and export crisp-pixel animated shaders. Free: PNG, video, React or plain JavaScript.', images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  description: 'A free generator for animated, crisp-pixel shaders. Roll a study and a palette, tune it, then export PNG, video, React or plain JavaScript. One hundred studies and 1000 palettes.',
};
export const viewport: Viewport = { themeColor: '#242424', colorScheme: 'dark' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
