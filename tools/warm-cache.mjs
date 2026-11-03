// Pre-warm the real profile cache with one live sync, so the first page open is instant.
import { copyFile, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { dirname, join } from 'node:path';

const scratch = await mkdtemp(join(tmpdir(), 'dsh-pd-warm-'));
process.env.DSH_HOME = scratch;
const routes = new Map();
const ctx = { connection: { fetch: { register(route) { routes.set(route.path, route.fetch); } } } };
const mod = await import('../index.js');
mod.apply(ctx);
const started = Date.now();
const response = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'));
const body = await response.json();
if (response.status !== 200 || !Array.isArray(body.items)) throw new Error(body.error ?? `status ${response.status}`);
const sources = {};
for (const row of body.items) sources[row[9]] = (sources[row[9]] ?? 0) + 1;
const from = join(scratch, 'cache', 'plugin-discovery', 'feed.json');
const target = join(process.env.DSH_HOME_REAL || join(homedir(), '.dsh'), 'cache', 'plugin-discovery', 'feed.json');
await mkdir(dirname(target), { recursive: true });
await copyFile(from, target);
const info = await stat(target);
console.log('warmed', target, (info.size / 1048576).toFixed(2), 'MB', 'in', Date.now() - started, 'ms');
console.log('total', body.items.length, 'sources', sources, 'fetchedAt', body.fetchedAt);
