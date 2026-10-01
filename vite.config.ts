import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE se nastavuje v GitHub Actions (např. /prosek-volejbal/). Lokálně './'.
export default defineConfig({ base: process.env.VITE_BASE || './', plugins: [react()] });
