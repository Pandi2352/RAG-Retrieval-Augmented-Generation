import { chatClient, CHAT_MODEL } from '../config/ollama.js'
import { env } from '../config/env.js'
import { embedOne } from './embeddingService.js'
import { search } from './vectorService.js'

/**
 * Query rewriting: turn a possibly-contextual user message into a single
 * standalone search query, using recent chat history. Improves retrieval
 * for follow-up questions ("what about its pricing?" -> full query).
 */
export async function rewriteQuery(message, history = []) {
  const recent = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const prompt = `Rewrite the user's latest question into a single, self-contained search query optimized for semantic document retrieval. Resolve pronouns and references using the conversation. Respond with ONLY the rewritten query, no quotes or extra text.

${recent ? `Conversation:\n${recent}\n` : ''}Latest question: ${message}

Rewritten query:`

  try {
    const res = await chatClient.chat({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.1 },
    })
    const rewritten = res.message?.content?.trim()
    return rewritten && rewritten.length > 2 ? rewritten : message
  } catch {
    // If rewriting fails, fall back to the raw message — never block retrieval.
    return message
  }
}

/**
 * Retrieve relevant chunks for a query, applying the similarity threshold.
 */
export async function retrieve(query, { documentIds } = {}) {
  const vector = await embedOne(query)
  const hits = await search(vector, {
    limit: env.topK,
    scoreThreshold: env.scoreThreshold,
    documentIds,
  })
  return hits
}

/** Build a numbered context block + the source list for attribution. */
export function buildContext(hits) {
  const sources = hits.map((h, i) => ({
    n: i + 1,
    documentId: h.documentId,
    filename: h.filename,
    chunkIndex: h.chunkIndex,
    score: Number(h.score?.toFixed(4)),
    snippet: (h.text || '').slice(0, 240),
  }))

  const context = hits
    .map((h, i) => `[${i + 1}] (source: ${h.filename})\n${h.text}`)
    .join('\n\n')

  return { context, sources }
}

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions using ONLY the provided context.

Rules:
- Base every claim on the context. If the answer is not in the context, say you don't have enough information from the documents.
- Cite sources inline using the bracketed numbers from the context, e.g. [1], [2].
- Be concise and accurate. Do not invent sources or facts.`

/**
 * Stream an answer. Yields token strings. `onSources` is called once with
 * the source list before generation starts.
 */
export async function* answerStream(message, hits, history = []) {
  const { context, sources } = buildContext(hits)

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: context
        ? `Context:\n${context}\n\nQuestion: ${message}`
        : `No relevant documents were found. Tell the user you could not find supporting information in their documents.\n\nQuestion: ${message}`,
    },
  ]

  // Surface sources first so the UI can render attribution immediately.
  yield { type: 'sources', sources }

  const stream = await chatClient.chat({
    model: CHAT_MODEL,
    messages,
    stream: true,
  })

  for await (const part of stream) {
    const token = part.message?.content
    if (token) yield { type: 'token', token }
  }

  yield { type: 'done' }
}
