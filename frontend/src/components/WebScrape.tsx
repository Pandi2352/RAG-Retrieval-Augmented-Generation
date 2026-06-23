import { useState } from 'react'
import { crawlWebsite } from '../api'

const FILE_TYPES = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'CSV', 'IMAGE', 'ZIP']

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500'

const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-300'
const hintCls = 'mt-1 text-[11px] text-slate-400 dark:text-slate-500'

export function WebScrape({ onCrawlStarted }: { onCrawlStarted: () => void }) {
  const [open, setOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlValid, setUrlValid] = useState<boolean | null>(null)

  const [url, setUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState('')
  const [maxPages, setMaxPages] = useState('')
  const [maxFileSize, setMaxFileSize] = useState('')
  const [concurrency, setConcurrency] = useState('')
  const [requestDelay, setRequestDelay] = useState('')
  const [respectRobots, setRespectRobots] = useState(true)
  const [jsRendering, setJsRendering] = useState(false)

  const reset = () => {
    setUrl('')
    setMaxDepth('')
    setMaxPages('')
    setMaxFileSize('')
    setConcurrency('')
    setRequestDelay('')
    setRespectRobots(true)
    setJsRendering(false)
    setShowAdvanced(false)
    setError(null)
    setUrlValid(null)
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    reset()
  }

  const testUrl = () => {
    try {
      const u = new URL(url.trim())
      setUrlValid(u.protocol === 'http:' || u.protocol === 'https:')
    } catch {
      setUrlValid(false)
    }
  }

  const num = (v: string) => (v.trim() === '' ? null : Number(v))

  const submit = async () => {
    setError(null)
    try {
      new URL(url.trim())
    } catch {
      setError('Please enter a valid http(s) URL')
      return
    }
    setBusy(true)
    try {
      await crawlWebsite({
        url: url.trim(),
        maxDepth: num(maxDepth),
        maxPages: num(maxPages),
        concurrency: num(concurrency),
        requestDelay: num(requestDelay),
        respectRobots,
        jsRendering,
      })
      onCrawlStarted()
      setOpen(false)
      reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.5 2.5-15 0-18m0 18c-2.5-2.5-2.5-15 0-18M3.6 9h16.8M3.6 15h16.8" />
        </svg>
        Add from website
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">🌐 Crawl a website</h2>
                <p className="text-xs text-slate-400">Scrape pages into a document, then embed it.</p>
              </div>
              <button onClick={close} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* URL */}
            <label className={labelCls}>
              Website URL <span className="text-rose-500">*</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setUrlValid(null)
                }}
                placeholder="https://example.com/reports"
                className={inputCls}
              />
              <button
                onClick={testUrl}
                className="flex-none rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Test
              </button>
            </div>
            {urlValid === true && <p className="mt-1 text-[11px] text-emerald-600">✓ Looks valid</p>}
            {urlValid === false && <p className="mt-1 text-[11px] text-rose-500">✗ Not a valid http(s) URL</p>}
            <p className={hintCls}>
              The page where the crawl starts. Only links on this exact domain (hostname) are followed.
            </p>

            {/* Advanced */}
            <button
              onClick={() => setShowAdvanced((s) => !s)}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
            >
              <svg className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Advanced Settings <span className="font-normal text-slate-400">(optional)</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Max Depth</label>
                    <input value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} type="number" min={0} placeholder="No limit" className={inputCls} />
                    <p className={hintCls}>Clicks away from the start URL. Blank = as deep as possible.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Max Pages</label>
                    <input value={maxPages} onChange={(e) => setMaxPages(e.target.value)} type="number" min={1} placeholder="No limit" className={inputCls} />
                    <p className={hintCls}>Total pages to visit. Blank = safety cap (100).</p>
                  </div>
                  <div>
                    <label className={labelCls}>Concurrency</label>
                    <input value={concurrency} onChange={(e) => setConcurrency(e.target.value)} type="number" min={1} placeholder="Auto" className={inputCls} />
                    <p className={hintCls}>Pages fetched in parallel. Blank = engine default.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Request Delay (ms)</label>
                    <input value={requestDelay} onChange={(e) => setRequestDelay(e.target.value)} type="number" min={0} placeholder="No delay" className={inputCls} />
                    <p className={hintCls}>Pause between requests. Blank = as fast as possible.</p>
                  </div>
                  <div className="opacity-60">
                    <label className={labelCls}>Max File Size (MB)</label>
                    <input value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} type="number" min={1} placeholder="No limit" className={inputCls} disabled />
                    <p className={hintCls}>For file imports (coming soon).</p>
                  </div>
                </div>

                {/* File types (placeholder — HTML crawl only for now) */}
                <div className="opacity-60">
                  <label className={labelCls}>File Types to Import</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {FILE_TYPES.map((t) => (
                      <span key={t} className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className={hintCls}>Binary-file import is coming soon — for now the crawler reads page text (HTML).</p>
                </div>

                {/* Robots */}
                <label className="flex items-center gap-2 pt-1">
                  <input type="checkbox" checked={respectRobots} onChange={(e) => setRespectRobots(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Respect robots.txt</span>
                </label>
                <p className={hintCls}>Honour the site's crawl rules. Recommended unless you own the site.</p>

                {/* JS rendering — uses a headless Chromium (Playwright) when enabled */}
                <label className="flex items-center gap-2 pt-1">
                  <input type="checkbox" checked={jsRendering} onChange={(e) => setJsRendering(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">JavaScript Rendering</span>
                </label>
                <p className={hintCls}>
                  Renders pages in a headless browser for JS-heavy sites (React/Vue/etc.). Slower — leave off for static sites.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={close} disabled={busy} className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !url.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Starting…' : 'Start crawl'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
