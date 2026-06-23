import { chatClient, CHAT_MODEL } from '../config/ollama.js'

/**
 * Extract important upcoming dates / deadlines from a document (expiry,
 * renewal, due dates…). Best-effort: returns [] on any failure.
 * Each item: { label, date (ISO YYYY-MM-DD | YYYY-MM | YYYY), type }.
 */
export async function extractKeyDates(text, max = 8) {
  const sample = (text || '').slice(0, 4000).trim()
  if (sample.length < 30) return []

  const prompt = `Extract important dates and deadlines from the document excerpt below — things like expiry dates, validity/renewal dates, due dates, or deadlines. IGNORE issue dates, dates of birth, and purely historical dates.
For each, return an object: {"label": short description (max 8 words), "date": ISO format "YYYY-MM-DD" (use "YYYY-MM" or "YYYY" if only partial), "type": one of "expiry" | "renewal" | "due" | "deadline" | "other"}.
Return ONLY a JSON array. If there are none, return [].

Excerpt:
"""
${sample}
"""`

  try {
    const res = await chatClient.chat({
      model: CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.2 },
    })
    return parseDates(res.message?.content || '', max)
  } catch (err) {
    console.error('[radarService] date extraction failed:', err.message)
    return []
  }
}

const TYPES = ['expiry', 'renewal', 'due', 'deadline', 'other']
const ISO = /^\d{4}(-\d{2}(-\d{2})?)?$/

function parseDates(content, max) {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end <= start) return []

  let arr
  try {
    arr = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []

  const out = []
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue
    const label = String(it.label || '').trim().slice(0, 80)
    const date = String(it.date || '').trim().slice(0, 10)
    const type = TYPES.includes(it.type) ? it.type : 'other'
    if (label && ISO.test(date)) {
      out.push({ label, date, type })
      if (out.length >= max) break
    }
  }
  return out
}
