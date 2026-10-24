import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' -> build ko kisi bhi folder / static host pe chala sakte ho
export default defineConfig({
  plugins: [react()],
  base: './',
});
