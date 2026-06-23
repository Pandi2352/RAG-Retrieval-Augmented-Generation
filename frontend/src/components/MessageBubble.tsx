import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import { Sources } from './Sources'

// Lets the inline [n] citation badges trigger the bubble's source-highlight
// handler without threading a callback through every markdown helper.
const CiteContext = createContext<((n: number) => void) | null>(null)

function Citation({ n }: { n: number }) {
  const onCite = useContext(CiteContext)
  const cls =
    'mx-0.5 rounded bg-indigo-50 px-1 py-0.5 align-super text-[9px] font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
  if (!onCite) return <sup className={cls}>{n}</sup>
  return (
    <button type="button" onClick={() => onCite(n)} className={`${cls} cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/40`} title="Jump to source">
      {n}
    </button>
  )
}

const TRANSLATE_LANGS = ['English', 'Tamil', 'Hindi', 'Spanish', 'French']

// Convert markdown to clean prose for text-to-speech (drop symbols, bullets,
// citation markers, table pipes, etc. so they aren't read aloud).
function toSpeechText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // drop fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> link text
    .replace(/\[\d+\]/g, '') // citation markers [1]
    .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, '') // table separator rows
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, '') // numbered list markers
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1') // underscore emphasis
    .replace(/\|/g, ', ') // remaining table cells -> pauses
    .replace(/[#*_~`>]/g, '') // any stray markdown symbols
    .replace(/\n{2,}/g, '. ') // paragraph breaks -> pause
    .replace(/\s*\n\s*/g, '. ') // line breaks -> pause
    .replace(/\.{2,}/g, '.') // collapse repeated periods
    .replace(/\s+/g, ' ')
    .trim()
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-md overflow-hidden border border-slate-800 bg-slate-900 text-slate-100">
      {/* Code Header */}
      <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 text-[10px] font-mono text-slate-400 select-none">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-indigo-300 transition text-slate-400"
          title="Copy Code"
        >
          {copied ? (
            <>
              <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code Area */}
      <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed select-text bg-slate-900/60 max-h-[300px]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function formatInlineText(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[\d+\])/g
  const parts = text.split(regex)
  return parts.map((part, i) => {
    // Citation marker like [1] → clickable superscript badge (jumps to source).
    if (/^\[\d+\]$/.test(part)) {
      return <Citation key={i} n={Number(part.slice(1, -1))} />
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic text-slate-800 dark:text-slate-300">
          {part.slice(1, -1)}
        </em>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-slate-100 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-600"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function parseBlocks(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null
  let currentTable: string[][] | null = null

  const flushList = (key: number) => {
    if (currentList) {
      const Tag = currentList.type
      elements.push(
        <Tag
          key={`list-${key}`}
          className={
            Tag === 'ul'
              ? 'list-disc pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300'
              : 'list-decimal pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300'
          }
        >
          {currentList.items.map((item, idx) => (
            <li key={idx} className="text-xs leading-relaxed">
              {formatInlineText(item)}
            </li>
          ))}
        </Tag>
      )
      currentList = null
    }
  }

  const flushTable = (key: number) => {
    if (currentTable) {
      const rows = currentTable.filter((r) => !r.every((c) => c.trim().match(/^:?-+:?$/)))
      if (rows.length > 0) {
        const headers = rows[0]
        const bodyRows = rows.slice(1)
        elements.push(
          <div key={`table-wrapper-${key}`} className="my-3 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-md">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {headers.map((h, idx) => (
                    <th
                      key={idx}
                      className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                    >
                      {formatInlineText(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3 py-2 text-slate-650 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 last:border-r-0 max-w-[200px] truncate"
                        title={cell.trim()}
                      >
                        {formatInlineText(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      currentTable = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 1. Table parser
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList(i)
      const cells = line.split('|').slice(1, -1)
      if (!currentTable) currentTable = []
      currentTable.push(cells)
      continue
    } else {
      flushTable(i)
    }

    // 2. List parser
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.*)$/)
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)$/)

    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(i)
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(ulMatch[1])
      continue
    } else if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(i)
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(olMatch[1])
      continue
    } else {
      flushList(i)
    }

    // 3. Header parser
    const h3Match = line.match(/^###\s+(.*)$/)
    const h2Match = line.match(/^##\s+(.*)$/)
    const h1Match = line.match(/^#\s+(.*)$/)

    if (h3Match) {
      elements.push(
        <h3 key={i} className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1">
          {formatInlineText(h3Match[1])}
        </h3>
      )
    } else if (h2Match) {
      elements.push(
        <h2 key={i} className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-4 mb-1.5 border-b border-slate-100 dark:border-slate-700 pb-1">
          {formatInlineText(h2Match[1])}
        </h2>
      )
    } else if (h1Match) {
      elements.push(
        <h1 key={i} className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-4 mb-2">
          {formatInlineText(h1Match[1])}
        </h1>
      )
    } else if (line.trim()) {
      elements.push(
        <p key={i} className="text-xs leading-relaxed text-slate-650 dark:text-slate-400 my-1">
          {formatInlineText(line)}
        </p>
      )
    }
  }

  flushList(lines.length)
  flushTable(lines.length)

  return elements
}

function parseMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/)
      const language = match ? match[1] : ''
      const code = match ? match[2] : part.slice(3, -3)
      return <CodeBlock key={index} code={code.trim()} language={language} />
    } else {
      return <React.Fragment key={index}>{parseBlocks(part)}</React.Fragment>
    }
  })
}

interface MessageBubbleProps {
  msg: ChatMessage
  streaming?: boolean
  onRegenerate?: () => void
  onFeedback?: (fb: 'up' | 'down') => void
  onAsk?: (text: string) => void
  onEdit?: (text: string) => void
  onDelete?: () => void
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({ msg, streaming, onRegenerate, onFeedback, onAsk, onEdit, onDelete }: MessageBubbleProps) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [showSources, setShowSources] = useState(false)
  // Citation click → open & highlight a source (k bumps to re-trigger same n).
  const [cite, setCite] = useState<{ n: number; k: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const contentRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)
  // Floating highlight-to-action toolbar over a text selection.
  const [sel, setSel] = useState<{ text: string; top: number; left: number } | null>(null)
  const [translateOpen, setTranslateOpen] = useState(false)
  // Read-aloud (TTS) + per-answer translate menu.
  const [speaking, setSpeaking] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeToolbar = () => {
    setSel(null)
    setTranslateOpen(false)
  }

  const onContentMouseUp = () => {
    if (isUser || !onAsk) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return
    const text = selection.toString().trim()
    if (text.length < 2) return
    if (contentRef.current && !contentRef.current.contains(selection.anchorNode)) return
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    setTranslateOpen(false)
    setSel({ text, top: rect.top, left: rect.left + rect.width / 2 })
  }

  // Dismiss the toolbar on outside click or scroll.
  useEffect(() => {
    if (!sel) return
    const onDocDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) closeToolbar()
    }
    const onScroll = () => closeToolbar()
    document.addEventListener('mousedown', onDocDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [sel])

  const runAction = (prompt: string) => {
    onAsk?.(prompt)
    window.getSelection()?.removeAllRanges()
    closeToolbar()
  }

  // Read the answer aloud via the Web Speech API. Toggles on/off.
  const toggleSpeak = () => {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    synth.cancel()
    const speech = toSpeechText(msg.content)
    if (!speech) return
    const utter = new SpeechSynthesisUtterance(speech)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(utter)
  }

  // Stop speech and close the language menu on unmount / outside click.
  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    if (!langOpen) return
    const onDocDown = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [langOpen])

  const handleCite = (n: number) => {
    if (!msg.sources?.length || n < 1 || n > msg.sources.length) return
    setShowSources(true)
    setCite((c) => ({ n, k: (c?.k || 0) + 1 }))
  }

  const hasSources = !isUser && !!msg.sources?.length
  // Action bar appears under completed assistant answers only.
  const showActions = !isUser && !!msg.content && !streaming

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`group flex max-w-[80%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative w-fit rounded-md px-4 py-3 transition border ${
          isUser
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200'
        }`}
      >
        {!isUser && msg.rewritten && (
          <p className="mb-2 text-xs italic text-slate-400 dark:text-slate-500">
            🔍 searched: {msg.rewritten}
          </p>
        )}

        {isUser && editing ? (
          <div className="w-72 max-w-full">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-md border border-indigo-300 bg-white p-2 text-sm text-slate-800 focus:outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false)
                  setDraft(msg.content)
                }}
                className="rounded-md px-2 py-1 text-xs font-medium text-indigo-100 hover:bg-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  onEdit?.(draft)
                }}
                disabled={!draft.trim()}
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                Save &amp; submit
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={contentRef}
            onMouseUp={onContentMouseUp}
            className={`leading-relaxed ${!isUser ? 'text-xs text-slate-650 dark:text-slate-300 space-y-1' : 'text-sm whitespace-pre-wrap'}`}
          >
            {isUser ? (
              msg.content
            ) : (
              <CiteContext.Provider value={handleCite}>{parseMarkdown(msg.content)}</CiteContext.Provider>
            )}
            {streaming && <span className="ml-0.5 inline-block animate-pulse">▋</span>}
          </div>
        )}

        {sel && (
          <div
            ref={toolbarRef}
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'fixed', top: sel.top - 8, left: sel.left, transform: 'translate(-50%, -100%)' }}
            className="z-50 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {translateOpen ? (
              <>
                <span className="px-1.5 text-[11px] text-slate-400">To:</span>
                {TRANSLATE_LANGS.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => runAction(`Translate the following to ${lang}:\n\n"${sel.text}"`)}
                    className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {lang}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button
                  onClick={() => runAction(`Explain this part of your previous answer in more detail:\n\n"${sel.text}"`)}
                  className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Explain
                </button>
                <button
                  onClick={() => runAction(`Simplify this and explain it in plain, simple language:\n\n"${sel.text}"`)}
                  className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Simplify
                </button>
                <button
                  onClick={() => setTranslateOpen(true)}
                  className="flex items-center gap-0.5 rounded px-2 py-1 font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Translate
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {showActions && (
          <div className="mt-2 flex items-center gap-1 border-t border-slate-100 dark:border-slate-700 pt-2 text-slate-400 dark:text-slate-500">
            <button
              onClick={handleCopy}
              title="Copy"
              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {copied ? (
                <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
            </button>

            {onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate"
                className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            )}

            {onFeedback && (
              <>
                <button
                  onClick={() => onFeedback('up')}
                  title="Good response"
                  className={`rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    msg.feedback === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill={msg.feedback === 'up' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14 9h-4m0 0V5.5m0 3.5h4m-7.5 1.5v8.25c0 .621-.504 1.125-1.125 1.125h-1.5A1.125 1.125 0 013 18.75V10.5c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125z" />
                  </svg>
                </button>
                <button
                  onClick={() => onFeedback('down')}
                  title="Bad response"
                  className={`rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    msg.feedback === 'down' ? 'text-rose-600 dark:text-rose-400' : 'hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill={msg.feedback === 'down' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 00.303-.54m.023-8.25H16.48a4.5 4.5 0 01-1.423-.23l-3.114-1.04a4.5 4.5 0 00-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 002.25 12c0 .434.023.863.068 1.285C2.427 14.306 3.346 15 4.372 15h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.5a2.25 2.25 0 002.25 2.25.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
                  </svg>
                </button>
              </>
            )}

            {/* Read aloud (TTS) */}
            <button
              onClick={toggleSpeak}
              title={speaking ? 'Stop' : 'Read aloud'}
              className={`rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                speaking ? 'text-indigo-600 dark:text-indigo-400' : 'hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {speaking ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="6" y="6" width="12" height="12" rx="1.5" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
            </button>

            {/* Translate whole answer */}
            {onAsk && (
              <div ref={langMenuRef} className="relative">
                <button
                  onClick={() => setLangOpen((o) => !o)}
                  title="Translate"
                  className={`flex items-center gap-0.5 rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    langOpen ? 'text-indigo-600 dark:text-indigo-400' : 'hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                </button>
                {langOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[8rem] rounded-md border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Translate to
                    </p>
                    {TRANSLATE_LANGS.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLangOpen(false)
                          onAsk(`Translate your previous answer to ${lang}:\n\n"${msg.content}"`)
                        }}
                        className="block w-full rounded px-2 py-1 text-left font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete"
                className="rounded-md p-1.5 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}

            {hasSources && (
              <button
                onClick={() => setShowSources((s) => !s)}
                className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showSources ? 'Hide' : 'Sources'} ({msg.sources!.length})
              </button>
            )}
          </div>
        )}

        {hasSources && showSources && <Sources sources={msg.sources!} highlight={cite} />}
      </div>

      {/* Footer: timestamp + (user) edit/delete on hover */}
      <div className={`mt-1 flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!editing && msg.createdAt && (
          <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
        )}
        {isUser && !editing && (onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={() => {
                  setDraft(msg.content)
                  setEditing(true)
                }}
                title="Edit"
                className="rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-700"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-2.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete"
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
