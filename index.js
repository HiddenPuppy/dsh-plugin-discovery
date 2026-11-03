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
 * Upstream is read from the catalog's 13 per-category markdown volumes rather
 * than the 22 MB `repositories.json`: each volume is under 1 MB, so the whole
 * catalog is ~6 MB and stays reachable through the jsDelivr mirror when
 * raw.githubusercontent.com is slow or blocked.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Host plugin name. */
export const name = 'plugin-discovery';

/** The authenticated API channel is the only Host dependency. */
export const inject = ['connection'];

/** Upstream repository holding the machine-readable market data. */
const UPSTREAM_REPO = 'bruc3van/awesome-dsh-plugin';
const UPSTREAM_REF = 'main';
const GITHUB_RAW = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_REF}/`;
const JSDELIVR = `https://cdn.jsdelivr.net/gh/${UPSTREAM_REPO}@${UPSTREAM_REF}/`;
/** Per-attempt timeout for one volume file. */
const FILE_TIMEOUT_MS = 15 * 1000;
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

/**
 * The catalog volumes, each one a markdown page for one category slice.
 * Several volumes share one category (the A–L / M–Z and A–F / G–M / N–Z splits).
 */
const VOLUMES = [
  { file: 'ecosystem-resources', key: 'ecosystem-resources', zh: '生态与资源', en: 'Ecosystem & Resources' },
  { file: 'ui-experience', key: 'ui-experience', zh: '界面与体验', en: 'UI & Experience' },
  { file: 'ui-experience-m-z', key: 'ui-experience', zh: '界面与体验', en: 'UI & Experience' },
  { file: 'media-vision', key: 'media-vision', zh: '设计、媒体与视觉', en: 'Design, Media & Vision' },
  { file: 'web-browser', key: 'web-browser', zh: '网页与浏览器', en: 'Web & Browser' },
  { file: 'integrations-sharing', key: 'integrations-sharing', zh: '集成与分享', en: 'Integrations & Sharing' },
  { file: 'knowledge-research', key: 'knowledge-research', zh: '知识与研究', en: 'Knowledge & Research' },
  { file: 'developer-tools', key: 'developer-tools', zh: '开发者工具', en: 'Developer Tools' },
  { file: 'multi-agents', key: 'multi-agents', zh: '多 Agent 编排与协作', en: 'Multi-Agent Orchestration & Teams' },
  { file: 'agents-workflows', key: 'agents-workflows', zh: 'Agent、自动化与工作流', en: 'Agents, Automation & Workflows' },
  { file: 'agents-workflows-g-m', key: 'agents-workflows', zh: 'Agent、自动化与工作流', en: 'Agents, Automation & Workflows' },
  { file: 'agents-workflows-n-z', key: 'agents-workflows', zh: 'Agent、自动化与工作流', en: 'Agents, Automation & Workflows' },
  { file: 'utilities', key: 'utilities', zh: '实用工具与其他', en: 'Utilities & Other' },
];

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
 * Fetch one upstream text document, falling back to the jsDelivr mirror.
 * @param {string} path repository-relative path such as `catalog/utilities.md`
 * @returns {Promise<{ text: string, source: 'github' | 'jsdelivr' }>} file body and serving source
 */
async function fetchText(path) {
  const sources = [
    ['github', `${GITHUB_RAW}${path}`, 1],
    ['jsdelivr', `${JSDELIVR}${path}`, 2],
  ];
  let lastError;
  for (const [source, url, attempts] of sources) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { 'user-agent': 'dsh-plugin-discovery', accept: 'text/plain' },
          signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
        });
        if (response.ok) return { text: await response.text(), source };
        lastError = new Error(`upstream ${response.status} for ${url}`);
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
    const description = plain(cells[1]);
    const languageRaw = plain(cells[2]);
    const language = languageRaw === '—' || languageRaw === '-' ? '' : languageRaw;
    const stars = Number.parseInt(cells[3].replace(/[,\s]/g, ''), 10);
    const license = plain(cells[4]);
    const updatedRaw = plain(cells[5]);
    const updated = /^\d{4}-\d{2}-\d{2}/.test(updatedRaw) ? updatedRaw.slice(0, 10) : '';
    rows.push({
      full,
      description,
      language,
      stars: Number.isFinite(stars) ? stars : 0,
      license,
      updated,
    });
  }
  return rows;
}

/** @param {string} text volume markdown */
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
 * @param {{ text: string, source: string, key: string, zh: string, en: string }[]} volumes parsed volume files
 * @param {Record<string, string> | undefined} aiZh AI-generated Chinese descriptions
 * @returns {object} feed payload
 */
export function buildCatalog(volumes, aiZh) {
  const items = [];
  const categoryCounts = new Map();
  /** @type {Map<string, { key: string, zh: string, en: string }>} */
  const categories = new Map();
  const languages = new Set();
  let snapshot = '';
  const sources = { github: 0, jsdelivr: 0 };
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  let recent30 = 0;
  let starred1k = 0;
  const seen = new Set();

  for (const volume of volumes) {
    if (!categories.has(volume.key)) categories.set(volume.key, { key: volume.key, zh: volume.zh, en: volume.en });
    const date = snapshotDate(volume.text);
    if (date > snapshot) snapshot = date;
    if (volume.source === 'jsdelivr') sources.jsdelivr += 1;
    else sources.github += 1;
    for (const row of parseVolume(volume.text)) {
      if (seen.has(row.full)) continue;
      seen.add(row.full);
      const slash = row.full.indexOf('/');
      const short = slash >= 0 ? row.full.slice(slash + 1) : row.full;
      categoryCounts.set(volume.key, (categoryCounts.get(volume.key) ?? 0) + 1);
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
        zh = autoSummary(short, volume.zh, row.language);
        zhSource = 'auto';
      }

      items.push([
        short,
        row.full,
        row.stars,
        row.language,
        row.license,
        row.updated,
        volume.key,
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
      volumes: volumes.length,
      github: sources.github,
      jsdelivr: sources.jsdelivr,
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
  const volumes = await Promise.all(
    VOLUMES.map(async (volume) => {
      const file = await fetchText(`catalog/${volume.file}.md`);
      return { ...volume, ...file };
    }),
  );
  const payload = buildCatalog(volumes, aiZh);
  if (payload.items.length === 0) throw new Error('upstream catalog returned no rows');
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
