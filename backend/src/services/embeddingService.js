import { pipeline } from '@xenova/transformers'
import { env } from '../config/env.js'

let extractor = null

// Lazy-load the in-process feature extraction pipeline
async function getExtractor() {
  if (!extractor) {
    console.log('[embeddingService] Loading in-process embedding pipeline (Xenova/all-MiniLM-L6-v2)...')
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    console.log('[embeddingService] Embedding pipeline loaded successfully.')
  }
  return extractor
}

/**
 * Embed one or many texts. Returns an array of vectors.
 */
export async function embedTexts(texts) {
  const input = Array.isArray(texts) ? texts : [texts]
  if (input.length === 0) return []

  const extract = await getExtractor()
  const embeddings = []

  for (const text of input) {
    const output = await extract(text, { pooling: 'mean', normalize: true })
    const vector = Array.from(output.data)
    embeddings.push(vector)
  }

  return embeddings
}

export async function embedOne(text) {
  const [vector] = await embedTexts([text])
  return vector
}
