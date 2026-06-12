/**
 * Recipe scraper (Phase 13b) — fetch + parse only. NO LLM calls, NO DB access.
 *
 * Usage:
 *   pnpm scrape-recipes --site aniagotuje --limit 10
 *   pnpm scrape-recipes --site kwestiasmaku --limit 10
 *
 * Discovers recipe URLs (sitemap or category listings, per site config), fetches
 * pages strictly sequentially with a rate limit of at least 1 req/2s (raised to
 * the site's robots.txt Crawl-delay when larger), parses schema.org/Recipe data
 * (JSON-LD → site-specific extractor → generic microdata) and dumps raw JSON to
 * data/raw-recipes/{contentHash}.json. Already-downloaded hashes are skipped
 * without refetching, so re-runs are idempotent and free.
 *
 * Raw ingredient/step text is stored verbatim ONLY in the gitignored data/
 * directory — the LLM rewrite step (scripts/process-recipes.ts, Phase 13c)
 * rewrites steps in our own words before anything reaches the database.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { load, type CheerioAPI } from 'cheerio'

// ----- types -----

interface RawRecipe {
  contentHash: string
  sourceUrl: string
  siteId: string
  fetchedAt: string
  parser: 'json-ld' | 'site-specific' | 'microdata'
  title: string
  description?: string
  servingsText?: string
  timeText?: string
  cuisine?: string
  ingredients: string[]
  steps: string[]
  categories: string[]
  tags: string[]
  imageUrl?: string
  jsonLd?: unknown
}

type ExtractedRecipe = Omit<
  RawRecipe,
  'contentHash' | 'sourceUrl' | 'siteId' | 'fetchedAt' | 'parser'
>

type Discovery =
  | { kind: 'sitemap'; url: string; urlFilter: RegExp }
  | { kind: 'listing'; listingUrls: string[]; recipeLinkFilter: RegExp }

interface SiteConfig {
  id: string
  baseUrl: string
  userAgent: string
  minDelayMs: number
  discovery: Discovery
  /** Site-specific extractor; tried after JSON-LD, before generic microdata. */
  extract?: ($: CheerioAPI) => ExtractedRecipe | null
}

// ----- site configs -----

const BOT_UA =
  'meal-planner-recipe-scraper/0.1 (personal family project; +https://github.com/inkorobeynikov/weekly-meal-plan)'

// kwestiasmaku.com's WAF resets the connection for any non-browser User-Agent
// (even "Mozilla/5.0 (compatible; ...)"), so a browser-like UA is required
// there. We compensate by honoring its robots.txt Crawl-delay of 10s.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const SITES: Record<string, SiteConfig> = {
  aniagotuje: {
    id: 'aniagotuje',
    baseUrl: 'https://aniagotuje.pl',
    userAgent: BOT_UA,
    minDelayMs: 2000,
    discovery: {
      kind: 'sitemap',
      url: 'https://aniagotuje.pl/sitemap.xml',
      urlFilter: /\/przepis\//,
    },
    extract: extractAniaGotuje,
  },
  kwestiasmaku: {
    id: 'kwestiasmaku',
    baseUrl: 'https://www.kwestiasmaku.com',
    userAgent: BROWSER_UA,
    minDelayMs: 2000, // robots.txt Crawl-delay: 10 raises the effective delay
    discovery: {
      kind: 'listing',
      listingUrls: ['https://www.kwestiasmaku.com/blog-kulinarny/category/dania-obiadowe'],
      recipeLinkFilter: /^\/przepis\//,
    },
    extract: extractKwestiaSmaku,
  },
}

// ----- small utils -----

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function contentHashOf(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('hex')
}

/** Sequential rate limiter: resolves once enough time passed since last call. */
function createThrottle(delayMs: number): () => Promise<void> {
  let last = 0
  return async () => {
    const wait = last + delayMs - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
  }
}

async function fetchText(url: string, userAgent: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pl,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.text()
}

// ----- robots.txt -----

interface RobotsRules {
  disallow: string[]
  crawlDelayMs: number | null
}

/**
 * Minimal robots.txt parser: picks the group with the most specific
 * User-agent match for our UA (substring match, '*' as fallback) and
 * returns its Disallow prefixes + Crawl-delay.
 */
