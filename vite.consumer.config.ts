import { defineConfig } from 'vite';
export default defineConfig({ root: 'examples/consumer', base: './', build: { outDir: '../../public/consumer', emptyOutDir: true, target: 'esnext' }, server: { host: '127.0.0.1', port: 5188, strictPort: true } });
