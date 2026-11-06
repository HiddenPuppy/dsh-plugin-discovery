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
/** Remembers which repository an installed bundle came from, for the ✓ marker. */
const ALIAS_FILE = join(CACHE_DIR, 'install-aliases.json');
/** Registries asked when a GitHub source cannot be prepared and an npm package may exist. */
const NPM_REGISTRIES = ['https://registry.npmjs.org', 'https://registry.npmmirror.com'];
/** Current profile directory: its pnpm-workspace.yaml stores build-script approvals. */
const PROFILE_DIR =
  process.env.DSH_PROFILE_DIR ||
  join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', process.env.DSH_PROFILE || 'desktop');

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
 * Read a gzipped tar archive and keep the catalog volumes plus the install-target map.
 * @param {Uint8Array} buffer gzipped tar
 * @returns {{ volumes: Map<string, string>, packages: any }} catalog data
 */
export function readArchive(buffer) {
  const tar = gunzipSync(buffer);
  /** @type {Map<string, string>} */
  const volumes = new Map();
  /** @type {any} */
  let packages;
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
    if (size > 0) {
      const marker = full.lastIndexOf(CATALOG_DIR);
      if (marker !== -1 && /\/catalog\/[^/]+\.md$/.test(full)) {
        volumes.set(full.slice(marker + CATALOG_DIR.length), tar.subarray(bodyStart, bodyStart + size).toString('utf8'));
      } else if (full.endsWith('data/packages.json')) {
        try {
          packages = JSON.parse(tar.subarray(bodyStart, bodyStart + size).toString('utf8'));
        } catch {
          packages = undefined;
        }
      }
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return { volumes, packages };
}

/**
 * Read only the catalog volumes from a gzipped tar archive.
 * @param {Uint8Array} buffer gzipped tar
 * @returns {Map<string, string>} volume file name → text
 */
export function readCatalogFromTar(buffer) {
  return readArchive(buffer).volumes;
}

/**
 * Download the repository archive and read the catalog data from it.
 * @returns {Promise<{ volumes: Map<string, string>, packages: any }>} catalog data
 */
async function loadArchive() {
  const candidates = [ARCHIVE_URL, ...MIRROR_PREFIXES.map((prefix) => prefix + ARCHIVE_URL)];
  let lastError;
  for (const url of candidates) {
    try {
      const response = await request(url, ARCHIVE_TIMEOUT_MS, 'application/gzip');
      const archive = readArchive(new Uint8Array(await response.arrayBuffer()));
      if (archive.volumes.size === 0) throw new Error('archive contains no catalog volumes');
      return archive;
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
 * Download the catalog index, every volume it lists and the install-target map,
 * one request per file through the mirror chain.
 * @returns {Promise<{ volumes: Map<string, string>, packages: any }>} catalog data
 */
async function loadVolumes() {
  const index = await fetchText(INDEX_FILE);
  const names = parseVolumeIndex(index.text);
  if (names.length === 0) throw new Error('目录索引中没有找到分类分册');
  const volumes = new Map(
    await Promise.all(names.map(async (name) => /** @type {[string, string]} */ ([name, (await fetchText(`${CATALOG_DIR}${name}`)).text]))),
  );
  let packages;
  try {
    packages = JSON.parse((await fetchText('data/packages.json')).text);
  } catch {
    packages = undefined;
  }
  return { volumes, packages };
}

/**
 * Normalize one `data/packages.json` entry into the install spec the UI offers.
 * npm specs win because they do not depend on GitHub being reachable.
 * @param {any} value packages.json entry for one repository
 * @returns {{ spec: string, via: 'npm' | 'git', command?: string } | null} install target
 */
export function normalizeInstall(value) {
  const packages = Array.isArray(value?.packages) ? value.packages : [];
  const specs = packages
    .map((entry) => (typeof entry?.install === 'string' ? entry.install.trim() : ''))
    .filter((spec) => spec.length > 0);
  if (specs.length === 0) return null;
  const isGitSpec = (spec) => /^(https?:\/\/|git\+|github:|gitlab:|bitbucket:|file:|link:|workspace:)/i.test(spec) || spec.includes('#path:');
  const npm = specs.find((spec) => !isGitSpec(spec));
  const spec = npm ?? specs[0];
  const command = packages.find((entry) => entry?.install === spec)?.command;
  return { spec, via: npm ? 'npm' : 'git', ...(typeof command === 'string' ? { command } : {}) };
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
 * @param {any} [packageEntries] `data/packages.json` install-target map
 * @returns {object} feed payload
 */
export function buildCatalog(files, aiZh, packageEntries) {
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
  let installable = 0;
  const seen = new Set();
  /** @type {Map<string, { spec: string, via: 'npm' | 'git' }>} */
  const installs = new Map();
  for (const [full, value] of Object.entries(packageEntries?.entries ?? {})) {
    const install = normalizeInstall(value);
    if (install !== null) installs.set(full.toLowerCase(), install);
  }

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

      const install = installs.get(row.full.toLowerCase());
      if (install?.via === 'npm') installable += 1;

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
        install?.spec ?? '',
        install?.via ?? '',
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
      installable,
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
  const archive = await loadArchive().catch(() => loadVolumes());
  const volumes = [...archive.volumes.entries()].map(([name, text]) => ({ name, text }));
  const payload = buildCatalog(volumes, aiZh, archive.packages);
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
 * Install jobs survive long pnpm runs outside the request that started them, so
 * the browser can poll for progress instead of holding one HTTP request open.
 * @type {Map<string, { id: string, full: string, spec: string, via: string, status: 'running' | 'done', startedAt: number, finishedAt?: number, result: any }>}
 */
const installJobs = new Map();
let installSequence = 0;
/** Finished job results are kept this long for polling clients. */
const INSTALL_RESULT_TTL_MS = 10 * 60 * 1000;

/**
 * Pick the best string out of a localized text value.
 * @param {any} value string or locale → string map
 * @returns {string} display text
 */
function localized(value) {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return '';
  return value.zh ?? value['zh-CN'] ?? value.en ?? Object.values(value).find((entry) => typeof entry === 'string') ?? '';
}

/**
 * Turn pnpm's verbose failure into one short, actionable message.
 * @param {string} raw package-manager output or diagnostic
 * @param {string[] | undefined} pendingBuilds build scripts pnpm refused to run
 * @returns {{ reason: string, message: string, detail: string }} classified failure
 */
export function classifyInstallError(raw, pendingBuilds) {
  const text = String(raw ?? '');
  const detail = text.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (Array.isArray(pendingBuilds) && pendingBuilds.length > 0) {
    return {
      reason: 'build-blocked',
      message: `安装被依赖的构建脚本拦截（${pendingBuilds.join(', ')}），可以允许这些脚本后重试`,
      detail,
    };
  }
  if (/GIT_PREPARE|GIT_DEP_PREPARE_NOT_ALLOWED|needs to execute build scripts but is not in the "allowBuilds"/i.test(text)) {
    const buildKey = /allowBuilds:\s*\n\s+'?([^'\n]+?)'?\s*:\s*true/i.exec(text)?.[1];
    return {
      reason: 'git-prepare-blocked',
      message: '这个插件的 GitHub 源码包安装前需要执行构建脚本（prepare），pnpm 默认拦截；可以允许后重试，或改用官方 npm 包安装',
      detail,
      ...(buildKey ? { buildKey } : {}),
    };
  }
  if (/prepare[^.]{0,40}(?:not allowed|blocked)|build scripts? (?:are )?(?:not allowed|blocked)/i.test(text)) {
    return { reason: 'build-blocked', message: '安装需要执行构建脚本，被 pnpm 的安全策略拦截；可以允许后重试', detail };
  }
  if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket hang up|timed? ?out/i.test(text)) {
    return { reason: 'network', message: '网络无法访问安装源（GitHub 或 npm 可能不可达），请稍后重试', detail };
  }
  if (/404|not found|NO_MATCHING_VERSION|No matching version/i.test(text)) {
    return { reason: 'not-found', message: '安装源里没有找到可安装的版本，可能已被作者删除或改名', detail };
  }
  if (/integrity|TARBALL|checksum/i.test(text)) {
    return { reason: 'integrity', message: '下载内容校验失败，请重试', detail };
  }
  const firstError = text.split('\n').map((line) => line.trim()).find((line) => /ERR_|error|failed/i.test(line)) ?? '';
  return { reason: 'unknown', message: (firstError || '安装失败').slice(0, 220), detail };
}

/**
 * Explain where an installed bundle shows up, from the rows it declares.
 * @param {any} bundle bundle info from `listBundles`, when available
 * @param {any} change install result
 * @returns {{ hints: string[], applied: boolean }} placement hints
 */
function describePlacement(bundle, change) {
  const rows = (bundle?.rows ?? [])
    .map((row) => `${row?.rowId ?? ''} ${row?.moduleName ?? ''}`)
    .join(' ')
    .toLowerCase();
  const description = `${localized(bundle?.meta?.title)} ${localized(bundle?.meta?.description)}`.toLowerCase();
  const hints = [];
  if (/notif|toast|alert|remind|提醒|通知/.test(rows + description)) hints.push('需要时会在界面通知 / 系统通知里提醒你（可在「设置 → 插件」里调整）');
  if (/theme|skin|appearance|主题|皮肤|配色/.test(rows + description)) hints.push('在「设置 → 外观 / 主题」里选择它');
  if (/client-ui|ui-|sidebar|panel|widget|侧边栏|面板|界面/.test(rows + description)) hints.push('刷新窗口后，在 DSH 界面（侧边栏 / 设置 / 面板）中查看');
  if (/tool-|tools?\b|工具/.test(rows + description)) hints.push('在对话里让 Agent 调用它提供的工具');
  if (/command-|斜杠命令/.test(rows + description)) hints.push('在输入框输入它注册的斜杠命令（输入 / 可查看）');
  if (/skill-|技能/.test(rows + description)) hints.push('作为 Skill 在对话中被触发');
  if (/provider|llm-|web-search|web-fetch|搜索|模型/.test(rows + description)) hints.push('在「设置 → 模型 / 网页搜索」里选择它');
  if (/agent-preset|preset|预设/.test(rows + description)) hints.push('在新建会话的 Agent 预设里选择它');
  if (/market|marketplace|store|市场|商店/.test(rows + description)) hints.push('在「插件」页或左侧栏里会出现它的市场入口（刷新窗口后查看）');
  if (hints.length === 0) hints.push('刷新窗口后查看左侧栏与「设置 → 插件」，多数插件会在这些位置出现');
  const applied = change?.application === 'applied';
  return { hints, applied };
}

/** In-memory repository → installed bundle aliases. */
const installAliases = new Map();
/** Aliases are loaded from disk once. */
let aliasesLoaded = false;

/**
 * Load repository → bundle aliases recorded by earlier installs.
 * @returns {Promise<void>} completion
 */
async function loadAliases() {
  if (aliasesLoaded) return;
  aliasesLoaded = true;
  try {
    const parsed = JSON.parse(await readFile(ALIAS_FILE, 'utf8'));
    for (const [full, bundle] of Object.entries(parsed ?? {})) {
      if (typeof bundle === 'string') installAliases.set(full, bundle);
    }
  } catch {
    /* no aliases yet */
  }
}

/**
 * Persist the current repository → bundle aliases.
 * @returns {Promise<void>} completion
 */
async function saveAliases() {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(ALIAS_FILE, JSON.stringify(Object.fromEntries(installAliases)), 'utf8');
  } catch {
    /* the marker still works for this session */
  }
}

/** Latest failed install per repository, so the page can offer approve-and-retry. */
const installFailures = new Map();
/** Cached npm-package lookups for GitHub-only catalog entries. */
const npmAlternatives = new Map();

/**
 * Escape a string for use inside a regular expression.
 * @param {string} text literal text
 * @returns {string} escaped text
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find an npm package published from the same repository, used when a GitHub
 * source cannot be prepared or built.
 * @param {string} full `owner/repo`
 * @param {string} rawError package-manager output naming the git package
 * @returns {Promise<{ name: string, version: string, spec: string, registry: string } | null>} npm target
 */
async function lookupNpmAlternative(full, rawError) {
  if (npmAlternatives.has(full)) return npmAlternatives.get(full);
  /** @type {Set<string>} */
  const candidates = new Set();
  const named = /git-hosted package "(.+?)@[0-9][^"]*"/i.exec(rawError)?.[1];
  if (named) candidates.add(named);
  const basename = full.split('/')[1] ?? '';
  if (basename) {
    candidates.add(basename);
    candidates.add(basename.replace(/-/g, ''));
  }
  for (const name of candidates) {
    for (const registry of NPM_REGISTRIES) {
      try {
        const response = await request(`${registry}/${encodeURIComponent(name)}/latest`, 8 * 1000, 'application/json');
        const metadata = await response.json();
        const repository = typeof metadata?.repository === 'string' ? metadata.repository : metadata?.repository?.url ?? '';
        const declared = metadata?.dsh?.bundle !== undefined;
        const matches = String(repository).toLowerCase().includes(`github.com/${full.toLowerCase()}`);
        if (declared && matches && typeof metadata.version === 'string') {
          const result = { name: metadata.name ?? name, version: metadata.version, spec: `${metadata.name ?? name}@${metadata.version}`, registry };
          npmAlternatives.set(full, result);
          return result;
        }
      } catch {
        /* try the next registry or candidate */
      }
    }
  }
  npmAlternatives.set(full, null);
  return null;
}

/**
 * Allow one git-hosted package's prepare script in the profile's pnpm settings.
 * Writes `allowBuilds` into pnpm-workspace.yaml — the same change pnpm's own
 * error message asks the user to make.
 * @param {string} buildKey exact allowBuilds key suggested by pnpm
 * @returns {Promise<string>} the key written
 */
export async function writeAllowBuilds(buildKey) {
  const file = join(PROFILE_DIR, 'pnpm-workspace.yaml');
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    text = 'packages:\n  - .\n';
  }
  const quoted = `'${buildKey.replace(/'/g, "''")}'`;
  const existing = new RegExp(`^[ \\t]*'?${escapeRegExp(buildKey)}'?[ \\t]*:[ \\t]*.*$`, 'm');
  if (existing.test(text)) {
    text = text.replace(existing, `  ${quoted}: true`);
  } else if (/^allowBuilds:[ \\t]*$/m.test(text)) {
    const match = /^allowBuilds:[ \\t]*$/m.exec(text);
    const insertAt = match.index + match[0].length;
    text = `${text.slice(0, insertAt)}\n   ${quoted}: true${text.slice(insertAt)}`.replace(/\n   /, '\n  ');
  } else {
    text = `${text.replace(/\s*$/, '')}\n\nallowBuilds:\n  ${quoted}: true\n`;
  }
  await mkdir(PROFILE_DIR, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, text, { mode: 384 });
  await rename(temporary, file);
  return buildKey;
}

