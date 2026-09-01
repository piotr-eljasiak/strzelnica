/**
 * Serves the fake range website on its own port.
 *
 * A separate port means a separate origin, which is the entire point: the widget is then
 * genuinely a third-party frame, with real CORS, real frame-ancestors and real cookie
 * behaviour. Serving it from the app's own port would prove nothing.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const page = join(dirname(fileURLToPath(import.meta.url)), '..', 'host-site', 'index.html');
const port = Number(process.env.HOST_SITE_PORT ?? 5174);

createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(readFileSync(page));
}).listen(port);

console.log(`Fake range website on http://localhost:${port}`);
