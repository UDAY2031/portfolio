// No bundler: serves the checked-in native module film and local dependencies.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(new URL('../public', import.meta.url).pathname);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
    try {
        let url = new URL(req.url, 'http://localhost').pathname;
        if (url === '/') {
            res.writeHead(302, { Location: '/film/index.html' + new URL(req.url, 'http://localhost').search }).end();
            return;
        }
        const file = resolve(root, '.' + decodeURIComponent(url));
        if (!file.startsWith(root + sep)) {
            res.writeHead(403).end();
            return;
        }
        await stat(file);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(await readFile(file));
    }
    catch {
        res.writeHead(404).end('Not found');
    }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port already in use. Reuse the existing film server or set PORT.' : error.message); process.exitCode=1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('GARGANTUA · http://127.0.0.1:' + (process.env.PORT || 4173)));
