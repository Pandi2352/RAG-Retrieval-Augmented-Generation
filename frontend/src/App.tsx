import { useCallback, useEffect, useState } from 'react'
import {
  deleteDocument,
  listDocuments,
  listConversations,
  deleteConversation,
  updateConversation,
} from './api'
import type { DocumentMeta, Conversation } from './types'
import { FileUpload } from './components/FileUpload'
import { WebScrape } from './components/WebScrape'
import { DocumentList } from './components/DocumentList'
import { ConversationList } from './components/ConversationList'
import { Chat } from './components/Chat'
import { OcrDrawer } from './components/OcrDrawer'
import { RadarDrawer, radarAttentionCount } from './components/RadarDrawer'
import { Onboarding } from './components/Onboarding'
import { ThemeToggle } from './components/ThemeToggle'

export default function App() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inspectDoc, setInspectDoc] = useState<DocumentMeta | null>(null)
  const [radarOpen, setRadarOpen] = useState(false)
  
  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments())
    } catch {
      /* ignore */
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refresh()
    refreshConversations()
  }, [refresh, refreshConversations])

  // Poll while anything is still processing, so status flips to "ready".
  useEffect(() => {
    if (!documents.some((d) => d.status === 'processing')) return
    const t = setInterval(refresh, 2000)
    return () => clearInterval(t)
  }, [documents, refresh])

  // Save selected documents to DB conversation whenever checked items change
  useEffect(() => {
    if (!activeId) return
    const timer = setTimeout(async () => {
      try {
        await updateConversation(activeId, {
          selectedDocumentIds: Array.from(selected),
        })
      } catch (err) {
        console.error('Failed to auto-save selected documents:', err)
      }
    }, 400) // slight debounce
    return () => clearTimeout(timer)
  }, [selected, activeId])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    setSelected((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    refresh()
  }

  // Conversation Session Handlers
  const handleSelectConversation = (id: string) => {
    setActiveId(id)
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id)
      if (activeId === id) {
        setActiveId(null)
      }
      refreshConversations()
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateConversation(id, { title: newTitle })
      refreshConversations()
    } catch (err) {
      console.error('Failed to rename conversation:', err)
    }
  }

  const handleCreateNewChat = () => {
    setActiveId(null)
  }

  const handleConversationCreated = (id: string) => {
    setActiveId(id)
    refreshConversations()
  }

  const radarCount = radarAttentionCount(documents)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-80 flex-none flex-col border-r border-slate-200 bg-slate-100/60 p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              🪶 Folio
            </h1>
            <p className="text-xs text-slate-400">Chat with your documents</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRadarOpen(true)}
              title="Document Radar — upcoming dates"
              className="relative rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {radarCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {radarCount}
                </span>
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>
        
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
          onCreateNew={handleCreateNewChat}
        />

        <FileUpload onUploaded={refresh} />
        <WebScrape onCrawlStarted={refresh} />
        <div className="mt-2 flex-1 overflow-y-auto">
          <DocumentList
            documents={documents}
            selected={selected}
            onToggle={toggle}
            onDelete={handleDelete}
            onInspectText={setInspectDoc}
          />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        <Chat
          conversationId={activeId}
          selectedIds={Array.from(selected)}
          documents={documents}
          onConversationCreated={handleConversationCreated}
          onSelectedDocumentsChange={(ids) => setSelected(new Set(ids))}
          onConversationUpdated={refreshConversations}
        />
      </main>

      <OcrDrawer doc={inspectDoc} onClose={() => setInspectDoc(null)} />
      <RadarDrawer open={radarOpen} documents={documents} onClose={() => setRadarOpen(false)} />
      <Onboarding />
    </div>
  )
}