function parseRobots(text: string, userAgent: string): RobotsRules {
  const ua = userAgent.toLowerCase()
  let best: RobotsRules = { disallow: [], crawlDelayMs: null }
  let bestMatchLen = -1

  let groupAgents: string[] = []
  let groupRules: RobotsRules | null = null
  let inAgentList = false

  const closeGroup = (): void => {
    if (!groupRules) return
    for (const agent of groupAgents) {
      const a = agent.toLowerCase()
      const matchLen = a === '*' ? 0 : ua.includes(a) ? a.length : -1
      if (matchLen > bestMatchLen) {
        bestMatchLen = matchLen
        best = groupRules
      }
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'user-agent') {
      if (!inAgentList) {
        closeGroup()
        groupAgents = []
        groupRules = { disallow: [], crawlDelayMs: null }
      }
      inAgentList = true
      groupAgents.push(value)
      continue
    }
    inAgentList = false
    if (!groupRules) continue
    if (key === 'disallow' && value) groupRules.disallow.push(value)
    if (key === 'crawl-delay') {
      const seconds = Number(value)
      if (Number.isFinite(seconds)) groupRules.crawlDelayMs = seconds * 1000
    }
  }
  closeGroup()
  return best
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isAllowedByRobots(url: string, rules: RobotsRules): boolean {
  const parsed = new URL(url)
  const path = parsed.pathname + parsed.search
  return !rules.disallow.some((pattern) => {
    if (pattern.includes('*') || pattern.includes('$')) {
      const re = new RegExp(
        '^' + pattern.split('*').map(escapeRegex).join('.*').replace(/\\\$$/, '$'),
      )
      return re.test(path)
    }
    return path.startsWith(pattern)
  })
}

// ----- URL discovery -----

interface Counters {
  discovered: number
  downloaded: number
  cachedSkip: number
  noRecipeData: number
  robotsBlocked: number
  fetchErrors: number
}

async function discoverFromSitemap(
  sitemapUrl: string,
  urlFilter: RegExp,
  userAgent: string,
  throttle: () => Promise<void>,
  limit: number,
): Promise<string[]> {
  await throttle()
  const xml = await fetchText(sitemapUrl, userAgent)
  const $ = load(xml, { xmlMode: true })

  // Sitemap index → recurse one level into child sitemaps.
  const childSitemaps = $('sitemapindex > sitemap > loc')
    .map((_, el) => $(el).text().trim())
    .get()

  const urls: string[] = []
  const seen = new Set<string>()
  const collect = (locs: string[]): void => {
    for (const loc of locs) {
      if (urls.length >= limit) return
      if (urlFilter.test(loc) && !seen.has(loc)) {
        seen.add(loc)
        urls.push(loc)
      }
    }
  }

  collect($('urlset > url > loc').map((_, el) => $(el).text().trim()).get())

  for (const child of childSitemaps) {
    if (urls.length >= limit) break
    await throttle()
    const childXml = await fetchText(child, userAgent)
    const $child = load(childXml, { xmlMode: true })
    collect($child('urlset > url > loc').map((_, el) => $child(el).text().trim()).get())
  }
  return urls
}

async function discoverFromListings(
  site: SiteConfig,
  listingUrls: string[],
  recipeLinkFilter: RegExp,
  robots: RobotsRules,
  throttle: () => Promise<void>,
  limit: number,
  counters: Counters,
): Promise<string[]> {
  const urls: string[] = []
  const seen = new Set<string>()
  const MAX_PAGES_PER_LISTING = 50

  for (const listingUrl of listingUrls) {
    for (let page = 0; page < MAX_PAGES_PER_LISTING; page++) {
      if (urls.length >= limit) return urls
      const pageUrl = page === 0 ? listingUrl : `${listingUrl}?page=${page}`
      if (!isAllowedByRobots(pageUrl, robots)) {
        counters.robotsBlocked++
        break
      }
      await throttle()
      let html: string
      try {
        html = await fetchText(pageUrl, site.userAgent)
      } catch (err) {
        counters.fetchErrors++
        console.warn(`[${site.id}] listing fetch failed: ${pageUrl}:`, errMessage(err))
        break
      }
      const $ = load(html)
      let newOnPage = 0
      $('a[href]').each((_, el) => {
        if (urls.length >= limit) return
        const href = $(el).attr('href')
        if (!href) return
        let absolute: URL
        try {
          absolute = new URL(href, site.baseUrl)
        } catch {
          return
        }
        if (!recipeLinkFilter.test(absolute.pathname)) return
        const normalized = absolute.origin + absolute.pathname
        if (seen.has(normalized)) return
        seen.add(normalized)
        urls.push(normalized)
        newOnPage++
      })
      if (newOnPage === 0) break // ran out of pages
    }
  }
  return urls
}

// ----- parsing: JSON-LD -----

function findJsonLdRecipe(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJsonLdRecipe(item)
      if (found) return found
    }
    return null
  }
  if (node === null || typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  const type = obj['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.includes('Recipe')) return obj
  if (obj['@graph']) return findJsonLdRecipe(obj['@graph'])
  return null
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [cleanText(value)].filter(Boolean)
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? cleanText(v) : ''))
      .filter(Boolean)
  }
  return []
}

