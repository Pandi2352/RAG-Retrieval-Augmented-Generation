import type { DocumentMeta } from '../types'

interface Props {
  open: boolean
  documents: DocumentMeta[]
  onClose: () => void
}

interface RadarItem {
  label: string
  date: string
  type?: string
  filename: string
  parsed: Date | null
  daysUntil: number | null
}

// Parse partial ISO dates. Year-only → Dec 31; month-only → last day of month.
function parseDate(s: string): Date | null {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s)
  if (!m) return null
  const y = +m[1]
  if (!m[2]) return new Date(y, 11, 31)
  const mo = +m[2] - 1
  if (!m[3]) return new Date(y, mo + 1, 0)
  const d = new Date(y, mo, +m[3])
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(target: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function buildItems(documents: DocumentMeta[]): RadarItem[] {
  const items: RadarItem[] = []
  for (const doc of documents) {
    for (const kd of doc.keyDates || []) {
      const parsed = parseDate(kd.date)
      items.push({
        label: kd.label,
        date: kd.date,
        type: kd.type,
        filename: doc.filename,
        parsed,
        daysUntil: parsed ? daysBetween(parsed) : null,
      })
    }
  }
  // Soonest / overdue first; undated last.
  return items.sort((a, b) => {
    if (a.parsed && b.parsed) return a.parsed.getTime() - b.parsed.getTime()
    if (a.parsed) return -1
    if (b.parsed) return 1
    return 0
  })
}

// Count of items needing attention (overdue or within 90 days) — for the badge.
export function radarAttentionCount(documents: DocumentMeta[]): number {
  return buildItems(documents).filter((i) => i.daysUntil !== null && i.daysUntil <= 90).length
}

function severity(daysUntil: number | null) {
  if (daysUntil === null)
    return { dot: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-400', when: '' }
  if (daysUntil < 0)
    return {
      dot: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      when: `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`,
    }
  if (daysUntil <= 30)
    return {
      dot: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      when: daysUntil === 0 ? 'Today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    }
  if (daysUntil <= 90)
    return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', when: `in ${daysUntil} days` }
  return { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', when: `in ${daysUntil} days` }
}

export function RadarDrawer({ open, documents, onClose }: Props) {
  const items = buildItems(documents)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-slate-200 bg-white transition-transform duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              📡 Document Radar
            </h2>
            <p className="text-xs text-slate-400">Upcoming dates &amp; deadlines</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <span className="mb-2 text-2xl">🗓️</span>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No dates found yet</p>
              <p className="mt-1 text-xs">Upload documents with expiry or due dates to see them here.</p>
            </div>
          ) : (
            items.map((item, i) => {
              const sev = severity(item.daysUntil)
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${sev.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={item.label}>
                        {item.label}
                      </p>
                      {item.type && item.type !== 'other' && (
                        <span className="flex-none rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-medium uppercase text-slate-400 dark:border-slate-700">
                          {item.type}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className={`font-semibold ${sev.text}`}>{sev.when || item.date}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-400">{item.date}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400" title={item.filename}>
                      📄 {item.filename}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
