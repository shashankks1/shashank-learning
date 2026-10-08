import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Browser storage is scoped to the origin (protocol + host + port).
// Dev and preview share one fixed port so your data is the same whichever you run.
const PORT = 5180;

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
