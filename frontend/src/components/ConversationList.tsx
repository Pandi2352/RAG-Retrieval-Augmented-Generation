import { useState } from 'react'
import type { Conversation } from '../types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  onCreateNew: () => void
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
  onCreateNew,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  // Per-chat tag accordion, closed by default.
  const [openTags, setOpenTags] = useState<Set<string>>(new Set())

  const toggleTags = (id: string) =>
    setOpenTags((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const startEdit = (c: Conversation) => {
    setEditingId(c._id)
    setEditVal(c.title)
  }

  const saveEdit = (id: string) => {
    if (editVal.trim()) {
      onRename(id, editVal.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="flex flex-col max-h-[300px] border-b border-slate-200/80 dark:border-slate-700 pb-4 mb-4 flex-none">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Chats
        </h2>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 transition border border-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30 dark:hover:bg-indigo-500/20"
        >
          <span>+ New Chat</span>
        </button>
      </div>

      <div className="overflow-y-auto space-y-1 pr-1 select-none flex-1 max-h-[250px]">
        {conversations.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-2 pl-1">
            No chats yet. Send a message to start.
          </p>
        ) : (
          conversations.map((c) => {
            const isActive = activeId === c._id
            const isEditing = editingId === c._id

            return (
              <div
                key={c._id}
                onClick={() => !isEditing && onSelect(c._id)}
                className={`group flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition cursor-pointer border ${
                  isActive
                    ? 'border-indigo-100 bg-indigo-50/50 text-indigo-700 font-semibold dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-transparent text-slate-500 hover:bg-slate-200/40 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      className={`h-3.5 w-3.5 flex-none ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => saveEdit(c._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(c._id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-400 dark:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEdit(c)}
                        className="truncate leading-relaxed pr-1"
                        title="Double-click to rename"
                      >
                        {c.title}
                      </span>
                    )}
                  </div>

                  {!isEditing && !!c.tags?.length && openTags.has(c._id) && (
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-md border px-1.5 py-0.5 text-[9px] font-medium border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 flex-none">
                    {!!c.tags?.length && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTags(c._id)
                        }}
                        className={`p-0.5 rounded-md transition hover:bg-slate-200/60 dark:hover:bg-slate-700 ${
                          openTags.has(c._id) ? 'text-indigo-500' : 'text-slate-400'
                        }`}
                        title={openTags.has(c._id) ? 'Hide tags' : 'Show tags'}
                      >
                        <svg
                          className={`h-3 w-3 transition-transform duration-200 ${openTags.has(c._id) ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(c)
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 transition dark:hover:bg-slate-700 dark:hover:text-indigo-300"
                      title="Rename"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.232 5.232l3.536 3.536m-2.036-2.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(c._id)
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition dark:hover:bg-rose-500/10"
                      title="Delete"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
