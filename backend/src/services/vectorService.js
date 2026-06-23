import { qdrant, COLLECTION } from '../config/qdrant.js'

/**
 * points: [{ id, vector, payload }]
 */
export async function upsertPoints(points) {
  if (points.length === 0) return
  await qdrant.upsert(COLLECTION, { wait: true, points })
}

/**
 * Similarity search with score-threshold filtering.
 * documentIds (optional) restricts the search to specific documents.
 */
export async function search(vector, { limit, scoreThreshold, documentIds } = {}) {
  const filter =
    documentIds && documentIds.length
      ? { must: [{ key: 'documentId', match: { any: documentIds } }] }
      : undefined

  const results = await qdrant.search(COLLECTION, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    filter,
    with_payload: true,
  })

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    text: r.payload?.text,
    documentId: r.payload?.documentId,
    filename: r.payload?.filename,
    chunkIndex: r.payload?.chunkIndex,
  }))
}

/** Remove all vectors belonging to a document. */
export async function deleteByDocument(documentId) {
  await qdrant.delete(COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
  })
}
