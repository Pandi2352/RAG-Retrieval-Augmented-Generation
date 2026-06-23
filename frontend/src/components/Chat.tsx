import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { streamChat, getConversation, setMessageFeedback, editMessage, deleteMessage } from '../api'
import type { ChatMessage, DocumentMeta } from '../types'
import { MessageBubble } from './MessageBubble'

// Defensive cleanup for chip text (also fixes suggestions stored before the
// backend parser was hardened): strip wrapping brackets/quotes and whitespace.
function cleanChip(s: string): string {
  return s
    .replace(/^[[\s"'“”]+/, '')
    .replace(/[\]\s"'“”]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Props {
  conversationId: string | null
  selectedIds: string[]
  documents?: DocumentMeta[]
  onConversationCreated: (id: string) => void
  onSelectedDocumentsChange: (ids: string[]) => void
  onConversationUpdated?: () => void
}

export function Chat({
  conversationId,
  selectedIds,
  documents = [],
  onConversationCreated,
  onSelectedDocumentsChange,
  onConversationUpdated,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadedIdRef = useRef<string | null>(null)
  // Sticks the view to the bottom; flipped off when the user scrolls up.
  const autoScrollRef = useRef(true)
  // Live conversation id (prop may lag while a brand-new chat is streaming).
  const convIdRef = useRef<string | null>(conversationId)

  useEffect(() => {
    convIdRef.current = conversationId
  }, [conversationId])

  // Auto-scroll only while pinned to the bottom.
  useEffect(() => {
    if (autoScrollRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages, streaming])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance < 80
    autoScrollRef.current = atBottom
    setShowJump(!atBottom)
  }, [])

  const jumpToBottom = () => {
    autoScrollRef.current = true
    setShowJump(false)
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  // Load message history when conversation ID changes
  useEffect(() => {
    if (!conversationId) {
      loadedIdRef.current = null
      setMessages([])
      return
    }

    if (conversationId === loadedIdRef.current) {
      // Already loaded or just created this session, skip fetching to avoid race conditions during stream
      return
    }

    let active = true
    async function loadHistory() {
      setLoading(true)
      try {
        const data = await getConversation(conversationId!)
        if (!active) return
        setMessages(data.messages || [])
        onSelectedDocumentsChange(data.selectedDocumentIds || [])
        loadedIdRef.current = conversationId
        autoScrollRef.current = true
      } catch (err) {
        console.error('Failed to load conversation history:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHistory()
    return () => {
      active = false
    }
  }, [conversationId, onSelectedDocumentsChange])

  // Shared stream runner for both new messages and regeneration.
  const runStream = useCallback(
    async (userText: string, regenerate: boolean) => {
      if (streaming) return
      autoScrollRef.current = true
      setShowJump(false)

      const now = new Date().toISOString()
      setMessages((m) => {
        if (regenerate) {
          // Replace the trailing assistant answer with a fresh placeholder.
          const copy = [...m]
          if (copy[copy.length - 1]?.role === 'assistant') copy.pop()
          return [...copy, { role: 'assistant', content: '', createdAt: now }]
        }
        return [
          ...m,
          { role: 'user', content: userText, createdAt: now },
          { role: 'assistant', content: '', createdAt: now },
        ]
      })
      setStreaming(true)

      const ctrl = new AbortController()
      abortRef.current = ctrl

      const patchLast = (patch: Partial<ChatMessage>) =>
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch }
          return copy
        })

      try {
        await streamChat(
          userText,
          convIdRef.current,
          selectedIds.length ? selectedIds : undefined,
          {
            onConversationId: (id) => {
              convIdRef.current = id
              if (!conversationId) {
                loadedIdRef.current = id
                onConversationCreated(id)
              }
            },
            onRewritten: (q) => patchLast({ rewritten: q }),
            onSources: (s) => patchLast({ sources: s }),
            onToken: (t) =>
              setMessages((m) => {
                const copy = [...m]
                const last = copy[copy.length - 1]
                copy[copy.length - 1] = { ...last, content: last.content + t }
                return copy
              }),
            onFollowups: (f) => patchLast({ followUps: f }),
            onTitle: () => onConversationUpdated?.(),
            onDone: (messageId) => {
              if (messageId) patchLast({ _id: messageId })
            },
            onError: (e) => patchLast({ content: `⚠️ ${e}` }),
          },
          ctrl.signal,
          regenerate
        )
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          patchLast({ content: `⚠️ ${(e as Error).message}` })
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [streaming, selectedIds, conversationId, onConversationCreated, onConversationUpdated]
  )

  function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    runStream(text, false)
  }

  function regenerate() {
    if (streaming) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) runStream(lastUser.content, true)
  }

  async function handleFeedback(index: number, fb: 'up' | 'down') {
    const msg = messages[index]
    if (!msg?._id || !convIdRef.current) return
    try {
      const saved = await setMessageFeedback(convIdRef.current, msg._id, fb)
      setMessages((m) => {
        const copy = [...m]
        copy[index] = { ...copy[index], feedback: saved }
        return copy
      })
    } catch (err) {
      console.error('Failed to save feedback:', err)
    }
  }

  async function handleDeleteMessage(index: number) {
    const msg = messages[index]
    if (!msg?._id || !convIdRef.current || streaming) return
    try {
      const updated = await deleteMessage(convIdRef.current, msg._id)
      setMessages(updated)
    } catch (err) {
      console.error('Failed to delete message:', err)
    }
  }

  // Edit a user message: persist + truncate on the server, then re-run from there.
  async function handleEditMessage(index: number, newText: string) {
    const msg = messages[index]
    const text = newText.trim()
    if (!msg?._id || !convIdRef.current || streaming || !text) return
    try {
      await editMessage(convIdRef.current, msg._id, text)
    } catch (err) {
      console.error('Failed to edit message:', err)
      return
    }
    // Truncate locally to the edited turn, then regenerate the answer.
    setMessages((m) => {
      const copy = m.slice(0, index + 1)
      copy[index] = { ...copy[index], content: text }
      return copy
    })
    runStream(text, true)
  }

  // Starter questions for the empty state: drawn from the selected documents
  // (or all ready ones), round-robin so multiple docs are represented.
  const suggestions = useMemo(() => {
    const ready = documents.filter((d) => d.status === 'ready' && d.suggestedQuestions?.length)
    const pool = selectedIds.length ? ready.filter((d) => selectedIds.includes(d._id)) : ready
    const lists = pool.map((d) => (d.suggestedQuestions || []).map(cleanChip).filter(Boolean))
    const seen = new Set<string>()
    const out: string[] = []
    for (let round = 0; out.length < 6; round++) {
      let added = false
      for (const list of lists) {
        const q = list[round]
        if (q && !seen.has(q)) {
          seen.add(q)
          out.push(q)
          added = true
          if (out.length >= 6) break
        }
      }
      if (!added) break
    }
    return out
  }, [documents, selectedIds])

  function askSuggested(q: string) {
    if (!streaming) runStream(q, false)
  }

  const lastIndex = messages.length - 1

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-4 overflow-y-auto p-6">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <svg className="animate-spin h-6 w-6 text-indigo-500 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs">Loading chat history...</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
              <p className="text-lg font-medium text-slate-500 dark:text-slate-400">Ask your documents anything</p>
              <p className="mt-1 text-sm">Answers are grounded in your uploads, with cited sources.</p>
              {suggestions.length > 0 && (
                <div className="mt-6 w-full max-w-xl">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Try asking
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => askSuggested(q)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-slate-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading &&
            messages.map((m, i) => {
              const isLastAssistant = i === lastIndex && m.role === 'assistant'
              const isStreamingThis = streaming && isLastAssistant
              return (
                <MessageBubble
                  key={m._id || i}
                  msg={m}
                  streaming={isStreamingThis}
                  // Regenerate only the final assistant answer, when idle.
                  onRegenerate={isLastAssistant && !streaming ? regenerate : undefined}
                  onFeedback={
                    m.role === 'assistant' && m._id ? (fb) => handleFeedback(i, fb) : undefined
                  }
                  onAsk={askSuggested}
                  onEdit={
                    m.role === 'user' && m._id && !streaming
                      ? (text) => handleEditMessage(i, text)
                      : undefined
                  }
                  onDelete={m._id && !streaming ? () => handleDeleteMessage(i) : undefined}
                />
              )
            })}

          {/* Follow-up questions under the most recent answer (ChatGPT-style). */}
          {!loading &&
            !streaming &&
            messages[lastIndex]?.role === 'assistant' &&
            !!messages[lastIndex]?.followUps?.length && (
              <div className="flex flex-col items-start gap-2 pl-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Related
                </p>
                <div className="flex flex-wrap gap-2">
                  {messages[lastIndex]
                    .followUps!.map(cleanChip)
                    .filter(Boolean)
                    .map((q, i) => (
                      <button
                        key={i}
                        onClick={() => askSuggested(q)}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-slate-700"
                      >
                        <svg className="h-3 w-3 flex-none text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {q}
                      </button>
                    ))}
                </div>
              </div>
            )}
        </div>

        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Jump to latest
          </button>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            disabled={loading}
            placeholder="Ask a question…"
            className="max-h-40 flex-1 resize-none rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none disabled:opacity-50"
          />
          {streaming ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-md bg-slate-200 dark:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
