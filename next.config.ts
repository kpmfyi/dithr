import type { NextConfig } from "next";

// The studio and demos are entirely client-rendered, so static hosts (Vercel)
// get a static export: `npm run build:static` sets SEEDBANK_STATIC_EXPORT=1 and
// vinext prerenders every route into dist/client. The default build keeps the
// server output used by `vinext start`.
const nextConfig: NextConfig = {
  ...(process.env.SEEDBANK_STATIC_EXPORT === '1' ? { output: 'export' as const } : {}),
};

export default nextConfig;
