import { QdrantClient } from '@qdrant/js-client-rest'
import { env } from './env.js'

export const qdrant = new QdrantClient({
  url: env.qdrantUrl,
  apiKey: env.qdrantApiKey,
})

export const COLLECTION = env.qdrantCollection

/**
 * Ensure the collection exists with the right vector size.
 * Called once on startup.
 */
export async function ensureCollection(dim = env.embedDim) {
  const { collections } = await qdrant.getCollections()
  const exists = collections.some((c) => c.name === COLLECTION)

  if (exists) {
    // Check if the dimension matches
    const info = await qdrant.getCollection(COLLECTION)
    const existingDim = info.config?.params?.vectors?.size
    if (existingDim !== dim) {
      console.warn(`[qdrant] Dimension mismatch for collection "${COLLECTION}" (existing=${existingDim}, configured=${dim}). Recreating collection...`)
      await qdrant.deleteCollection(COLLECTION)
      await createNewCollection(dim)
    } else {
      console.log(`[qdrant] collection "${COLLECTION}" ready (dim=${dim})`)
    }
  } else {
    await createNewCollection(dim)
  }
}

async function createNewCollection(dim) {
  await qdrant.createCollection(COLLECTION, {
    vectors: { size: dim, distance: 'Cosine' },
  })
  // Index payload field we filter on, so per-document filtering is fast.
  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: 'documentId',
    field_schema: 'keyword',
  })
  console.log(`[qdrant] created collection "${COLLECTION}" (dim=${dim})`)
}