function jsonLdInstructions(value: unknown): string[] {
  if (typeof value === 'string') return [cleanText(value)].filter(Boolean)
  if (!Array.isArray(value)) return []
  const steps: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      const t = cleanText(item)
      if (t) steps.push(t)
      continue
    }
    if (item === null || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (typeof obj.text === 'string') {
      const t = cleanText(obj.text)
      if (t) steps.push(t)
    } else if (Array.isArray(obj.itemListElement)) {
      steps.push(...jsonLdInstructions(obj.itemListElement)) // HowToSection
    }
  }
  return steps
}

function jsonLdImage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return jsonLdImage(value[0])
  if (value !== null && typeof value === 'object') {
    const url = (value as Record<string, unknown>).url
    if (typeof url === 'string') return url
  }
  return undefined
}

function extractJsonLd($: CheerioAPI): ExtractedRecipe | null {
  let recipe: Record<string, unknown> | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (recipe) return
    try {
      recipe = findJsonLdRecipe(JSON.parse($(el).text()))
    } catch {
      // malformed JSON-LD block — ignore
    }
  })
  if (!recipe) return null
  const r: Record<string, unknown> = recipe

  const title = typeof r.name === 'string' ? cleanText(r.name) : ''
  const ingredients = asStringArray(r.recipeIngredient ?? r.ingredients)
  const steps = jsonLdInstructions(r.recipeInstructions)
  if (!title || ingredients.length === 0 || steps.length === 0) return null

  const yieldValue = r.recipeYield
  const servingsText =
    typeof yieldValue === 'number' ? String(yieldValue) : asStringArray(yieldValue)[0]
  const time = r.totalTime ?? r.cookTime ?? r.prepTime

  return {
    title,
    description: typeof r.description === 'string' ? cleanText(r.description) : undefined,
    servingsText,
    timeText: typeof time === 'string' ? time : undefined,
    cuisine: asStringArray(r.recipeCuisine)[0],
    ingredients,
    steps,
    categories: asStringArray(r.recipeCategory),
    tags: asStringArray(r.keywords).flatMap((k) => k.split(',').map(cleanText)).filter(Boolean),
    imageUrl: jsonLdImage(r.image),
    jsonLd: recipe,
  }
}

// ----- parsing: generic microdata -----

interface MicrodataResult {
  /** All Recipe metadata + ingredients; steps left empty. */
  metadata: ExtractedRecipe
  /** Steps as the generic itemprop="recipeInstructions" handling sees them. */
  genericSteps: string[]
}

function parseMicrodata($: CheerioAPI): MicrodataResult | null {
  const root = $('[itemtype*="schema.org/Recipe"]').first()
  if (root.length === 0) return null
  const rootEl = root.get(0)

  // Only itemprops whose nearest itemscope ancestor is the Recipe root itself
  // (excludes e.g. author Person or breadcrumb ListItem properties).
  const owned = (prop: string) =>
    root.find(`[itemprop="${prop}"]`).filter((_, el) => {
      const scope = $(el).parent().closest('[itemscope]')
      return scope.length === 0 || scope.get(0) === rootEl
    })

  const ownedTexts = (prop: string): string[] =>
    owned(prop)
      .map((_, el) => cleanText($(el).attr('content') ?? $(el).text()))
      .get()
      .filter(Boolean)

  const propValue = (prop: string): string | undefined => {
    const el = owned(prop).first()
    if (el.length === 0) return undefined
    const value =
      el.attr('content') ?? el.attr('datetime') ?? el.attr('src') ?? el.attr('href') ?? el.text()
    const t = cleanText(value)
    return t || undefined
  }

  const title = propValue('name')
  const ingredients = ownedTexts('recipeIngredient')
  if (!title || ingredients.length === 0) return null

  const genericSteps: string[] = []
  owned('recipeInstructions').each((_, el) => {
    const $el = $(el)
    // HowToStep markup: prefer the dedicated text prop over the node soup.
    const stepText = $el.find('[itemprop="text"]').first()
    if (stepText.length > 0) {
      const t = cleanText(stepText.text())
      if (t) genericSteps.push(t)
      return
    }
    const items = $el.find('li')
    if (items.length > 0) {
      items.each((_, li) => {
        const t = cleanText($(li).text())
        if (t) genericSteps.push(t)
      })
    } else {
      const t = cleanText($el.attr('content') ?? $el.text())
      if (t) genericSteps.push(t)
    }
  })

  return {
    metadata: {
      title,
      description: propValue('description'),
      servingsText: propValue('recipeYield'),
      timeText: propValue('totalTime') ?? propValue('cookTime') ?? propValue('prepTime'),
      cuisine: propValue('recipeCuisine'),
      ingredients,
      steps: [],
      categories: ownedTexts('recipeCategory'),
      tags: (propValue('keywords') ?? '').split(',').map(cleanText).filter(Boolean),
      imageUrl: propValue('image'),
    },
    genericSteps,
  }
}

