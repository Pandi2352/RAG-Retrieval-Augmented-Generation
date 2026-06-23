import { v4 as uuidv4 } from 'uuid'
import { Document } from '../models/Document.js'
import { Chunk } from '../models/Chunk.js'
import { extractText } from './documentService.js'
import { chunkText } from './chunkingService.js'
import { embedTexts } from './embeddingService.js'
import { upsertPoints, deleteByDocument } from './vectorService.js'
import { generateSuggestedQuestions } from './suggestionService.js'
import { extractKeyDates } from './radarService.js'
import { crawlWebsite } from './crawlService.js'

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

async function failDoc(docId, label, err) {
  console.error(`[ingestService] Error during ingestion of ${label}:`, err.message)
  await setStatus(docId, {
    status: 'failed',
    statusStep: 'Failed',
    error: err.message,
  }).catch(() => {})
  // best-effort cleanup of any partial vectors
  await deleteByDocument(docId.toString()).catch(() => {})
}

// Shared pipeline: chunk → embed → store → analyze → mark ready.
// Used by both file uploads and website crawls.
async function processExtractedText(docId, filename, text) {
  await setStatus(docId, { statusStep: 'Chunking text...' })
  const chunks = chunkText(text)
  if (chunks.length === 0) throw new Error('No extractable text')

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
        payload: { documentId: docId.toString(), filename, chunkIndex, text: textChunk },
      })
      chunkDocs.push({ _id: id, documentId: docId, filename, chunkIndex, text: textChunk })
    })

    await upsertPoints(points)
    await Chunk.insertMany(chunkDocs)
    stored += batch.length
  }

  // Analyze: starter questions + key dates (best-effort, parallel).
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
}

async function processBackgroundIngest(docId, buffer, filename, mimetype) {
  try {
    await setStatus(docId, { statusStep: 'Extracting text...' })
    const text = await extractText(buffer, mimetype, filename, (step) =>
      setStatus(docId, { statusStep: step })
    )
    await processExtractedText(docId, filename, text)
  } catch (err) {
    await failDoc(docId, filename, err)
  }
}

function webLabel(url) {
  try {
    return `${new URL(url).hostname} (web)`
  } catch {
    return `${url} (web)`
  }
}

// Crawl a website and ingest the scraped text as a single document.
export async function ingestWebsite({ url, options = {} }) {
  const filename = webLabel(url)
  const doc = await Document.create({
    filename,
    mimeType: 'text/html',
    source: 'web',
    sourceUrl: url,
    status: 'processing',
    statusStep: 'Queued',
  })

  processBackgroundCrawl(doc._id, url, options, filename).catch((err) =>
    console.error(`[ingestService] Crawl trigger failed for ${url}:`, err.message)
  )

  return doc
}

async function processBackgroundCrawl(docId, url, options, filename) {
  try {
    const { pages, skipped, files } = await crawlWebsite({ startUrl: url, ...options }, (step) =>
      setStatus(docId, { statusStep: step })
    )

    // Combine crawled pages, prefixing each with its source URL for citation.
    let text = pages
      .map((p) => `Source: ${p.url}\n${p.title ? p.title + '\n' : ''}${p.text}`)
      .join('\n\n----\n\n')

    // Download & extract the linked files of selected types (respecting size).
    const importFailures = []
    const maxBytes =
      options.maxFileSizeMb && options.maxFileSizeMb > 0
        ? options.maxFileSizeMb * 1024 * 1024
        : Infinity

    for (let i = 0; i < (files?.length || 0); i++) {
      const f = files[i]
      await setStatus(docId, { statusStep: `Importing files (${i + 1}/${files.length})…` })
      try {
        const res = await fetch(f.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > maxBytes) {
          importFailures.push({ url: f.url, reason: 'file too large' })
          continue
        }
        const fname = decodeURIComponent(f.url.split('/').pop().split('?')[0]) || `file.${f.ext}`
        const fileText = await extractText(buf, res.headers.get('content-type') || '', fname)
        if (fileText && fileText.trim()) {
          text += `\n\n----\n\nSource: ${f.url}\n${fileText}`
        } else {
          importFailures.push({ url: f.url, reason: 'no text extracted' })
        }
      } catch (err) {
        console.warn(`[ingestService] file import failed ${f.url}: ${err.message}`)
        importFailures.push({ url: f.url, reason: 'import failed' })
      }
    }

    // Persist the final skipped list (un-followed links + failed imports).
    const allSkipped = [...(skipped || []), ...importFailures]
    if (allSkipped.length) await setStatus(docId, { skippedUrls: allSkipped })

    if (!text.trim()) throw new Error('No readable content found on the site')

    await processExtractedText(docId, filename, text)
  } catch (err) {
    await failDoc(docId, url, err)
  }
}

export async function removeDocument(documentId) {
  await deleteByDocument(documentId)
  await Chunk.deleteMany({ documentId })
  await Document.findByIdAndDelete(documentId)
}