/**
 * Install one catalog entry through the profile's plugin manager.
 * @param {any} ctx Host context
 * @param {{ id: string, full: string, spec: string, via: string, status: string, startedAt: number, result: any, options?: { approvedBuilds?: string[], allowBuildKey?: string, npmSpec?: string, mode?: string } }} job install job
 * @returns {Promise<void>} completion
 */
async function runInstallJob(ctx, job) {
  const manager = ctx.get('pluginManager');
  if (manager === undefined) {
    job.result = { ok: false, stage: 'manager', error: '当前 profile 没有可用的插件管理器（pluginManager 服务未加载）', install: job.spec, via: job.via };
    return;
  }
  const spec = job.options?.npmSpec ?? job.spec;
  const via = job.options?.npmSpec ? 'npm' : job.via;
  try {
    if (job.options?.allowBuildKey) await writeAllowBuilds(job.options.allowBuildKey);
    const inspection = await manager.inspect(spec, undefined, AbortSignal.timeout(45 * 1000));
    if (inspection.status === 'refused') {
      const already = inspection.problem === 'already-installed';
      job.result = {
        ok: false,
        stage: 'inspect',
        problem: inspection.problem,
        error: already ? '这个插件已经安装过了' : inspection.reason || '这个插件没有可用的安装来源',
        install: job.spec,
        via: job.via,
      };
      return;
    }
    if (inspection.bundle === false) {
      job.result = { ok: false, stage: 'inspect', problem: 'not-bundle', error: '该仓库不是可安装的 DSH 插件包（package.json 里没有声明 dsh.bundle）', install: job.spec, via: job.via };
      return;
    }
    const options = job.options?.approvedBuilds === undefined ? { enabled: true } : { enabled: true, approvedBuilds: job.options.approvedBuilds };
    const change = await manager.installBundle(spec, options);
    if (change.application === 'failed') {
      const pending = Array.isArray(change.pendingBuilds) && change.pendingBuilds.length > 0 ? change.pendingBuilds : undefined;
      const raw = change.error?.diagnostic ?? change.packageResult?.output ?? change.error?.code ?? '安装失败';
      const classified = classifyInstallError(raw, pending);
      const wantsNpm = !job.options?.npmSpec && via !== 'npm' && (classified.reason === 'git-prepare-blocked' || classified.reason === 'unknown' || classified.reason === 'network');
      const npmAlternative = wantsNpm ? await lookupNpmAlternative(job.full, raw) : null;
      job.result = {
        ok: false,
        stage: 'install',
        reason: classified.reason,
        error: classified.message,
        detail: classified.detail,
        pendingBuilds: pending,
        ...(classified.buildKey ? { buildKey: classified.buildKey } : {}),
        ...(npmAlternative ? { npmAlternative } : {}),
        install: job.spec,
        via,
      };
      return;
    }
    let bundleInfo;
    try {
      const bundles = await manager.listBundles();
      const name = change.bundle ?? inspection.name;
      bundleInfo = bundles.find((bundle) => bundle.name === name);
    } catch {
      bundleInfo = undefined;
    }
    const placement = describePlacement(bundleInfo, change);
    job.result = {
      ok: true,
      bundle: change.bundle ?? inspection.name,
      version: change.version ?? inspection.version,
      application: change.application,
      restartReason: change.restartReason,
      title: localized(bundleInfo?.meta?.title) || change.bundle || inspection.name || job.full,
      description: localized(bundleInfo?.meta?.description) || inspection.description || '',
      hints: placement.hints,
      applied: placement.applied,
      install: job.spec,
      via,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const classified = classifyInstallError(raw);
    const wantsNpm = !job.options?.npmSpec && via !== 'npm' && (classified.reason === 'git-prepare-blocked' || classified.reason === 'unknown' || classified.reason === 'network');
    const npmAlternative = wantsNpm ? await lookupNpmAlternative(job.full, raw) : null;
    job.result = {
      ok: false,
      stage: 'install',
      reason: classified.reason,
      error: classified.message,
      detail: classified.detail,
      ...(classified.buildKey ? { buildKey: classified.buildKey } : {}),
      ...(npmAlternative ? { npmAlternative } : {}),
      install: job.spec,
      via,
    };
  } finally {
    job.status = 'done';
    job.finishedAt = Date.now();
    if (job.result?.ok) {
      installFailures.delete(job.full);
      if (typeof job.result.bundle === 'string' && job.result.bundle.length > 0) {
        installAliases.set(job.full, job.result.bundle);
        void saveAliases();
      }
    } else if (job.result) {
      installFailures.set(job.full, { result: job.result, spec: job.spec, via: job.via });
    }
    for (const [key, value] of installJobs) {
      if (value.status === 'done' && Date.now() - (value.finishedAt ?? value.startedAt) > INSTALL_RESULT_TTL_MS) installJobs.delete(key);
    }
  }
}

/** Host context captured for event handlers and routes that need services. */
let hostCtx = null;

// #region AUI — agent-facing plugin discovery

/** Persisted AUI settings file. */
const AUI_FILE = join(CACHE_DIR, 'aui.json');
/** Default AUI behaviour. */
const AUI_DEFAULTS = { enabled: true, minScore: 3, cooldownSeconds: 120 };
/** Loaded AUI settings. */
let auiSettings = null;
/** The suggestion waiting for the client to pick up. */
let pendingSuggestion = null;
/** Suggestion id sequence. */
let suggestionSeq = 0;
/** When the last real suggestion was produced. */
let lastSuggestionAt = 0;
/** Plugins the user asked not to suggest again. */
const dismissedPlugins = new Set();
/** Cache of derived search strings for the current catalog payload. */
let searchCache = { fetchedAt: '', entries: [] };
/** Short cache of installed bundle names. */
let installedCache = { at: 0, names: new Set(), aliases: new Map() };

/**
 * Intent expansions: everyday wording → catalog vocabulary.
 * Keeps matching useful without any keyword index or model call.
 */
const INTENTS = [
  { test: /excel|xlsx|spreadsheet|表格|台账|报表|对账|数据表|sheet\b|csv/i, terms: ['excel', 'xlsx', '表格', 'spreadsheet', 'sheet', 'csv', '台账', '报表', 'office'] },
  { test: /pdf|文档|word|docx|ppt|pptx|演示|幻灯片|office|办公/i, terms: ['office', 'docx', 'word', 'pdf', 'pptx', 'ppt', '文档', '演示', '幻灯片'] },
  { test: /图片|修图|视觉|截图|识图|ocr|看图|识别图/i, terms: ['vision', 'image', 'ocr', '图片', '视觉', '截图', '识图'] },
  { test: /浏览器|网页|爬|抓取|webkit|chrome|链接|打开网页/i, terms: ['browser', 'web', 'chrome', '网页', '浏览器', '爬虫', '抓取'] },
  { test: /搜索|联网|查资料|搜一下|检索/i, terms: ['search', 'web-search', '搜索', '联网', '检索'] },
  { test: /通知|提醒|报警|告警|到点|完成时/i, terms: ['notification', 'notify', 'toast', '提醒', '通知', '告警'] },
  { test: /语音|说话|朗读|tts|听写|录音|语音输入/i, terms: ['voice', 'speech', 'tts', '语音', '朗读', '录音'] },
  { test: /翻译|译成|中译英|英译中/i, terms: ['translate', 'translation', '翻译'] },
  { test: /记忆|长期记忆|记住|上下文|知识库/i, terms: ['memory', 'context', '记忆', '上下文', '知识库'] },
  { test: /定时|每天|每周|周期|cron|schedule|自动化任务/i, terms: ['schedule', 'cron', '定时', '自动化', 'workflow'] },
  { test: /飞书|lark|钉钉|微信|企业微信|qq|telegram|slack|im\b|消息推送/i, terms: ['feishu', 'lark', 'wechat', 'telegram', 'slack', 'im', '飞书', '微信', '推送'] },
  { test: /代码|编程|重构|调试|git|仓库|测试|项目/i, terms: ['code', 'git', 'developer', 'debug', '代码', '调试', '仓库'] },
  { test: /数据库|sql|mysql|postgres|查询数据/i, terms: ['database', 'sql', 'mysql', 'postgres', '数据库'] },
  { test: /图表|可视化|看板|大屏|仪表盘|dashboard/i, terms: ['chart', 'dashboard', 'visualization', '图表', '可视化', '看板'] },
  { test: /主题|皮肤|美化|外观|壁纸|宠物/i, terms: ['theme', 'skin', 'wallpaper', 'pet', '主题', '皮肤', '壁纸', '宠物'] },
  { test: /手机|安卓|android|ios|移动端|扫码/i, terms: ['mobile', 'android', 'ios', '手机', '移动'] },
  { test: /命令|快捷键|斜杠/i, terms: ['command', 'shortcut', '命令', '快捷键'] },
  { test: /统计|用量|花费|成本|token|余额/i, terms: ['usage', 'cost', 'token', 'balance', '统计', '用量', '成本', '余额'] },
  { test: /监控|日志|诊断|排查|性能/i, terms: ['monitor', 'log', 'diagnose', '监控', '日志', '诊断'] },
  { test: /视频|音频|剪辑|字幕|music|podcast/i, terms: ['video', 'audio', 'subtitle', '视频', '音频', '字幕'] },
  { test: /日历|日程|会议|待办|任务|todo|task/i, terms: ['calendar', 'schedule', 'task', 'todo', '日历', '日程', '待办', '任务'] },
  { test: /销售|客户|crm|报价|订单|商机|外贸|获客/i, terms: ['crm', 'sales', 'customer', 'quote', 'order', '销售', '客户', '报价', '订单'] },
];

/** Common words that should not drive a match on their own. */
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'you', 'can', 'help', 'please', 'have', 'want', 'need', 'make', 'use', 'from']);