function extractMicrodata($: CheerioAPI): ExtractedRecipe | null {
  const result = parseMicrodata($)
  if (!result || result.genericSteps.length === 0) return null
  return { ...result.metadata, steps: result.genericSteps }
}

// ----- site-specific extractors -----

/**
 * aniagotuje.pl has two markup generations:
 * - newer recipes: one HowToStep element per step ("Krok 1..N" with
 *   itemprop="name"/"text") — handled by the generic microdata steps;
 * - older recipes: a single itemprop="recipeInstructions" div wrapping the
 *   ENTIRE article body (intro, ads, nutrition, the ingredients section, step
 *   paragraphs and bare text nodes), where the generic handling would produce
 *   garbage — strip the junk and collect the remaining text blocks as steps.
 */
function extractAniaGotuje($: CheerioAPI): ExtractedRecipe | null {
  const result = parseMicrodata($)
  if (!result) return null

  const hasHowToSteps = $('[itemprop="recipeInstructions"]').toArray().some((el) =>
    ($(el).attr('itemtype') ?? '').includes('HowToStep'),
  )
  if (hasHowToSteps && result.genericSteps.length > 0) {
    return { ...result.metadata, steps: result.genericSteps }
  }

  const container = $('[itemprop="recipeInstructions"]').first().clone()
  if (container.length === 0) return null
  container
    .find(
      '.article-intro, .ads-slot-article, .ad-slot, .img-placeholder, #recipeIngredients, ' +
        '.recipe-info, .nutrition-info, h2, h3, figure, img, script, style, ' +
        '.post-ingredients, .copy-share-lock-con, button, .btn',
    )
    .remove()

  // Emit one block per paragraph/list item/bare text node, in document order
  // (step text alternates between <p> tags and text nodes separated by <br>).
  const steps: string[] = []
  const walk = (nodes: ReturnType<typeof container.contents>): void => {
    nodes.each((_, node) => {
      if (node.type === 'text') {
        const t = cleanText($(node).text())
        if (t) steps.push(t)
        return
      }
      if (node.type !== 'tag') return
      if (node.name === 'p' || node.name === 'li') {
        const t = cleanText($(node).text())
        if (t) steps.push(t)
        return
      }
      walk($(node).contents())
    })
  }
  walk(container.contents())

  if (steps.length === 0) return null
  return { ...result.metadata, steps }
}

/**
 * kwestiasmaku.com (Drupal 7) has no JSON-LD and only thin microdata
 * (description/image/rating) — the actual content lives in Drupal field markup.
 */
function extractKwestiaSmaku($: CheerioAPI): ExtractedRecipe | null {
  const title =
    cleanText($('div[itemprop="name"] h1').first().text()) ||
    cleanText($('h1.przepis').first().text())
  const ingredients = $('.field-name-field-skladniki li')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean)
  const steps = $('.field-name-field-przygotowanie li')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean)
  if (!title || ingredients.length === 0 || steps.length === 0) return null

  const description = cleanText($('span[itemprop="description"]').first().text()) || undefined
  const servingsText = cleanText($('.field-name-field-ilosc-porcji').first().text()) || undefined
  const categories = $('.field-name-field-przepisy a')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean)
  const tags = $('.field-name-field-tagi a')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean)

  return {
    title,
    description,
    servingsText,
    ingredients,
    steps,
    categories,
    tags,
    imageUrl: $('img[itemprop="image"]').first().attr('src'),
  }
}

// ----- parse cascade -----

function parseRecipe(
  $: CheerioAPI,
  site: SiteConfig,
): { parser: RawRecipe['parser']; data: ExtractedRecipe } | null {
  const fromJsonLd = extractJsonLd($)
  if (fromJsonLd) return { parser: 'json-ld', data: fromJsonLd }
  if (site.extract) {
    const fromSite = site.extract($)
    if (fromSite) return { parser: 'site-specific', data: fromSite }
  }
  const fromMicrodata = extractMicrodata($)
  if (fromMicrodata) return { parser: 'microdata', data: fromMicrodata }
  return null
}

