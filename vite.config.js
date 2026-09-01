import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:3000';

/**
 * Which sites may frame a range's widget comes from the range's own data, not from a list
 * in this file (story 36). In production the app server would set this header; in dev the
 * dev server does, so that the rule is actually exercised rather than merely intended.
 */
function frameAncestors() {
  return {
    name: 'frame-ancestors',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/w\/([\w-]+)/);
        if (!match) {
          // Everything that is not the widget refuses to be framed at all.
          res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
          return next();
        }
        try {
          const response = await fetch(`${API}/api/ranges/${match[1]}/embed-origins`);
          const origins = response.ok ? (await response.json()).origins : [];
          res.setHeader(
            'Content-Security-Policy',
            `frame-ancestors 'self' ${origins.join(' ')}`.trim(),
          );
        } catch {
          // API down: fail closed rather than allowing anyone to frame the widget.
          res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), frameAncestors()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: API, changeOrigin: false } },
  },
});
