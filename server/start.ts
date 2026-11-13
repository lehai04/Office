import { createServer } from 'node:http';
import { handleApiRequest } from './officeServer';

const port = Number(process.env.PORT || 8080);
const allowedOrigin = process.env.OFFICE_WEB_ORIGIN || 'https://lehai04.github.io';

export const officeServer = createServer(async (req, res) => {
  res.setHeader('Vary', 'Origin');
  if (req.headers.origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(req.headers.origin === allowedOrigin ? 204 : 403).end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/api/reset') {
    res.writeHead(404).end();
    return;
  }

  if (!(await handleApiRequest(req, res))) {
    res.writeHead(404).end();
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Office API listening on port ${port}`);
});
