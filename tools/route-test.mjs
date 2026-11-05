// End-to-end test of the Host half with local fixtures and a fake connection service.
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'dsh-pd-'));
process.env.DSH_HOME = home;

const dir = process.argv[2] ?? '/tmp/vols-current';
const archive = process.argv[3] ?? '/tmp/repo.tar.gz';
const requested = [];
let archiveMode = process.argv.includes('--archive');
let failArchive = !archiveMode;

globalThis.fetch = async (url) => {
  const text = String(url);
  requested.push(text);
  if (/codeload\.github\.com/.test(text)) {
    if (failArchive) return new Response('down', { status: 502 });
    return new Response(await readFile(archive), { status: 200, headers: { 'content-type': 'application/gzip' } });
  }
  if (text.endsWith('/CATALOG.md')) {
    return new Response(await readFile(`${dir}/CATALOG.md`, 'utf8'), { status: 200 });
  }
  const match = /\/catalog\/([a-z0-9-]+\.md)$/.exec(text);
  if (match) {
    try {
      return new Response(await readFile(`${dir}/${match[1]}`, 'utf8'), { status: 200 });
    } catch {
      return new Response('not found', { status: 404 });
    }
  }
  return new Response('not found', { status: 404 });
};

const routes = new Map();
const ctx = { connection: { fetch: { register(route) { routes.set(route.path, route.fetch); } } } };
const mod = await import('../index.js');
mod.apply(ctx);
console.log('routes', [...routes.keys()], 'archiveMode', archiveMode);

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

// A failing upstream keeps serving the cached payload.
failArchive = true;
await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?refresh=1'));
const waited = await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'));
const waitedBody = await waited.json();
console.log('after failure status', waited.status, 'items', waitedBody.items?.length, 'error', waitedBody.error);
console.log('upstream requests', requested.length);
