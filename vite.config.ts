import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // La API de autenticación se sirve bajo el mismo origen (/api): la cookie de sesión es de primera parte y no hace falta CORS.
    // En producción lo hace el rewrite de vercel.json; aquí, este proxy hacia el backend local.
    proxy: { '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080', changeOrigin: false } }
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
          if (id.includes('/motion') || id.includes('framer-motion')) return 'motion';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('@tanstack') || id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms-tables';
          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Las pruebas de pantalla completa pasan solas, pero con todas en paralelo en una PC lenta superan los 5 s por defecto.
    testTimeout: 15000,
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false
  }
});
