/**
 * dsh-usage-dashboard — Host half.
 *
 * Owns exactly two read-only JSON routes that the Client panel calls:
 *
 *   GET /dsh-usage-dashboard/snapshot[?refresh=1]
 *        Token totals (input / output / cache read / cache write), cost
 *        estimation from a configurable price table, per-day series for the
 *        trend chart and heatmap, per-model share, and a cached account
 *        balance read.
 *
 * Source of truth: the session log. `assistant/message` carries
 * `data.usage` (TokenUsage) and `data.message.source` (provider + model), so
 * every number here is re-derivable from committed events; this plugin only
 * keeps a derived cache keyed by `SessionPersistenceSnapshot.revision`.
 *
 * The counters are Anthropic-Messages style (the DeepSeek route speaks that
 * protocol): `inputTokens` is the non-cached prompt, and `cacheReadTokens` /
 * `cacheWriteTokens` are additive, separate counters — not a subset.
 */

const ROUTE_PREFIX = '/dsh-usage-dashboard'
const SNAPSHOT_ROUTE = `${ROUTE_PREFIX}/snapshot`

/** Balance reads hit the network; one minute is enough for a dashboard. */
const BALANCE_TTL_MS = 60_000
/** Parallel session-log reads; the log backend is cheap but not free. */
const READ_CONCURRENCY = 4
/** Current module generation may be replaced by HMR: share caches by symbol. */
const CACHE_KEY = Symbol.for('dsh-usage-dashboard:cache')

const DEFAULT_PRICE = { miss: 2, hit: 0.2, write: 2, output: 3 }
const DEFAULT_PRICING = {
  currency: 'CNY',
  unit: 1_000_000,
  default: DEFAULT_PRICE,
  models: {},
}

const DEFAULTS = {
  historyDays: 182,
  maxSessions: 600,
  pricing: DEFAULT_PRICING,
}

// ---------------------------------------------------------------- utilities

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function positiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/** Local calendar day (`YYYY-MM-DD`) for one epoch-ms timestamp. */
function dayKey(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '1970-01-01'
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** The last `days` local calendar days, oldest first, ending today. */
function recentDays(days) {
  const out = []
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(noon)
    d.setDate(noon.getDate() - i)
    out.push(dayKey(d.getTime()))
  }
  return out
}

function priceShape(raw, fallback) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const pick = (key) => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback[key]
  }
  return { miss: pick('miss'), hit: pick('hit'), write: pick('write'), output: pick('output') }
}

/** Normalize the row's `config.pricing`, tolerating any user shape. */
function normalizePricing(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const unit = Number.isFinite(source.unit) && source.unit > 0 ? source.unit : DEFAULT_PRICING.unit
  const currency = typeof source.currency === 'string' && source.currency !== ''
    ? source.currency
    : DEFAULT_PRICING.currency
  const base = priceShape(source.default, DEFAULT_PRICE)
  const models = new Map()
  const table = source.models !== null && typeof source.models === 'object' ? source.models : {}
  for (const [key, value] of Object.entries(table)) {
    if (typeof key !== 'string' || key === '') continue
    models.set(key.toLowerCase(), priceShape(value, base))
  }
  return { currency, unit, base, models }
}

/** Exact id, then longest registered prefix, then the default row. */
function priceFor(pricing, model) {
  const id = typeof model === 'string' ? model.toLowerCase() : ''
  const exact = pricing.models.get(id)
  if (exact !== undefined) return exact
  let best
  let bestLength = -1
  for (const [key, price] of pricing.models) {
    if (id.startsWith(key) && key.length > bestLength) {
      best = price
      bestLength = key.length
    }
  }
  return best ?? pricing.base
}

function costOf(price, record, unit) {
  const miss = record.i * price.miss
  const hit = record.cr * price.hit
  const write = record.cw * price.write
  const output = record.o * price.output
  return (miss + hit + write + output) / unit
}

// ------------------------------------------------------------------- caches

/**
 * Per-session derived records plus the balance snapshot, shared across module
 * generations so an HMR remount does not rescan every log.
 */
function cache() {
  const scope = globalThis
  const existing = scope[CACHE_KEY]
  if (existing !== undefined && existing !== null) return existing
  const created = {
    sessions: new Map(), // sessionId -> { key, records }
    balance: { at: 0, value: null },
  }
  scope[CACHE_KEY] = created
  return created
}

// --------------------------------------------------------------- log reading

/** `list()` returns snapshots (`{ header, revision }`); accept bare headers too. */
function snapshotHeader(item) {
  return item !== null && typeof item === 'object' && item.header !== undefined ? item.header : item
}

