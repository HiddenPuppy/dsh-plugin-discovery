// Offline check: parse local catalog volumes and print the normalized feed stats.
import { readFile } from 'node:fs/promises';
import { VOLUMES_FOR_TEST } from './volumes-fixture.mjs';
import { buildCatalog } from '../index.js';

const dir = process.argv[2] ?? '/tmp/vols';
const started = Date.now();
const volumes = [];
for (const volume of VOLUMES_FOR_TEST) {
  const text = await readFile(`${dir}/${volume.file}.md`, 'utf8');
  volumes.push({ ...volume, text, source: 'jsdelivr' });
}
const aiZh = JSON.parse(await readFile(new URL('../zh-descriptions.json', import.meta.url), 'utf8'));
const payload = buildCatalog(volumes, aiZh);
console.log('total', payload.stats.total, 'categories', payload.categories.length, 'ms', Date.now() - started);
console.log('stats', payload.stats);
console.log('upstream', payload.upstream);
console.log('categories', payload.categories.map((c) => `${c.zh}:${c.count}`).join(' | '));
const sources = {};
for (const row of payload.items) sources[row[9]] = (sources[row[9]] ?? 0) + 1;
console.log('zhSources', sources);
console.log('top', payload.top.slice(0, 3).map((t) => `${t.name}:${t.stars}`).join(' | '));
console.log('bytes MB', (Buffer.byteLength(JSON.stringify(payload)) / 1048576).toFixed(2));
