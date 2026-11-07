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
      'table.actions': '操作',
      'action.install': '安装',
      'action.installing': '安装中…',
      'action.installed': '已安装',
      'action.installSource.npm': 'npm 源',
      'action.installSource.git': 'GitHub 源',
      'summary.installable': '其中 {count} 个可通过 npm 源一键安装。',
      'footer.install': '点击「安装」会通过 DSH 插件管理器把插件装进当前 profile（优先 npm 源），安装完成后再按提示刷新窗口或重启 DSH 即可使用。',
      'toast.progress.title': '正在安装 {name}…',
      'toast.progress.body': '正在通过 DSH 插件管理器安装，首次安装通常需要几十秒。',
      'toast.success.title': '已安装 {name}',
      'toast.error.title': '安装失败：{name}',
      'toast.version': '版本 {version} · {via}',
      'toast.where': '在哪里使用',
      'toast.applied': '已立即生效，刷新一下窗口就能看到入口。',
      'toast.restart': '需要重启 DSH 后生效。',
      'toast.gitOnly': '该插件只提供 GitHub 安装源，当前网络可能无法直连 GitHub；可以稍后重试，或在「插件」页手动安装。',
      'toast.pending': '安装被依赖的构建脚本拦截（{list}），点下面的「允许并重试」继续。',
      'toast.buildBlocked': '这个插件安装时要执行构建脚本，被 pnpm 安全策略拦截；可在「插件」页允许脚本后重试。',
      'toast.network': '网络无法访问安装源（GitHub 或 npm 可能不可达），请稍后重试。',
      'toast.notFound': '安装源里没有找到可安装的版本，可能已被作者删除或改名。',
      'toast.approveRetry': '允许并重试',
      'toast.useNpm': '改用 npm 源安装（{spec}）',
      'toast.retryingTitle': '正在重试安装 {name}…',
      'toast.approveNote': '允许后会执行该插件自带的构建脚本（会写入当前 profile 的 pnpm-workspace.yaml），请确认来源可信。',
      'toast.npmNote': '检测到同一项目的官方 npm 包 {spec}，改用它安装不需要执行构建脚本。',
      'toast.already': '这个插件已经安装过了，无需重复安装。',
      'toast.notBundle': '该仓库不是可安装的 DSH 插件包（没有声明 bundle），可能只是一个目录或示例仓库。',
      'toast.openGithub': '打开 GitHub',
      'toast.openPlugins': '查看已安装插件',
      'toast.close': '关闭',
      'tab.discover': '发现',
      'tab.manage': '管理',
      'tab.aui': 'AUI',
      'manage.title': '插件管理',
      'manage.subtitle': '官方自带插件与本地已安装插件，可直接启停或卸载',
      'manage.official': '官方插件',
      'manage.installed': '已安装的第三方插件',
      'manage.empty': '这里还没有插件',
      'manage.loading': '正在读取插件列表…',
      'manage.error': '读取插件列表失败：{error}',
      'manage.refresh': '刷新',
      'manage.list': '列表',
      'manage.grid': '网格',
      'manage.search': '搜索插件名称或描述…',
      'manage.badge.official': '官方',
      'manage.badge.installed': '已安装',
      'manage.badge.optional': '可选',
      'manage.badge.disabled': '已停用',
      'manage.badge.error': '异常',
      'manage.rows': '{count} 个组件',
      'manage.enable': '启用',
      'manage.disable': '停用',
      'manage.remove': '卸载',
      'manage.confirmRemove': '确认卸载',
      'manage.cancel': '取消',
      'manage.removing': '卸载中…',
      'manage.saving': '处理中…',
      'manage.restart': '需要重启 DSH 后生效',
      'manage.officialHint': '官方插件随 DSH 提供，可停用但通常不建议卸载',
      'manage.installedHint': '这些是你安装到当前 profile 的第三方插件，可停用或卸载',
      'manage.uninstallHint': '卸载会移除依赖并取消启用，之后可以重新安装',
      'aui.title': 'AUI · 对话中主动推荐插件',
      'aui.desc': '开启后，DSH 会先用本地检索找出候选插件，再让模型静默判断「这条消息是否真的需要某个插件」；只有判断值得且置信度足够时，才会在右下角弹出轻量卡片。只有你点「安装」才会真正安装。',
      'aui.enabled': '允许 DSH 在对话中推荐插件',
      'aui.minConfidence': '最低置信度',
      'aui.cooldown': '冷却时间（秒）',
      'aui.maxPerHour': '每小时最多推荐',
      'aui.maxPerSession': '每个会话最多推荐',
      'aui.quietHint': '默认偏安静：冷却 4 分钟、每小时最多 4 次、每会话最多 2 次。',
      'aui.test': '试一下',
      'aui.testPlaceholder': '输入一句你正在做的事，例如：帮我整理一下 Excel 表格数据',
      'aui.testHint': '试一下只会在右下角弹出预览卡片，不会自动安装。',
      'aui.notice': '候选由本地召回；对话内容会发给当前默认模型做判断，但不会发往插件市场。',
      'aui.close': '关闭',
      'aui.saved': '已保存',
      'aui.card.title': '发现一个可能帮到你的插件',
      'aui.card.reason': '匹配到：{terms}',
      'aui.card.install': '安装',
      'aui.card.installing': '安装中…',
      'aui.card.ignore': '忽略',
      'aui.card.mute': '不再提示',
      'aui.card.installed': '已安装，刷新窗口即可使用',
      'aui.card.failed': '安装失败：{error}',
      'aui.card.footer': '在「插件发现 → AUI」里可以调整或关闭这个行为',
      'usage.title': '插件使用情况',
      'usage.summary': '监控已运行 {days} 天 · 记录 {records} 次工具调用 · 第三方插件 {plugins} 个',
      'usage.idleTitle': '装了但很少用',
      'usage.idleHint': '这些插件使用次数很少、且已经很久没用了。移除后下次有相关需求时，AUI 可以再帮你把它找回来。',
      'usage.idleEmpty': '暂时没有需要清理的插件',
      'usage.status.tools': '工具型',
      'usage.status.ui': '界面型（暂不统计）',
      'usage.status.unknown': '无法统计',
      'usage.uses': '使用 {count} 次',
      'usage.lastUsed': '最近使用：{when}',
      'usage.neverUsed': '还没记录到使用',
      'usage.firstSeen': '首次记录：{when}',
      'usage.rule': '闲置判定：{days} 天未使用且使用不超过 {maxUses} 次',
      'usage.recent': '最近活动',
      'usage.noActivity': '还没有使用记录',
      'usage.empty': '当前没有可统计的第三方插件',
      'usage.uninstallHint': '移除只卸载插件本身，不会删除你的会话或文件。',
      'usage.officialLine': '官方插件使用：{items}',
      'usage.open': '使用记录',
      'usage.dialogTitle': '插件使用记录',
      'usage.idleBanner': '{count} 个插件装了但很少用',
      'usage.idleShow': '看看',
      'usage.idleHide': '收起',
      'usage.idleTag': '很少使用',
      'usage.officialTitle': '官方插件使用',
      'usage.note': '界面型插件（主题、预览器）不统计使用次数，也不会进入清理提醒。',
      'time.justNow': '刚刚',
      'time.minutesAgo': '{count} 分钟前',
      'time.hoursAgo': '{count} 小时前',
      'time.daysAgo': '{count} 天前',
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
      'table.actions': 'Actions',
      'action.install': 'Install',
      'action.installing': 'Installing…',
      'action.installed': 'Installed',
      'action.installSource.npm': 'npm',
      'action.installSource.git': 'GitHub',
      'summary.installable': '{count} of them can be installed in one click from the npm registry.',
      'footer.install': '“Install” asks the DSH plugin manager to add the plugin to this profile (npm source first). After it finishes, refresh the window or restart DSH as the notice says.',
      'toast.progress.title': 'Installing {name}…',
      'toast.progress.body': 'The DSH plugin manager is installing it; the first install usually takes a few dozen seconds.',
      'toast.success.title': 'Installed {name}',
      'toast.error.title': 'Install failed: {name}',
      'toast.version': 'Version {version} · {via}',
      'toast.where': 'Where to find it',
      'toast.applied': 'Applied immediately — refresh the window to see the entry.',
      'toast.restart': 'Restart DSH for it to take effect.',
      'toast.gitOnly': 'This plugin only ships a GitHub install source, and GitHub may be unreachable on this network. Retry later or install it manually from the Plugins page.',
      'toast.pending': 'The install was blocked by dependency build scripts ({list}); use “Allow and retry” below.',
      'toast.buildBlocked': 'This plugin runs build scripts during install and pnpm blocked them; allow them on the Plugins page and retry.',
      'toast.network': 'The install source is unreachable (GitHub or npm may be down); retry later.',
      'toast.notFound': 'No installable version was found; the package may have been removed or renamed.',
      'toast.approveRetry': 'Allow and retry',
      'toast.useNpm': 'Install from npm instead ({spec})',
      'toast.retryingTitle': 'Retrying {name}…',
      'toast.approveNote': 'Allowing runs this plugin’s own build scripts and writes the approval into this profile’s pnpm-workspace.yaml; only continue for a source you trust.',
      'toast.npmNote': 'The same project publishes an npm package {spec}; installing from npm needs no build scripts.',
      'toast.already': 'This plugin is already installed.',
      'toast.notBundle': 'This repository is not an installable DSH bundle (it declares no bundle patch); it may be a catalog or example repository.',
      'toast.openGithub': 'Open GitHub',
      'toast.openPlugins': 'Installed plugins',
      'toast.close': 'Close',
      'tab.discover': 'Discover',
      'tab.manage': 'Manage',
      'tab.aui': 'AUI',
      'manage.title': 'Plugin management',
      'manage.subtitle': 'Bundled official plugins and third-party plugins installed in this profile',
      'manage.official': 'Official plugins',
      'manage.installed': 'Installed third-party plugins',
      'manage.empty': 'Nothing here yet',
      'manage.loading': 'Reading the plugin list…',
      'manage.error': 'Could not read the plugin list: {error}',
      'manage.refresh': 'Refresh',
      'manage.list': 'List',
      'manage.grid': 'Grid',
      'manage.search': 'Search by name or description…',
      'manage.badge.official': 'Official',
      'manage.badge.installed': 'Installed',
      'manage.badge.optional': 'Optional',
      'manage.badge.disabled': 'Disabled',
      'manage.badge.error': 'Problem',
      'manage.rows': '{count} rows',
      'manage.enable': 'Enable',
      'manage.disable': 'Disable',
      'manage.remove': 'Uninstall',
      'manage.confirmRemove': 'Confirm uninstall',
      'manage.cancel': 'Cancel',
      'manage.removing': 'Removing…',
      'manage.saving': 'Working…',
      'manage.restart': 'Restart DSH for this to take effect',
      'manage.officialHint': 'Official plugins ship with DSH; they can be disabled but are usually not uninstalled',
      'manage.installedHint': 'Third-party plugins installed in this profile can be disabled or uninstalled',
      'manage.uninstallHint': 'Uninstalling removes the dependency and the activation; you can install it again later',
      'aui.title': 'AUI · proactive plugin suggestions',
      'aui.desc': 'When enabled, DSH first recalls candidate plugins locally, then asks the model to silently judge whether this message really needs one. Only a confident, worthwhile match shows a small bottom-right card, and nothing installs until you press Install.',
      'aui.enabled': 'Let DSH suggest plugins during conversation',
      'aui.minConfidence': 'Minimum confidence',
      'aui.cooldown': 'Cooldown (seconds)',
      'aui.maxPerHour': 'Max per hour',
      'aui.maxPerSession': 'Max per session',
      'aui.quietHint': 'Quiet by default: 4-minute cooldown, at most 4 per hour and 2 per session.',
      'aui.test': 'Try it',
      'aui.testPlaceholder': 'Describe something you are doing, e.g. tidy up an Excel sheet',
      'aui.testHint': 'Trying it only previews the card in the corner; nothing gets installed.',
      'aui.notice': 'Candidates are recalled locally; the sentence is sent to your current default model for judgement, never to the plugin market.',
      'aui.close': 'Close',
      'aui.saved': 'Saved',
      'aui.card.title': 'A plugin that might help',
      'aui.card.reason': 'Matched: {terms}',
      'aui.card.install': 'Install',
      'aui.card.installing': 'Installing…',
      'aui.card.ignore': 'Ignore',
      'aui.card.mute': 'Don\'t suggest again',
      'aui.card.installed': 'Installed — refresh the window to use it',
      'aui.card.failed': 'Install failed: {error}',
      'aui.card.footer': 'Adjust or disable this in Plugin Discovery → AUI',
      'usage.title': 'Plugin usage',
      'usage.summary': 'Monitoring for {days} days · {records} tool calls recorded · {plugins} third-party plugins',
      'usage.idleTitle': 'Installed but rarely used',
      'usage.idleHint': 'These plugins were barely used and have been quiet for a long time. Remove them, and AUI can find them again when a relevant need comes up.',
      'usage.idleEmpty': 'Nothing to clean up right now',
      'usage.status.tools': 'Tool plugin',
      'usage.status.ui': 'UI plugin (not counted yet)',
      'usage.status.unknown': 'Not measurable',
      'usage.uses': '{count} uses',
      'usage.lastUsed': 'Last used: {when}',
      'usage.neverUsed': 'No use recorded yet',
      'usage.firstSeen': 'First seen: {when}',
      'usage.rule': 'Idle rule: no use for {days} days and at most {maxUses} uses',
      'usage.recent': 'Recent activity',
      'usage.noActivity': 'No activity yet',
      'usage.empty': 'No measurable third-party plugins yet',
      'usage.uninstallHint': 'Removing only uninstalls the plugin; your sessions and files stay.',
      'usage.officialLine': 'Official plugin usage: {items}',
      'usage.open': 'Usage log',
      'usage.dialogTitle': 'Plugin usage log',
      'usage.idleBanner': '{count} plugin(s) installed but rarely used',
      'usage.idleShow': 'Show',
      'usage.idleHide': 'Hide',
      'usage.idleTag': 'Rarely used',
      'usage.officialTitle': 'Official plugin usage',
      'usage.note': 'UI plugins (themes, previewers) are not counted and never enter the cleanup list.',
      'time.justNow': 'just now',
      'time.minutesAgo': '{count} min ago',
      'time.hoursAgo': '{count} h ago',
      'time.daysAgo': '{count} d ago',
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
.pd-rowactions{display:flex;align-items:center;gap:4px;justify-content:flex-end;flex-wrap:wrap}
.pd-install{border:1px solid var(--dsw-alias-brand-primary,#2F6FED);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 8%,transparent);color:var(--dsw-alias-brand-primary,#2F6FED);border-radius:6px;padding:2px 9px;font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.pd-install:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 18%,transparent)}
.pd-install:disabled{opacity:.6;cursor:default}
.pd-installed{font-size:11px;color:var(--dsw-alias-state-success-primary,#12B76A);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#12B76A) 40%,transparent);border-radius:6px;padding:2px 8px;white-space:nowrap}
.pd-status{border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-left:4px solid var(--dsw-alias-brand-primary,#2F6FED);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);padding:12px 14px;font-size:12.5px;line-height:1.6;animation:pd-pop .18s ease-out}
.pd-status.success{border-left-color:var(--dsw-alias-state-success-primary,#12B76A);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#12B76A) 5%,var(--dsw-alias-bg-layer-1,#fff))}
.pd-status.error{border-left-color:var(--dsw-alias-state-error-primary,#B42318);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#B42318) 5%,var(--dsw-alias-bg-layer-1,#fff))}
@keyframes pd-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.pd-status-head{display:flex;align-items:flex-start;gap:8px}
.pd-status-title{font-weight:600;font-size:13px;flex:1 1 auto;min-width:0;word-break:break-word}
.pd-status-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}
.pd-status-body{margin-top:4px;color:var(--dsw-alias-label-secondary,#667085);word-break:break-word}
.pd-status-meta{margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-status-detail{margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary,#667085);opacity:.8;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pd-status-where{margin-top:8px;display:flex;flex-direction:column;gap:2px}
.pd-status-where b{font-weight:500;color:var(--dsw-alias-label-primary,#101828)}
.pd-status-where span{color:var(--dsw-alias-label-secondary,#667085);padding-left:10px;position:relative}
.pd-status-where span:before{content:"·";position:absolute;left:0}
.pd-status-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.pd-status-link{font-size:11.5px;color:var(--dsw-alias-brand-primary,#2F6FED);text-decoration:none;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:6px;padding:3px 9px;cursor:pointer;background:transparent;font-family:inherit}
.pd-status-link:hover{background:var(--dsw-alias-bg-layer-2,#f4f6fa)}
.pd-status-link.primary{background:var(--dsw-alias-brand-primary,#2F6FED);border-color:var(--dsw-alias-brand-primary,#2F6FED);color:#fff}
.pd-status-link.primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 85%,black)}
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
.pd-tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pd-tab{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#667085);border-radius:8px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer}
.pd-tab:hover{background:var(--dsw-alias-bg-layer-2,#f4f6fa)}
.pd-tab.on{background:var(--dsw-alias-bg-layer-2,#eef2f8);color:var(--dsw-alias-label-primary,#101828);font-weight:600;border-color:var(--dsw-alias-border-l1,#e4e8f0)}
.pd-tab.gear{margin-left:auto}
.pd-manage-head{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.pd-seg{display:flex;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:8px;overflow:hidden}
.pd-seg button{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#667085);padding:5px 12px;font:inherit;font-size:12px;cursor:pointer}
.pd-seg button.on{background:var(--dsw-alias-brand-primary,#2F6FED);color:#fff}
.pd-linkbtn{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#667085);font:inherit;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px}
.pd-linkbtn:hover{background:var(--dsw-alias-bg-layer-2,#f4f6fa);color:var(--dsw-alias-label-primary,#101828)}
.pd-idle-banner{border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f79009) 32%,transparent);border-left:3px solid var(--dsw-alias-state-warn-primary,#f79009);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f79009) 5%,transparent);border-radius:10px;padding:8px 12px;margin:6px 0 2px;display:flex;flex-direction:column;gap:6px}
.pd-idle-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.pd-idle-head b{font-size:12.5px}
.pd-idle-list{display:flex;flex-direction:column;gap:6px;border-top:1px dashed var(--dsw-alias-border-l1,#e4e8f0);padding-top:8px}
.pd-idle-row{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.pd-idle-main{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px}
.pd-usage-inline{font-size:11px;color:var(--dsw-alias-label-secondary,#667085);margin-top:2px}
.pd-usage-list{display:flex;flex-direction:column;gap:6px}
.pd-usage-activity b{font-size:12px}
.pd-usage-activity ul{margin:4px 0 0;padding-left:16px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-modal-line{display:flex;flex-direction:column;gap:3px;margin-top:12px;font-size:12.5px}
.pd-usage-modal{width:560px}
.pd-manage-section{margin-top:14px}
.pd-manage-section h3{margin:0 0 4px;font-size:13px;font-weight:600;display:flex;gap:8px;align-items:center}
.pd-manage-section p.hint{margin:0 0 8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-bundle-list{display:flex;flex-direction:column;gap:8px}
.pd-bundle{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1,#fff);min-width:0}
.pd-bundle-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.pd-bundle-title{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-weight:600;font-size:12.5px}
.pd-bundle-name{font-size:11px;color:var(--dsw-alias-label-secondary,#667085);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.pd-bundle-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#667085);line-height:1.55}
.pd-bundle-actions{display:flex;gap:8px;align-items:center;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}
.pd-tag{font-size:10.5px;padding:0 6px;border-radius:4px;line-height:17px;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);color:var(--dsw-alias-label-secondary,#667085)}
.pd-tag.official{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#2F6FED) 40%,transparent);color:var(--dsw-alias-brand-primary,#2F6FED)}
.pd-tag.warn{color:var(--dsw-alias-state-warn-primary,#f79009);border-color:var(--dsw-alias-border-l1,#e4e8f0)}
.pd-switch{position:relative;width:36px;height:20px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);background:var(--dsw-alias-bg-layer-2,#e9edf3);cursor:pointer;flex:0 0 auto;transition:background .15s;padding:0}
.pd-switch:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.2);transition:left .15s}
.pd-switch.on{background:var(--dsw-alias-brand-primary,#2F6FED);border-color:var(--dsw-alias-brand-primary,#2F6FED)}
.pd-switch.on:after{left:18px}
.pd-bundle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.pd-bundle-grid .pd-bundle{flex-direction:column}
.pd-bundle-grid .pd-bundle-actions{justify-content:flex-start}
.pd-danger{color:var(--dsw-alias-state-error-primary,#B42318)}
.pd-btn.danger{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#B42318) 45%,transparent);color:var(--dsw-alias-state-error-primary,#B42318)}
.pd-modal-mask{position:fixed;inset:0;background:rgba(16,24,40,.45);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px}
.pd-modal{width:540px;max-width:100%;max-height:86vh;overflow:auto;background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-primary,#101828);border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:12px;box-shadow:0 20px 60px rgba(16,24,40,.28);padding:16px 18px;box-sizing:border-box}
.pd-modal h2{margin:0;font-size:15px;font-weight:600}
.pd-modal p.desc{margin:6px 0 0;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary,#667085)}
.pd-field{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:12.5px}
.pd-field > span{flex:0 0 130px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-field input[type=range]{flex:1 1 auto}
.pd-field input[type=number],.pd-field input[type=text]{flex:1 1 auto;min-width:0;border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-radius:7px;padding:5px 8px;font:inherit;font-size:12.5px;background:var(--dsw-alias-bg-base,#fff);color:inherit}
.pd-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.pd-aui{position:fixed;right:20px;bottom:88px;width:380px;max-width:calc(100vw - 40px);pointer-events:auto;z-index:70;background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-primary,#101828);border:1px solid var(--dsw-alias-border-l1,#e4e8f0);border-left:4px solid var(--dsw-alias-brand-primary,#2F6FED);border-radius:12px;box-shadow:0 14px 40px rgba(16,24,40,.22);padding:12px 14px;font-size:12.5px;line-height:1.6;animation:pd-pop .2s ease-out}
.pd-aui-head{display:flex;align-items:flex-start;gap:8px}
.pd-aui-title{font-weight:600;font-size:12.5px;flex:1 1 auto}
.pd-aui-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#667085);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}
.pd-aui-plugin{margin-top:8px;display:flex;flex-direction:column;gap:2px}
.pd-aui-plugin b{font-size:13px}
.pd-aui-plugin span{font-size:11px;color:var(--dsw-alias-label-secondary,#667085)}
.pd-aui-desc{margin-top:4px;color:var(--dsw-alias-label-secondary,#667085);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pd-aui-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.pd-aui-foot{margin-top:8px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#667085);opacity:.85}
.pd-aui-status{margin-top:6px;font-size:11.5px}
.pd-aui-status.ok{color:var(--dsw-alias-state-success-primary,#12B76A)}
.pd-aui-status.err{color:var(--dsw-alias-state-error-primary,#B42318)}
`;

    const CATEGORY_ZH = new Map();

    /**
     * Resolve the slot translator, falling back to the bundled dictionaries.
     * @param {any} props slot props
     * @returns {(key: string, vars?: Record<string, unknown>) => string} translator
     */
    function createTranslator(props) {
      if (typeof props?.t === 'function') return props.t;
      return (key, vars) => {
        const template = zh[key] ?? en[key] ?? key;
        if (!vars) return template;
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
      };
    }


    /**
     * Format an ISO timestamp as compact relative time.
     * @param {string | null} iso timestamp
     * @param {(key: string, vars?: Record<string, unknown>) => string} t translator
     * @returns {string} display text
     */
    function relativeTime(iso, t) {
      if (typeof iso !== 'string' || iso.length === 0) return t('usage.neverUsed');
      const diff = Math.max(0, Date.now() - Date.parse(iso));
      const minutes = Math.round(diff / 60000);
      if (minutes < 1) return t('time.justNow');
      if (minutes < 60) return t('time.minutesAgo', { count: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24) return t('time.hoursAgo', { count: hours });
      return t('time.daysAgo', { count: Math.round(hours / 24) });
    }

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
        install: row[10] ?? '',
        via: row[11] ?? '',
        url: `https://github.com/${row[1]}`,
      }));
    }

    /**
     * The 插件发现 panel page.
     * @param {{ t?: (key: string, vars?: Record<string, unknown>) => string }} props slot props
     * @returns {any} page element
     */
    function DiscoveryPage(props) {
      const t = createTranslator(props);

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
      const [view, setView] = React.useState('discover');
      const [showAui, setShowAui] = React.useState(false);
      const [installing, setInstalling] = React.useState(() => new Set());
      const [installedFull, setInstalledFull] = React.useState(() => new Set());
      const [installedBundles, setInstalledBundles] = React.useState([]);
      const [toast, setToast] = React.useState(null);
      const alive = React.useRef(true);
      const toastTimer = React.useRef(null);
      const openPlugins = typeof props.openPlugins === 'function' ? props.openPlugins : null;

      const showToast = React.useCallback((next, autoCloseMs) => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current);
        setToast(next);
        if (autoCloseMs) toastTimer.current = setTimeout(() => setToast(null), autoCloseMs);
      }, []);

      React.useEffect(() => () => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      }, []);

      // Mark plugins that are already installed in this profile.
      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const response = await fetch('/api/plugin-discovery/installed', { headers: { accept: 'application/json' }, cache: 'no-store' });
            if (!response.ok) return;
            const body = await response.json();
            if (!cancelled && Array.isArray(body.bundles)) setInstalledBundles(body.bundles);
          } catch {
            /* the badge is best-effort */
          }
        })();
        return () => { cancelled = true; };
      }, []);

      /**
       * Whether one catalog row is already installed in this profile.
       * @param {any} row normalized catalog row
       * @returns {boolean} installed
       */
      const isInstalledRow = React.useCallback((row) => {
        if (installedFull.has(row.full)) return true;
        const spec = String(row.install ?? '').toLowerCase();
        if (spec.length > 0) {
          const base = spec.replace(/^(@[^/]+)\/([^@]+)@.*$/, '$1/$2').replace(/^([^@/]+)@.*$/, '$1');
          if (installedBundles.some((bundle) => String(bundle.name ?? '').toLowerCase() === base)) return true;
        }
        const needle = String(row.full ?? '').toLowerCase();
        return installedBundles.some((bundle) =>
          String(bundle.aliasFor ?? '').toLowerCase() === needle ||
          String(bundle.source ?? '').toLowerCase().includes(needle));
      }, [installedFull, installedBundles]);

      /**
       * Poll one Host install job until it settles.
       * @param {string} jobId job id
       * @returns {Promise<any>} final result, or null on timeout
       */
      const pollJob = React.useCallback(async (jobId) => {
        const deadline = Date.now() + 5 * 60 * 1000;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const status = await fetch(`/api/plugin-discovery/install/status?id=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
          const statusBody = await status.json().catch(() => ({}));
          if (!status.ok) throw new Error(statusBody.error ?? `HTTP ${status.status}`);
          if (statusBody.status === 'done') return statusBody.result ?? null;
        }
        return null;
      }, []);

      /**
       * Install one catalog plugin through the Host plugin manager.
       * @param {any} row catalog row
       * @returns {Promise<void>} completion
       */
      const installPlugin = React.useCallback(async (row) => {
        if (installing.has(row.full)) return;
        setInstalling((prev) => new Set(prev).add(row.full));
        showToast({ kind: 'progress', full: row.full, name: row.name, url: row.url });
        try {
          const started = await fetch('/api/plugin-discovery/install', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ full: row.full }),
          });
          const startBody = await started.json().catch(() => ({}));
          if (!started.ok || typeof startBody.jobId !== 'string') throw new Error(startBody.error ?? `HTTP ${started.status}`);
          const result = await pollJob(startBody.jobId);
          if (result === null) throw new Error('安装超时，请稍后在「插件」页查看结果');
          if (result.ok) {
            setInstalledFull((prev) => new Set(prev).add(row.full));
            try {
              const refreshed = await fetch('/api/plugin-discovery/installed', { cache: 'no-store' });
              const refreshedBody = await refreshed.json();
              if (Array.isArray(refreshedBody.bundles)) setInstalledBundles(refreshedBody.bundles);
            } catch {
              /* badge refresh is best-effort */
            }
            showToast({ kind: 'success', full: row.full, name: row.name, url: row.url, result });
          } else {
            showToast({ kind: 'error', full: row.full, name: row.name, url: row.url, result });
          }
        } catch (cause) {
          showToast({ kind: 'error', full: row.full, name: row.name, url: row.url, result: { ok: false, error: cause instanceof Error ? cause.message : String(cause) } });
        } finally {
          setInstalling((prev) => {
            const next = new Set(prev);
            next.delete(row.full);
            return next;
          });
        }
      }, [installing, showToast, pollJob]);

      /**
       * Retry a failed install with the approval the failed attempt needs
       * (allow git prepare scripts in pnpm settings, approve pending build
       * scripts, or switch to the project's npm package).
       * @param {string} full owner/repo
       * @param {string} name display name
       * @param {string} url GitHub url
       * @returns {Promise<void>} completion
       */
      const approveInstall = React.useCallback(async (full, name, url) => {
        if (installing.size > 0) return;
        setInstalling((prev) => new Set(prev).add(full));
        setToast({ kind: 'progress', full, name, url, retrying: true });
        try {
          const started = await fetch('/api/plugin-discovery/install/approve', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ full }),
          });
          const startBody = await started.json().catch(() => ({}));
          if (!started.ok || typeof startBody.jobId !== 'string') throw new Error(startBody.error ?? `HTTP ${started.status}`);
          const result = await pollJob(startBody.jobId);
          if (result === null) throw new Error('安装超时，请稍后在「插件」页查看结果');
          if (result.ok) {
            setInstalledFull((prev) => new Set(prev).add(full));
            try {
              const refreshed = await fetch('/api/plugin-discovery/installed', { cache: 'no-store' });
              const refreshedBody = await refreshed.json();
              if (Array.isArray(refreshedBody.bundles)) setInstalledBundles(refreshedBody.bundles);
            } catch {
              /* badge refresh is best-effort */
            }
            showToast({ kind: 'success', full, name, url, result });
          } else {
            showToast({ kind: 'error', full, name, url, result });
          }
        } catch (cause) {
          showToast({ kind: 'error', full, name, url, result: { ok: false, error: cause instanceof Error ? cause.message : String(cause) } });
        } finally {
          setInstalling((prev) => {
            const next = new Set(prev);
            next.delete(full);
            return next;
          });
        }
      }, [installing, showToast, pollJob]);

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

      const tabs = h(
        'div',
        { className: 'pd-tabs' },
        h('button', { key: 'discover', className: view === 'discover' ? 'pd-tab on' : 'pd-tab', onClick: () => setView('discover') }, t('tab.discover')),
        h('button', { key: 'manage', className: view === 'manage' ? 'pd-tab on' : 'pd-tab', onClick: () => setView('manage') }, t('tab.manage')),
        h('button', { key: 'aui', className: 'pd-tab gear', title: t('aui.title'), onClick: () => setShowAui(true) }, `⚙ ${t('tab.aui')}`),
      );

      const auiDialog = showAui ? h(AuiSettingsDialog, { t, onClose: () => setShowAui(false) }) : null;

      const shell = (content) =>
        h(
          'div',
          { className: 'pd-root' },
          h('div', { className: 'pd-scroll' }, h('div', { className: 'pd-inner' }, head, tabs, content)),
          auiDialog,
        );

      if (loading && rows.length === 0) {
        return shell(h('div', { className: 'pd-state' }, h('i', { className: 'pd-spin', style: { width: 18, height: 18, borderWidth: 2 } }), h('div', null, t('loading'))));
      }

      if (error && rows.length === 0) {
        return shell(
          h(
            'div',
            { className: 'pd-state' },
            h('b', { className: 'pd-err' }, t('error.title')),
            h('div', { className: 'pd-err' }, error),
            h('div', { style: { marginTop: 12 } }, h('button', { className: 'pd-btn', onClick: () => void refresh() }, t('error.retry'))),
          ),
        );
      }

      if (view === 'manage') {
        return shell(h(ManagementView, { t }));
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
        (stats.installable ?? 0) > 0
          ? h('p', { className: 'pd-note', style: { margin: '4px 0 0' } }, t('summary.installable', { count: (stats.installable ?? 0).toLocaleString('zh-CN') }))
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

      const chooseCategory = (value) => {
        setCategory(value);
      };
      const chips = [
        h(
          'button',
          { key: 'all', className: `pd-chip${category === 'all' ? ' on' : ''}`, onClick: () => chooseCategory('all') },
          t('filter.all'),
          h('small', null, total.toLocaleString('zh-CN')),
        ),
        ...headCategories.map((item) =>
          h(
            'button',
            { key: item.key, className: `pd-chip${category === item.key ? ' on' : ''}`, onClick: () => chooseCategory(item.key), title: item.en },
            item.zh,
            h('small', null, item.count.toLocaleString('zh-CN')),
          ),
        ),
        otherCount > 0
          ? h(
              'button',
              { key: 'other', className: `pd-chip${category === 'other' ? ' on' : ''}`, onClick: () => chooseCategory('other'), title: categories.slice(HEAD_CHIPS).map((item) => item.zh).join(' / ') },
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
            h('col', { style: { width: 158 } }),
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
              h('th', null, t('table.actions')),
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
                        'div',
                        { className: 'pd-rowactions' },
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
                        isInstalledRow(row)
                          ? h('span', { className: 'pd-installed' }, `✓ ${t('action.installed')}`)
                          : h(
                              'button',
                              {
                                className: 'pd-install',
                                disabled: installing.has(row.full) || installing.size > 0,
                                title: row.install ? `${t('action.install')} · ${row.via === 'npm' ? t('action.installSource.npm') : t('action.installSource.git')}` : t('action.install'),
                                onClick: (event) => {
                                  event.stopPropagation();
                                  void installPlugin(row);
                                },
                              },
                              installing.has(row.full) ? t('action.installing') : t('action.install'),
                            ),
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

      /**
       * Build the install status card shown above the table.
       * @returns {any} status card element or null
       */
      const renderInstallStatus = () => {
        if (toast === null) return null;
        const result = toast.result ?? null;
        const isProgress = toast.kind === 'progress';
        const isSuccess = toast.kind === 'success';
        const title = isProgress
          ? t(toast.retrying ? 'toast.retryingTitle' : 'toast.progress.title', { name: toast.name })
          : isSuccess
            ? t('toast.success.title', { name: result?.title || toast.name })
            : t('toast.error.title', { name: toast.name });
        const body = isProgress
          ? t('toast.progress.body')
          : isSuccess
            ? result?.description || ''
            : (result?.error || '');
        const guidance = [];
        if (isSuccess && result) {
          if (Array.isArray(result.hints) && result.hints.length > 0) guidance.push({ label: t('toast.where'), items: result.hints });
          guidance.push({ label: '', items: [result.applied ? t('toast.applied') : t('toast.restart')] });
        } else if (!isProgress) {
          if (result?.problem === 'already-installed') guidance.push({ label: '', items: [t('toast.already')] });
          else if (result?.problem === 'not-bundle') guidance.push({ label: '', items: [t('toast.notBundle')] });
          else if (result?.reason === 'unknown' && result?.via === 'git') guidance.push({ label: '', items: [t('toast.gitOnly')] });
          if (result?.npmAlternative?.spec) guidance.push({ label: '', items: [t('toast.npmNote', { spec: result.npmAlternative.spec })] });
          else if (result?.buildKey) guidance.push({ label: '', items: [t('toast.approveNote')] });
          if (Array.isArray(result?.pendingBuilds) && result.pendingBuilds.length > 0) {
            guidance.push({ label: '', items: [t('toast.pending', { list: result.pendingBuilds.join(', ') })] });
          }
        }
        const actions = [];
        if (!isProgress && toast.result && toast.full) {
          if (toast.result.npmAlternative?.spec) {
            actions.push(h('button', {
              key: 'npm',
              className: 'pd-status-link primary',
              disabled: installing.size > 0,
              onClick: () => void approveInstall(toast.full, toast.name, toast.url),
            }, t('toast.useNpm', { spec: toast.result.npmAlternative.spec })));
          } else if (toast.result.buildKey || (Array.isArray(toast.result.pendingBuilds) && toast.result.pendingBuilds.length > 0)) {
            actions.push(h('button', {
              key: 'approve',
              className: 'pd-status-link primary',
              disabled: installing.size > 0,
              onClick: () => void approveInstall(toast.full, toast.name, toast.url),
            }, t('toast.approveRetry')));
          }
        }
        if (toast.url) actions.push(h('a', { key: 'gh', className: 'pd-status-link', href: toast.url, target: '_blank', rel: 'noopener noreferrer' }, `${t('toast.openGithub')} ↗`));
        if (isSuccess && openPlugins !== null) actions.push(h('button', { key: 'plugins', className: 'pd-status-link', onClick: () => openPlugins() }, t('toast.openPlugins')));
        actions.push(h('button', { key: 'close', className: 'pd-status-link', onClick: () => setToast(null) }, t('toast.close')));
        return h(
          'div',
          { className: `pd-status ${isProgress ? 'progress' : isSuccess ? 'success' : 'error'}`, role: 'status', 'aria-live': 'polite' },
          h(
            'div',
            { className: 'pd-toast-head' },
            isProgress ? h('i', { className: 'pd-spin', style: { marginTop: 3 } }) : null,
            h('div', { className: 'pd-status-title' }, title),
            h('button', { className: 'pd-status-close', onClick: () => setToast(null), 'aria-label': t('toast.close') }, '×'),
          ),
          body ? h('div', { className: 'pd-status-body' }, body) : null,
          !isProgress && result?.detail ? h('div', { className: 'pd-status-detail' }, String(result.detail).slice(0, 260)) : null,
          isSuccess && result?.version
            ? h('div', { className: 'pd-status-meta' }, t('toast.version', { version: result.version, via: result.via === 'npm' ? t('action.installSource.npm') : t('action.installSource.git') }))
            : null,
          guidance.map((group, index) =>
            h(
              'div',
              { className: 'pd-status-where', key: `g${index}` },
              group.label ? h('b', null, group.label) : null,
              ...group.items.map((item, itemIndex) => h('span', { key: `i${itemIndex}` }, `· ${item}`)),
            ),
          ),
          h('div', { className: 'pd-status-actions' }, ...actions),
        );
      };

      return shell(
        h(
          React.Fragment,
          null,
          syncError
            ? h('div', { className: 'pd-card', style: { borderColor: 'var(--dsw-alias-state-warn-primary,#f79009)' } }, h('span', { className: 'pd-note pd-err' }, t('stale.warning', { error: syncError })))
            : null,
          summaryCard,
          h('div', { className: 'pd-chips' }, chips),
          toolbar,
          renderInstallStatus(),
          table,
          h(
            'div',
            { className: 'pd-note' },
            h('div', null, t('footer.source'), ' · ', h('a', { href: 'https://github.com/bruc3van/awesome-dsh-plugin', target: '_blank', rel: 'noreferrer' }, 'bruc3van/awesome-dsh-plugin')),
            h('div', null, t('footer.legend')),
            h('div', null, t('footer.install')),
          ),
        ),
      );
    }

    /**
     * Read one bundle list and render it as a management page: official plugins
     * and third-party plugins installed in this profile, with switches and uninstall.
     * @param {{ t: (key: string, vars?: Record<string, unknown>) => string }} props slot props
     * @returns {any} management view
     */
    function ManagementView(props) {
      const t = createTranslator(props);
      const [bundles, setBundles] = React.useState(null);
      const [usage, setUsage] = React.useState(null);
      const [showUsage, setShowUsage] = React.useState(false);
      const [showIdle, setShowIdle] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [mode, setMode] = React.useState('list');
      const [query, setQuery] = React.useState('');
      const [busy, setBusy] = React.useState('');
      const [confirming, setConfirming] = React.useState('');
      const [notice, setNotice] = React.useState('');

      const load = React.useCallback(async () => {
        setLoading(true);
        try {
          const [response, usageResponse] = await Promise.all([
            fetch('/api/plugin-discovery/bundles', { cache: 'no-store' }),
            fetch('/api/plugin-discovery/usage', { cache: 'no-store' }),
          ]);
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
          setBundles(Array.isArray(body.bundles) ? body.bundles : []);
          if (usageResponse.ok) {
            const usageBody = await usageResponse.json().catch(() => null);
            if (usageBody !== null && typeof usageBody === 'object') setUsage(usageBody);
          }
          setError(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => {
        void load();
      }, [load]);

      const toggle = async (bundle) => {
        if (busy.length > 0) return;
        setBusy(bundle.name);
        setNotice('');
        try {
          const response = await fetch('/api/plugin-discovery/bundles/enable', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ name: bundle.name, enabled: !bundle.enabled }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${response.status}`);
          setNotice(body.restartReason ? t('manage.restart') : '');
          await load();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy('');
        }
      };

      const remove = async (name) => {
        if (busy.length > 0) return;
        setBusy(name);
        setNotice('');
        try {
          const response = await fetch('/api/plugin-discovery/bundles/remove', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ name }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${response.status}`);
          setNotice(body.restartReason ? t('manage.restart') : '');
          setConfirming('');
          await load();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy('');
        }
      };

      const list = Array.isArray(bundles) ? bundles : [];
      const matches = (bundle) => {
        const needle = query.trim().toLowerCase();
        if (needle.length === 0) return true;
        return `${bundle.title ?? ''} ${bundle.name ?? ''} ${bundle.description ?? ''} ${bundle.metaDescription ?? ''}`.toLowerCase().includes(needle);
      };
      const official = list.filter((bundle) => bundle.official === true).filter(matches);
      const thirdParty = list.filter((bundle) => bundle.official !== true && bundle.installed === true).filter(matches);

      const renderBundle = (bundle) => {
        const title = bundle.title || bundle.metaDescription || bundle.name;
        const description = bundle.metaDescription || bundle.description || '';
        return h(
          'div',
          { className: 'pd-bundle', key: bundle.name },
          h(
            'div',
            { className: 'pd-bundle-main' },
            h(
              'div',
              { className: 'pd-bundle-title' },
              h('span', null, title),
              bundle.official ? h('span', { className: 'pd-tag official' }, t('manage.badge.official')) : null,
              bundle.official !== true && bundle.installed ? h('span', { className: 'pd-tag' }, t('manage.badge.installed')) : null,
              bundle.optional ? h('span', { className: 'pd-tag' }, t('manage.badge.optional')) : null,
              !bundle.enabled ? h('span', { className: 'pd-tag warn' }, t('manage.badge.disabled')) : null,
              bundle.problem ? h('span', { className: 'pd-tag warn' }, t('manage.badge.error')) : null,
            ),
            h('div', { className: 'pd-bundle-name' }, `${bundle.name}${bundle.version ? ` @ ${bundle.version}` : ''}`),
            description ? h('div', { className: 'pd-bundle-desc' }, description) : null,
            thirdPartyUsageLine(bundle),
            Array.isArray(bundle.rows) && bundle.rows.length > 0 ? h('div', { className: 'pd-note' }, t('manage.rows', { count: bundle.rows.length })) : null,
          ),
          h(
            'div',
            { className: 'pd-bundle-actions' },
            h('button', {
              className: `pd-switch${bundle.enabled ? ' on' : ''}`,
              disabled: busy.length > 0,
              onClick: () => void toggle(bundle),
              title: bundle.enabled ? t('manage.disable') : t('manage.enable'),
              'aria-label': bundle.enabled ? t('manage.disable') : t('manage.enable'),
              'aria-pressed': bundle.enabled,
            }),
            bundle.official !== true && bundle.removable
              ? confirming === bundle.name
                ? h('button', { className: 'pd-btn danger', disabled: busy.length > 0, onClick: () => void remove(bundle.name) }, busy === bundle.name ? t('manage.removing') : t('manage.confirmRemove'))
                : h('button', { className: 'pd-btn', disabled: busy.length > 0, onClick: () => setConfirming(bundle.name) }, t('manage.remove'))
              : null,
            confirming === bundle.name ? h('button', { className: 'pd-btn', onClick: () => setConfirming('') }, t('manage.cancel')) : null,
          ),
        );
      };

      const allUsagePlugins = Array.isArray(usage?.plugins) ? usage.plugins : [];
      const usageById = new Map(allUsagePlugins.map((plugin) => [plugin.name, plugin]));
      const officialUsage = allUsagePlugins.filter((plugin) => plugin.official === true && plugin.uses > 0).sort((left, right) => right.uses - left.uses).slice(0, 6);
      const usageIdle = Array.isArray(usage?.idle) ? usage.idle : [];
      const monitoredDays = usage?.startedAt ? Math.max(1, Math.ceil((Date.now() - Date.parse(usage.startedAt)) / 86400000)) : 0;
      const idleDays = usage?.rules?.idleDays ?? 7;
      const maxIdleUses = usage?.rules?.maxUses ?? 2;

      const usageTextFor = (bundle) => {
        const record = usageById.get(bundle.name);
        if (record === undefined || record.status !== 'tools') return null;
        if (record.idle) return t('usage.idleTag');
        if (record.uses <= 0) return null;
        return `${t('usage.uses', { count: record.uses })} · ${relativeTime(record.lastUsed, t)}`;
      };
      const thirdPartyUsageLine = (bundle) => {
        const text = bundle.official !== true ? usageTextFor(bundle) : null;
        return text === null ? null : h('div', { className: 'pd-usage-inline' }, text);
      };

      const renderIdleRow = (plugin) => h(
        'div',
        { className: 'pd-idle-row', key: plugin.name },
        h(
          'div',
          { className: 'pd-idle-main' },
          h('b', null, plugin.title || plugin.name),
          h('span', { className: 'pd-muted' }, `${t('usage.uses', { count: plugin.uses })} · ${relativeTime(plugin.lastUsed, t)}`),
        ),
        plugin.removable
          ? confirming === plugin.name
            ? h('button', { className: 'pd-btn danger', disabled: busy.length > 0, onClick: () => void remove(plugin.name) }, busy === plugin.name ? t('manage.removing') : t('manage.confirmRemove'))
            : h('button', { className: 'pd-btn', disabled: busy.length > 0, onClick: () => setConfirming(plugin.name) }, t('manage.remove'))
          : null,
        confirming === plugin.name ? h('button', { className: 'pd-btn', onClick: () => setConfirming('') }, t('manage.cancel')) : null,
      );

      const idleBanner = usageIdle.length > 0
        ? h(
            'div',
            { className: 'pd-idle-banner' },
            h(
              'div',
              { className: 'pd-idle-head' },
              h('b', null, t('usage.idleBanner', { count: usageIdle.length })),
              h('span', { className: 'pd-muted' }, t('usage.idleHint')),
              h('button', { className: 'pd-btn', onClick: () => setShowIdle((value) => !value) }, showIdle ? t('usage.idleHide') : t('usage.idleShow')),
            ),
            showIdle ? h('div', { className: 'pd-idle-list' }, usageIdle.map(renderIdleRow)) : null,
          )
        : null;

      const usageDialog = showUsage
        ? h(
            'div',
            {
              className: 'pd-modal-mask',
              onClick: (event) => {
                if (event.target === event.currentTarget) setShowUsage(false);
              },
            },
            h(
              'div',
              { className: 'pd-modal pd-usage-modal', role: 'dialog', 'aria-modal': true },
              h('h2', null, t('usage.dialogTitle')),
              usage === null
                ? h('div', { className: 'pd-note' }, t('loading'))
                : h(
                    React.Fragment,
                    null,
                    h('p', { className: 'desc' }, t('usage.summary', { days: monitoredDays, records: usage.records ?? 0, plugins: allUsagePlugins.filter((plugin) => plugin.official !== true).length })),
                    officialUsage.length > 0
                      ? h('div', { className: 'pd-modal-line' }, h('b', null, t('usage.officialTitle')), h('div', { className: 'pd-note' }, officialUsage.map((plugin) => `${plugin.title} · ${t('usage.uses', { count: plugin.uses })}`).join(' · ')))
                      : null,
                    usageIdle.length > 0
                      ? h('div', { className: 'pd-modal-line' }, h('b', null, t('usage.idleTitle')), h('div', { className: 'pd-usage-list' }, usageIdle.map(renderIdleRow)))
                      : null,
                    h('p', { className: 'pd-note' }, t('usage.rule', { days: idleDays, maxUses: maxIdleUses })),
                    h(
                      'div',
                      { className: 'pd-usage-activity' },
                      h('b', null, t('usage.recent')),
                      Array.isArray(usage.recent) && usage.recent.length > 0
                        ? h('ul', null, usage.recent.slice(0, 12).map((record, index) => h('li', { key: `${record.at}-${index}` }, `${String(record.at ?? '').slice(11, 19)} · ${record.kind} · ${record.name}`)))
                        : h('div', { className: 'pd-note' }, t('usage.noActivity')),
                    ),
                    h('p', { className: 'pd-note' }, t('usage.note')),
                  ),
              h('div', { className: 'pd-modal-actions' }, h('button', { className: 'pd-btn primary', onClick: () => setShowUsage(false) }, t('aui.close'))),
            ),
          )
        : null;
      return h(
        'div',
        { className: 'pd-manage' },
        h(
          'div',
          { className: 'pd-manage-head' },
          h(
            'label',
            { className: 'pd-search' },
            h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true }, h('circle', { cx: 11, cy: 11, r: 6.5 }), h('path', { d: 'm16 16 4.2 4.2' })),
            h('input', { type: 'search', value: query, placeholder: t('manage.search'), onChange: (event) => setQuery(event.target.value) }),
          ),
          h(
            'div',
            { className: 'pd-seg' },
            h('button', { className: mode === 'list' ? 'on' : '', onClick: () => setMode('list') }, t('manage.list')),
            h('button', { className: mode === 'grid' ? 'on' : '', onClick: () => setMode('grid') }, t('manage.grid')),
          ),
          h('button', { className: 'pd-linkbtn', onClick: () => setShowUsage(true) }, t('usage.open')),
          h('button', { className: 'pd-btn', onClick: () => void load(), disabled: loading }, t('manage.refresh')),
        ),
        notice ? h('div', { className: 'pd-note', style: { color: 'var(--dsw-alias-state-success-primary,#12B76A)' } }, notice) : null,
        error ? h('div', { className: 'pd-card pd-err', style: { marginTop: 10 } }, t('manage.error', { error })) : null,
        loading && bundles === null ? h('div', { className: 'pd-state' }, h('i', { className: 'pd-spin' }), ' ', t('manage.loading')) : null,
        h(
          'section',
          { className: 'pd-manage-section' },
          h('h3', null, t('manage.official'), h('span', { className: 'pd-muted' }, official.length)),
          h('p', { className: 'hint' }, t('manage.officialHint')),
          official.length === 0
            ? h('div', { className: 'pd-note' }, t('manage.empty'))
            : h('div', { className: mode === 'grid' ? 'pd-bundle-grid' : 'pd-bundle-list' }, official.map(renderBundle)),
        ),
        h(
          'section',
          { className: 'pd-manage-section' },
          h('h3', null, t('manage.installed'), h('span', { className: 'pd-muted' }, thirdParty.length)),
          idleBanner,
          h('p', { className: 'hint' }, t('manage.installedHint')),
          thirdParty.length === 0
            ? h('div', { className: 'pd-note' }, t('manage.empty'))
            : h('div', { className: mode === 'grid' ? 'pd-bundle-grid' : 'pd-bundle-list' }, thirdParty.map(renderBundle)),
        ),
        h('p', { className: 'pd-note', style: { marginTop: 12 } }, t('manage.uninstallHint')),
        usageDialog,
      );
    }

    /**
     * AUI settings dialog: switch, sensitivity, cooldown and a preview button.
     * @param {{ t: (key: string, vars?: Record<string, unknown>) => string, onClose: () => void }} props dialog props
     * @returns {any} dialog
     */
    function AuiSettingsDialog(props) {
      const t = createTranslator(props);
      const [settings, setSettings] = React.useState(null);
      const [text, setText] = React.useState('帮我整理一下 Excel 表格数据，检查公式');
      const [saved, setSaved] = React.useState(false);

      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const response = await fetch('/api/plugin-discovery/aui', { cache: 'no-store' });
            const body = await response.json();
            if (!cancelled) setSettings(body.settings ?? { enabled: true, minConfidence: 0.6, cooldownSeconds: 240, maxPerHour: 4, maxPerSession: 2 });
          } catch {
            if (!cancelled) setSettings({ enabled: true, minConfidence: 0.6, cooldownSeconds: 240, maxPerHour: 4, maxPerSession: 2 });
          }
        })();
        return () => {
          cancelled = true;
        };
      }, []);

      const save = async (patch) => {
        try {
          const response = await fetch('/api/plugin-discovery/aui', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(patch),
          });
          const body = await response.json();
          if (response.ok && body.settings) {
            setSettings(body.settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }
        } catch {
          /* the dialog keeps its local value */
        }
      };

      const test = async () => {
        try {
          await fetch('/api/plugin-discovery/aui/test', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ text }),
          });
        } catch {
          /* preview is best-effort */
        }
      };

      return h(
        'div',
        {
          className: 'pd-modal-mask',
          onClick: (event) => {
            if (event.target === event.currentTarget) props.onClose();
          },
        },
        h(
          'div',
          { className: 'pd-modal', role: 'dialog', 'aria-modal': true },
          h('h2', null, t('aui.title')),
          h('p', { className: 'desc' }, t('aui.desc')),
          settings === null
            ? h('div', { className: 'pd-note' }, t('loading'))
            : h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.enabled')),
                  h('button', {
                    className: `pd-switch${settings.enabled ? ' on' : ''}`,
                    onClick: () => void save({ enabled: !settings.enabled }),
                    'aria-label': t('aui.enabled'),
                    'aria-pressed': settings.enabled,
                  }),
                ),
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.minConfidence')),
                  h('input', {
                    type: 'range',
                    min: 0.3,
                    max: 0.95,
                    step: 0.05,
                    value: settings.minConfidence ?? 0.6,
                    onChange: (event) => setSettings({ ...settings, minConfidence: Number(event.target.value) }),
                    onMouseUp: () => void save({ minConfidence: settings.minConfidence }),
                    onTouchEnd: () => void save({ minConfidence: settings.minConfidence }),
                  }),
                  h('span', { className: 'pd-muted' }, `${Math.round((settings.minConfidence ?? 0.6) * 100)}%`),
                ),
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.cooldown')),
                  h('input', {
                    type: 'number',
                    min: 0,
                    max: 900,
                    value: settings.cooldownSeconds,
                    onChange: (event) => setSettings({ ...settings, cooldownSeconds: Number(event.target.value) }),
                    onBlur: () => void save({ cooldownSeconds: settings.cooldownSeconds }),
                  }),
                ),
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.maxPerHour')),
                  h('input', {
                    type: 'number',
                    min: 1,
                    max: 20,
                    value: settings.maxPerHour ?? 4,
                    onChange: (event) => setSettings({ ...settings, maxPerHour: Number(event.target.value) }),
                    onBlur: () => void save({ maxPerHour: settings.maxPerHour }),
                  }),
                ),
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.maxPerSession')),
                  h('input', {
                    type: 'number',
                    min: 1,
                    max: 10,
                    value: settings.maxPerSession ?? 2,
                    onChange: (event) => setSettings({ ...settings, maxPerSession: Number(event.target.value) }),
                    onBlur: () => void save({ maxPerSession: settings.maxPerSession }),
                  }),
                ),
                h('div', { className: 'pd-note' }, t('aui.quietHint')),
                h('p', { className: 'desc' }, t('aui.notice')),
                h(
                  'div',
                  { className: 'pd-field' },
                  h('span', null, t('aui.test')),
                  h('input', { type: 'text', value: text, placeholder: t('aui.testPlaceholder'), onChange: (event) => setText(event.target.value) }),
                ),
                h('div', { className: 'pd-note' }, t('aui.testHint')),
              ),
          h(
            'div',
            { className: 'pd-modal-actions' },
            saved ? h('span', { className: 'pd-note' }, t('aui.saved')) : null,
            h('button', { className: 'pd-btn', onClick: () => void test() }, t('aui.test')),
            h('button', { className: 'pd-btn primary', onClick: () => props.onClose() }, t('aui.close')),
          ),
        ),
      );
    }

    /**
     * Frame-wide AUI card: shows the plugin suggested from the last user message.
     * Polls the Host for a pending suggestion; never installs without a click.
     * @param {{ t?: Function }} props slot props
     * @returns {any} floating card or null
     */
    function AuiOverlay(props) {
      const t = createTranslator(props);
      const [suggestion, setSuggestion] = React.useState(null);
      const [status, setStatus] = React.useState({ kind: '', message: '' });
      const [busy, setBusy] = React.useState(false);
      const lastId = React.useRef('');

      React.useEffect(() => {
        let alive = true;
        let timer = null;
        const poll = async () => {
          try {
            const response = await fetch(`/api/plugin-discovery/aui/suggestion?after=${encodeURIComponent(lastId.current)}`, { cache: 'no-store' });
            if (response.ok) {
              const body = await response.json();
              if (alive && body.suggestion && body.suggestion.id !== lastId.current) {
                lastId.current = body.suggestion.id;
                setSuggestion(body.suggestion);
                setStatus({ kind: '', message: '' });
              }
            }
          } catch {
            /* polling must stay quiet */
          }
          if (alive) timer = setTimeout(poll, 1000);
        };
        void poll();
        return () => {
          alive = false;
          if (timer !== null) clearTimeout(timer);
        };
      }, []);

      const dismiss = async (patch) => {
        setSuggestion(null);
        try {
          await fetch('/api/plugin-discovery/aui/dismiss', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ id: lastId.current, ...patch }),
          });
        } catch {
          /* dismiss is best-effort */
        }
      };

      const install = async () => {
        if (suggestion === null || busy) return;
        setBusy(true);
        setStatus({ kind: 'info', message: t('aui.card.installing') });
        try {
          const started = await fetch('/api/plugin-discovery/install', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ full: suggestion.plugin.full }),
          });
          const startBody = await started.json().catch(() => ({}));
          if (!started.ok || typeof startBody.jobId !== 'string') throw new Error(startBody.error ?? `HTTP ${started.status}`);
          const deadline = Date.now() + 5 * 60 * 1000;
          let result = null;
          while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const state = await fetch(`/api/plugin-discovery/install/status?id=${encodeURIComponent(startBody.jobId)}`, { cache: 'no-store' });
            const body = await state.json().catch(() => ({}));
            if (!state.ok) throw new Error(body.error ?? `HTTP ${state.status}`);
            if (body.status === 'done') {
              result = body.result;
              break;
            }
          }
          if (result?.ok) setStatus({ kind: 'ok', message: t('aui.card.installed') });
          else setStatus({ kind: 'err', message: t('aui.card.failed', { error: result?.error ?? 'timeout' }) });
        } catch (cause) {
          setStatus({ kind: 'err', message: t('aui.card.failed', { error: cause instanceof Error ? cause.message : String(cause) }) });
        } finally {
          setBusy(false);
        }
      };

      if (suggestion === null) return null;
      const plugin = suggestion.plugin;
      return h(
        'div',
        { className: 'pd-aui', role: 'status', 'aria-live': 'polite' },
        h(
          'div',
          { className: 'pd-aui-head' },
          h('div', { className: 'pd-aui-title' }, t('aui.card.title')),
          h('button', { className: 'pd-aui-close', onClick: () => void dismiss({}), 'aria-label': t('toast.close') }, '×'),
        ),
        h('div', { className: 'pd-aui-plugin' }, h('b', null, plugin.name), h('span', null, `★ ${plugin.stars} · ${plugin.categoryZh || plugin.category || ''}${typeof suggestion.confidence === 'number' ? ` · ${Math.round(suggestion.confidence * 100)}%` : ''}`)),
        h('div', { className: 'pd-aui-desc' }, plugin.zh || plugin.en || ''),
        typeof suggestion.reason === 'string' && suggestion.reason.length > 0
          ? h('div', { className: 'pd-note' }, suggestion.reason)
          : Array.isArray(suggestion.reason) && suggestion.reason.length > 0
            ? h('div', { className: 'pd-note' }, t('aui.card.reason', { terms: suggestion.reason.join('、') }))
            : null,
        status.message.length > 0 ? h('div', { className: `pd-aui-status ${status.kind}` }, status.message) : null,
        h(
          'div',
          { className: 'pd-aui-actions' },
          h('button', { className: 'pd-btn primary', disabled: busy, onClick: () => void install() }, busy ? t('aui.card.installing') : t('aui.card.install')),
          h('button', { className: 'pd-btn', onClick: () => void dismiss({}) }, t('aui.card.ignore')),
          h('button', { className: 'pd-btn', onClick: () => void dismiss({ mutePlugin: true }) }, t('aui.card.mute')),
        ),
        h('div', { className: 'pd-aui-foot' }, t('aui.card.footer')),
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
        inject: () => ({
          openPlugins: () => {
            try {
              ctx.layout.selectPanel('plugins');
            } catch (error) {
              console.error('plugin-discovery: cannot open the plugins panel', error);
            }
          },
        }),
      }, DiscoveryPage)), 'plugin-discovery: main panel');
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'plugin-discovery-aui',
        order: 50,
        locale: NS,
      }, AuiOverlay)), 'plugin-discovery: AUI overlay');
    }

    return { inject: ['slots', 'locale', 'layout'], apply, DiscoveryPage, DiscoveryIcon, ManagementView, AuiOverlay, AuiSettingsDialog };
  },
});
