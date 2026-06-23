import { CheerioCrawler, Configuration } from '@crawlee/cheerio'

// Safety ceiling when "Max Pages" is left blank, so a crawl can't run away.
const DEFAULT_PAGE_CAP = Number(process.env.CRAWL_MAX_PAGES_CAP || 100)

// Links to binary/asset files: can't be rendered as HTML pages, so don't follow
// them (in a browser these trigger a download and crash page.goto).
const ASSET_EXCLUDE = [
  /\.(pdf|zips?|docx?|xlsx?|pptx?|csv|rtf|odt|png|jpe?g|gif|svg|webp|bmp|ico|mp4|webm|mp3|wav|woff2?|ttf|eot|css|js|json|xml|rss|zip|rar|7z|tar|gz)(\?.*)?$/i,
]

// File extensions whose text `extractText` can actually read.
const SUPPORTED_IMPORT_EXTS = new Set(['pdf', 'docx', 'doc', 'csv', 'txt', 'md'])
// UI "File Types" → extensions.
const TYPE_TO_EXTS = {
  PDF: ['pdf'],
  DOCX: ['docx', 'doc'],
  CSV: ['csv'],
  TXT: ['txt', 'md'],
}

// Which extensions to import: blank selection ⇒ every supported type.
function resolveImportExts(fileTypes) {
  if (!fileTypes || !fileTypes.length) return new Set(SUPPORTED_IMPORT_EXTS)
  const set = new Set()
  for (const t of fileTypes) {
    for (const e of TYPE_TO_EXTS[String(t).toUpperCase()] || []) {
      if (SUPPORTED_IMPORT_EXTS.has(e)) set.add(e)
    }
  }
  return set
}

// Classify a link the crawler won't follow, with a human reason + kind.
// Returns null for same-host HTML pages (crawled) and un-actionable links.
function classifyLink(href, base, startHost) {
  if (!href) return null
  const h = href.trim()
  if (!h || h.startsWith('#')) return null
  if (/^mailto:/i.test(h)) return { url: h, reason: 'email link', kind: 'contact' }
  if (/^tel:/i.test(h)) return { url: h, reason: 'phone link', kind: 'contact' }
  if (/^(javascript:|data:)/i.test(h)) return null
  let abs
  try {
    abs = new URL(h, base)
  } catch {
    return null
  }
  if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null
  if (abs.hostname !== startHost) return { url: abs.href, reason: 'external site', kind: 'external' }
  if (ASSET_EXCLUDE.some((re) => re.test(abs.pathname))) {
    const m = abs.pathname.match(/\.([a-z0-9]+)$/i)
    const ext = m ? m[1].toLowerCase() : ''
    return { url: abs.href, reason: ext ? `file (${ext})` : 'file', kind: 'file', ext }
  }
  return null // same-host HTML page → crawled, not skipped
}

// Pull readable text out of a Cheerio document.
function extractFromCheerio($) {
  $('script, style, noscript, nav, footer, header, svg, iframe, aside').remove()
  const title = ($('title').first().text() || $('h1').first().text() || '').trim()
  const text = ($('body').text() || '').replace(/\s+/g, ' ').trim()
  return { title, text }
}

/**
 * Crawl a website (static HTML, or JS-rendered via headless Chromium) and
 * return the readable text of each visited page. Same-hostname links only.
 *
 * options: { maxDepth, maxPages, concurrency, requestDelayMs, respectRobots, jsRendering }
 * Returns: [{ url, title, text }]
 */
export async function crawlWebsite(
  {
    startUrl,
    maxDepth = null,
    maxPages = null,
    concurrency = null,
    requestDelayMs = null,
    respectRobots = true,
    jsRendering = false,
    fileTypes = null,
  },
  onProgress
) {
  // eslint-disable-next-line no-new
  new URL(startUrl) // validate up front

  const pages = []
  const skipped = []
  const skippedSeen = new Set()
  const files = []
  const fileSeen = new Set()
  const importExts = resolveImportExts(fileTypes)
  const startHost = new URL(startUrl).hostname
  const pageCap = maxPages && maxPages > 0 ? maxPages : DEFAULT_PAGE_CAP

  const commonOptions = {
    maxRequestsPerCrawl: pageCap,
    respectRobotsTxtFile: !!respectRobots,
    ...(concurrency && concurrency > 0 ? { maxConcurrency: concurrency } : {}),
    ...(requestDelayMs && requestDelayMs > 0
      ? { sameDomainDelaySecs: Math.max(requestDelayMs / 1000, 0.1) }
      : {}),
    failedRequestHandler: ({ request }, err) => {
      console.warn(`[crawl] failed ${request.url}: ${err?.message}`)
    },
  }

  // Shared per-page logic: collect text + enqueue same-hostname links by depth.
  const handlePage = async ($, request, enqueueLinks) => {
    // Collect links FIRST — extractFromCheerio() strips nav/header/footer, which
    // often contain the links we want to report (e.g. a header "Download" PDF).
    $('a[href]').each((_, el) => {
      const item = classifyLink($(el).attr('href'), request.url, startHost)
      if (!item) return
      // Importable file of a selected type → queue for download/extraction.
      if (item.kind === 'file' && importExts.has(item.ext)) {
        if (!fileSeen.has(item.url)) {
          fileSeen.add(item.url)
          files.push({ url: item.url, ext: item.ext })
        }
      } else if (!skippedSeen.has(item.url)) {
        skippedSeen.add(item.url)
        skipped.push({ url: item.url, reason: item.reason })
      }
    })

    const { title, text } = extractFromCheerio($)
    if (text.length > 30) pages.push({ url: request.url, title, text })
    if (onProgress) await onProgress(`Crawling… ${pages.length} page(s) read`)

    const depth = request.userData?.depth ?? 0
    if (maxDepth == null || depth < maxDepth) {
      await enqueueLinks({
        strategy: 'same-hostname',
        exclude: ASSET_EXCLUDE,
        userData: { depth: depth + 1 },
      })
    }
  }

  let crawler
  if (jsRendering) {
    // JS-heavy sites: drive a headless browser so client-rendered content loads.
    console.log('[crawl] using PlaywrightCrawler (JavaScript rendering on)')
    const { PlaywrightCrawler, Configuration: PwConfiguration } = await import('@crawlee/playwright')
    crawler = new PlaywrightCrawler(
      {
        ...commonOptions,
        requestHandler: async ({ request, page, parseWithCheerio, enqueueLinks }) => {
          // Let client-rendered (React/Vue/…) content finish loading.
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
          const $ = await parseWithCheerio()
          await handlePage($, request, enqueueLinks)
        },
      },
      new PwConfiguration({ persistStorage: false })
    )
  } else {
    // Fast path: plain HTTP fetch + HTML parse.
    crawler = new CheerioCrawler(
      {
        ...commonOptions,
        requestHandler: async ({ request, $, enqueueLinks }) => {
          await handlePage($, request, enqueueLinks)
        },
      },
      new Configuration({ persistStorage: false })
    )
  }

  await crawler.run([{ url: startUrl, userData: { depth: 0 } }])
  return { pages, skipped, files }
}
