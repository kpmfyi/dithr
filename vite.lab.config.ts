import { defineConfig } from 'vite';
/** Local render lab for developing studies. Not part of the viewer or the export. */
export default defineConfig({ root: 'scripts/lab', publicDir: false, server: { host: '127.0.0.1', port: 5189, strictPort: true, hmr: false, fs: { allow: ['../..'] } } });
