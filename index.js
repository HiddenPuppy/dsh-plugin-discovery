/**
 * Host half of 插件发现 (Plugin Discovery).
 *
 * Pulls the complete DeepSeek Harness plugin market published on GitHub
 * (bruc3van/awesome-dsh-plugin, the community-maintained catalog of every
 * repository carrying the `dsh-plugin` topic), normalizes it into one compact
 * feed, caches it on disk, and serves it to the browser half over the plugin's
 * own authenticated API channel:
 *
 *   GET /api/plugin-discovery/feed              cached feed, refreshes in background
 *   GET /api/plugin-discovery/feed?refresh=1    same, forces a background refresh
 *   GET /api/plugin-discovery/feed?wait=1       waits for an in-flight refresh
 *   GET /api/plugin-discovery/meta              small status document
 *
 * The browser never talks to GitHub directly: the Host owns the download,
 * the parsing and the Chinese description fallbacks.
 *
 * Upstream freshness without a hardcoded file list: the catalog splits itself
 * into per-category volumes and renames/splits those files as it grows, so this
 * module downloads the repository archive (one request through GitHub's
 * codeload) and reads whatever `catalog/*.md` files it currently contains. When
 * the archive is unreachable it falls back to reading `CATALOG.md`'s volume
 * index and downloading each volume through the mirror chain (GitHub raw,
 * jsDelivr, GitHub acceleration mirrors).
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

/** Host plugin name. */
export const name = 'plugin-discovery';

/** The authenticated API channel is the only Host dependency. */
export const inject = ['connection'];

/** Upstream repository holding the machine-readable market data. */
const UPSTREAM_REPO = 'bruc3van/awesome-dsh-plugin';
const UPSTREAM_REF = 'main';
const ARCHIVE_URL = `https://codeload.github.com/${UPSTREAM_REPO}/tar.gz/refs/heads/${UPSTREAM_REF}`;
const RAW_BASE = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_REF}/`;
const JSDELIVR_BASE = `https://cdn.jsdelivr.net/gh/${UPSTREAM_REPO}@${UPSTREAM_REF}/`;
/** Public GitHub acceleration mirrors used only when GitHub itself is unreachable. */
const MIRROR_PREFIXES = ['https://gh-proxy.com/', 'https://ghfast.top/', 'https://ghproxy.net/'];
/** The catalog index that lists the current volume files. */
const INDEX_FILE = 'CATALOG.md';
/** Directory holding the per-category volumes. */
const CATALOG_DIR = 'catalog/';
/** Per-attempt timeout for one raw file. */
const FILE_TIMEOUT_MS = 20 * 1000;
/** One archive download may take longer. */
const ARCHIVE_TIMEOUT_MS = 60 * 1000;
/** Default cache lifetime: after this age a request kicks off a background refresh. */
const DEFAULT_TTL_MS = 3 * 60 * 60 * 1000;
/** A forced refresh closer together than this is coalesced. */
const MIN_REFRESH_INTERVAL_MS = 20 * 1000;
/** Package directory (holds the AI-generated Chinese description cache). */
const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
/** Where the normalized feed is cached between Harness restarts. */
const CACHE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'cache', 'plugin-discovery');
const CACHE_FILE = join(CACHE_DIR, 'feed.json');
const AI_ZH_FILE = join(PACKAGE_DIR, 'zh-descriptions.json');

/** Stable category keys, matched on the (suffix-stripped) English volume title. */
const CATEGORY_KEYS = new Map([
  ['Ecosystem & Resources', 'ecosystem-resources'],
  ['UI & Experience', 'ui-experience'],
  ['Design, Media & Vision', 'media-vision'],
  ['Web & Browser', 'web-browser'],
  ['Integrations & Sharing', 'integrations-sharing'],
  ['Knowledge & Research', 'knowledge-research'],
  ['Developer Tools', 'developer-tools'],
  ['Multi-Agent Orchestration & Teams', 'multi-agents'],
  ['Agents, Automation & Workflows', 'agents-workflows'],
  ['Utilities & Other', 'utilities'],
]);

/** Short-lived in-memory state. */
const state = {
  /** @type {null | object} normalized feed payload */
  payload: null,
  /** epoch ms of the last successful refresh */
  at: 0,
  /** @type {null | Promise<void>} */
  refreshing: null,
  /** @type {null | string} */
  error: null,
};

/**
 * Cached feed directory currently in use.
 * @returns {string} absolute path
 */
export function cacheDirectory() {
  return CACHE_DIR;
}

