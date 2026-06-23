import { useState } from 'react'
import type { Source } from '../types'

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources?.length) return null

  // Global accordion toggle state (starts closed for clean chat UI)
  const [globalOpen, setGlobalOpen] = useState(false)
  
  // Keep track of which source indexes (s.n) are expanded.
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())

  const toggle = (n: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(n)) {
        next.delete(n)
      } else {
        next.add(n)
      }
      return next
    })
  }

  const allOpen = openIds.size === sources.length
  const toggleAll = () => {
    if (allOpen) {
      setOpenIds(new Set())
    } else {
      setOpenIds(new Set(sources.map((s) => s.n)))
    }
  }

  // Handle snippet copy-to-clipboard state
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const copySnippet = (n: number, snippet: string) => {
    navigator.clipboard.writeText(snippet)
    setCopiedId(n)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="mt-3 border-t border-slate-200/80 dark:border-slate-700 pt-3">
      {/* Global Accordion Trigger */}
      <div
        onClick={() => setGlobalOpen(!globalOpen)}
        className="flex cursor-pointer items-center gap-1.5 py-1 text-slate-400 hover:text-slate-600 transition select-none w-fit"
      >
        <svg
          className={`h-3 w-3 transition-transform duration-200 ${
            globalOpen ? 'rotate-90 text-indigo-500' : 'text-slate-400'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Sources ({sources.length})
        </span>
      </div>

      {/* Global Accordion Content */}
      {globalOpen && (
        <div className="mt-2.5 space-y-2">
          {sources.length > 1 && (
            <div className="flex justify-end">
              <button
                onClick={toggleAll}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                {allOpen ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {sources.map((s) => {
              const isOpen = openIds.has(s.n)
              const isCopied = copiedId === s.n

              return (
                <div
                  key={s.n}
                  className={`rounded-md border text-sm transition duration-200 ${
                    isOpen
                      ? 'border-indigo-100 bg-indigo-50/10 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800'
                  }`}
                >
                  {/* Header Toggle */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(s.n)
                    }}
                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded text-[10px] font-bold transition duration-200 ${
                        isOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                      }`}>
                        {s.n}
                      </span>
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200 text-xs" title={s.filename}>
                        {s.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      <span className="rounded bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                        {(s.score * 100).toFixed(0)}% Match
                      </span>
                      <svg
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-indigo-600' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Snippet Details */}
                  {isOpen && (
                    <div className="border-t border-slate-200/40 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 pb-3 pt-2 rounded-b-md">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Snippet Context
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copySnippet(s.n, s.snippet)
                          }}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          {isCopied ? (
                            <>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Copied
                            </>
                          ) : (
                            'Copy'
                          )}
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed bg-slate-50/50 dark:bg-slate-800/50 rounded-md p-2 border border-slate-100/50 dark:border-slate-700 select-text">
                        {s.snippet}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
