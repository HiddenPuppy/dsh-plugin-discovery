// Offline check: read a repository archive (or extracted catalog dir) and print the normalized feed stats.
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { buildCatalog, readCatalogFromTar } from '../index.js';

const target = process.argv[2] ?? '/tmp/repo.tar.gz';
let files;
if (target.endsWith('.tar.gz') || target.endsWith('.tgz')) {
  files = readCatalogFromTar(new Uint8Array(await readFile(target)));
} else {
  files = new Map();
  for (const name of await readdir(target)) {
    if (name === 'CATALOG.md' || !name.endsWith('.md')) continue;
    files.set(name, await readFile(`${target}/${name}`, 'utf8'));
  }
}
const aiZh = JSON.parse(await readFile(new URL('../zh-descriptions.json', import.meta.url), 'utf8'));
const started = Date.now();
const payload = buildCatalog([...files.entries()].map(([name, text]) => ({ name, text })), aiZh);
const sources = {};
for (const row of payload.items) sources[row[9]] = (sources[row[9]] ?? 0) + 1;
console.log('total', payload.stats.total, 'categories', payload.categories.length, 'ms', Date.now() - started);
console.log('stats', payload.stats);
console.log('upstream', payload.upstream);
console.log('categories', payload.categories.map((c) => `${c.zh}:${c.count}`).join(' | '));
console.log('zhSources', sources);
console.log('top', payload.top.slice(0, 3).map((t) => `${t.name}:${t.stars}`).join(' | '));
console.log('bytes MB', (Buffer.byteLength(JSON.stringify(payload)) / 1048576).toFixed(2));
