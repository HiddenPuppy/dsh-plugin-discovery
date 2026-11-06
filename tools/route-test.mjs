// End-to-end test of the Host half with local fixtures and fake services.
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'dsh-pd-'));
process.env.DSH_HOME = home;

const dir = process.argv[2] ?? '/tmp/vols-current';
const archive = process.argv[3] ?? '/tmp/repo.tar.gz';
const requested = [];
let archiveMode = process.argv.includes('--archive');
let failArchive = !archiveMode;
let inspectMode = 'accepted';

globalThis.fetch = async (url) => {
  const text = String(url);
  requested.push(text);
  if (/codeload\.github\.com/.test(text)) {
    if (failArchive) return new Response('down', { status: 502 });
    return new Response(await readFile(archive), { status: 200, headers: { 'content-type': 'application/gzip' } });
  }
  if (text.endsWith('/CATALOG.md')) return new Response(await readFile(`${dir}/CATALOG.md`, 'utf8'), { status: 200 });
  if (text.endsWith('/data/packages.json')) {
    try { return new Response(await readFile(`${dir}/packages.json`, 'utf8'), { status: 200 }); } catch { return new Response('nf', { status: 404 }); }
  }
  const match = /\/catalog\/([a-z0-9-]+\.md)$/.exec(text);
  if (match) {
    try { return new Response(await readFile(`${dir}/${match[1]}`, 'utf8'), { status: 200 }); } catch { return new Response('nf', { status: 404 }); }
  }
  return new Response('not found', { status: 404 });
};

const installedBundle = {
  name: '@demo/dsh-demo',
  installed: true,
  enabled: true,
  version: '1.2.3',
  source: 'npm:@demo/dsh-demo@1.2.3',
  meta: { title: { en: 'Demo plugin', zh: '演示插件' }, description: { en: 'Demo', zh: '演示用插件' } },
  rows: [{ rowId: 'tool-demo', moduleName: '@demo/dsh-demo/tool' }],
};
const fakeManager = {
  async inspect(spec) {
    if (inspectMode === 'refused') return { status: 'refused', problem: 'not-bundle', reason: 'no bundle patch' };
    if (inspectMode === 'missing') return { status: 'refused', problem: 'not-found', reason: 'not found' };
    return { status: 'accepted', kind: 'npm', name: '@demo/dsh-demo', version: '1.2.3', bundle: true, registry: null };
  },
  async installBundle(spec, options) {
    if (!Array.isArray(options?.approvedBuilds) || options.approvedBuilds.length === 0) {
      return { changed: false, application: 'failed', stage: 'install', target: spec, pendingBuilds: ['esbuild'], error: { diagnostic: 'Ignored build scripts: esbuild' } };
    }
    return { changed: true, application: 'applied', stage: 'install', target: '@demo/dsh-demo', bundle: '@demo/dsh-demo', version: '1.2.3' };
  },
  async listBundles() {
    return [installedBundle, { name: '@deepseek-ai/dsh-base', official: true, installed: false, enabled: true, version: '0.2.1-rc.5', description: 'core', meta: { title: '基础能力' }, rows: [], removable: false }];
  },
  async setBundleEnabled() {
    return { changed: true, application: 'applied' };
  },
  async removeBundle() {
    return { changed: true, application: 'applied' };
  },
};

const routes = new Map();
const services = { pluginManager: fakeManager };
const ctx = {
  connection: { fetch: { register(route) { routes.set(route.path, route.fetch); } } },
  get(name) { return services[name]; },
};
const mod = await import('../index.js');
mod.apply(ctx);
console.log('routes', [...routes.keys()], 'archiveMode', archiveMode);

const feed = await (await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'))).json();
const installs = {};
for (const row of feed.items) installs[row[11] || 'none'] = (installs[row[11] || 'none'] ?? 0) + 1;
console.log('feed items', feed.items.length, 'installable', feed.stats.installable, installs, 'upstream', feed.upstream);
console.log('cache MB', ((await stat(join(home, 'cache', 'plugin-discovery', 'feed.json'))).size / 1048576).toFixed(2));

// install job: success
const startResponse = await routes.get('/api/plugin-discovery/install')(new Request('http://localhost/api/plugin-discovery/install', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ full: 'demo/dsh-demo' }),
}));
const started = await startResponse.json();
console.log('install start', startResponse.status, started);
let status;
for (let i = 0; i < 50; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  status = await (await routes.get('/api/plugin-discovery/install/status')(new Request(`http://localhost/api/plugin-discovery/install/status?id=${started.jobId}`))).json();
  if (status.status === 'done') break;
}
console.log('install done', status.status, JSON.stringify(status.result, null, 1).slice(0, 700));
console.log('installed endpoint', await (await routes.get('/api/plugin-discovery/installed')(new Request('http://localhost/api/plugin-discovery/installed'))).json());