/**
 * Fetch one URL with a timeout and a status check.
 * @param {string} url absolute URL
 * @param {number} timeoutMs per-attempt timeout
 * @param {string} accept `accept` header value
 * @returns {Promise<Response>} successful response
 */
async function request(url, timeoutMs, accept = '*/*') {
  const response = await fetch(url, {
    headers: { 'user-agent': 'dsh-plugin-discovery', accept },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

/**
 * Download one small text file through the mirror chain.
 * @param {string} path repository-relative path such as `catalog/utilities.md`
 * @returns {Promise<{ text: string, source: 'github' | 'jsdelivr' | 'mirror' }>} file body and serving source
 */
async function fetchText(path) {
  /** @type {[string, 'github' | 'jsdelivr' | 'mirror'][]} */
  const candidates = [
    [RAW_BASE + path, 'github'],
    [JSDELIVR_BASE + path, 'jsdelivr'],
    ...MIRROR_PREFIXES.map((prefix) => /** @type {[string, 'mirror']} */ ([prefix + RAW_BASE + path, 'mirror'])),
  ];
  let lastError;
  for (const [url, source] of candidates) {
    try {
      const response = await request(url, FILE_TIMEOUT_MS, 'text/plain');
      return { text: await response.text(), source };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`无法获取 ${path}${lastError ? `（${lastError.message}）` : ''}`);
}

/**
 * Read a gzipped tar archive and keep only the catalog volumes.
 * @param {Uint8Array} buffer gzipped tar
 * @returns {Map<string, string>} volume file name → text
 */
export function readCatalogFromTar(buffer) {
  const tar = gunzipSync(buffer);
  /** @type {Map<string, string>} */
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeField = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeField, 8) || 0;
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const full = prefix.length > 0 ? `${prefix}/${name}` : name;
    const bodyStart = offset + 512;
    const marker = full.lastIndexOf(CATALOG_DIR);
    if (size > 0 && marker !== -1 && /\/catalog\/[^/]+\.md$/.test(full)) {
      files.set(full.slice(marker + CATALOG_DIR.length), tar.subarray(bodyStart, bodyStart + size).toString('utf8'));
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * Download the repository archive and read every catalog volume from it.
 * @returns {Promise<Map<string, string>>} volume file name → text
 */
async function loadArchive() {
  const candidates = [ARCHIVE_URL, ...MIRROR_PREFIXES.map((prefix) => prefix + ARCHIVE_URL)];
  let lastError;
  for (const url of candidates) {
    try {
      const response = await request(url, ARCHIVE_TIMEOUT_MS, 'application/gzip');
      const files = readCatalogFromTar(new Uint8Array(await response.arrayBuffer()));
      if (files.size === 0) throw new Error('archive contains no catalog volumes');
      return files;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Read `CATALOG.md` to learn the current volume file names.
 * @param {string} indexText catalog index markdown
 * @returns {string[]} volume file names such as `utilities.md`
 */
export function parseVolumeIndex(indexText) {
  const names = [];
  for (const line of indexText.split('\n')) {
    const match = /^\|\s*\[[^\]]*\]\(\.\/catalog\/([^)]+)\)\s*\|/.exec(line);
    if (match !== null && match[1].endsWith('.md') && !names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

/**
 * Download the catalog index and every volume it lists, one request per file.
 * @returns {Promise<Map<string, string>>} volume file name → text
 */
async function loadVolumes() {
  const index = await fetchText(INDEX_FILE);
  const names = parseVolumeIndex(index.text);
  if (names.length === 0) throw new Error('目录索引中没有找到分类分册');
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const name of names) {
    const file = await fetchText(`${CATALOG_DIR}${name}`);
    files.set(name, file.text);
  }
  return files;
}

/**
 * Split one markdown table line into trimmed cells, honouring `\|` escapes.
 * @param {string} line table line
 * @returns {string[]} cells without the outer empty cells
 */
export function splitCells(line) {
  /** @type {string[]} */
  const cells = [];
  let current = '';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '\\' && line[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/**
 * Strip markdown decoration that a catalog description may carry.
 * @param {string} text raw cell
 * @returns {string} plain text
 */
function plain(text) {
  return text
    .replace(/\\\|/g, '|')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse one catalog volume table into repository rows.
 * @param {string} text markdown page
 * @returns {{ full: string, description: string, language: string, stars: number, license: string, updated: string }[]} rows
 */
export function parseVolume(text) {
  /** @type {any[]} */
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('| [') && !line.startsWith('|  [')) continue;
    const cells = splitCells(line);
    if (cells.length !== 6) continue;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(cells[0]);
    if (link === null) continue;
    const full = link[1].trim();
    if (!full.includes('/')) continue;
    const languageRaw = plain(cells[2]);
    const language = languageRaw === '—' || languageRaw === '-' ? '' : languageRaw;
    const stars = Number.parseInt(cells[3].replace(/[,\s]/g, ''), 10);
    const updatedRaw = plain(cells[5]);
    rows.push({
      full,
      description: plain(cells[1]),
      language,
      stars: Number.isFinite(stars) ? stars : 0,
      license: plain(cells[4]),
      updated: /^\d{4}-\d{2}-\d{2}/.test(updatedRaw) ? updatedRaw.slice(0, 10) : '',
    });
  }
  return rows;
}

/**
 * Read one volume's Chinese and English category titles from its first heading.
 * Split volumes append a range suffix such as `（A–L）` / `(A–L)`, which is removed.
 * @param {string} text volume markdown
 * @returns {{ zh: string, en: string }} titles
 */
export function parseVolumeTitle(text) {
  const firstLine = text.split('\n', 1)[0] ?? '';
  const heading = firstLine.replace(/^#\s*/, '').trim();
  const slash = heading.indexOf(' / ');
  if (slash === -1) return { zh: heading, en: heading };
  const zh = heading.slice(0, slash).replace(/（[^）]*）\s*$/, '').trim();
  const en = heading.slice(slash + 3).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return { zh, en };
}

/**
 * Stable category key for one volume title.
 * @param {string} en English category title
 * @param {string} file volume file name
 * @returns {string} category key
 */
function categoryKey(en, file) {
  const known = CATEGORY_KEYS.get(en);
  if (known !== undefined) return known;
  return file
    .replace(/\.md$/, '')
    .replace(/-[a-z0-9]-[a-z0-9]$/, '')
    .replace(/-m-z$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Snapshot date declared by one volume page.
 * @param {string} text volume markdown
 * @returns {string} `YYYY-MM-DD` or an empty string
 */
export function snapshotDate(text) {
  const match = /Snapshot date:?\s*\**\s*(\d{4}-\d{2}-\d{2})/i.exec(text);
  return match === null ? '' : match[1];
}

/**
 * Compose the automatic Chinese summary used when a repository offers no Chinese text.
 * @param {string} short project name
 * @param {string} categoryZh Chinese category label
 * @param {string} language primary language
 * @returns {string} one-sentence Chinese summary
 */
export function autoSummary(short, categoryZh, language) {
  const tail = language ? `，基于 ${language} 开发` : '';
  return `「${short}」是一个${categoryZh}方向的 DSH 插件${tail}。英文原简介见下方。`;
}

/**
 * Normalize the catalog volumes plus the AI Chinese cache into the feed the browser renders.
 * @param {{ name: string, text: string }[]} files volume files
 * @param {Record<string, string> | undefined} aiZh AI-generated Chinese descriptions
 * @returns {object} feed payload
 */
export function buildCatalog(files, aiZh) {
  const items = [];
  const categoryCounts = new Map();
  /** @type {Map<string, { key: string, zh: string, en: string }>} */
  const categories = new Map();
  const languages = new Set();
  let snapshot = '';
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  let recent30 = 0;
  let starred1k = 0;
  const seen = new Set();

  for (const file of files) {
    const title = parseVolumeTitle(file.text);
    const key = categoryKey(title.en, file.name);
    if (!categories.has(key)) categories.set(key, { key, zh: title.zh, en: title.en });
    const date = snapshotDate(file.text);
    if (date > snapshot) snapshot = date;
    for (const row of parseVolume(file.text)) {
      if (seen.has(row.full)) continue;
      seen.add(row.full);
      const slash = row.full.indexOf('/');
      const short = slash >= 0 ? row.full.slice(slash + 1) : row.full;
      categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
      if (row.language) languages.add(row.language);
      if (row.stars >= 1000) starred1k += 1;
      const pushedMs = Date.parse(row.updated);
      if (Number.isFinite(pushedMs) && now - pushedMs <= thirtyDays) recent30 += 1;

      let zh = '';
      let zhSource = '';
      if (/[\u3400-\u9fff]/.test(row.description)) {
        zh = row.description;
        zhSource = 'native';
      } else if (aiZh && typeof aiZh[row.full] === 'string' && aiZh[row.full].length > 0) {
        zh = aiZh[row.full];
        zhSource = 'ai';
      } else {
        zh = autoSummary(short, title.zh, row.language);
        zhSource = 'auto';
      }

      items.push([
        short,
        row.full,
        row.stars,
        row.language,
        row.license,
        row.updated,
        key,
        zh,
        row.description,
        zhSource,
      ]);
    }
  }

  items.sort((a, b) => b[2] - a[2]);

  const categoryList = [...categories.values()]
    .map((category) => ({ ...category, count: categoryCounts.get(category.key) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const top = items.slice(0, 8).map((row) => ({ name: row[0], full: row[1], stars: row[2], zh: row[7] }));

  return {
    v: 1,
    fetchedAt: new Date().toISOString(),
    upstream: {
      repo: UPSTREAM_REPO,
      snapshot,
      volumes: files.length,
    },
    stats: {
      total: items.length,
      recent30,
      starred1k,
      languages: languages.size,
      categories: categoryList.length,
    },
    categories: categoryList,
    top,
    items,
  };
}

/**
 * Download and assemble one fresh feed payload.
 * @returns {Promise<object>} feed payload
 */
async function refreshNow() {
  let aiZh;
  try {
    aiZh = JSON.parse(await readFile(AI_ZH_FILE, 'utf8'));
  } catch {
    aiZh = undefined;
  }
  const files = await loadArchive().catch(() => loadVolumes());
  const volumes = [...files.entries()].map(([name, text]) => ({ name, text }));
  const payload = buildCatalog(volumes, aiZh);
  if (payload.items.length === 0) throw new Error('上游目录没有解析出任何插件');
  state.payload = payload;
  state.at = Date.now();
  state.error = null;
  await persist(payload).catch(() => {});
  return payload;
}

/**
 * Persist the normalized feed for instant first paint after a restart.
 * @param {object} payload feed payload
 * @returns {Promise<void>} completion
 */
async function persist(payload) {
  await mkdir(CACHE_DIR, { recursive: true });
  const temporary = `${CACHE_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(payload), 'utf8');
  await rename(temporary, CACHE_FILE);
}

/**
 * Load the persisted feed when the process has none yet.
 * @returns {Promise<void>} completion
 */
async function loadPersisted() {
  if (state.payload !== null) return;
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
      state.payload = parsed;
      state.at = Date.parse(parsed.fetchedAt) || 0;
    }
  } catch {
    /* a missing cache is the normal first-run path */
  }
}

/**
 * Start (or join) one refresh.
 * @param {boolean} [force] ignore the cache TTL (still coalesced with an in-flight refresh)
 * @returns {Promise<void>} resolves when the refresh settles
 */
function startRefresh(force = false) {
  if (state.refreshing !== null) return state.refreshing;
  if (state.payload !== null && Date.now() - state.at < MIN_REFRESH_INTERVAL_MS) return Promise.resolve();
  state.refreshing = refreshNow()
    .catch((error) => {
      state.error = error instanceof Error ? error.message : String(error);
      if (state.payload === null) throw error;
    })
    .finally(() => {
      state.refreshing = null;
    });
  return state.refreshing;
}

/**
 * One JSON route response.
 * @param {unknown} body response body
 * @param {number} [status] HTTP status
 * @returns {Response} response
 */
function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

/**
 * Small status document shared by both halves.
 * @returns {object} status
 */
function statusOf() {
  return {
    ok: state.payload !== null,
    fetchedAt: state.payload?.fetchedAt ?? null,
    cachedAt: state.at,
    refreshing: state.refreshing !== null,
    error: state.error,
  };
}

/**
 * Register the plugin's authenticated routes.
 * @param {any} ctx Host context carrying `connection`
 */
function registerRoutes(ctx) {
  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/feed',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const url = new URL(request.url, 'http://localhost');
      const wait = url.searchParams.get('wait') === '1';
      const refresh = url.searchParams.get('refresh') === '1';
      try {
        await loadPersisted();
        if (state.payload === null) {
          await startRefresh(true);
        } else if (wait) {
          if (state.refreshing !== null) await state.refreshing;
          else if (Date.now() - state.at > MIN_REFRESH_INTERVAL_MS) await startRefresh(true);
        } else if (refresh || Date.now() - state.at > DEFAULT_TTL_MS) {
          void startRefresh(refresh).catch(() => {});
        }
        if (state.payload === null) return json({ error: state.error ?? 'feed unavailable' }, 503);
        return json({ ...state.payload, ...statusOf() });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 502);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/meta',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      await loadPersisted();
      return json(statusOf());
    },
  });
}

/**
 * Host plugin body.
 * @param {any} ctx Host context
 */
export function apply(ctx) {
  registerRoutes(ctx);
}