function revisionKey(snapshot) {
  const revision = snapshot !== null && typeof snapshot === 'object' ? snapshot.revision : undefined
  const eventCount = snapshot !== null && typeof snapshot === 'object' ? snapshot.eventCount : undefined
  return `${String(revision ?? '')}#${String(eventCount ?? '')}`
}

/** One `assistant/message` usage reading, reduced to the numbers we aggregate. */
function readRecords(events, into) {
  for (const event of events) {
    if (event === null || typeof event !== 'object' || event.type !== 'assistant/message') continue
    const data = event.data
    if (data === null || typeof data !== 'object') continue
    const usage = data.usage
    if (usage === null || typeof usage !== 'object') continue
    const source = data.message !== null && typeof data.message === 'object' ? data.message.source : undefined
    into.push({
      t: typeof event.time === 'number' ? event.time : 0,
      p: source !== undefined && typeof source.provider === 'string' ? source.provider : 'unknown',
      m: source !== undefined && typeof source.model === 'string' ? source.model : 'unknown',
      i: num(usage.inputTokens),
      o: num(usage.outputTokens),
      cr: num(usage.cacheReadTokens),
      cw: num(usage.cacheWriteTokens),
      r: num(usage.reasoningTokens),
    })
  }
}

async function readSessionRecords(ctx, snapshot) {
  const id = snapshotHeader(snapshot)?.id
  if (typeof id !== 'string' || id === '') return []
  const handle = await ctx.sessionPersistence.open(id, 'read')
  try {
    const result = await handle.read()
    const records = []
    readRecords(result.events, records)
    return records
  } finally {
    await Promise.resolve(handle.close()).catch(() => {})
  }
}

/**
 * Fold every session log into per-session record lists, reusing the cache for
 * sessions whose revision did not change.
 */
async function collectRecords(ctx, snapshots, store) {
  const records = []
  const changed = []
  for (const snapshot of snapshots) {
    const header = snapshotHeader(snapshot)
    const id = header?.id
    if (typeof id !== 'string' || id === '') continue
    const key = revisionKey(snapshot)
    const cached = store.sessions.get(id)
    if (cached !== undefined && cached.key === key) {
      records.push(...cached.records)
      continue
    }
    changed.push({ snapshot, id, key })
  }
  for (let index = 0; index < changed.length; index += READ_CONCURRENCY) {
    const slice = changed.slice(index, index + READ_CONCURRENCY)
    const settled = await Promise.all(slice.map((entry => readSessionRecords(ctx, entry.snapshot).then(
      (value) => ({ entry, value }),
      () => ({ entry, value: [] }),
    ))))
    for (const { entry, value } of settled) {
      store.sessions.set(entry.id, { key: entry.key, records: value })
      records.push(...value)
    }
  }
  // Forget sessions that no longer exist so the cache stays bounded.
  if (store.sessions.size > snapshots.length * 2 + 32) {
    const alive = new Set()
    for (const snapshot of snapshots) {
      const id = snapshotHeader(snapshot)?.id
      if (typeof id === 'string') alive.add(id)
    }
    for (const id of [...store.sessions.keys()]) {
      if (!alive.has(id)) store.sessions.delete(id)
    }
  }
  return { records, changed: changed.length }
}

// ------------------------------------------------------------------ folding

function emptyBucket() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, tokens: 0, cost: 0 }
}

function addTo(bucket, record, cost) {
  bucket.calls += 1
  bucket.input += record.i
  bucket.output += record.o
  bucket.cacheRead += record.cr
  bucket.cacheWrite += record.cw
  bucket.reasoning += record.r
  bucket.tokens += record.i + record.o + record.cr + record.cw
  bucket.cost += cost
  return bucket
}

function roundMoney(value) {
  return Math.round(value * 10000) / 10000
}

function shapeBucket(bucket) {
  const prompt = bucket.input + bucket.cacheRead + bucket.cacheWrite
  return {
    calls: bucket.calls,
    input: bucket.input,
    output: bucket.output,
    cacheRead: bucket.cacheRead,
    cacheWrite: bucket.cacheWrite,
    reasoning: bucket.reasoning,
    prompt,
    tokens: bucket.tokens,
    cost: roundMoney(bucket.cost),
    cacheHitRate: prompt > 0 ? bucket.cacheRead / prompt : 0,
  }
}

