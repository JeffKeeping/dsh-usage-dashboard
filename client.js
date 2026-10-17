/**
 * dsh-usage-dashboard — Client half.
 *
 * Registers two surfaces against the live Slot table:
 *   - `sidebar.panellist` (list, id = PANEL_KEY): the sidebar icon and label.
 *   - `main` (keyed, key = PANEL_KEY): the board itself, rendered as the
 *     central panel when that sidebar entry is selected.
 *
 * All numbers come from the Host route `/dsh-usage-dashboard/snapshot`; this
 * module never reads a session log and never touches another plugin's DOM.
 * Chart colours are the DeepSeek blue ramp sampled from the requested
 * reference (#dff2fe → #a0dcfd → #60b3fe → #0c70f3); everything structural
 * still uses host theme tokens.
 */
window.__ModuleLoader__.load({
  id: 'dsh-usage-dashboard',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useCallback, useRef } = React

    const PANEL_KEY = 'dsh-usage-dashboard'
    const ROUTE = '/dsh-usage-dashboard/snapshot'
    const POLL_MS = 60_000
    const RANGES = [7, 30, 90, 182]

    // ------------------------------------------------------------ dictionary

    const ZH = {
      'panel.title': '用量看板',
      'action.refresh': '刷新',
      'action.refreshing': '刷新中…',
      'action.retry': '重试',
      'state.loading': '正在统计会话日志…',
      'state.loadingHint': '首次打开需要扫描全部会话，稍等一下就好。',
      'state.error': '读取失败',
      'state.errorHint': 'Host 路由没有返回数据，可稍后重试。',
      'state.empty': '还没有可统计的用量',
      'state.emptyHint': '发起一次对话后，这里会出现真实数据。',
      'meta.updated': '更新于 {time}',
      'meta.scanned': '{sessions} 个会话 / {readings} 次调用',
      'meta.truncated': ' · 只统计最近 {max} 个会话',
      'readout.tokens': 'Token 总量',
      'readout.tokensSub': '{calls} 次调用 · 命中率 {rate}',
      'readout.today': '今日费用',
      'readout.todaySub': '{tokens} tokens',
      'readout.month': '本月费用',
      'readout.monthSub': '{calls} 次调用',
      'readout.allTime': '历史累计',
      'readout.allTimeSub': '{tokens} tokens',
      'readout.balance': 'API 余额',
      'readout.balanceSub': 'DeepSeek 账户',
      'panel.composition': 'Token 构成',
      'panel.compositionHint': '全部历史',
      'panel.models': '模型占比',
      'panel.modelsHint': '按总 Token',
      'panel.trend': '使用趋势',
      'panel.trendHint': '每日 Token',
      'token.input': '输入',
      'token.inputLong': '输入（未命中缓存）',
      'token.output': '输出',
      'token.cacheRead': '缓存命中',
      'token.cacheWrite': '缓存写入',
      'token.total': '总计',
      'token.cost': '费用',
      'token.calls': '调用',
      'balance.signedOut': '未登录',
      'balance.signedOutHint': '在 设置 → 账户 登录后读取余额',
      'balance.unavailable': '未启用',
      'balance.unavailableHint': '当前配置没有挂载账户服务',
      'balance.failed': '读取失败',
      'balance.failedHint': '稍后刷新重试',
      'balance.bonus': '赠送',
      'range.7': '7 天',
      'range.30': '30 天',
      'range.90': '90 天',
      'range.182': '半年',
      'chart.hint': '悬停查看当天明细 · ← → 可逐日移动',
      'chart.none': '窗口内暂无数据',
      'chart.peak': '峰值 {value}',
      'heatmap.title': '近半年活跃度',
      'heatmap.hint': '每格一天，颜色越深用量越大',
      'heatmap.less': '少',
      'heatmap.more': '多',
      'pricing.line': '估算口径：{currency} / {unit} tokens · 价格表可在插件配置里修改',
    }

    const EN = {
      'panel.title': 'Usage Board',
      'action.refresh': 'Refresh',
      'action.refreshing': 'Refreshing…',
      'action.retry': 'Retry',
      'state.loading': 'Reading session logs…',
      'state.loadingHint': 'The first open scans every session, so this can take a moment.',
      'state.error': 'Could not load',
      'state.errorHint': 'The Host route returned no data. Try again shortly.',
      'state.empty': 'No usage recorded yet',
      'state.emptyHint': 'Real numbers appear after the first conversation turn.',
      'meta.updated': 'Updated {time}',
      'meta.scanned': '{sessions} sessions / {readings} calls',
      'meta.truncated': ' · newest {max} sessions only',
      'readout.tokens': 'Total tokens',
      'readout.tokensSub': '{calls} calls · {rate} cache hit',
      'readout.today': 'Today',
      'readout.todaySub': '{tokens} tokens',
      'readout.month': 'This month',
      'readout.monthSub': '{calls} calls',
      'readout.allTime': 'All time',
      'readout.allTimeSub': '{tokens} tokens',
      'readout.balance': 'API balance',
      'readout.balanceSub': 'DeepSeek account',
      'panel.composition': 'Token composition',
      'panel.compositionHint': 'all history',
      'panel.models': 'Model share',
      'panel.modelsHint': 'by total tokens',
      'panel.trend': 'Usage trend',
      'panel.trendHint': 'tokens per day',
      'token.input': 'Input',
      'token.inputLong': 'Input (uncached)',
      'token.output': 'Output',
      'token.cacheRead': 'Cache hit',
      'token.cacheWrite': 'Cache write',
      'token.total': 'Total',
      'token.cost': 'Cost',
      'token.calls': 'Calls',
      'balance.signedOut': 'Signed out',
      'balance.signedOutHint': 'Sign in under Settings → Account',
      'balance.unavailable': 'Unavailable',
      'balance.unavailableHint': 'No account service is mounted',
      'balance.failed': 'Read failed',
      'balance.failedHint': 'Refresh again later',
      'balance.bonus': 'bonus',
      'range.7': '7d',
      'range.30': '30d',
      'range.90': '90d',
      'range.182': '6mo',
      'chart.hint': 'Hover a day · ← → to step',
      'chart.none': 'No data in this window',
      'chart.peak': 'peak {value}',
      'heatmap.title': 'Last six months',
      'heatmap.hint': 'one cell per day, darker means more usage',
      'heatmap.less': 'less',
      'heatmap.more': 'more',
      'pricing.line': 'Estimates at {currency} / {unit} tokens · edit the price table in the plugin config',
    }

    let activeDict = ZH
    let activeTag = 'zh-CN'
    const localeListeners = new Set()

    function dictFor(locale) {
      return typeof locale === 'string' && locale.toLowerCase().startsWith('zh') ? ZH : EN
    }

    function tagFor(locale) {
      return typeof locale === 'string' && locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
    }

    function tr(key, vars) {
      const text = activeDict[key] ?? ZH[key] ?? key
      if (vars === undefined) return text
      return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])))
    }

    function useLocaleTick() {
      const [, setTick] = useState(0)
      useEffect(() => {
        const listener = () => setTick((value) => value + 1)
        localeListeners.add(listener)
        return () => {
          localeListeners.delete(listener)
        }
      }, [])
    }

    // ------------------------------------------------------------ formatting

    function numberFormat() {
      try {
        return new Intl.NumberFormat(activeTag)
      } catch {
        return new Intl.NumberFormat('en-US')
      }
    }

    function fmtInt(value) {
      const n = Number.isFinite(value) ? value : 0
      return numberFormat().format(Math.round(n))
    }

    /** Compact for readouts: 9.02 亿 / 12.4M. */
    function fmtCompact(value) {
      const n = Number.isFinite(value) ? value : 0
      const abs = Math.abs(n)
      if (activeTag === 'zh-CN') {
        if (abs >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
        if (abs >= 1e4) return `${(n / 1e4).toFixed(abs >= 1e6 ? 0 : 2)} 万`
        return fmtInt(n)
      }
      if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
      return fmtInt(n)
    }

    function currencySign(currency) {
      if (currency === 'USD') return '$'
      if (currency === 'CNY') return '¥'
      return ''
    }

    function fmtMoney(value, currency) {
      const n = Number.isFinite(value) ? value : 0
      const digits = Math.abs(n) > 0 && Math.abs(n) < 1 ? 3 : 2
      return `${currencySign(currency)}${n.toFixed(digits)}`
    }

    /** Wallet strings arrive with full provider precision; show money, not floats. */
    function fmtWallet(currency, balance) {
      const n = Number(balance)
      if (!Number.isFinite(n)) return `${currencySign(currency)}${String(balance)}`
      return `${currencySign(currency)}${n.toFixed(2)}`
    }

    function fmtPercent(ratio) {
      const n = Number.isFinite(ratio) ? ratio : 0
      return `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`
    }

    function fmtClock(ts) {
      if (!Number.isFinite(ts) || ts <= 0) return '—'
      const d = new Date(ts)
      const two = (value) => String(value).padStart(2, '0')
      return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
    }

    // ------------------------------------------------------------- primitives

    function Panel(props) {
      return h('section', { className: 'dsh-ud-panel' },
        h('header', { className: 'dsh-ud-panel-head' },
          h('h2', { className: 'dsh-ud-panel-title' }, props.title),
          props.hint === undefined ? null : h('span', { className: 'dsh-ud-panel-hint' }, props.hint),
          props.aside === undefined ? null : h('div', { className: 'dsh-ud-panel-aside' }, props.aside)),
        props.children)
    }

    function Readout(props) {
      return h('div', { className: 'dsh-ud-readout' },
        h('span', { className: 'dsh-ud-readout-label' }, props.label),
        h('span', {
          className: props.primary === true ? 'dsh-ud-readout-value dsh-ud-readout-value-lead' : 'dsh-ud-readout-value',
        }, props.value),
        h('span', { className: props.tone === undefined ? 'dsh-ud-readout-sub' : `dsh-ud-readout-sub dsh-ud-tone-${props.tone}` },
          props.sub ?? ''))
    }

    function Note(props) {
      return h('div', { className: 'dsh-ud-note' },
        h('div', { className: 'dsh-ud-note-title' }, props.title),
        props.hint === undefined ? null : h('div', { className: 'dsh-ud-note-hint' }, props.hint))
    }

    /** Stacked proportion bar: four counters, four token-driven tones. */
    function CompositionBar(props) {
      const rows = props.rows.filter((row) => row.value > 0)
      const total = rows.reduce((sum, row) => sum + row.value, 0)
      if (total <= 0) return h('div', { className: 'dsh-ud-bar is-empty' })
      return h('div', { className: 'dsh-ud-bar' },
        rows.map((row) => h('span', {
          key: row.key,
          className: 'dsh-ud-bar-seg',
          'data-tone': row.key,
          style: { flexGrow: String(Math.max(row.value / total, 0.004)), opacity: row.opacity },
          title: `${row.label} ${fmtInt(row.value)}`,
        })))
    }

    /** One shared day-detail card, driven by both the chart and the heatmap. */
    function DayTip(props) {
      const point = props.point
      if (point === null || point === undefined) return null
      const rows = [
        { key: 'input', label: tr('token.input'), value: point.input, tone: 'input' },
        { key: 'output', label: tr('token.output'), value: point.output, tone: 'output' },
        { key: 'cacheRead', label: tr('token.cacheRead'), value: point.cacheRead, tone: 'cacheRead' },
        { key: 'cacheWrite', label: tr('token.cacheWrite'), value: point.cacheWrite, tone: 'cacheWrite' },
      ].filter((row) => row.value > 0)
      return h('div', { className: 'dsh-ud-tip', style: props.style, role: 'status' },
        h('div', { className: 'dsh-ud-tip-date' }, point.d),
        h('div', { className: 'dsh-ud-tip-total' }, fmtCompact(point.tokens), h('span', null, ' tokens')),
        h('div', { className: 'dsh-ud-tip-rows' },
          rows.map((row) => h('div', { key: row.key, className: 'dsh-ud-tip-row' },
            h('span', { className: 'dsh-ud-tip-dot', 'data-tone': row.tone }),
            h('span', { className: 'dsh-ud-tip-label' }, row.label),
            h('span', { className: 'dsh-ud-tip-value' }, fmtInt(row.value))))),
        h('div', { className: 'dsh-ud-tip-foot' },
          h('span', null, `${tr('token.cost')} ${fmtMoney(point.cost, props.currency)}`),
          h('span', null, `${tr('token.calls')} ${fmtInt(point.calls)}`)))
    }

    // ----------------------------------------------------------------- bands

    function ReadoutStrip(props) {
      const data = props.data
      const currency = props.currency
      const totals = data.totals
      const raw = data.balance
      // Normalize once: an older Host shape must degrade to "signed out", never
      // to a thrown render that blanks the slot entry.
      const balance = raw === null || raw === undefined
        ? null
        : {
          available: raw.available !== false,
          signedIn: raw.signedIn === true,
          wallets: Array.isArray(raw.wallets) ? raw.wallets : [],
          bonusWallets: Array.isArray(raw.bonusWallets) ? raw.bonusWallets : [],
          error: raw.error ?? null,
        }

      let balanceValue = '—'
      let balanceSub = tr('readout.balanceSub')
      let balanceTone
      if (balance !== null) {
        if (balance.available === false) {
          balanceValue = tr('balance.unavailable')
          balanceSub = tr('balance.unavailableHint')
          balanceTone = 'muted'
        } else if (balance.signedIn === false) {
          balanceValue = tr('balance.signedOut')
          balanceSub = tr('balance.signedOutHint')
          balanceTone = 'muted'
        } else if (balance.error !== null && balance.wallets.length === 0) {
          balanceValue = tr('balance.failed')
          balanceSub = tr('balance.failedHint')
          balanceTone = 'muted'
        } else if (balance.wallets.length > 0) {
          const wallet = balance.wallets[0]
          balanceValue = fmtWallet(wallet.currency, wallet.balance)
          const extra = balance.wallets.length > 1
            ? ` · ${balance.wallets.slice(1).map((w) => fmtWallet(w.currency, w.balance)).join(' · ')}`
            : ''
          const bonus = balance.bonusWallets.length > 0
            ? ` · ${tr('balance.bonus')} ${balance.bonusWallets.map((w) => fmtWallet(w.currency, w.balance)).join(' · ')}`
            : ''
          balanceSub = `${wallet.currency}${extra}${bonus}`
        }
      }

      return h('section', { className: 'dsh-ud-strip' },
        h(Readout, {
          label: tr('readout.tokens'),
          value: fmtCompact(totals.tokens),
          primary: true,
          sub: tr('readout.tokensSub', {
            calls: fmtInt(totals.calls),
            rate: fmtPercent(totals.cacheHitRate),
          }),
        }),
        h(Readout, {
          label: tr('readout.today'),
          value: fmtMoney(data.today.cost, currency),
          sub: tr('readout.todaySub', { tokens: fmtCompact(data.today.tokens) }),
        }),
        h(Readout, {
          label: tr('readout.month'),
          value: fmtMoney(data.month.cost, currency),
          sub: tr('readout.monthSub', { calls: fmtInt(data.month.calls) }),
        }),
        h(Readout, {
          label: tr('readout.allTime'),
          value: fmtMoney(data.history.cost, currency),
          sub: tr('readout.allTimeSub', { tokens: fmtCompact(data.history.tokens) }),
        }),
        h(Readout, {
          label: tr('readout.balance'),
          value: balanceValue,
          sub: balanceSub,
          tone: balanceTone,
        }))
    }

    function CompositionPanel(props) {
      const totals = props.totals
      const rows = [
        { key: 'input', label: tr('token.inputLong'), value: totals.input, opacity: 1 },
        { key: 'output', label: tr('token.output'), value: totals.output, opacity: 1 },
        { key: 'cacheRead', label: tr('token.cacheRead'), value: totals.cacheRead, opacity: 1 },
        { key: 'cacheWrite', label: tr('token.cacheWrite'), value: totals.cacheWrite, opacity: 1 },
      ]
      const sum = totals.tokens > 0 ? totals.tokens : rows.reduce((acc, row) => acc + row.value, 0)
      return h(Panel, { title: tr('panel.composition'), hint: tr('panel.compositionHint') },
        h(CompositionBar, { rows }),
        h('dl', { className: 'dsh-ud-rows' },
          rows.map((row) => h('div', { key: row.key, className: 'dsh-ud-row' },
            h('dt', { className: 'dsh-ud-row-label' },
              h('span', { className: 'dsh-ud-dot', 'data-tone': row.key, style: { opacity: row.opacity } }),
              row.label),
            h('dd', { className: 'dsh-ud-row-value' }, fmtInt(row.value)),
            h('dd', { className: 'dsh-ud-row-share' }, sum > 0 ? fmtPercent(row.value / sum) : '—'))),
          h('div', { className: 'dsh-ud-row dsh-ud-row-total' },
            h('dt', { className: 'dsh-ud-row-label' }, tr('token.total')),
            h('dd', { className: 'dsh-ud-row-value' }, fmtInt(totals.tokens)),
            h('dd', { className: 'dsh-ud-row-share' }, '100%'))))
    }

    function ModelsPanel(props) {
      const models = props.models
      if (models.length === 0) {
        return h(Panel, { title: tr('panel.models'), hint: tr('panel.modelsHint') },
          h(Note, { title: tr('state.empty') }))
      }
      const top = models.slice(0, 6)
      return h(Panel, { title: tr('panel.models'), hint: tr('panel.modelsHint') },
        h('ul', { className: 'dsh-ud-models' },
          top.map((entry) => h('li', { key: entry.id, className: 'dsh-ud-model' },
            h('div', { className: 'dsh-ud-model-head' },
              h('span', {
                className: 'dsh-ud-model-name',
                title: Array.isArray(entry.providers) && entry.providers.length > 0
                  ? `${entry.model} · ${entry.providers.join(', ')}`
                  : entry.model,
              }, entry.model),
              h('span', { className: 'dsh-ud-model-share' }, fmtPercent(entry.share))),
            h('div', { className: 'dsh-ud-model-track' },
              h('span', {
                className: 'dsh-ud-model-fill',
                style: { width: `${Math.max(entry.share * 100, 1.5).toFixed(2)}%` },
              })),
            h('div', { className: 'dsh-ud-model-meta' },
              h('span', null, `${fmtCompact(entry.tokens)} tokens`),
              h('span', null, fmtMoney(entry.cost, props.currency)))))))
    }

    // ------------------------------------------------------- chart geometry

    /**
     * Monotone cubic interpolation (Fritsch–Carlson): a smooth line that never
     * overshoots the samples, so a day with zero usage can never render below
     * the baseline as a straight-segment path would not, but a Bezier fit can.
     */
    function monotonePath(points) {
      const n = points.length
      if (n === 0) return ''
      if (n === 1) return `M${points[0].x} ${points[0].y}`
      if (n === 2) return `M${points[0].x} ${points[0].y} L${points[1].x} ${points[1].y}`
      const dx = []
      const slope = []
      for (let i = 0; i < n - 1; i += 1) {
        dx[i] = points[i + 1].x - points[i].x
        slope[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]
      }
      const tangent = [slope[0]]
      for (let i = 1; i < n - 1; i += 1) {
        if (slope[i - 1] * slope[i] <= 0) {
          tangent[i] = 0
        } else {
          const w1 = 2 * dx[i] + dx[i - 1]
          const w2 = dx[i] + 2 * dx[i - 1]
          tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
        }
      }
      tangent[n - 1] = slope[n - 2]
      let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
      for (let i = 0; i < n - 1; i += 1) {
        const third = dx[i] / 3
        d += ` C${(points[i].x + third).toFixed(2)} ${(points[i].y + tangent[i] * third).toFixed(2)}` +
          `, ${(points[i + 1].x - third).toFixed(2)} ${(points[i + 1].y - tangent[i + 1] * third).toFixed(2)}` +
          `, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`
      }
      return d
    }

    /** Track the element's real pixel width so the SVG never scales its text. */
    function useMeasuredWidth(fallback) {
      const ref = useRef(null)
      const [width, setWidth] = useState(fallback)
      useEffect(() => {
        const element = ref.current
        if (element === null) return undefined
        const measure = () => {
          const next = element.clientWidth
          if (next > 0) setWidth((current) => (Math.abs(current - next) < 0.5 ? current : next))
        }
        measure()
        if (typeof ResizeObserver === 'undefined') {
          window.addEventListener('resize', measure)
          return () => window.removeEventListener('resize', measure)
        }
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [])
      return [ref, width]
    }

    const CHART_HEIGHT = 208
    const PAD = { top: 14, right: 8, bottom: 20, left: 8 }

    function TrendChart(props) {
      const series = props.series
      const [wrapRef, width] = useMeasuredWidth(760)
      const [hover, setHover] = useState(null)
      const n = series.length
      const innerW = Math.max(width - PAD.left - PAD.right, 10)
      const innerH = CHART_HEIGHT - PAD.top - PAD.bottom
      const max = Math.max(1, ...series.map((point) => point.tokens))

      const xAt = (index) => PAD.left + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW)
      const yAt = (value) => PAD.top + innerH - (Math.max(value, 0) / max) * innerH

      const points = series.map((point, index) => ({ x: xAt(index), y: yAt(point.tokens) }))
      const line = monotonePath(points)
      const area = points.length === 0
        ? ''
        : `${line} L${points[points.length - 1].x.toFixed(2)} ${PAD.top + innerH} L${points[0].x.toFixed(2)} ${PAD.top + innerH} Z`

      const pick = (clientX) => {
        const element = wrapRef.current
        if (element === null || n === 0) return null
        const rect = element.getBoundingClientRect()
        // Measure against the plot's rendered pixels, not the viewBox units:
        // if a layout pass ever renders the SVG at another width, hit-testing
        // still lands on the day under the pointer.
        const scale = width > 0 ? rect.width / width : 1
        const plotLeft = rect.left + PAD.left * scale
        const plotWidth = innerW * scale
        const ratio = (clientX - plotLeft) / (plotWidth === 0 ? 1 : plotWidth)
        const index = Math.round(Math.min(1, Math.max(0, ratio)) * (n - 1))
        return Number.isFinite(index) ? Math.min(n - 1, Math.max(0, index)) : null
      }

      const active = hover !== null && series[hover] !== undefined ? series[hover] : null
      const activeX = hover !== null ? xAt(hover) : 0
      const flip = activeX > width * 0.58
      const tipStyle = active === null
        ? null
        : {
          left: `${flip ? activeX - 14 : activeX + 14}px`,
          transform: flip ? 'translateX(-100%)' : 'none',
          top: '4px',
        }

      const ticks = [0, 0.5, 1]
      const labelIndex = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n > 1 ? [0, n - 1] : [0]

      return h('div', { className: 'dsh-ud-chart-block', ref: wrapRef },
        h('svg', {
          className: 'dsh-ud-chart',
          width,
          height: CHART_HEIGHT,
          viewBox: `0 0 ${width} ${CHART_HEIGHT}`,
          role: 'img',
          'aria-label': tr('panel.trend'),
          tabIndex: 0,
          onPointerMove: (event) => {
            const index = pick(event.clientX)
            if (index !== null) setHover(index)
          },
          onPointerLeave: () => setHover(null),
          onFocus: () => setHover((current) => (current === null ? n - 1 : current)),
          onBlur: () => setHover(null),
          onKeyDown: (event) => {
            if (n === 0) return
            const current = hover === null ? n - 1 : hover
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setHover(Math.max(0, current - 1))
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              setHover(Math.min(n - 1, current + 1))
            } else if (event.key === 'Home') {
              event.preventDefault()
              setHover(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              setHover(n - 1)
            } else if (event.key === 'Escape') {
              setHover(null)
            }
          },
        },
          h('defs', {},
            h('linearGradient', { id: 'dsh-ud-area', x1: '0', y1: '0', x2: '0', y2: '1' },
              h('stop', { offset: '0%', stopColor: '#0c70f3', stopOpacity: '0.26' }),
              h('stop', { offset: '100%', stopColor: '#0c70f3', stopOpacity: '0.015' }))),
          ticks.map((ratio, index) => h('line', {
            key: `grid-${index}`,
            className: ratio === 1 ? 'dsh-ud-grid dsh-ud-grid-base' : 'dsh-ud-grid',
            x1: PAD.left,
            x2: width - PAD.right,
            y1: PAD.top + innerH * ratio,
            y2: PAD.top + innerH * ratio,
          })),
          area === '' ? null : h('path', { d: area, fill: 'url(#dsh-ud-area)', stroke: 'none' }),
          line === '' ? null : h('path', { d: line, className: 'dsh-ud-line' }),
          active === null ? null : h('line', {
            className: 'dsh-ud-cross',
            x1: activeX,
            x2: activeX,
            y1: PAD.top,
            y2: PAD.top + innerH,
          }),
          active === null ? null : h('circle', {
            className: 'dsh-ud-point-halo',
            cx: activeX,
            cy: yAt(active.tokens),
            r: 5.5,
          }),
          active === null ? null : h('circle', {
            className: 'dsh-ud-point',
            cx: activeX,
            cy: yAt(active.tokens),
            r: 3,
          }),
          h('text', { className: 'dsh-ud-axis', x: PAD.left, y: PAD.top - 3 }, fmtCompact(max)),
          labelIndex.map((index, order) => h('text', {
            key: `tick-${index}`,
            className: 'dsh-ud-axis',
            x: xAt(index),
            y: CHART_HEIGHT - 5,
            textAnchor: order === 0 ? 'start' : order === labelIndex.length - 1 ? 'end' : 'middle',
          }, series[index]?.d ?? ''))),
        h(DayTip, { point: active, currency: props.currency, style: tipStyle }))
    }

    // ---------------------------------------------------------------- heatmap

    /**
     * The heatmap never floats a card over its own grid: hovering swaps the
     * legend row underneath for one compact readout, and the hovered cell gets
     * a ring. Nothing covers the cells you are trying to read.
     */
    function Heatmap(props) {
      const daily = props.daily
      const [hover, setHover] = useState(null)
      if (daily.length === 0) return h(Note, { title: tr('chart.none') })

      const cell = 12
      const step = cell + 3
      const first = new Date(`${daily[0].d}T00:00:00`)
      const lead = Number.isNaN(first.getTime()) ? 0 : (first.getDay() + 6) % 7
      const weeks = Math.floor((lead + daily.length - 1) / 7) + 1
      const width = weeks * step
      const height = 7 * step
      const max = Math.max(1, ...daily.map((point) => point.tokens))
      const level = (value) => {
        if (value <= 0) return 0
        const ratio = value / max
        if (ratio > 0.6) return 4
        if (ratio > 0.3) return 3
        if (ratio > 0.1) return 2
        return 1
      }
      const todayKey = daily[daily.length - 1].d
      const hoverKey = hover === null ? null : hover.d

      return h('div', { className: 'dsh-ud-heat-block' },
        h('div', {
          className: 'dsh-ud-heat-wrap',
          onPointerLeave: () => setHover(null),
        },
          h('svg', {
            className: 'dsh-ud-heat',
            viewBox: `0 0 ${width} ${height}`,
            width,
            height,
            role: 'img',
            'aria-label': tr('heatmap.title'),
          }, daily.map((point, index) => {
            const slot = lead + index
            const value = level(point.tokens)
            return h('rect', {
              key: point.d,
              x: Math.floor(slot / 7) * step,
              y: (slot % 7) * step,
              width: cell,
              height: cell,
              rx: 3,
              className: value === 0 ? 'dsh-ud-heat-cell is-empty' : 'dsh-ud-heat-cell',
              'data-level': String(value),
              'data-today': point.d === todayKey ? '1' : undefined,
              'data-hover': point.d === hoverKey ? '1' : undefined,
              onPointerEnter: () => setHover(point),
            })
          }))),
        h('div', { className: 'dsh-ud-heat-foot' },
          hover === null
            ? [
              h('span', { key: 'less' }, tr('heatmap.less')),
              [0, 1, 2, 3, 4].map((value) => h('span', {
                key: `legend-${value}`,
                className: 'dsh-ud-heat-swatch',
                'data-level': String(value),
              })),
              h('span', { key: 'more' }, tr('heatmap.more')),
            ]
            : h('div', { className: 'dsh-ud-heat-readout', role: 'status' },
              h('span', { className: 'dsh-ud-heat-readout-date' }, hover.d),
              h('span', { className: 'dsh-ud-heat-readout-strong' }, `${fmtCompact(hover.tokens)} tokens`),
              h('span', null, `${tr('token.cost')} ${fmtMoney(hover.cost, props.currency)}`),
              h('span', null, `${tr('token.calls')} ${fmtInt(hover.calls)}`),
              h('span', null, `${tr('token.input')} ${fmtInt(hover.input)}`),
              h('span', null, `${tr('token.output')} ${fmtInt(hover.output)}`),
              h('span', null, `${tr('token.cacheRead')} ${fmtCompact(hover.cacheRead)}`))))
    }

    function TrendPanel(props) {
      const daily = props.daily
      const [range, setRange] = useState(30)
      const visible = useMemo(
        () => (daily.length > range ? daily.slice(daily.length - range) : daily),
        [daily, range],
      )
      const peak = visible.reduce((best, point) => (point.tokens > best ? point.tokens : best), 0)
      const controls = h('div', { className: 'dsh-ud-range' },
        RANGES.map((value) => h('button', {
          key: String(value),
          type: 'button',
          className: 'dsh-ud-btn dsh-ud-btn-sm',
          'aria-pressed': range === value ? 'true' : 'false',
          onClick: () => setRange(value),
        }, tr(`range.${value}`))),
        h('span', { className: 'dsh-ud-range-peak' }, tr('chart.peak', { value: fmtCompact(peak) })))

      return h(Panel, { title: tr('panel.trend'), hint: tr('chart.hint'), aside: controls },
        daily.length === 0
          ? h(Note, { title: tr('chart.none') })
          : h(TrendChart, { series: visible, currency: props.currency }),
        h('div', { className: 'dsh-ud-heat-head' },
          h('span', null, tr('heatmap.title')),
          h('span', { className: 'dsh-ud-heat-hint' }, tr('heatmap.hint'))),
        h(Heatmap, { daily, currency: props.currency }))
    }

    // ------------------------------------------------------------------ board

    function Board() {
      useLocaleTick()
      const [data, setData] = useState(null)
      const [phase, setPhase] = useState('loading')
      const [busy, setBusy] = useState(false)
      const mounted = useRef(true)

      useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
        }
      }, [])

      const load = useCallback(async (force) => {
        setBusy(true)
        try {
          const response = await fetch(`${ROUTE}${force ? '?refresh=1' : ''}`, {
            headers: { accept: 'application/json' },
          })
          const payload = await response.json().catch(() => null)
          if (!mounted.current) return
          if (response.ok && payload !== null && payload.ok === true) {
            setData(payload)
            setPhase('ready')
          } else {
            setPhase((current) => (current === 'ready' ? 'ready' : 'error'))
          }
        } catch {
          if (mounted.current) setPhase((current) => (current === 'ready' ? 'ready' : 'error'))
        } finally {
          if (mounted.current) setBusy(false)
        }
      }, [])

      useEffect(() => {
        load(false)
        const timer = window.setInterval(() => load(false), POLL_MS)
        return () => window.clearInterval(timer)
      }, [load])

      const currency = data?.pricing?.currency ?? 'CNY'

      const header = h('header', { className: 'dsh-ud-head' },
        h('div', { className: 'dsh-ud-head-text' },
          h('h1', { className: 'dsh-ud-title' }, tr('panel.title')),
          h('div', { className: 'dsh-ud-sub' },
            data === null
              ? tr('state.loading')
              : `${tr('meta.updated', { time: fmtClock(data.generatedAt) })} · ${tr('meta.scanned', {
                sessions: fmtInt(data.scan.sessions),
                readings: fmtInt(data.scan.readings),
              })}${data.scan.truncated ? tr('meta.truncated', { max: fmtInt(data.scan.maxSessions) }) : ''}`)),
        h('div', { className: 'dsh-ud-actions' },
          h('button', {
            type: 'button',
            className: 'dsh-ud-btn',
            onClick: () => load(true),
            disabled: busy,
          }, busy ? tr('action.refreshing') : tr('action.refresh'))))

      if (phase === 'loading' && data === null) {
        return h('div', { className: 'dsh-ud-root' }, h('div', { className: 'dsh-ud-inner' },
          header,
          h('section', { className: 'dsh-ud-strip' },
            [0, 1, 2, 3, 4].map((index) => h('div', { key: `sk-${index}`, className: 'dsh-ud-readout' },
              h('span', { className: 'dsh-ud-skel dsh-ud-skel-label' }),
              h('span', { className: 'dsh-ud-skel dsh-ud-skel-value' }),
              h('span', { className: 'dsh-ud-skel dsh-ud-skel-sub' })))),
          h('div', { className: 'dsh-ud-note-line' }, tr('state.loadingHint'))))
      }

      if (phase === 'error' && data === null) {
        return h('div', { className: 'dsh-ud-root' }, h('div', { className: 'dsh-ud-inner' },
          header,
          h('section', { className: 'dsh-ud-panel dsh-ud-panel-empty' },
            h(Note, { title: tr('state.error'), hint: tr('state.errorHint') }),
            h('div', { className: 'dsh-ud-actions dsh-ud-actions-center' },
              h('button', { type: 'button', className: 'dsh-ud-btn', onClick: () => load(true) },
                tr('action.retry'))))))
      }

      const empty = data.totals.tokens === 0 && data.totals.calls === 0

      return h('div', { className: 'dsh-ud-root' }, h('div', { className: 'dsh-ud-inner' },
        header,
        empty
          ? h('section', { className: 'dsh-ud-panel dsh-ud-panel-empty' },
            h(Note, { title: tr('state.empty'), hint: tr('state.emptyHint') }))
          : h(ReadoutStrip, { data, currency }),
        h('div', { className: 'dsh-ud-row' },
          h(CompositionPanel, { totals: data.totals }),
          h(ModelsPanel, { models: data.models, currency })),
        h(TrendPanel, { daily: data.daily, currency }),
        h('footer', { className: 'dsh-ud-footline' },
          tr('pricing.line', { currency, unit: fmtInt(data.pricing.unit) }))))
    }

    function PanelIcon(props) {
      const size = Number.isFinite(props?.size) && props.size > 0 ? props.size : 18
      const active = props?.active === true
      const strong = active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('rect', { x: 3, y: 13, width: 4.2, height: 8, rx: 1.3, fill: strong }),
        h('rect', { x: 9.9, y: 8.4, width: 4.2, height: 12.6, rx: 1.3, fill: strong, opacity: 0.72 }),
        h('rect', { x: 16.8, y: 3.6, width: 4.2, height: 17.4, rx: 1.3, fill: strong, opacity: 0.45 }))
    }

    // ----------------------------------------------------------------- styles

    const CSS = `
.dsh-ud-root{--dsh-ud-blue-1:#dff2fe;--dsh-ud-blue-2:#a0dcfd;--dsh-ud-blue-3:#60b3fe;--dsh-ud-blue-4:#0c70f3;height:100%;min-height:0;overflow:auto;box-sizing:border-box;padding:22px 24px 44px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:400 13px/1.55 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
.dsh-ud-root ::selection{background:var(--dsh-ud-blue-4);color:#fff}
.dsh-ud-root :focus-visible{outline:2px solid var(--dsh-ud-blue-4);outline-offset:2px}
.dsh-ud-inner{max-width:1160px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.dsh-ud-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:2px}
.dsh-ud-head-text{min-width:0;display:flex;flex-direction:column;gap:2px}
.dsh-ud-title{margin:0;font-size:18px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
.dsh-ud-sub{color:var(--dsw-alias-label-secondary);font-size:12px;overflow-wrap:anywhere}
.dsh-ud-actions{margin-left:auto;display:flex;gap:8px;align-items:center}
.dsh-ud-actions-center{margin-left:0;justify-content:center;margin-top:4px}
.dsh-ud-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 12px;font:inherit;font-size:12px;line-height:1.5;cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.dsh-ud-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsh-ud-btn:disabled{opacity:.55;cursor:default}
.dsh-ud-btn-sm{padding:3px 9px;border-radius:7px;font-size:11.5px}
.dsh-ud-btn[aria-pressed="true"]{border-color:var(--dsh-ud-blue-4);color:var(--dsh-ud-blue-4);background:var(--dsw-alias-bg-layer-2)}

.dsh-ud-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dsh-ud-readout{display:flex;flex-direction:column;gap:1px;min-width:0;padding:0 14px}
.dsh-ud-readout:first-child{padding-left:0}
.dsh-ud-readout+.dsh-ud-readout{border-left:1px solid var(--dsw-alias-border-l1)}
.dsh-ud-readout-label{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-ud-readout-value{font-size:17px;font-weight:600;line-height:1.35;font-variant-numeric:tabular-nums;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ud-readout-value-lead{font-size:26px;line-height:1.2}
.dsh-ud-readout-sub{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ud-tone-muted{opacity:.85}

.dsh-ud-row{display:grid;grid-template-columns:1.3fr 1fr;gap:12px;align-items:stretch}
.dsh-ud-panel{display:flex;flex-direction:column;gap:10px;min-width:0;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dsh-ud-panel-empty{align-items:center;padding:26px 16px}
.dsh-ud-panel-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.dsh-ud-panel-title{margin:0;font-size:12.5px;font-weight:600}
.dsh-ud-panel-hint{color:var(--dsw-alias-label-secondary);font-size:11px}
.dsh-ud-panel-aside{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.dsh-ud-bar{display:flex;gap:2px;height:9px;border-radius:999px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.dsh-ud-bar.is-empty{opacity:.6}
.dsh-ud-bar-seg{display:block;height:100%;min-width:2px;background:var(--dsh-ud-blue-4)}
.dsh-ud-bar-seg[data-tone="output"]{background:var(--dsh-ud-blue-3)}
.dsh-ud-bar-seg[data-tone="cacheRead"]{background:var(--dsh-ud-blue-2)}
.dsh-ud-bar-seg[data-tone="cacheWrite"]{background:var(--dsh-ud-blue-1)}

.dsh-ud-rows{margin:0;display:flex;flex-direction:column;gap:5px}
.dsh-ud-rows .dsh-ud-row{display:grid;grid-template-columns:1fr auto 46px;align-items:center;gap:10px}
.dsh-ud-row-label{display:flex;align-items:center;gap:7px;color:var(--dsw-alias-label-secondary);font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ud-row-value{margin:0;font-size:12.5px;font-variant-numeric:tabular-nums;text-align:right}
.dsh-ud-row-share{margin:0;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;text-align:right}
.dsh-ud-row-total{margin-top:4px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-ud-row-total .dsh-ud-row-label{color:var(--dsw-alias-label-primary);font-weight:500}

.dsh-ud-dot{display:inline-block;flex:none;width:8px;height:8px;border-radius:3px;background:var(--dsh-ud-blue-4)}
.dsh-ud-dot[data-tone="output"]{background:var(--dsh-ud-blue-3)}
.dsh-ud-dot[data-tone="cacheRead"]{background:var(--dsh-ud-blue-2)}
.dsh-ud-dot[data-tone="cacheWrite"]{background:var(--dsh-ud-blue-1);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}

.dsh-ud-models{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.dsh-ud-model{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsh-ud-model-head{display:flex;align-items:baseline;gap:8px;font-size:12px}
.dsh-ud-model-name{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-ud-model-share{margin-left:auto;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsh-ud-model-track{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.dsh-ud-model-fill{display:block;height:100%;border-radius:999px;background:var(--dsh-ud-blue-4);opacity:.9}
.dsh-ud-model-meta{display:flex;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}

.dsh-ud-range{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsh-ud-range-peak{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;margin-left:2px}

.dsh-ud-chart-block{position:relative;width:100%;min-width:0}
.dsh-ud-chart{display:block;width:100%;height:208px;overflow:visible;cursor:default}
.dsh-ud-chart:focus-visible{outline:2px solid var(--dsh-ud-blue-4);outline-offset:2px;border-radius:6px}
.dsh-ud-grid{stroke:var(--dsw-alias-border-l1);stroke-width:1;stroke-dasharray:2 4;vector-effect:non-scaling-stroke}
.dsh-ud-grid-base{stroke-dasharray:none}
.dsh-ud-line{fill:none;stroke:var(--dsh-ud-blue-4);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dsh-ud-cross{stroke:var(--dsh-ud-blue-4);stroke-width:1;stroke-dasharray:3 3;opacity:.55;vector-effect:non-scaling-stroke}
.dsh-ud-point{fill:var(--dsh-ud-blue-4);stroke:var(--dsw-alias-bg-layer-1);stroke-width:2}
.dsh-ud-point-halo{fill:var(--dsh-ud-blue-3);opacity:.28}
.dsh-ud-axis{fill:var(--dsw-alias-label-secondary);font-size:10px;font-variant-numeric:tabular-nums}

.dsh-ud-tip{position:absolute;z-index:2;pointer-events:none;min-width:152px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 6px 18px rgba(10,20,40,.16);font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-ud-tip-date{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.dsh-ud-tip-total{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.dsh-ud-tip-total span{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary);margin-left:3px}
.dsh-ud-tip-rows{display:flex;flex-direction:column;gap:1px;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-ud-tip-row{display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:6px;font-size:11px}
.dsh-ud-tip-dot{width:7px;height:7px;border-radius:2px;display:inline-block;background:var(--dsh-ud-blue-4)}
.dsh-ud-tip-dot[data-tone="output"]{background:var(--dsh-ud-blue-3)}
.dsh-ud-tip-dot[data-tone="cacheRead"]{background:var(--dsh-ud-blue-2)}
.dsh-ud-tip-dot[data-tone="cacheWrite"]{background:var(--dsh-ud-blue-1)}
.dsh-ud-tip-label{color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dsh-ud-tip-value{font-variant-numeric:tabular-nums;text-align:right}
.dsh-ud-tip-foot{display:flex;gap:10px;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}

.dsh-ud-heat-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:2px}
.dsh-ud-heat-head>span:first-child{font-size:11.5px;font-weight:500}
.dsh-ud-heat-hint{color:var(--dsw-alias-label-secondary);font-size:11px}
.dsh-ud-heat-block{position:relative;width:100%;min-width:0}
.dsh-ud-heat-wrap{overflow-x:auto;padding-bottom:2px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
.dsh-ud-heat{display:block;width:auto;height:96px}
.dsh-ud-heat-cell{stroke:none;fill:var(--dsh-ud-blue-2);cursor:default}
.dsh-ud-heat-cell[data-level="1"]{fill:var(--dsh-ud-blue-1)}
.dsh-ud-heat-cell[data-level="2"]{fill:var(--dsh-ud-blue-2)}
.dsh-ud-heat-cell[data-level="3"]{fill:var(--dsh-ud-blue-3)}
.dsh-ud-heat-cell[data-level="4"]{fill:var(--dsh-ud-blue-4)}
.dsh-ud-heat-cell.is-empty{fill:var(--dsw-alias-bg-layer-2);stroke:var(--dsw-alias-border-l1);stroke-width:1}
.dsh-ud-heat-cell[data-today="1"]{stroke:var(--dsw-alias-label-secondary);stroke-width:1.2}
.dsh-ud-heat-cell[data-hover="1"]{stroke:var(--dsh-ud-blue-4);stroke-width:1.6}
.dsh-ud-heat-foot{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:18px;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.dsh-ud-heat-readout{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dsh-ud-heat-readout-date{color:var(--dsw-alias-label-primary);font-weight:500}
.dsh-ud-heat-readout-strong{color:var(--dsw-alias-label-primary);font-weight:600}
.dsh-ud-heat-swatch{display:inline-block;width:11px;height:11px;border-radius:3px;background:var(--dsh-ud-blue-2)}
.dsh-ud-heat-swatch[data-level="0"]{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1)}
.dsh-ud-heat-swatch[data-level="1"]{background:var(--dsh-ud-blue-1)}
.dsh-ud-heat-swatch[data-level="2"]{background:var(--dsh-ud-blue-2)}
.dsh-ud-heat-swatch[data-level="3"]{background:var(--dsh-ud-blue-3)}
.dsh-ud-heat-swatch[data-level="4"]{background:var(--dsh-ud-blue-4)}

.dsh-ud-note{display:flex;flex-direction:column;gap:3px;align-items:center;text-align:center}
.dsh-ud-note-title{font-size:12.5px;font-weight:500}
.dsh-ud-note-hint{color:var(--dsw-alias-label-secondary);font-size:12px;max-width:60ch}
.dsh-ud-note-line{color:var(--dsw-alias-label-secondary);font-size:12px}
.dsh-ud-footline{color:var(--dsw-alias-label-secondary);font-size:11px;text-align:center;padding-top:2px}

.dsh-ud-skel{display:block;border-radius:4px;background:var(--dsw-alias-bg-layer-2);opacity:.85}
.dsh-ud-skel-label{height:9px;width:52%;margin-bottom:6px}
.dsh-ud-skel-value{height:20px;width:74%;margin-bottom:6px}
.dsh-ud-skel-sub{height:8px;width:40%}

@media (max-width:979px){
.dsh-ud-strip{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:14px}
.dsh-ud-readout:nth-child(2n+1){padding-left:0;border-left:none}
.dsh-ud-row{grid-template-columns:1fr}
}
@media (max-width:520px){
.dsh-ud-root{padding:16px 14px 36px}
.dsh-ud-strip{grid-template-columns:1fr;row-gap:12px}
.dsh-ud-readout{padding-left:0;border-left:none}
.dsh-ud-readout-value-lead{font-size:23px}
}
`

    // ------------------------------------------------------------------ apply

    function apply(ctx) {
      const style = document.createElement('style')
      style.setAttribute('data-dsh-usage-dashboard', '1')
      style.textContent = CSS
      document.head.append(style)
      ctx.effect(() => () => style.remove(), 'dsh-usage-dashboard: styles')

      const syncLocale = () => {
        const snapshot = ctx.locale.getLocale()
        activeDict = dictFor(snapshot?.active)
        activeTag = tagFor(snapshot?.active)
        for (const listener of localeListeners) listener()
      }
      syncLocale()
      ctx.effect(() => ctx.locale.subscribe(syncLocale), 'dsh-usage-dashboard: locale')

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_KEY,
        order: 30,
        label: () => tr('panel.title'),
      }, PanelIcon))

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_KEY,
      }, Board))
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
