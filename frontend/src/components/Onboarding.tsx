import { useState } from 'react'

const STORAGE_KEY = 'folio_onboarded'

const STEPS = [
  { icon: '📄', title: 'Upload documents', text: 'Drag & drop PDFs, Word docs, or text files — even scanned PDFs (OCR included).' },
  { icon: '💬', title: 'Ask anything', text: 'Get answers grounded in your documents, with cited sources for every claim.' },
  { icon: '📡', title: 'Document Radar', text: 'Folio tracks expiry & due dates across your documents so nothing slips.' },
  { icon: '🔊', title: 'Listen & translate', text: 'Read any answer aloud or translate it into 5 languages.' },
]

export function Onboarding() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY)
    } catch {
      return false
    }
  })

  if (!show) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">🪶 Welcome to Folio</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Chat with your documents — grounded answers, cited sources.
        </p>

        <ul className="mt-5 space-y-3">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3">
              <span className="text-lg leading-none">{s.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={dismiss}
          className="mt-6 w-full rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Get started
        </button>
      </div>
    </div>
  )
}
