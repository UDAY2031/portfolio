// No bundler: serves the checked-in native module film and local dependencies.
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(new URL('../public', import.meta.url).pathname);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm':'video/webm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
        const info=await stat(file);
        if(req.headers.range && ['.mp4','.webm'].includes(extname(file))){
            const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            if(!match){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
            const start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2])),end=match[1]&&match[2]?Math.min(info.size-1,Number(match[2])):info.size-1;
            if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
            res.writeHead(206,{'Content-Type':mime[extname(file)],'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});createReadStream(file,{start,end}).pipe(res);return;
        }
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges':'bytes' });
        res.end(await readFile(file));
    }
    catch {
        res.writeHead(404).end('Not found');
    }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port already in use. Reuse the existing film server or set PORT.' : error.message); process.exitCode=1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('GARGANTUA · http://127.0.0.1:' + (process.env.PORT || 4173)));
