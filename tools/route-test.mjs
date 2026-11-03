// End-to-end test of the Host half with local volume fixtures and a fake connection service.
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VOLUMES_FOR_TEST } from './volumes-fixture.mjs';

const home = await mkdtemp(join(tmpdir(), 'dsh-pd-'));
process.env.DSH_HOME = home;

const dir = process.argv[2] ?? '/tmp/vols';
const requested = [];
let failNext = false;
globalThis.fetch = async (url) => {
  requested.push(String(url));
  if (failNext) {
    failNext = false;
    return new Response('boom', { status: 500 });
  }
  const match = /catalog\/([a-z-]+)\.md$/.exec(String(url));
  if (match) {
    const body = await readFile(`${dir}/${match[1]}.md`, 'utf8');
    return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return new Response('not found', { status: 404 });
};

const routes = new Map();
const ctx = { connection: { fetch: { register(route) { routes.set(route.path, route.fetch); } } } };
const mod = await import('../index.js');
mod.apply(ctx);
console.log('routes', [...routes.keys()]);

const started = Date.now();
const first = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'));
const body = await first.json();
console.log('first status', first.status, 'items', body.items?.length, 'ms', Date.now() - started, 'error', body.error);
console.log('stats', body.stats, 'upstream', body.upstream);
const cachePath = join(home, 'cache', 'plugin-discovery', 'feed.json');
console.log('cache MB', ((await stat(cachePath)).size / 1048576).toFixed(2));

const second = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed'));
const secondBody = await second.json();
console.log('second status', second.status, 'items', secondBody.items?.length, 'same fetchedAt', secondBody.fetchedAt === body.fetchedAt);

const meta = await routes.get('/api/plugin-discovery/meta')(new Request('http://localhost/api/plugin-discovery/meta'));
console.log('meta', await meta.json());

// A failing upstream keeps serving the cached payload.
failNext = true;
await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?refresh=1'));
const waited = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'));
const waitedBody = await waited.json();
console.log('after failure status', waited.status, 'items', waitedBody.items?.length, 'error', waitedBody.error);
console.log('upstream requests', requested.length);
