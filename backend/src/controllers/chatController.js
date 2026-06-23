import { rewriteQuery, retrieve, answerStream } from '../services/ragService.js'
import { generateFollowUps, generateTitleAndTags } from '../services/suggestionService.js'
import { Conversation } from '../models/Conversation.js'

const sse = (res, event, data) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * POST /api/chat   { message, conversationId?, documentIds?: [], regenerate?: bool }
 * Streams the answer back over Server-Sent Events.
 * When `regenerate` is true, the last assistant message is replaced rather than
 * appending a new exchange (the trailing user message is reused as the query).
 */
export async function chat(req, res) {
  const { message, conversationId, documentIds, regenerate } = req.body || {}
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    // 1) Find or auto-create conversation in Mongo
    let conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId)
    }

    if (!conversation) {
      const textSnippet = message.trim()
      const title = textSnippet.length > 30 ? textSnippet.slice(0, 27) + '...' : textSnippet
      conversation = new Conversation({
        title,
        selectedDocumentIds: documentIds || [],
        messages: [],
      })
      await conversation.save()
    } else {
      if (documentIds !== undefined) {
        conversation.selectedDocumentIds = documentIds
      }
    }

    // On regenerate, drop the trailing assistant message so we can replace it.
    // The preceding user message is reused as the query.
    let userContent = message
    if (regenerate && conversation.messages.length) {
      const last = conversation.messages[conversation.messages.length - 1]
      if (last.role === 'assistant') conversation.messages.pop()
      const lastUser = conversation.messages[conversation.messages.length - 1]
      if (lastUser && lastUser.role === 'user') userContent = lastUser.content
    }

    // First real exchange → we'll auto-generate a title + tags after answering.
    const isFirstExchange = !regenerate && conversation.messages.length === 0

    // Yield conversationId immediately so frontend can sync
    sse(res, 'conversationId', { conversationId: conversation._id.toString() })

    // History is the prior turns, excluding the current user turn (which the
    // RAG layer re-adds with retrieved context). On regenerate the current user
    // turn is already the last stored message, so exclude it too.
    const priorMessages = regenerate
      ? conversation.messages.slice(0, -1)
      : conversation.messages
    const history = priorMessages.map((m) => ({ role: m.role, content: m.content }))

    // 2) Query rewriting for better retrieval
    const rewritten = await rewriteQuery(userContent, history)
    sse(res, 'rewritten', { query: rewritten })

    // 3) RAG retrieval using current conversation context
    const activeDocIds = documentIds || conversation.selectedDocumentIds
    const hits = await retrieve(rewritten, { documentIds: activeDocIds })

    // 4) Stream the grounded answer with source attribution
    let fullAnswer = ''
    let sources = []

    for await (const evt of answerStream(userContent, hits, history)) {
      if (evt.type === 'sources') {
        sources = evt.sources
        sse(res, 'sources', { sources: evt.sources })
      } else if (evt.type === 'token') {
        fullAnswer += evt.token
        sse(res, 'token', { token: evt.token })
      }
      // 'done' is emitted after persistence below, with the saved message id.
    }

    // 5) Persist. On a fresh turn append the user message; on regenerate it's
    // already stored. Then append the new assistant message.
    if (!regenerate) {
      conversation.messages.push({ role: 'user', content: userContent })
    }

    // Generate follow-up questions from the answer (best-effort).
    const followUps = await generateFollowUps(userContent, fullAnswer)
    sse(res, 'followups', { followUps })

    conversation.messages.push({
      role: 'assistant',
      content: fullAnswer,
      rewritten,
      sources,
      followUps,
    })

    // Auto-title + tag on the first exchange (best-effort; keep snippet on fail).
    if (isFirstExchange) {
      const meta = await generateTitleAndTags(userContent, fullAnswer)
      if (meta) {
        conversation.title = meta.title
        conversation.tags = meta.tags
        sse(res, 'title', { title: meta.title, tags: meta.tags })
      }
    }

    await conversation.save()

    const assistantMsg = conversation.messages[conversation.messages.length - 1]
    sse(res, 'done', { messageId: assistantMsg._id.toString() })
  } catch (err) {
    console.error('[chat] error', err.message)
    sse(res, 'error', { error: err.message })
  } finally {
    res.end()
  }
}
