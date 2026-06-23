import { useRef, useState } from 'react'
import { uploadDocuments } from '../api'

export function FileUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setMsg(null)
    try {
      const { results } = await uploadDocuments(Array.from(files))
      const ok = results.filter((r) => r.ok).length
      const failed = results.filter((r) => !r.ok)
      setMsg(
        failed.length
          ? `${ok} uploaded · ${failed.length} failed (${failed
              .map((f) => f.filename)
              .join(', ')})`
          : `${ok} document${ok > 1 ? 's' : ''} uploaded`
      )
      onUploaded()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition ${
          dragging
            ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10'
            : 'border-slate-300 bg-white hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-indigo-500'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <svg className="mb-2 h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {busy ? 'Processing…' : 'Drop files or click to upload'}
        </p>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">PDF, DOCX, TXT, MD, CSV, JSON · multiple allowed</p>
      </div>
      {msg && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{msg}</p>}
    </div>
  )
}
