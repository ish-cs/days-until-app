/**
 * Dev-only HTTP shim so /.netlify/functions/groq works with Vite's proxy
 * (Netlify production unchanged). Loads env from .env via dotenv.
 */
import 'dotenv/config';
import http from 'node:http';
import { handler as groqHandler } from '../netlify/functions/groq.js';

const PORT = Number(process.env.LOCAL_FUNCTIONS_PORT) || 9999;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || url.pathname !== '/.netlify/functions/groq') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  try {
    const result = await groqHandler({
      httpMethod: 'POST',
      body,
      headers: req.headers,
      path: url.pathname,
    });

    const payload =
      typeof result.body === 'string' ? result.body : JSON.stringify(result.body);

    res.writeHead(result.statusCode || 200, { 'Content-Type': 'application/json' });
    res.end(payload);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local Netlify functions shim at http://127.0.0.1:${PORT}`);
});
