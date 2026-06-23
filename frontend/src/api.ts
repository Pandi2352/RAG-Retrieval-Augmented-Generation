import type { DocumentMeta, Source, Conversation, ChatMessage } from './types'

const API = '/api'

export async function listDocuments(): Promise<DocumentMeta[]> {
  const res = await fetch(`${API}/documents`)
  if (!res.ok) throw new Error('Failed to load documents')
  const data = await res.json()
  return data.documents
}

export async function uploadDocuments(files: File[]) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const res = await fetch(`${API}/documents`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Upload failed')
  }
  return res.json() as Promise<{ results: { ok: boolean; filename?: string; error?: string }[] }>
}

export interface CrawlPayload {
  url: string
  maxDepth?: number | null
  maxPages?: number | null
  maxFileSize?: number | null
  concurrency?: number | null
  requestDelay?: number | null
  respectRobots?: boolean
  jsRendering?: boolean
  fileTypes?: string[]
}

export async function crawlWebsite(payload: CrawlPayload) {
  const res = await fetch(`${API}/documents/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Crawl failed')
  }
  return res.json()
}

export async function deleteDocument(id: string) {
  const res = await fetch(`${API}/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function getDocumentChunks(id: string): Promise<{ _id: string; documentId: string; filename: string; chunkIndex: number; text: string }[]> {
  const res = await fetch(`${API}/documents/${id}/chunks`)
  if (!res.ok) throw new Error('Failed to load document text')
  const data = await res.json()
  return data.chunks
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API}/conversations`)
  if (!res.ok) throw new Error('Failed to load conversations')
  const data = await res.json()
  return data.conversations
}

export async function createConversation(title?: string, selectedDocumentIds?: string[]): Promise<Conversation> {
  const res = await fetch(`${API}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, selectedDocumentIds }),
  })
  if (!res.ok) throw new Error('Failed to create conversation')
  const data = await res.json()
  return data.conversation
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await fetch(`${API}/conversations/${id}`)
  if (!res.ok) throw new Error('Failed to load conversation details')
  const data = await res.json()
  return data.conversation
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API}/conversations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete conversation')
}

export async function updateConversation(
  id: string,
  updates: { title?: string; selectedDocumentIds?: string[] }
): Promise<Conversation> {
  const res = await fetch(`${API}/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update conversation')
  const data = await res.json()
  return data.conversation
}

export async function setMessageFeedback(
  conversationId: string,
  messageId: string,
  feedback: 'up' | 'down' | null
): Promise<'up' | 'down' | null> {
  const res = await fetch(
    `${API}/conversations/${conversationId}/messages/${messageId}/feedback`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }
  )
  if (!res.ok) throw new Error('Failed to save feedback')
  const data = await res.json()
  return data.feedback
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string
): Promise<ChatMessage[]> {
  const res = await fetch(`${API}/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to edit message')
  const data = await res.json()
  return data.messages
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<ChatMessage[]> {
  const res = await fetch(`${API}/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete message')
  const data = await res.json()
  return data.messages
}

interface StreamHandlers {
  onConversationId?: (id: string) => void
  onRewritten?: (q: string) => void
  onSources?: (s: Source[]) => void
  onToken?: (t: string) => void
  onFollowups?: (q: string[]) => void
  onTitle?: (title: string, tags: string[]) => void
  onDone?: (messageId?: string) => void
  onError?: (e: string) => void
}

/**
 * POST to /api/chat and parse the Server-Sent Events stream.
 * Pass `regenerate: true` to replace the conversation's last assistant message.
 */
export async function streamChat(
  message: string,
  conversationId: string | null,
  documentIds: string[] | undefined,
  handlers: StreamHandlers,
  signal?: AbortSignal,
  regenerate?: boolean
) {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversationId,
      documentIds,
      regenerate,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    handlers.onError?.('Request failed')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line.
    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''

    for (const frame of frames) {
      const lines = frame.split('\n')
      let event = 'message'
      let data = ''
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      const payload = JSON.parse(data)

      if (event === 'conversationId') handlers.onConversationId?.(payload.conversationId)
      else if (event === 'rewritten') handlers.onRewritten?.(payload.query)
      else if (event === 'sources') handlers.onSources?.(payload.sources)
      else if (event === 'token') handlers.onToken?.(payload.token)
      else if (event === 'followups') handlers.onFollowups?.(payload.followUps)
      else if (event === 'title') handlers.onTitle?.(payload.title, payload.tags || [])
      else if (event === 'done') handlers.onDone?.(payload.messageId)
      else if (event === 'error') handlers.onError?.(payload.error)
    }
  }
}