// ----- CLI -----

interface CliArgs {
  site: string
  limit: number
}

function parseArgs(argv: string[]): CliArgs {
  let site = 'aniagotuje'
  let limit = 50
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--site') site = argv[++i] ?? ''
    else if (arg === '--limit') limit = Number(argv[++i] ?? '')
    else if (arg?.startsWith('--site=')) site = arg.slice('--site='.length)
    else if (arg?.startsWith('--limit=')) limit = Number(arg.slice('--limit='.length))
    else {
      console.error(`Unknown argument: ${arg}`)
      console.error('Usage: pnpm scrape-recipes --site <id> --limit <n>')
      process.exit(1)
    }
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('--limit must be a positive number')
    process.exit(1)
  }
  return { site, limit }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ----- main -----

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const site = SITES[args.site]
  if (!site) {
    console.error(`Unknown site "${args.site}". Available: ${Object.keys(SITES).join(', ')}`)
    process.exit(1)
  }

  const outDir = resolve(process.cwd(), 'data', 'raw-recipes')
  mkdirSync(outDir, { recursive: true })

  // robots.txt: honor Disallow + Crawl-delay. Unreachable robots → default rules.
  let robots: RobotsRules = { disallow: [], crawlDelayMs: null }
  try {
    const robotsTxt = await fetchText(new URL('/robots.txt', site.baseUrl).href, site.userAgent)
    robots = parseRobots(robotsTxt, site.userAgent)
  } catch (err) {
    console.warn(`[${site.id}] robots.txt not readable (${errMessage(err)}); using defaults`)
  }

  const delayMs = Math.max(site.minDelayMs, robots.crawlDelayMs ?? 0)
  const throttle = createThrottle(delayMs)
  console.log(
    `[${site.id}] limit=${args.limit}, rate limit: 1 req / ${delayMs / 1000}s` +
      (robots.crawlDelayMs ? ' (robots.txt Crawl-delay)' : ''),
  )

  const counters: Counters = {
    discovered: 0,
    downloaded: 0,
    cachedSkip: 0,
    noRecipeData: 0,
    robotsBlocked: 0,
    fetchErrors: 0,
  }

  const discovery = site.discovery
  const urls =
    discovery.kind === 'sitemap'
      ? await discoverFromSitemap(
          discovery.url,
          discovery.urlFilter,
          site.userAgent,
          throttle,
          args.limit,
        )
      : await discoverFromListings(
          site,
          discovery.listingUrls,
          discovery.recipeLinkFilter,
          robots,
          throttle,
          args.limit,
          counters,
        )
  counters.discovered = urls.length
  console.log(`[${site.id}] discovered ${urls.length} recipe urls`)

  for (const url of urls) {
    const hash = contentHashOf(url)
    const outPath = join(outDir, `${hash}.json`)
    if (existsSync(outPath)) {
      counters.cachedSkip++
      continue
    }
    if (!isAllowedByRobots(url, robots)) {
      counters.robotsBlocked++
      continue
    }
    await throttle()
    let html: string
    try {
      html = await fetchText(url, site.userAgent)
    } catch (err) {
      counters.fetchErrors++
      console.warn(`[${site.id}] fetch failed: ${url}: ${errMessage(err)}`)
      continue
    }
    const parsed = parseRecipe(load(html), site)
    if (!parsed) {
      counters.noRecipeData++
      console.warn(`[${site.id}] no recipe data: ${url}`)
      continue
    }
    const raw: RawRecipe = {
      contentHash: hash,
      sourceUrl: url,
      siteId: site.id,
      fetchedAt: new Date().toISOString(),
      parser: parsed.parser,
      ...parsed.data,
    }
    writeFileSync(outPath, JSON.stringify(raw, null, 2), 'utf8')
    counters.downloaded++
    console.log(`[${site.id}] ✓ ${raw.title} (${parsed.parser})`)
  }

  console.log(
    `Scrape done [${site.id}]: discovered ${counters.discovered}, ` +
      `downloaded ${counters.downloaded}, cached-skip ${counters.cachedSkip}, ` +
      `no-recipe-data ${counters.noRecipeData}, robots-blocked ${counters.robotsBlocked}, ` +
      `fetch-errors ${counters.fetchErrors}`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[scrape-recipes] fatal:', err)
  process.exit(1)
})
