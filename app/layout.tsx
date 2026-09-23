import type { Metadata } from 'next';
import './globals.css';
import './workbench.css';
export const metadata: Metadata = {
  title: 'Shader Seedbank — sharp pixels, restless signals',
  description: 'Thirty crisp animated shader studies inspired by damaged displays. Explore grid failures, punctures and pressure fronts; reroll palettes, fine tune motion and save exact recipes.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
