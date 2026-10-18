import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  // The hosted demo lives below an existing website. Local development stays at /;
  // the standalone Docker image overrides the production base with --base=/.
  base: command === 'build' || isPreview ? '/dev/demo/connect-981/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/graphql': 'http://127.0.0.1:4000',
      '/health': 'http://127.0.0.1:4000',
      '/auth': 'http://127.0.0.1:4000',
    },
  },
}));
