import { useState } from 'react'
import type { DocumentMeta } from '../types'

const statusStyles: Record<DocumentMeta['status'], string> = {
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  processing: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  failed: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
}

interface Props {
  documents: DocumentMeta[]
  selected: Set<string>
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onInspectText?: (doc: DocumentMeta) => void
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function DocumentList({ documents, selected, onToggle, onDelete, onInspectText }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (documents.length === 0) {
    return <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No documents yet. Upload some to start.</p>
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-slate-400">
        {selected.size === 0
          ? 'Searching all documents'
          : `Searching ${selected.size} selected`}
      </p>
      {documents.map((doc) => {
        const isSel = selected.has(doc._id)
        const isExp = expandedId === doc._id
        const ext = doc.filename.split('.').pop()?.toUpperCase() || 'FILE'
        const dateStr = new Date(doc.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        return (
          <div
            key={doc._id}
            onClick={() => toggleExpand(doc._id)}
            className={`group flex flex-col rounded-md border p-3 transition cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 ${
              isSel
                ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isSel}
                disabled={doc.status !== 'ready'}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggle(doc._id)}
                className="h-4 w-4 flex-none accent-indigo-600 disabled:opacity-40"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200" title={doc.filename}>
                  {doc.filename}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
                  <span className="font-semibold text-indigo-600 text-[10px]">{ext}</span>
                  <span>•</span>
                  <span>{formatBytes(doc.size)}</span>
                  <span>•</span>
                  <span className={`rounded border px-1.5 py-0.2 text-[9px] font-semibold tracking-wide uppercase ${statusStyles[doc.status]}`}>
                    {doc.status}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(doc._id)
                }}
                className="flex-none rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition dark:text-slate-500 dark:hover:bg-rose-500/10"
                title="Delete"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>

            {/* Live Progress Stage (shown in compact view too) */}
            {doc.status === 'processing' && doc.statusStep && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-500/10 rounded px-2 py-1 border border-amber-100/50 dark:border-amber-500/20">
                <svg className="animate-spin h-3 w-3 text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="animate-pulse">{doc.statusStep}</span>
              </div>
            )}

            {/* Error Detail Display */}
            {doc.status === 'failed' && doc.error && (
              <div className="mt-2 text-[10px] text-rose-500 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-500/10 rounded px-2 py-1 border border-rose-100/50 dark:border-rose-500/20 break-words">
                Err: {doc.error}
              </div>
            )}

            {/* Expanded Detailed Metadata Panel */}
            {isExp && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-md p-2">
                <div className="flex justify-between">
                  <span>MIME Type:</span>
                  <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">{doc.mimeType || 'unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{formatBytes(doc.size)} ({doc.size?.toLocaleString()} B)</span>
                </div>
                {doc.status === 'ready' && (
                  <>
                    <div className="flex justify-between">
                      <span>Total Chunks:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{doc.chunkCount} chunks</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Char Count:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{doc.charCount?.toLocaleString()} chars</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span>Uploaded:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{dateStr}</span>
                </div>

                {doc.status === 'ready' && onInspectText && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onInspectText(doc)
                    }}
                    className="mt-2 w-full py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-700 transition"
                  >
                    View Extracted OCR Text →
                  </button>
                )}

                {/* Skipped URLs (web crawls) — things not pulled into the document. */}
                {!!doc.skippedUrls?.length && (
                  <div className="mt-2 border-t border-slate-200/60 dark:border-slate-700 pt-2">
                    <p className="mb-1 font-semibold text-slate-500 dark:text-slate-400">
                      Skipped ({doc.skippedUrls.length})
                    </p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto">
                      {doc.skippedUrls.map((s, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                            title={s.url}
                          >
                            {s.url}
                          </a>
                          <span className="flex-none rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 dark:border-slate-700">
                            {s.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
