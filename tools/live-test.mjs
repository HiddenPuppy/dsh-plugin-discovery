// Live check: run the real Host routes against the real upstream URLs.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'dsh-pd-live-'));
const routes = new Map();
const ctx = { connection: { fetch: { register(route) { routes.set(route.path, route.fetch); } } } };
const mod = await import('../index.js');
mod.apply(ctx);
const started = Date.now();
const response = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'));
const body = await response.json();
console.log('status', response.status, 'wallMs', Date.now() - started);
console.log('error', body.error);
console.log('total', body.items?.length, 'categories', body.categories?.length);
console.log('stats', body.stats);
console.log('upstream', body.upstream);
const sample = body.items?.slice(0, 3) ?? [];
for (const row of sample) console.log('-', row[0], '|', row[6], '|', row[9], '|', row[7].slice(0, 60));
