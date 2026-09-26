import type { Metadata, Viewport } from 'next';
import './studio.css';
export const metadata: Metadata = {
  title: 'Shader Seedbank: roll and export pixel shaders',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: 'Shader Seedbank', description: 'Roll, tune and export crisp-pixel animated shaders. Free: PNG, video, React or plain JavaScript.', images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  description: 'A free generator for animated, crisp-pixel shaders. Roll a study and a palette, tune it, then export PNG, video, React or plain JavaScript. Ninety studies and 729 palettes.',
};
export const viewport: Viewport = { themeColor: '#242424', colorScheme: 'dark' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
