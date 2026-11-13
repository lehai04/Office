import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/officeServer';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'van-phong-ao-api-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const handled = await handleApiRequest(req, res);
          if (!handled) {
            next();
          }
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const handled = await handleApiRequest(req, res);
          if (!handled) {
            next();
          }
        });
      },
    },
  ],
});

