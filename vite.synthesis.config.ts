import { defineConfig } from 'vite';
export default defineConfig({ publicDir: false, build: { outDir: 'public/synthesis-lab', emptyOutDir: true,
  rolldownOptions: { input: 'scripts/synthesis-lab.html' } }, base: './' });
