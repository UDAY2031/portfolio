// Asset copying only, no compilation. Checked-in public/film is directly runnable.
import { cpSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NavigationController } from '../public/film/navigation.js';
import { validateJourney } from '../public/film/director.js';
const root = resolve(new URL('..', import.meta.url).pathname);
const rooms = validateJourney(JSON.parse(readFileSync(resolve(root, 'resources/journey.json'), 'utf8')));
for (const room of rooms)
    for (const media of [...room.images, ...(room.video ? [room.video] : []), ...(room.pages||[]).flatMap(p=>p.video?[p.video]:[])])
        if (media.startsWith('/resources/media/') && !existsSync(resolve(root, media.slice(1))))
            throw new Error(`Missing media ${media}`);
const to = resolve(root, 'public/resources');
mkdirSync(to, { recursive: true });
for (const file of ['journey.json', 'film.json', 'journey.schema.json'])
    cpSync(resolve(root, 'resources', file), resolve(to, file));
cpSync(resolve(root, 'resources/media'), resolve(to, 'media'), { recursive: true });
console.log(`Film ready: ${rooms.length} rooms · ${new NavigationController(rooms).duration} seconds. Native ES modules, local Three.js.`);
