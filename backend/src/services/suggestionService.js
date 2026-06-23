import { chatClient, CHAT_MODEL } from '../config/ollama.js'

/**
 * Generate a few concise, document-grounded questions a user might ask.
 * Best-effort: returns [] on any failure so ingestion never breaks.
 */
export async function generateSuggestedQuestions(text, count = 4) {
  const sample = (text || '').slice(0, 4000).trim()
  if (sample.length < 40) return []

  const prompt = `Based on the document excerpt below, write ${count} concise, specific questions a user could ask that are answerable from this document. Keep each question under 12 words.
Return ONLY a JSON array of strings — no markdown, no commentary.

Excerpt:
"""
${sample}
"""`

  try {
    const res = await chatClient.chat({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.4 },
    })
    return parseQuestions(res.message?.content || '', count)
  } catch (err) {
    console.error('[suggestionService] generation failed:', err.message)
    return []
  }
}

/**
 * Generate natural follow-up questions based on the last exchange.
 * Best-effort: returns [] on any failure.
 */
export async function generateFollowUps(question, answer, count = 3) {
  const ans = (answer || '').slice(0, 3000).trim()
  if (ans.length < 20) return []

  const prompt = `Given the user's question and the assistant's answer below, suggest ${count} natural follow-up questions the user might ask next. Keep each under 12 words, specific, and answerable from the same documents.
Return ONLY a JSON array of strings — no markdown, no commentary.

Question: ${question}
Answer: ${ans}`

  try {
    const res = await chatClient.chat({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.5 },
    })
    return parseQuestions(res.message?.content || '', count)
  } catch (err) {
    console.error('[suggestionService] follow-up generation failed:', err.message)
    return []
  }
}

/**
 * Generate a concise conversation title and a few topic tags from the first
 * exchange. Best-effort: returns null on failure so the caller keeps its fallback.
 */
export async function generateTitleAndTags(question, answer) {
  const ans = (answer || '').slice(0, 1500).trim()
  const prompt = `Summarize this conversation. Produce a short title (3-6 words, no quotes) and 2-4 lowercase topic tags.
Return ONLY JSON: {"title": "...", "tags": ["...", "..."]}

Question: ${question}
Answer: ${ans}`

  try {
    const res = await chatClient.chat({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.3 },
    })
    const content = (res.message?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    const parsed = JSON.parse(content.slice(start, end + 1))
    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 60) : null
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 4)
      : []
    if (!title) return null
    return { title, tags }
  } catch (err) {
    console.error('[suggestionService] title/tag generation failed:', err.message)
    return null
  }
}

// Strip list markers, wrapping brackets, and surrounding quotes (straight or
// smart), and collapse whitespace.
function sanitizeQuestion(raw) {
  return String(raw)
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[[\s]+/, '')
    .replace(/[\]\s]+$/, '')
    .replace(/^["'“”]+\s*/, '')
    .replace(/\s*["'“”]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseQuestions(content, count) {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()

  let items = []
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    try {
      const arr = JSON.parse(slice)
      if (Array.isArray(arr)) items = arr.map(String)
    } catch {
      // Malformed JSON (trailing commas, smart quotes…): pull out quoted strings.
      const quoted = slice.match(/"([^"]+)"/g)
      if (quoted) items = quoted.map((m) => m.slice(1, -1))
    }
  }
  if (items.length === 0) items = cleaned.split('\n') // last resort: by line

  // Sanitize, drop empties, dedupe, cap.
  const seen = new Set()
  const out = []
  for (const item of items) {
    const q = sanitizeQuestion(item)
    if (q.length > 1 && !seen.has(q.toLowerCase())) {
      seen.add(q.toLowerCase())
      out.push(q)
      if (out.length >= count) break
    }
  }
  return out
}
