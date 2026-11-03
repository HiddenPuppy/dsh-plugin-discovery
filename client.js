/**
 * Browser half of 插件发现 (Plugin Discovery).
 *
 * Two registrations on the root scope:
 *  - `sidebar.panellist` id `plugin-discovery` — the left-sidebar entry below
 *    自动化任务, whose icon the shell renders in the rail and expanded list.
 *  - `main` key `plugin-discovery` — the full panel page.
 *
 * The page asks the Host half for the normalized market feed, renders the
 * summary, category chips, sort control and the paged project table, and
 * refreshes from GitHub every time it is opened.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-discovery',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'plugin-discovery';
    const PANEL_ID = 'plugin-discovery';
    const FEED_URL = '/api/plugin-discovery/feed';
    const PAGE_SIZES = [50, 100, 200];
    const HEAD_CHIPS = 6;

    /** Sidebar dictionaries. */
    const zh = {
      'panel.title': '插件发现',
      'panel.label': '插件发现',
      'page.subtitle': '来自 GitHub 的 DSH 插件市场全量目录',
      'page.summary.title': '生态概况',
      'stat.total': '收录插件',
      'stat.categories': '插件分类',
      'stat.languages': '开发语言',
      'stat.recent': '近 30 天更新',
      'action.refresh': '刷新',
      'action.syncing': '正在同步最新…',
      'action.open': '打开项目',
      'filter.all': '全部',
      'filter.other': '其他',
      'filter.search': '搜索插件名称、简介或主题…',
      'sort.label': '排序',
      'sort.catalog': '全部（目录顺序）',
      'sort.stars': '最高 Star',
      'sort.updated': '最新更新',
      'table.project': '项目',
      'table.desc': '中文简介',
      'table.category': '分类',
      'table.language': '语言',
      'table.stars': 'Star',
      'table.updated': '更新时间',
      'table.index': '#',
      'empty': '没有符合条件的插件',
      'error.title': '暂时无法读取插件市场',
      'error.retry': '重试',
      'loading': '正在从 GitHub 拉取插件市场数据…',
      'pager.prev': '上一页',
      'pager.next': '下一页',
      'pager.info': '第 {page} / {pages} 页',
      'pager.total': '共 {total} 个插件',
      'footer.source': '数据来源：GitHub 社区维护的 DSH 插件全量目录（bruc3van/awesome-dsh-plugin）',
      'footer.legend': '中文简介来源：项目自带 · 编辑精选 · AI 生成 · 自动归类',
      'source.native': '项目自带中文',
      'source.curated': '编辑精选',
      'source.ai': 'AI 生成',
      'source.auto': '自动归类',
      'synced.at': '上次同步：{time}',
      'stale.warning': '本次同步失败，正在显示本地缓存数据：{error}',
    };

    /** English dictionaries. */
    const en = {
      'panel.title': 'Plugin Discovery',
      'panel.label': 'Plugin Discovery',
      'page.subtitle': 'The complete DSH plugin market published on GitHub',
      'page.summary.title': 'Ecosystem overview',
      'stat.total': 'Plugins',
      'stat.categories': 'Categories',
      'stat.languages': 'Languages',
      'stat.recent': 'Updated in 30 days',
      'action.refresh': 'Refresh',
      'action.syncing': 'Syncing the latest…',
      'action.open': 'Open project',
      'filter.all': 'All',
      'filter.other': 'Other',
      'filter.search': 'Search name, description or topics…',
      'sort.label': 'Sort',
      'sort.catalog': 'All (catalog order)',
      'sort.stars': 'Most stars',
      'sort.updated': 'Recently updated',
      'table.project': 'Project',
      'table.desc': 'Description (Chinese)',
      'table.category': 'Category',
      'table.language': 'Language',
      'table.stars': 'Stars',
      'table.updated': 'Updated',
      'table.index': '#',
      'empty': 'No plugin matches the filters',
      'error.title': 'The plugin market is unavailable',
      'error.retry': 'Retry',
      'loading': 'Pulling the plugin market from GitHub…',
      'pager.prev': 'Previous',
      'pager.next': 'Next',
      'pager.info': 'Page {page} / {pages}',
      'pager.total': '{total} plugins',
      'footer.source': 'Source: the community-maintained complete DSH plugin catalog on GitHub (bruc3van/awesome-dsh-plugin)',
      'footer.legend': 'Chinese description sources: repository · editor pick · AI · automatic tag summary',
      'source.native': 'Repository',
      'source.curated': 'Editor pick',
      'source.ai': 'AI',
      'source.auto': 'Auto tags',
      'synced.at': 'Last synced: {time}',
      'stale.warning': 'The last sync failed; showing the local cache: {error}',
    };

    const CSS = `
.pd-root{display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 auto;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#101828);font-size:13px;line-height:1.55;box-sizing:border-box}
.pd-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;padding:20px 24px 28px}
.pd-inner{max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.pd-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.pd-headmain{flex:1 1 auto;min-width:220px}
.pd-h1{margin:0;font-size:19px;font-weight:600;letter-spacing:.2px;display:flex;align-items:center;gap:8px}
.pd-sub{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.pd-btn{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);background:var(--dsw-alias-bg-base,#fff);color:inherit;border-radius:7px;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.pd-btn:hover{background:var(--dsw-alias-bg-layer-2,#f4f6fa)}
.pd-btn:disabled{opacity:.55;cursor:default}
.pd-btn.primary{background:var(--dsw-alias-brand-primary,#2F6FED);border-color:var(--dsw-alias-brand-primary,#2F6FED);color:#fff}
.pd-spin{width:11px;height:11px;border-radius:50%;border:1.6px solid currentColor;border-top-color:transparent;animation:pd-spin .8s linear infinite;display:inline-block}
@keyframes pd-spin{to{transform:rotate(360deg)}}
.pd-card{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);padding:14px 16px}
.pd-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.pd-stat{min-width:0}
.pd-stat b{display:block;font-size:20px;font-weight:600;letter-spacing:.3px}
.pd-stat span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary,#667085);margin-top:1px}
.pd-summary{margin:8px 0 0;font-size:12.5px;color:var(--dsw-alias-label-secondary,#667085);line-height:1.75}
.pd-bars{display:flex;flex-direction:column;gap:5px;margin-top:10px}
.pd-bar{display:grid;grid-template-columns:minmax(86px,132px) 1fr 44px;align-items:center;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-bar i{display:block;height:6px;border-radius:3px;background:var(--dsw-alias-brand-primary,#2F6FED);opacity:.75;min-width:2px}
.pd-bar em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}
.pd-bar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pd-search{flex:1 1 240px;min-width:180px;position:relative;display:flex;align-items:center}
.pd-search input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:8px;padding:6px 10px 6px 30px;font:inherit;font-size:12.5px;background:var(--dsw-alias-bg-base,#fff);color:inherit}
.pd-search input:focus{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 35%,transparent);outline-offset:1px;border-color:var(--dsw-alias-brand-primary,#2F6FED)}
.pd-search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--dsw-alias-label-secondary,#667085);pointer-events:none}
.pd-sort{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-sort select{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:8px;padding:5px 8px;font:inherit;font-size:12.5px;background:var(--dsw-alias-bg-base,#fff);color:inherit;cursor:pointer}
.pd-chips{display:flex;gap:7px;flex-wrap:wrap}
.pd-chip{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:999px;padding:3px 11px;font-size:12px;cursor:pointer;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#667085);display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.pd-chip:hover{background:var(--dsw-alias-bg-layer-2,#f4f6fa)}
.pd-chip.on{border-color:var(--dsw-alias-brand-primary,#2F6FED);color:var(--dsw-alias-brand-primary,#2F6FED);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 9%,transparent);font-weight:500}
.pd-chip small{font-size:10.5px;opacity:.75;font-variant-numeric:tabular-nums}
.pd-tablewrap{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff)}
.pd-table{width:100%;border-collapse:collapse;table-layout:fixed}
.pd-table th{position:sticky;top:0;z-index:1;text-align:left;font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary,#667085);background:var(--dsw-alias-bg-layer-2,#f7f9fc);padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#e4e8f0);white-space:nowrap}
.pd-table td{padding:9px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef1f6);vertical-align:top}
.pd-table tr:last-child td{border-bottom:none}
.pd-table tbody tr{cursor:pointer}
.pd-table tbody tr:hover td{background:var(--dsw-alias-bg-layer-2,#f7f9fc)}
.pd-num{color:var(--dsw-alias-state-idle-primary,#98a2b3);font-size:11.5px;font-variant-numeric:tabular-nums;text-align:right}
.pd-proj{display:flex;flex-direction:column;gap:1px;min-width:0}
.pd-proj b{font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-proj span{font-size:11px;color:var(--dsw-alias-label-secondary,#667085);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-desc{display:flex;flex-direction:column;gap:3px;min-width:0}
.pd-desc p{margin:0;font-size:12px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.pd-desc p.en{font-size:11px;color:var(--dsw-alias-label-secondary,#667085);-webkit-line-clamp:2;line-height:1.55}
.pd-badge{display:inline-block;font-size:10px;padding:0 5px;border-radius:4px;line-height:15px;color:var(--dsw-alias-label-secondary,#667085);border:1px solid var(--dsw-alias-border-l1,#e4e8f0);margin-left:6px;vertical-align:1px;white-space:nowrap}
.pd-cat{font-size:11.5px;color:var(--dsw-alias-brand-primary,#2F6FED);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 8%,transparent);border-radius:5px;padding:1px 6px;display:inline-block;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pd-muted{font-size:11.5px;color:var(--dsw-alias-label-secondary,#667085);white-space:nowrap}
.pd-star{font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.pd-open{border:1px solid transparent;background:transparent;color:var(--dsw-alias-brand-primary,#2F6FED);font:inherit;font-size:11.5px;cursor:pointer;border-radius:6px;padding:2px 6px;text-decoration:none;display:inline-block;white-space:nowrap}
.pd-open:hover{border-color:var(--dsw-alias-border-l1,#e4e8f0);background:var(--dsw-alias-bg-base,#fff)}
.pd-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between;padding:10px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-pager{display:flex;align-items:center;gap:6px}
.pd-pager select{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:7px;padding:4px 6px;font:inherit;font-size:12px;background:var(--dsw-alias-bg-base,#fff);color:inherit}
.pd-state{padding:56px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#667085);font-size:12.5px;line-height:1.8}
.pd-state b{display:block;color:var(--dsw-alias-label-primary,#101828);font-size:14px;margin-bottom:4px}
.pd-err{color:var(--dsw-alias-state-error-primary,#B42318)}
.pd-note{font-size:11px;color:var(--dsw-alias-label-secondary,#667085);line-height:1.7}
.pd-note a{color:var(--dsw-alias-brand-primary,#2F6FED);text-decoration:none}
.pd-note a:hover{text-decoration:underline}
@media (max-width:860px){.pd-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pd-scroll{padding:14px 12px 20px}.pd-hide-narrow{display:none}}
`;

    const CATEGORY_ZH = new Map();

    /**
     * Sidebar icon: a puzzle piece with a magnifier, drawn with currentColor so
     * the shell's rail and active states keep working.
     * @param {{ size?: number, active?: boolean }} props icon owner props
     * @returns {any} SVG element
     */
    function DiscoveryIcon({ size = 16 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M10 3.5a2 2 0 0 1 4 0c0 .7.6 1.2 1.3 1.2H17a1.5 1.5 0 0 1 1.5 1.5v1.7c0 .7.5 1.3 1.2 1.3a2 2 0 0 1 0 4c-.7 0-1.2.6-1.2 1.3V17a1.5 1.5 0 0 1-1.5 1.5h-1.7c-.7 0-1.3.5-1.3 1.2a2 2 0 0 1-4 0c0-.7-.6-1.2-1.3-1.2H7A1.5 1.5 0 0 1 5.5 17v-1.7c0-.7-.5-1.3-1.2-1.3a2 2 0 0 1 0-4c.7 0 1.2-.6 1.2-1.3V7A1.5 1.5 0 0 1 7 5.5h1.7c.7 0 1.3-.5 1.3-1.2Z' }),
        h('circle', { cx: 10.6, cy: 10.6, r: 2.4 }),
        h('path', { d: 'm12.4 12.4 2.1 2.1' }),
      );
    }

    /**
     * Format a star count for the table.
     * @param {number} value stars
     * @returns {string} compact label
     */
    function formatStars(value) {
      if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return String(value);
    }

    /**
     * Format an ISO timestamp for the sync line.
     * @param {string | null | undefined} iso timestamp
     * @returns {string} local time or a dash
     */
    function formatTime(iso) {
      if (!iso) return '—';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '—';
      const pad = (n) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Ask the Host half for the feed.
     * @param {boolean} wait wait for an in-flight refresh
     * @param {AbortSignal} signal cancellation
     * @returns {Promise<any>} feed payload
     */
    async function loadFeed(wait, signal) {
      const response = await fetch(`${FEED_URL}${wait ? '?wait=1' : ''}`, {
        headers: { accept: 'application/json' },
        signal,
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
      return body;
    }

    /**
     * Normalize the compact wire rows into render objects once per payload.
     * @param {any} feed payload
     * @returns {any[]} rows
     */
    function toRows(feed) {
      if (!feed || !Array.isArray(feed.items)) return [];
      return feed.items.map((row) => ({
        name: row[0],
        full: row[1],
        stars: row[2] ?? 0,
        language: row[3] ?? '',
        license: row[4] ?? '',
        updated: row[5] ?? '',
        category: row[6] ?? '',
        zh: row[7] ?? '',
        en: row[8] ?? '',
        source: row[9] ?? '',
        url: `https://github.com/${row[1]}`,
      }));
    }

    /**
     * The 插件发现 panel page.
     * @param {{ t?: (key: string, vars?: Record<string, unknown>) => string }} props slot props
     * @returns {any} page element
     */
    function DiscoveryPage(props) {
      const t = typeof props.t === 'function'
        ? props.t
        : (key, vars) => {
            const template = zh[key] ?? en[key] ?? key;
            if (!vars) return template;
            return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
          };

      const [feed, setFeed] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [syncing, setSyncing] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [syncError, setSyncError] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [category, setCategory] = React.useState('all');
      const [sort, setSort] = React.useState('catalog');
      const [pageSize, setPageSize] = React.useState(50);
      const [page, setPage] = React.useState(1);
      const alive = React.useRef(true);

      React.useEffect(() => {
        alive.current = true;
        const controller = new AbortController();
        (async () => {
          try {
            const cached = await loadFeed(false, controller.signal);
            if (!alive.current) return;
            if (Array.isArray(cached.items) && cached.items.length > 0) {
              setFeed(cached);
              setLoading(false);
            }
            setSyncing(true);
            const fresh = await loadFeed(true, controller.signal);
            if (!alive.current) return;
            if (Array.isArray(fresh.items) && fresh.items.length > 0) setFeed(fresh);
            setSyncError(fresh.error ?? null);
          } catch (cause) {
            if (!alive.current || controller.signal.aborted) return;
            setError(cause instanceof Error ? cause.message : String(cause));
          } finally {
            if (alive.current) {
              setLoading(false);
              setSyncing(false);
            }
          }
        })();
        return () => {
          alive.current = false;
          controller.abort();
        };
      }, []);

      const refresh = React.useCallback(async () => {
        setSyncing(true);
        try {
          const fresh = await loadFeed(true);
          if (Array.isArray(fresh.items) && fresh.items.length > 0) {
            setFeed(fresh);
            setError(null);
            setSyncError(null);
          } else if (fresh.error) setSyncError(fresh.error);
        } catch (cause) {
          setSyncError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setSyncing(false);
        }
      }, []);

      const rows = React.useMemo(() => toRows(feed), [feed]);

      const categories = React.useMemo(() => {
        const list = Array.isArray(feed?.categories) ? feed.categories : [];
        for (const item of list) CATEGORY_ZH.set(item.key, item.zh);
        return list;
      }, [feed]);

      // Head categories keep their own chip; the long tail is folded into 其他.
      const headCategories = React.useMemo(() => categories.slice(0, HEAD_CHIPS), [categories]);
      const otherCategoryKeys = React.useMemo(() => new Set(categories.slice(HEAD_CHIPS).map((item) => item.key)), [categories]);
      const otherCount = React.useMemo(
        () => categories.slice(HEAD_CHIPS).reduce((sum, item) => sum + item.count, 0),
        [categories],
      );
      const categoryRank = React.useMemo(() => {
        const rank = new Map();
        categories.forEach((item, index) => rank.set(item.key, index));
        return rank;
      }, [categories]);

      React.useEffect(() => {
        setPage(1);
      }, [query, category, sort, pageSize]);

      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        let list = rows;
        if (category !== 'all') {
          list = category === 'other'
            ? list.filter((row) => otherCategoryKeys.has(row.category))
            : list.filter((row) => row.category === category);
        }
        if (needle.length > 0) {
          list = list.filter((row) =>
            row.name.toLowerCase().includes(needle) ||
            row.full.toLowerCase().includes(needle) ||
            row.zh.toLowerCase().includes(needle) ||
            row.en.toLowerCase().includes(needle),
          );
        }
        if (sort === 'stars') return list.slice().sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
        if (sort === 'updated') return list.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || b.stars - a.stars);
        return list.slice().sort((a, b) => (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99) || b.stars - a.stars);
      }, [rows, query, category, sort, otherCategoryKeys, categoryRank]);

      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const current = Math.min(page, pages);
      const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

      const stats = feed?.stats ?? { total: rows.length, categories: categories.length, languages: 0, recent30: 0, starred1k: 0 };
      const topCategory = categories[0];
      const topProject = feed?.top?.[0];
      const total = stats.total ?? rows.length;

      /**
       * Open one project on GitHub in a new tab.
       * @param {string} url repository URL
       */
      const openProject = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      };

      const head = h(
        'div',
        { className: 'pd-head' },
        h(
          'div',
          { className: 'pd-headmain' },
          h(
            'h1',
            { className: 'pd-h1' },
            h(DiscoveryIcon, { size: 20 }),
            t('panel.title'),
          ),
          h(
            'p',
            { className: 'pd-sub' },
            t('page.subtitle'),
            feed?.upstream?.snapshot ? ` · ${String(feed.upstream.snapshot).slice(0, 10)} 快照` : '',
            feed?.fetchedAt ? ` · ${t('synced.at', { time: formatTime(feed.fetchedAt) })}` : '',
          ),
        ),
        h(
          'div',
          { className: 'pd-actions' },
          syncing ? h('span', { className: 'pd-spinner', style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } }, h('i', { className: 'pd-spin' }), ' ', t('action.syncing')) : null,
          h(
            'button',
            { className: 'pd-btn primary', onClick: () => void refresh(), disabled: syncing },
            syncing ? h('i', { className: 'pd-spin' }) : null,
            t('action.refresh'),
          ),
        ),
      );

      if (loading) {
        return h('div', { className: 'pd-root' }, h('div', { className: 'pd-state' }, h('i', { className: 'pd-spin', style: { width: 18, height: 18, borderWidth: 2 } }), h('div', null, t('loading'))));
      }

      if (error && rows.length === 0) {
        return h(
          'div',
          { className: 'pd-root' },
          h(
            'div',
            { className: 'pd-state' },
            h('b', { className: 'pd-err' }, t('error.title')),
            h('div', { className: 'pd-err' }, error),
            h('div', { style: { marginTop: 12 } }, h('button', { className: 'pd-btn', onClick: () => void refresh() }, t('error.retry'))),
          ),
        );
      }

      const summaryCard = h(
        'section',
        { className: 'pd-card' },
        h('div', { className: 'pd-stats' }, [
          [stats.total ?? total, t('stat.total')],
          [stats.categories ?? categories.length, t('stat.categories')],
          [stats.languages ?? 0, t('stat.languages')],
          [stats.recent30 ?? 0, t('stat.recent')],
        ].map(([value, label]) =>
          h('div', { className: 'pd-stat', key: label }, h('b', null, typeof value === 'number' ? value.toLocaleString('zh-CN') : String(value)), h('span', null, label)),
        )),
        topCategory
          ? h(
              'p',
              { className: 'pd-summary' },
              `当前市场共收录 ${total.toLocaleString('zh-CN')} 个经核实的 DSH 插件，覆盖 ${categories.length} 个分类、${stats.languages ?? 0} 种开发语言。`,
              `其中「${topCategory.zh}」类最多，共 ${topCategory.count.toLocaleString('zh-CN')} 个（约占 ${Math.round((topCategory.count / Math.max(1, total)) * 100)}%）`,
              categories[1] ? `，其次是「${categories[1].zh}」${categories[1].count.toLocaleString('zh-CN')} 个` : '',
              topProject ? `。星标最高的是 ${topProject.name}（${formatStars(topProject.stars)} Star）。` : '。',
              `最近 30 天有 ${(stats.recent30 ?? 0).toLocaleString('zh-CN')} 个项目保持更新。`,
            )
          : null,
        categories.length > 0
          ? h(
              'div',
              { className: 'pd-bars' },
              categories.slice(0, 6).map((item) =>
                h(
                  'div',
                  { className: 'pd-bar', key: item.key },
                  h('span', null, item.zh),
                  h('i', { style: { width: `${Math.max(2, Math.round((item.count / Math.max(1, total)) * 100))}%` } }),
                  h('em', null, item.count.toLocaleString('zh-CN')),
                ),
              ),
            )
          : null,
      );

      const chips = [
        h(
          'button',
          { key: 'all', className: `pd-chip${category === 'all' ? ' on' : ''}`, onClick: () => setCategory('all') },
          t('filter.all'),
          h('small', null, total.toLocaleString('zh-CN')),
        ),
        ...headCategories.map((item) =>
          h(
            'button',
            { key: item.key, className: `pd-chip${category === item.key ? ' on' : ''}`, onClick: () => setCategory(item.key), title: item.en },
            item.zh,
            h('small', null, item.count.toLocaleString('zh-CN')),
          ),
        ),
        otherCount > 0
          ? h(
              'button',
              { key: 'other', className: `pd-chip${category === 'other' ? ' on' : ''}`, onClick: () => setCategory('other'), title: categories.slice(HEAD_CHIPS).map((item) => item.zh).join(' / ') },
              t('filter.other'),
              h('small', null, otherCount.toLocaleString('zh-CN')),
            )
          : null,
      ];

      const toolbar = h(
        'div',
        { className: 'pd-toolbar' },
        h(
          'label',
          { className: 'pd-search' },
          h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true }, h('circle', { cx: 11, cy: 11, r: 6.5 }), h('path', { d: 'm16 16 4.2 4.2' })),
          h('input', { type: 'search', value: query, placeholder: t('filter.search'), onChange: (event) => setQuery(event.target.value) }),
        ),
        h(
          'div',
          { className: 'pd-sort' },
          h('span', null, t('sort.label')),
          h(
            'select',
            { value: sort, onChange: (event) => setSort(event.target.value) },
            h('option', { value: 'catalog' }, t('sort.catalog')),
            h('option', { value: 'stars' }, t('sort.stars')),
            h('option', { value: 'updated' }, t('sort.updated')),
          ),
        ),
      );

      const table = h(
        'div',
        { className: 'pd-tablewrap' },
        h(
          'table',
          { className: 'pd-table' },
          h(
            'colgroup',
            null,
            h('col', { style: { width: 44 } }),
            h('col', { style: { width: '21%' } }),
            h('col', null),
            h('col', { style: { width: '11%' } }),
            h('col', { style: { width: 78 } }),
            h('col', { style: { width: 74 } }),
            h('col', { style: { width: 92 } }),
            h('col', { style: { width: 64 } }),
          ),
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', { className: 'pd-num' }, t('table.index')),
              h('th', null, t('table.project')),
              h('th', null, t('table.desc')),
              h('th', null, t('table.category')),
              h('th', null, t('table.language')),
              h('th', null, t('table.stars')),
              h('th', null, t('table.updated')),
              h('th', null, ''),
            ),
          ),
          h(
            'tbody',
            null,
            visible.length === 0
              ? h('tr', null, h('td', { colSpan: 8 }, h('div', { className: 'pd-state' }, t('empty'))))
              : visible.map((row, index) =>
                  h(
                    'tr',
                    { key: row.full, onClick: () => openProject(row.url), title: row.url },
                    h('td', { className: 'pd-num' }, (current - 1) * pageSize + index + 1),
                    h(
                      'td',
                      null,
                      h(
                        'div',
                        { className: 'pd-proj' },
                        h('b', null, row.name),
                        h('span', null, row.full),
                      ),
                    ),
                    h(
                      'td',
                      null,
                      h(
                        'div',
                        { className: 'pd-desc' },
                        h('p', null, row.zh || row.en),
                        row.source === 'auto' && row.en
                          ? h('p', { className: 'en' }, row.en)
                          : row.source === 'ai' || row.source === 'curated'
                            ? h('span', { className: 'pd-badge' }, t(`source.${row.source}`))
                            : null,
                      ),
                    ),
                    h('td', null, h('span', { className: 'pd-cat' }, CATEGORY_ZH.get(row.category) ?? row.category)),
                    h('td', { className: 'pd-muted pd-hide-narrow' }, row.language || '—'),
                    h('td', { className: 'pd-star' }, formatStars(row.stars)),
                    h('td', { className: 'pd-muted' }, row.updated || '—'),
                    h(
                      'td',
                      null,
                      h(
                        'a',
                        {
                          className: 'pd-open',
                          href: row.url,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          onClick: (event) => event.stopPropagation(),
                          title: t('action.open'),
                        },
                        `${t('action.open')} ↗`,
                      ),
                    ),
                  ),
                ),
          ),
        ),
        h(
          'div',
          { className: 'pd-foot' },
          h('span', null, t('pager.total', { total: filtered.length.toLocaleString('zh-CN') })),
          h(
            'div',
            { className: 'pd-pager' },
            h(
              'select',
              { value: String(pageSize), onChange: (event) => setPageSize(Number(event.target.value)) },
              PAGE_SIZES.map((size) => h('option', { key: size, value: String(size) }, `${size} / 页`)),
            ),
            h('button', { className: 'pd-btn', disabled: current <= 1, onClick: () => setPage(Math.max(1, current - 1)) }, t('pager.prev')),
            h('span', null, t('pager.info', { page: current, pages })),
            h('button', { className: 'pd-btn', disabled: current >= pages, onClick: () => setPage(Math.min(pages, current + 1)) }, t('pager.next')),
          ),
        ),
      );

      return h(
        'div',
        { className: 'pd-root' },
        h(
          'div',
          { className: 'pd-scroll' },
          h(
            'div',
            { className: 'pd-inner' },
            head,
            syncError
              ? h('div', { className: 'pd-card', style: { borderColor: 'var(--dsw-alias-state-warn-primary,#f79009)' } }, h('span', { className: 'pd-note pd-err' }, t('stale.warning', { error: syncError })))
              : null,
            summaryCard,
            h('div', { className: 'pd-chips' }, chips),
            toolbar,
            table,
            h(
              'div',
              { className: 'pd-note' },
              h('div', null, t('footer.source'), ' · ', h('a', { href: 'https://github.com/bruc3van/awesome-dsh-plugin', target: '_blank', rel: 'noreferrer' }, 'bruc3van/awesome-dsh-plugin')),
              h('div', null, t('footer.legend')),
            ),
          ),
        ),
      );
    }

    /**
     * Register the sidebar entry and the main panel page.
     * @param {any} ctx Client root context
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-discovery: dictionaries');
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        const tagId = 'dsh-plugin-discovery/panel.css';
        let tag = document.querySelector(`style[data-plugin-css="${tagId}"]`);
        if (tag === null) {
          tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-plugin-discovery';
          tag.dataset.pluginCss = tagId;
          document.head.appendChild(tag);
        }
        tag.textContent = CSS;
        return () => {
          if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
        };
      }, 'plugin-discovery: styles');
      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 20,
        locale: NS,
        label: () => ctx.locale.bind(NS)('panel.label'),
      }, DiscoveryIcon)), 'plugin-discovery: sidebar entry');
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, DiscoveryPage)), 'plugin-discovery: main panel');
    }

    return { inject: ['slots', 'locale'], apply, DiscoveryPage, DiscoveryIcon };
  },
});