function fold(records, pricing, days) {
  const totals = emptyBucket()
  const today = emptyBucket()
  const month = emptyBucket()
  const byDay = new Map()
  const byModel = new Map()
  for (const day of days) byDay.set(day, emptyBucket())

  const todayKey = days[days.length - 1]
  const monthKey = todayKey.slice(0, 7)
  const dayFloor = days.length > 0 ? new Date(`${days[0]}T00:00:00`).getTime() : 0

  for (const record of records) {
    const price = priceFor(pricing, record.m)
    const cost = costOf(price, record, pricing.unit)
    addTo(totals, record, cost)
    const key = dayKey(record.t)
    if (key === todayKey) addTo(today, record, cost)
    if (key.startsWith(monthKey)) addTo(month, record, cost)
    // Records older than the requested window still count in totals/history;
    // they only stay out of the daily series and the heatmap.
    if (record.t >= dayFloor) {
      let bucket = byDay.get(key)
      if (bucket === undefined) {
        bucket = emptyBucket()
        byDay.set(key, bucket)
      }
      addTo(bucket, record, cost)
    }
    const modelId = record.m
    let model = byModel.get(modelId)
    if (model === undefined) {
      model = { model: record.m, providers: new Set(), bucket: emptyBucket() }
      byModel.set(modelId, model)
    }
    if (record.p !== 'unknown') model.providers.add(record.p)
    addTo(model.bucket, record, cost)
  }

  return { totals, today, month, byDay, byModel, todayKey, dayFloor, monthKey }
}

function seriesOf(byDay, days) {
  return days.map((day) => {
    const bucket = byDay.get(day) ?? emptyBucket()
    return {
      d: day,
      calls: bucket.calls,
      input: bucket.input,
      output: bucket.output,
      cacheRead: bucket.cacheRead,
      cacheWrite: bucket.cacheWrite,
      tokens: bucket.tokens,
      cost: roundMoney(bucket.cost),
    }
  })
}

function modelsOf(byModel, totals) {
  const list = []
  for (const entry of byModel.values()) {
    const bucket = entry.bucket
    list.push({
      id: entry.model,
      model: entry.model,
      providers: [...entry.providers],
      calls: bucket.calls,
      input: bucket.input,
      output: bucket.output,
      cacheRead: bucket.cacheRead,
      cacheWrite: bucket.cacheWrite,
      tokens: bucket.tokens,
      cost: roundMoney(bucket.cost),
      share: totals.tokens > 0 ? bucket.tokens / totals.tokens : 0,
    })
  }
  list.sort((left, right) => right.tokens - left.tokens)
  return list
}

function pricingView(pricing) {
  const rows = []
  for (const [model, price] of pricing.models) rows.push({ model, ...price })
  return { currency: pricing.currency, unit: pricing.unit, default: { ...pricing.base }, models: rows }
}

// ------------------------------------------------------------------ balance

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), ms)
      if (typeof timer === 'object' && timer !== null && typeof timer.unref === 'function') timer.unref()
    }),
  ])
}

