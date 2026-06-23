import { env } from '../config/env.js'

/**
 * Recursive-ish character splitter with overlap. Tries to break on
 * paragraph / sentence boundaries before falling back to a hard cut.
 */
export function chunkText(text, size = env.chunkSize, overlap = env.chunkOverlap) {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const chunks = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length)

    if (end < clean.length) {
      // Prefer to cut on a boundary inside the last 30% of the window.
      const window = clean.slice(start, end)
      const minBreak = Math.floor(size * 0.7)
      const candidates = [
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('\n'),
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
      ]
      const breakAt = Math.max(...candidates)
      if (breakAt > minBreak) end = start + breakAt + 1
    }

    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)

    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}