// install job: refusal
inspectMode = 'refused';
const refusedStart = await (await routes.get('/api/plugin-discovery/install')(new Request('http://localhost/api/plugin-discovery/install', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ full: 'demo/docs-only' }),
}))).json();
let refused;
for (let i = 0; i < 50; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  refused = await (await routes.get('/api/plugin-discovery/install/status')(new Request(`http://localhost/api/plugin-discovery/install/status?id=${refusedStart.jobId}`))).json();
  if (refused.status === 'done') break;
}
console.log('refused result', refused.result);

// approve-and-retry: the failed job reports pending build scripts, approve retries with them
inspectMode = 'accepted';
const failStart = await (await routes.get('/api/plugin-discovery/install')(new Request('http://localhost/api/plugin-discovery/install', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ full: 'demo/build-demo' }),
}))).json();
let failedJob;
for (let i = 0; i < 50; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  failedJob = await (await routes.get('/api/plugin-discovery/install/status')(new Request(`http://localhost/api/plugin-discovery/install/status?id=${failStart.jobId}`))).json();
  if (failedJob.status === 'done') break;
}
console.log('failed job', failedJob.result?.ok, failedJob.result?.reason, failedJob.result?.pendingBuilds);
const approveStart = await (await routes.get('/api/plugin-discovery/install/approve')(new Request('http://localhost/api/plugin-discovery/install/approve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ full: 'demo/build-demo' }),
}))).json();
console.log('approve start', approveStart);
let approved;
for (let i = 0; i < 50; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  approved = await (await routes.get('/api/plugin-discovery/install/status')(new Request(`http://localhost/api/plugin-discovery/install/status?id=${approveStart.jobId}`))).json();
  if (approved.status === 'done') break;
}
console.log('approved job', approved.result?.ok, approved.result?.bundle, approved.result?.application);

// invalid repo name
const bad = await routes.get('/api/plugin-discovery/install')(new Request('http://localhost/api/plugin-discovery/install', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ full: 'not-a-repo' }),
}));
console.log('invalid repo status', bad.status);

// management + AUI routes
const bundlesResponse = await (await routes.get('/api/plugin-discovery/bundles')(new Request('http://localhost/api/plugin-discovery/bundles'))).json();
console.log('bundles:', bundlesResponse.bundles?.length, bundlesResponse.bundles?.map((b) => `${b.name}:${b.official ? 'official' : 'third'}`).join(','));
const enableResponse = await (await routes.get('/api/plugin-discovery/bundles/enable')(new Request('http://localhost/api/plugin-discovery/bundles/enable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'dsh-demo', enabled: false }) }))).json();
console.log('enable:', enableResponse.ok, enableResponse.application);
const auiGet = await (await routes.get('/api/plugin-discovery/aui')(new Request('http://localhost/api/plugin-discovery/aui'))).json();
console.log('aui settings:', auiGet.settings);
const auiPost = await (await routes.get('/api/plugin-discovery/aui')(new Request('http://localhost/api/plugin-discovery/aui', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, minScore: 3.5 }) }))).json();
console.log('aui saved:', auiPost.settings);
const testResponse = await (await routes.get('/api/plugin-discovery/aui/test')(new Request('http://localhost/api/plugin-discovery/aui/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '帮我整理一下 Excel 表格数据，检查公式' }) }))).json();
console.log('aui suggestion:', testResponse.suggestion?.plugin?.full, testResponse.suggestion?.reason);
const suggestionResponse = await (await routes.get('/api/plugin-discovery/aui/suggestion')(new Request('http://localhost/api/plugin-discovery/aui/suggestion'))).json();
console.log('pending suggestion:', suggestionResponse.suggestion?.plugin?.full);
await routes.get('/api/plugin-discovery/aui/dismiss')(new Request('http://localhost/api/plugin-discovery/aui/dismiss', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mutePlugin: true }) }));

// failing upstream keeps serving the cached payload
failArchive = true;
inspectMode = 'accepted';
await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?refresh=1'));
const waited = await (await routes.get('/api/plugin-discovery/feed')(new Request('http://localhost/api/plugin-discovery/feed?wait=1'))).json();
console.log('after failure items', waited.items?.length, 'error', waited.error);
console.log('upstream requests', requested.length);