/**
 * Read the AUI settings from disk once, merging defaults.
 * @returns {Promise<typeof AUI_DEFAULTS>} settings
 */
async function loadAuiSettings() {
  if (auiSettings !== null) return auiSettings;
  try {
    const parsed = JSON.parse(await readFile(AUI_FILE, 'utf8'));
    auiSettings = {
      enabled: parsed.enabled !== false,
      minScore: Number.isFinite(parsed.minScore) ? Math.min(10, Math.max(1, parsed.minScore)) : AUI_DEFAULTS.minScore,
      cooldownSeconds: Number.isFinite(parsed.cooldownSeconds) ? Math.min(900, Math.max(0, parsed.cooldownSeconds)) : AUI_DEFAULTS.cooldownSeconds,
    };
  } catch {
    auiSettings = { ...AUI_DEFAULTS };
  }
  return auiSettings;
}

/**
 * Persist a settings patch.
 * @param {any} patch partial settings
 * @returns {Promise<typeof AUI_DEFAULTS>} saved settings
 */
async function saveAuiSettings(patch) {
  const current = await loadAuiSettings();
  const next = { ...current };
  if (typeof patch?.enabled === 'boolean') next.enabled = patch.enabled;
  if (Number.isFinite(patch?.minScore)) next.minScore = Math.min(10, Math.max(1, patch.minScore));
  if (Number.isFinite(patch?.cooldownSeconds)) next.cooldownSeconds = Math.min(900, Math.max(0, patch.cooldownSeconds));
  auiSettings = next;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(AUI_FILE, JSON.stringify(next), 'utf8');
  } catch {
    /* settings stay live for this session */
  }
  return next;
}

