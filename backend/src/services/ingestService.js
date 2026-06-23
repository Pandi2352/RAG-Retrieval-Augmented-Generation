import { v4 as uuidv4 } from 'uuid'
import { Document } from '../models/Document.js'
import { Chunk } from '../models/Chunk.js'
import { extractText } from './documentService.js'
import { chunkText } from './chunkingService.js'
import { embedTexts } from './embeddingService.js'
import { upsertPoints, deleteByDocument } from './vectorService.js'
import { generateSuggestedQuestions } from './suggestionService.js'
import { extractKeyDates } from './radarService.js'

const EMBED_BATCH = 32

export async function ingestFile({ buffer, originalname, mimetype, size }) {
  const doc = await Document.create({
    filename: originalname,
    mimeType: mimetype,
    size,
    status: 'processing',
    statusStep: 'Queued'
  })

  // Process in background
  processBackgroundIngest(doc._id, buffer, originalname, mimetype).catch((err) => {
    console.error(`[ingestService] Background ingestion trigger failed for ${originalname}:`, err.message)
  })

  return doc
}

// Atomic status update. Using updateOne (a query) instead of doc.save() avoids
// Mongoose's ParallelSaveError when progress callbacks overlap, and is safe to
// run concurrently across multiple in-flight uploads.
function setStatus(docId, fields) {
  return Document.updateOne({ _id: docId }, { $set: fields })
}

async function processBackgroundIngest(docId, buffer, filename, mimetype) {
  try {
    await setStatus(docId, { statusStep: 'Extracting text...' })

    const text = await extractText(buffer, mimetype, filename, (step) =>
      setStatus(docId, { statusStep: step })
    )

    await setStatus(docId, { statusStep: 'Chunking text...' })
    const chunks = chunkText(text)
    if (chunks.length === 0) throw new Error('No extractable text in file')

    let stored = 0
    const totalBatches = Math.ceil(chunks.length / EMBED_BATCH)

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batchIndex = Math.floor(i / EMBED_BATCH) + 1
      await setStatus(docId, {
        statusStep: `Generating embeddings (${batchIndex}/${totalBatches})...`,
      })

      const batch = chunks.slice(i, i + EMBED_BATCH)
      const vectors = await embedTexts(batch)

      await setStatus(docId, {
        statusStep: `Storing vectors (${batchIndex}/${totalBatches})...`,
      })

      const points = []
      const chunkDocs = []

      batch.forEach((textChunk, j) => {
        const chunkIndex = i + j
        const id = uuidv4()
        points.push({
          id,
          vector: vectors[j],
          payload: {
            documentId: docId.toString(),
            filename: filename,
            chunkIndex,
            text: textChunk,
          },
        })
        chunkDocs.push({
          _id: id,
          documentId: docId,
          filename: filename,
          chunkIndex,
          text: textChunk,
        })
      })

      await upsertPoints(points)
      await Chunk.insertMany(chunkDocs)
      stored += batch.length
    }

    // Analyze the document: starter questions + key dates (best-effort, parallel).
    await setStatus(docId, { statusStep: 'Analyzing document...' })
    const [suggestedQuestions, keyDates] = await Promise.all([
      generateSuggestedQuestions(text),
      extractKeyDates(text),
    ])

    await setStatus(docId, {
      status: 'ready',
      statusStep: 'Ready',
      chunkCount: stored,
      charCount: text.length,
      suggestedQuestions,
      keyDates,
    })
  } catch (err) {
    console.error(`[ingestService] Error during background ingestion of ${filename}:`, err.message)
    await setStatus(docId, {
      status: 'failed',
      statusStep: 'Failed',
      error: err.message,
    }).catch(() => {})
    // best-effort cleanup of any partial vectors
    await deleteByDocument(docId.toString()).catch(() => {})
  }
}

export async function removeDocument(documentId) {
  await deleteByDocument(documentId)
  await Chunk.deleteMany({ documentId })
  await Document.findByIdAndDelete(documentId)
}
