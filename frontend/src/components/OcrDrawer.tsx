import { useEffect, useState } from 'react'
import type { DocumentMeta } from '../types'
import { getDocumentChunks } from '../api'

interface Props {
  doc: DocumentMeta | null
  onClose: () => void
}

export function OcrDrawer({ doc, onClose }: Props) {
  const [chunks, setChunks] = useState<{ text: string; chunkIndex: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!doc) {
      setChunks([])
      setError(null)
      return
    }

    async function loadChunks() {
      setLoading(true)
      setError(null)
      try {
        const data = await getDocumentChunks(doc!._id)
        setChunks(data.sort((a, b) => a.chunkIndex - b.chunkIndex))
      } catch (err: any) {
        setError(err.message || 'Failed to load text')
      } finally {
        setLoading(false)
      }
    }

    loadChunks()
  }, [doc])

  // Reset copied status after 2 seconds
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = () => {
    const fullText = chunks.map((c) => c.text).join('\n\n')
    navigator.clipboard.writeText(fullText)
    setCopied(true)
  }

  // Slide drawer: translate-x-full hides it off-screen, translate-x-0 slides it in.
  const isOpen = !!doc

  return (
    <>
      {/* Backdrop overlay (semi-transparent, fade-in/out) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Slide-out Drawer Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[500px] max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={doc?.filename}>
              {doc?.filename}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Extracted OCR Transcription</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {chunks.length > 0 && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-md border border-indigo-200 transition dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30"
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy All
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Close drawer"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
              <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs font-medium">Loading extracted text...</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-md p-4 text-xs text-rose-500 dark:text-rose-400">
              {error}
            </div>
          )}

          {!loading && !error && chunks.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">No text extracted for this document.</p>
          )}

          {!loading && !error && chunks.map((c, idx) => (
            <div key={c.chunkIndex || idx} className="space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-4 last:border-b-0">
              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded uppercase tracking-wider">
                Chunk {idx + 1}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap select-text bg-slate-50/50 dark:bg-slate-800/50 rounded-md p-3 border border-slate-100/50 dark:border-slate-700">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
