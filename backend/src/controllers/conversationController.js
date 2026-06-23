import { Conversation } from '../models/Conversation.js'

// GET /api/conversations
export async function listConversations(_req, res, next) {
  try {
    const list = await Conversation.find()
      .select('title tags selectedDocumentIds createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean()
    res.json({ conversations: list })
  } catch (err) {
    next(err)
  }
}

// POST /api/conversations
export async function createConversation(req, res, next) {
  try {
    const { title, selectedDocumentIds } = req.body || {}
    const conversation = new Conversation({
      title: title || 'New Chat',
      selectedDocumentIds: selectedDocumentIds || [],
      messages: [],
    })
    await conversation.save()
    res.status(201).json({ conversation })
  } catch (err) {
    next(err)
  }
}

// GET /api/conversations/:id
export async function getConversation(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id).lean()
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    res.json({ conversation })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/conversations/:id
export async function deleteConversation(req, res, next) {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/conversations/:id
export async function updateConversation(req, res, next) {
  try {
    const { title, selectedDocumentIds } = req.body || {}
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (title !== undefined) conversation.title = title
    if (selectedDocumentIds !== undefined) conversation.selectedDocumentIds = selectedDocumentIds

    await conversation.save()
    res.json({ conversation })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/conversations/:id/messages/:messageId/feedback   { feedback: 'up'|'down'|null }
export async function setMessageFeedback(req, res, next) {
  try {
    const { feedback } = req.body || {}
    if (![null, 'up', 'down'].includes(feedback)) {
      return res.status(400).json({ error: 'feedback must be "up", "down", or null' })
    }
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const message = conversation.messages.id(req.params.messageId)
    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }
    // Toggle off if the same value is sent again.
    message.feedback = message.feedback === feedback ? null : feedback
    await conversation.save()
    res.json({ ok: true, feedback: message.feedback })
  } catch (err) {
    next(err)
  }
}

// PATCH /api/conversations/:id/messages/:messageId   { content }
// Edits a message and truncates everything after it (re-running happens via /chat).
export async function editMessage(req, res, next) {
  try {
    const { content } = req.body || {}
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' })
    }
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const idx = conversation.messages.findIndex(
      (m) => m._id.toString() === req.params.messageId
    )
    if (idx === -1) {
      return res.status(404).json({ error: 'Message not found' })
    }
    conversation.messages[idx].content = content.trim()
    conversation.messages.splice(idx + 1) // drop everything after the edited turn
    await conversation.save()
    res.json({ ok: true, messages: conversation.messages })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/conversations/:id/messages/:messageId
// Removes a message; if it's a user message with an assistant reply, removes both.
export async function deleteMessage(req, res, next) {
  try {
    const conversation = await Conversation.findById(req.params.id)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const idx = conversation.messages.findIndex(
      (m) => m._id.toString() === req.params.messageId
    )
    if (idx === -1) {
      return res.status(404).json({ error: 'Message not found' })
    }
    const removeCount =
      conversation.messages[idx].role === 'user' &&
      conversation.messages[idx + 1]?.role === 'assistant'
        ? 2
        : 1
    conversation.messages.splice(idx, removeCount)
    await conversation.save()
    res.json({ ok: true, messages: conversation.messages })
  } catch (err) {
    next(err)
  }
}
