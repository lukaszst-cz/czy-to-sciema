import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2020' }, server: { port: 5185 }, preview: { port: 5185 } });
