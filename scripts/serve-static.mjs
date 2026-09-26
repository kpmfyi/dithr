// Serves the static export (dist/client) like Vercel with cleanUrls: /demos -> demos.html.
// Usage: node scripts/serve-static.mjs [dir=dist/client] [port=5190]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const [dir = 'dist/client', port = '5190'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.rsc': 'text/x-component' };
const file = async path => { try { return (await stat(path)).isFile() ? path : null; } catch { return null; } };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = join(dir, safe);
  const found = await file(base) ?? await file(`${base}.html`) ?? await file(join(base, 'index.html'));
  const path = found ?? join(dir, '404.html');
  res.writeHead(found ? 200 : 404, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  res.end(await readFile(path));
}).listen(Number(port), '127.0.0.1', () => console.log(`static export on http://127.0.0.1:${port}/`));
