// Offline check: read a repository archive (or extracted catalog dir) and print the normalized feed stats.
import { readFile, readdir } from 'node:fs/promises';
import { buildCatalog, readArchive } from '../index.js';

const target = process.argv[2] ?? '/tmp/repo.tar.gz';
let volumes;
let packages;
if (target.endsWith('.tar.gz') || target.endsWith('.tgz')) {
  const archive = readArchive(new Uint8Array(await readFile(target)));
  volumes = archive.volumes;
  packages = archive.packages;
} else {
  volumes = new Map();
  for (const name of await readdir(target)) {
    if (name === 'CATALOG.md' || name === 'packages.json' || !name.endsWith('.md')) continue;
    volumes.set(name, await readFile(`${target}/${name}`, 'utf8'));
  }
  packages = JSON.parse(await readFile(`${target}/packages.json`, 'utf8'));
}
const aiZh = JSON.parse(await readFile(new URL('../zh-descriptions.json', import.meta.url), 'utf8'));
const started = Date.now();
const payload = buildCatalog([...volumes.entries()].map(([name, text]) => ({ name, text })), aiZh, packages);
const sources = {};
const installs = {};
for (const row of payload.items) {
  sources[row[9]] = (sources[row[9]] ?? 0) + 1;
  installs[row[11] || 'none'] = (installs[row[11] || 'none'] ?? 0) + 1;
}
console.log('total', payload.stats.total, 'categories', payload.categories.length, 'ms', Date.now() - started);
console.log('stats', payload.stats);
console.log('upstream', payload.upstream);
console.log('categories', payload.categories.map((c) => `${c.zh}:${c.count}`).join(' | '));
console.log('zhSources', sources);
console.log('installSources', installs);
console.log('top', payload.top.slice(0, 3).map((t) => `${t.name}:${t.stars}`).join(' | '));
console.log('bytes MB', (Buffer.byteLength(JSON.stringify(payload)) / 1048576).toFixed(2));