/**
 * Extract the human text from one user message.
 * @param {any} message message record
 * @returns {string} plain text
 */
export function messageText(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * Derive match terms from a sentence: intent vocabulary, English words and CJK bigrams.
 * @param {string} text user text
 * @returns {Set<string>} lowercase terms
 */
export function queryTerms(text) {
  const lower = text.toLowerCase();
  /** @type {Set<string>} */
  const terms = new Set();
  for (const intent of INTENTS) {
    if (intent.test.test(lower)) for (const term of intent.terms) terms.add(term.toLowerCase());
  }
  for (const word of lower.match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []) {
    if (!STOPWORDS.has(word)) terms.add(word);
  }
  for (const run of text.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    for (let index = 0; index + 1 < run.length; index += 1) terms.add(run.slice(index, index + 2));
  }
  return terms;
}

/**
 * Build (or reuse) the searchable strings for the current payload.
 * @returns {any[]} entries
 */
function searchEntries() {
  const payload = state.payload;
  if (!payload) return [];
  if (searchCache.fetchedAt === payload.fetchedAt) return searchCache.entries;
  const categoryNames = new Map((payload.categories ?? []).map((category) => [category.key, category.zh]));
  searchCache = {
    fetchedAt: payload.fetchedAt,
    entries: payload.items.map((row) => ({
      row,
      name: String(row[0] ?? '').toLowerCase(),
      full: String(row[1] ?? '').toLowerCase(),
      text: `${row[7] ?? ''} ${row[8] ?? ''}`.toLowerCase(),
      category: String(categoryNames.get(row[6]) ?? '').toLowerCase(),
      stars: Number(row[2] ?? 0),
      via: String(row[11] ?? ''),
    })),
  };
  return searchCache.entries;
}

/**
 * Read the set of installed bundle names, briefly cached.
 * @returns {Promise<{ names: Set<string>, aliases: Map<string, string> }>} installed info
 */
async function installedInfo() {
  if (Date.now() - installedCache.at < 15 * 1000) return installedCache;
  const names = new Set();
  const aliases = new Map();
  try {
    const manager = hostCtx?.get('pluginManager');
    if (manager !== undefined) {
      const bundles = await manager.listBundles();
      for (const bundle of bundles) {
        if (bundle.installed === true && typeof bundle.name === 'string') names.add(bundle.name.toLowerCase());
      }
    }
  } catch {
    /* treat as unknown */
  }
  await loadAliases();
  for (const [full, bundleName] of installAliases) aliases.set(full, String(bundleName).toLowerCase());
  installedCache = { at: Date.now(), names, aliases };
  return installedCache;
}

/**
 * Score one catalog entry against query terms.
 * @param {any} entry search entry
 * @param {Set<string>} terms query terms
 * @returns {{ score: number, matched: string[] }} score and matched terms
 */
export function scoreEntry(entry, terms) {
  let score = 0;
  const matched = new Set();
  for (const term of terms) {
    if (term.length < 2) continue;
    if (entry.name.includes(term) || entry.full.includes(term)) {
      score += 4;
      matched.add(term);
      continue;
    }
    if (entry.text.includes(term)) {
      score += 1.2;
      matched.add(term);
      continue;
    }
    if (entry.category.length > 0 && entry.category.includes(term)) {
      score += 0.8;
      matched.add(term);
    }
  }
  if (score === 0) return { score: 0, matched: [] };
  score += Math.min(1.2, Math.log10(entry.stars + 1) * 0.35);
  if (entry.via === 'npm') score += 0.6;
  return { score: Math.round(score * 10) / 10, matched: [...matched].slice(0, 6) };
}

/**
 * Match the catalog against one sentence.
 * @param {string} text user text
 * @param {boolean} [force] ignore the AUI switch and the cooldown
 * @returns {Promise<any | null>} suggestion or null
 */
export async function suggestFor(text, force = false) {
  const settings = await loadAuiSettings();
  if (!force && !settings.enabled) return null;
  if (!force && Date.now() - lastSuggestionAt < settings.cooldownSeconds * 1000) return null;
  await loadPersisted();
  const entries = searchEntries();
  if (entries.length === 0) return null;
  const terms = queryTerms(text);
  if (terms.size === 0) return null;
  const { names, aliases } = await installedInfo();
  /** @type {null | { entry: any, score: number, matched: string[] }} */
  let best = null;
  for (const entry of entries) {
    const full = String(entry.row[1]);
    if (dismissedPlugins.has(full)) continue;
    if (aliases.has(full)) continue;
    if (names.has(entry.name) || names.has(entry.full)) continue;
    const scored = scoreEntry(entry, terms);
    if (scored.score <= 0) continue;
    if (best === null || scored.score > best.score) best = { entry, ...scored };
  }
  if (best === null || best.score < settings.minScore) return null;
  const row = best.entry.row;
  const categoryZh = (state.payload?.categories ?? []).find((category) => category.key === row[6])?.zh ?? '';
  const suggestion = {
    id: `${Date.now().toString(36)}-${(suggestionSeq += 1)}`,
    createdAt: new Date().toISOString(),
    query: text.slice(0, 160),
    reason: best.matched,
    score: best.score,
    plugin: {
      name: row[0],
      full: row[1],
      stars: row[2],
      category: row[6],
      categoryZh,
      zh: row[7],
      en: row[8],
      url: `https://github.com/${row[1]}`,
      install: row[10] ?? '',
      via: row[11] ?? '',
    },
  };
  if (!force) lastSuggestionAt = Date.now();
  return suggestion;
}

/**
 * React to a new user message by looking for a helpful catalog plugin.
 * @param {any} payload event payload
 * @returns {Promise<void>} completion
 */
async function handleInboxMessage(payload) {
  try {
    const text = messageText(payload?.message);
    if (text.length < 4 || text.startsWith('/')) return;
    const suggestion = await suggestFor(text, false);
    if (suggestion !== null) pendingSuggestion = suggestion;
  } catch {
    /* AUI must never disturb the conversation */
  }
}

// #endregion

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

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/install',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const full = typeof body?.full === 'string' ? body.full.trim() : '';
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(full)) return json({ error: '无效的仓库名' }, 400);
        await loadPersisted();
        const item = state.payload?.items?.find((row) => row[1] === full);
        const spec = (item && typeof item[10] === 'string' && item[10].length > 0 ? item[10] : '') || `https://github.com/${full}`;
        const via = (item && typeof item[11] === 'string' && item[11].length > 0 ? item[11] : '') || 'git';
        for (const job of installJobs.values()) {
          if (job.status === 'running' && job.full === full) return json({ jobId: job.id });
          if (job.status === 'running') return json({ error: '已有另一个安装任务正在进行，请等它完成后再试' }, 409);
        }
        const id = `${Date.now().toString(36)}-${(installSequence += 1)}`;
        const job = { id, full, spec, via, status: /** @type {'running'} */ ('running'), startedAt: Date.now(), result: null };
        installJobs.set(id, job);
        void runInstallJob(ctx, job);
        return json({ jobId: id, spec, via });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/install/approve',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const full = typeof body?.full === 'string' ? body.full.trim() : '';
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(full)) return json({ error: '无效的仓库名' }, 400);
        const failure = installFailures.get(full);
        if (failure === undefined) return json({ error: '没有待处理的安装失败，请先点一次「安装」' }, 400);
        for (const running of installJobs.values()) {
          if (running.status === 'running') return json({ error: '已有另一个安装任务正在进行，请等它完成后再试' }, 409);
        }
        const result = failure.result;
        /** @type {{ npmSpec?: string, allowBuildKey?: string, approvedBuilds?: string[], mode: string }} */
        let options;
        if (result?.npmAlternative?.spec) {
          options = { npmSpec: result.npmAlternative.spec, mode: 'npm-alternative' };
        } else if (result?.buildKey) {
          options = { allowBuildKey: result.buildKey, mode: 'allow-builds' };
        } else if (Array.isArray(result?.pendingBuilds) && result.pendingBuilds.length > 0) {
          options = { approvedBuilds: result.pendingBuilds, mode: 'approved-builds' };
        } else {
          return json({ error: '这次失败不需要构建授权，无法自动重试' }, 400);
        }
        const id = `${Date.now().toString(36)}-${(installSequence += 1)}`;
        const job = { id, full, spec: failure.spec, via: failure.via, status: /** @type {'running'} */ ('running'), startedAt: Date.now(), result: null, options };
        installJobs.set(id, job);
        void runInstallJob(ctx, job);
        return json({ jobId: id, mode: options.mode, spec: options.npmSpec ?? failure.spec, approvedBuilds: options.approvedBuilds ?? [] });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/install/status',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const url = new URL(request.url, 'http://localhost');
      const id = url.searchParams.get('id') ?? '';
      const job = installJobs.get(id);
      if (job === undefined) return json({ error: '安装任务不存在或已过期' }, 404);
      return json({ id: job.id, full: job.full, status: job.status, result: job.result });
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/installed',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      const manager = ctx.get('pluginManager');
      if (manager === undefined) return json({ bundles: [] });
      try {
        await loadAliases();
        const bundles = await manager.listBundles();
        const installed = bundles.filter((bundle) => bundle.installed === true);
        const list = installed.map((bundle) => ({
          name: bundle.name,
          version: bundle.version,
          source: bundle.source,
          enabled: bundle.enabled,
        }));
        const names = new Set(installed.map((bundle) => bundle.name));
        for (const [full, bundleName] of installAliases) {
          if (names.has(bundleName)) list.push({ name: bundleName, installed: true, enabled: true, aliasFor: full });
        }
        return json({ bundles: list });
      } catch (error) {
        return json({ bundles: [], error: error instanceof Error ? error.message : String(error) });
      }
    },
  });

  // #region Plugin management (bundles: official / installed)

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/bundles',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      const manager = ctx.get('pluginManager');
      if (manager === undefined) return json({ bundles: [], error: 'pluginManager 服务未加载' });
      try {
        const bundles = await manager.listBundles();
        return json({
          bundles: bundles.map((bundle) => ({
            name: bundle.name,
            official: bundle.official === true,
            availability: bundle.availability,
            installed: bundle.installed === true,
            enabled: bundle.enabled === true,
            version: bundle.version ?? null,
            description: bundle.description ?? '',
            title: localized(bundle.meta?.title),
            metaDescription: localized(bundle.meta?.description),
            source: bundle.source ?? null,
            optional: bundle.optional === true,
            removable: bundle.removable === true,
            readOnlyReason: bundle.readOnlyReason ?? null,
            problem: bundle.error?.code ?? null,
            rows: (bundle.rows ?? []).map((row) => ({ rowId: row.rowId, moduleName: row.moduleName, entryId: row.entryId ?? null })),
            overrides: Array.isArray(bundle.overrides) ? bundle.overrides : [],
          })),
        });
      } catch (error) {
        return json({ bundles: [], error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/bundles/enable',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const manager = ctx.get('pluginManager');
      if (manager === undefined) return json({ error: 'pluginManager 服务未加载' }, 503);
      try {
        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name : '';
        if (name.length === 0) return json({ error: '缺少组合包名称' }, 400);
        const change = await manager.setBundleEnabled(name, body?.enabled === true);
        return json({
          ok: change.application !== 'failed',
          application: change.application,
          restartReason: change.restartReason ?? null,
          warnings: change.warnings ?? [],
          error: change.error?.diagnostic ?? change.error?.code ?? null,
        });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/bundles/remove',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const manager = ctx.get('pluginManager');
      if (manager === undefined) return json({ error: 'pluginManager 服务未加载' }, 503);
      try {
        const body = await request.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name : '';
        if (name.length === 0) return json({ error: '缺少组合包名称' }, 400);
        const change = await manager.removeBundle(name);
        return json({
          ok: change.application !== 'failed',
          application: change.application,
          restartReason: change.restartReason ?? null,
          warnings: change.warnings ?? [],
          error: change.error?.diagnostic ?? change.error?.code ?? null,
        });
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  // #endregion

  // #region AUI — agent-facing plugin discovery

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/aui',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const settings = await saveAuiSettings(body ?? {});
          return json({ settings, pending: pendingSuggestion });
        }
        const settings = await loadAuiSettings();
        return json({ settings, pending: pendingSuggestion });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/aui/suggestion',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const url = new URL(request.url, 'http://localhost');
      const after = url.searchParams.get('after') ?? '';
      const settings = await loadAuiSettings();
      const fresh = pendingSuggestion !== null && pendingSuggestion.id !== after;
      return json({ enabled: settings.enabled, suggestion: fresh ? pendingSuggestion : null });
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/aui/dismiss',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const current = pendingSuggestion;
        if (body?.mutePlugin === true && current !== null) dismissedPlugins.add(String(current.plugin.full));
        if (body?.disable === true) await saveAuiSettings({ enabled: false });
        if (current !== null && (body?.id === undefined || body.id === current.id)) pendingSuggestion = null;
        return json({ ok: true, muted: dismissedPlugins.size });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/plugin-discovery/aui/test',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await request.json().catch(() => ({}));
        const text = typeof body?.text === 'string' && body.text.trim().length > 0 ? body.text.trim() : '帮我整理一下 Excel 表格数据，检查公式';
        const suggestion = await suggestFor(text, true);
        pendingSuggestion = suggestion;
        return json({ suggestion, text });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });

  // #endregion
}

/**
 * Host plugin body.
 * @param {any} ctx Host context
 */
export function apply(ctx) {
  hostCtx = ctx;
  registerRoutes(ctx);
  if (typeof ctx.on === 'function') {
    ctx.on('agent/inbox/inserted', (payload) => {
      void handleInboxMessage(payload);
    });
  }
}