function clientMetadata(ctx) {
  let locale = 'zh'
  try {
    const settings = ctx.get('settings')
    const value = settings?.get?.('locale')
    if (typeof value === 'string' && value !== '') locale = value
  } catch {
    // Settings are optional; the fallback locale is honest enough here.
  }
  return {
    version: '1.0.0',
    locale,
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}

/**
 * Read the signed-in account's wallet balances. Returns a plain JSON snapshot
 * (never an exception) so the panel can show `未登录` instead of an error page.
 */
async function readBalance(ctx, store, force) {
  const fresh = store.balance.value !== null && !force && Date.now() - store.balance.at < BALANCE_TTL_MS
  if (fresh) return store.balance.value

  const result = { available: false, signedIn: false, wallets: [], bonusWallets: [], links: null, error: null }
  const account = ctx.get('deepseekAccount')
  if (account === undefined || account === null) {
    result.error = 'service-unavailable'
    store.balance = { at: Date.now(), value: result }
    return result
  }
  result.available = true
  const client = clientMetadata(ctx)
  try {
    const state = await withTimeout(Promise.resolve(account.getState()), 6000)
    if (state !== null && typeof state === 'object') {
      result.signedIn = state.status === 'credential-stored'
      if (state.links !== null && typeof state.links === 'object') {
        result.links = {
          usageUrl: typeof state.links.usageUrl === 'string' ? state.links.usageUrl : null,
          topUpUrl: typeof state.links.topUpUrl === 'string' ? state.links.topUpUrl : null,
        }
      }
    }
    if (result.signedIn) {
      const balance = await withTimeout(Promise.resolve(account.getBalance(client)), 8000)
      if (balance === undefined || balance === null) {
        result.error = 'unavailable'
      } else if (balance.status !== 'ready') {
        result.error = 'failed'
      } else {
        const wallet = (entry) => ({
          currency: typeof entry?.currency === 'string' ? entry.currency : '',
          balance: typeof entry?.balance === 'string' ? entry.balance : String(entry?.balance ?? ''),
        })
        result.wallets = Array.isArray(balance.value) ? balance.value.map(wallet) : []
        result.bonusWallets = Array.isArray(balance.bonusWallets) ? balance.bonusWallets.map(wallet) : []
      }
    }
  } catch (error) {
    result.error = 'failed'
    ctx.logger?.warn?.('[dsh-usage-dashboard] balance read failed:', error)
  }
  store.balance = { at: Date.now(), value: result }
  return result
}

// ------------------------------------------------------------------- routes

function respond(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function routeTable() {
  const key = Symbol.for('dsh-usage-dashboard:routes')
  const scope = globalThis
  const existing = scope[key]
  if (existing instanceof Map) return existing
  const created = new Map()
  scope[key] = created
  return created
}

/**
 * Claim one exact route, releasing a stale generation's handler first: a plugin
 * can be re-mounted while the previous generation's route is still installed,
 * and `webServer.register()` throws on a duplicate `(kind, path)`.
 */
function installRoute(ctx, route) {
  const key = `${route.kind}:${route.path}`
  const table = routeTable()
  const previous = table.get(key)
  if (previous !== undefined) {
    try {
      previous()
    } catch {
      // The old webserver may already be gone.
    }
    table.delete(key)
  }
  try {
    const dispose = ctx.webServer.register(route)
    table.set(key, dispose)
    return () => {
      try {
        dispose()
      } catch {
        // Already released.
      }
      table.delete(key)
    }
  } catch (error) {
    ctx.logger?.warn?.(`[dsh-usage-dashboard] route ${key} is already registered; keeping the existing handler:`, error)
    return () => {}
  }
}

async function buildSnapshot(ctx, config, forceRefresh) {
  const pricing = normalizePricing(config.pricing)
  const days = recentDays(positiveInt(config.historyDays, DEFAULTS.historyDays))
  const maxSessions = positiveInt(config.maxSessions, DEFAULTS.maxSessions)
  const store = cache()

  let snapshots = []
  let truncated = false
  try {
    const listed = await ctx.sessionPersistence.list()
    snapshots = Array.isArray(listed) ? listed.slice() : []
  } catch (error) {
    ctx.logger?.warn?.('[dsh-usage-dashboard] session list failed:', error)
  }
  if (snapshots.length > maxSessions) {
    snapshots.sort((left, right) => {
      const a = snapshotHeader(left)?.createdAt ?? 0
      const b = snapshotHeader(right)?.createdAt ?? 0
      return b - a
    })
    snapshots = snapshots.slice(0, maxSessions)
    truncated = true
  }

  const collected = await collectRecords(ctx, snapshots, store)
  const folded = fold(collected.records, pricing, days)

  return {
    ok: true,
    generatedAt: Date.now(),
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
    pricing: pricingView(pricing),
    scan: {
      sessions: snapshots.length,
      rescanned: collected.changed,
      readings: collected.records.length,
      truncated,
      maxSessions,
    },
    window: { days: days.length, from: days[0] ?? null, to: days[days.length - 1] ?? null },
    totals: shapeBucket(folded.totals),
    today: shapeBucket(folded.today),
    month: shapeBucket(folded.month),
    history: {
      tokens: folded.totals.tokens,
      cost: roundMoney(folded.totals.cost),
      calls: folded.totals.calls,
    },
    daily: seriesOf(folded.byDay, days),
    models: modelsOf(folded.byModel, folded.totals),
    balance: await readBalance(ctx, store, forceRefresh),
  }
}

// --------------------------------------------------------------------- apply

export const name = 'dsh-usage-dashboard'
/** Registered through a scoped `ctx.inject` below, so the row mounts at once. */
export const inject = []

const SCOPED_SERVICES = ['webServer', 'sessionPersistence']

export function apply(ctx, config) {
  const settings = config !== null && typeof config === 'object' ? config : DEFAULTS
  ctx.inject(SCOPED_SERVICES, (scoped) => {
    const disposeRoute = installRoute(scoped, {
      kind: 'exact',
      path: SNAPSHOT_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          respond(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const url = new URL(req.url ?? SNAPSHOT_ROUTE, 'http://localhost')
        const forceRefresh = url.searchParams.get('refresh') === '1'
        try {
          respond(res, 200, await buildSnapshot(scoped, settings, forceRefresh))
        } catch (error) {
          scoped.logger?.warn?.('[dsh-usage-dashboard] snapshot failed:', error)
          respond(res, 500, { ok: false, error: 'snapshot-failed' })
        }
      },
    })
    scoped.effect(() => () => {
      disposeRoute()
      // The caches themselves survive: they are keyed by session revision.
    }, 'dsh-usage-dashboard: routes')
  })
}
