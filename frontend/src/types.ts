export interface DocumentMeta {
  _id: string
  filename: string
  mimeType?: string
  size?: number
  status: 'processing' | 'ready' | 'failed'
  statusStep?: string
  suggestedQuestions?: string[]
  keyDates?: { label: string; date: string; type?: string }[]
  chunkCount: number
  charCount: number
  error?: string
  createdAt: string
}

export interface Source {
  n: number
  documentId: string
  filename: string
  chunkIndex: number
  score: number
  snippet: string
}

export interface ChatMessage {
  _id?: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  rewritten?: string
  feedback?: 'up' | 'down' | null
  followUps?: string[]
  createdAt?: string
}

export interface Conversation {
  _id: string
  title: string
  tags?: string[]
  messages: ChatMessage[]
  selectedDocumentIds: string[]
  createdAt: string
  updatedAt: string
}
