import { Document } from '../models/Document.js'
import { Chunk } from '../models/Chunk.js'
import { ingestFile, ingestWebsite, removeDocument } from '../services/ingestService.js'

// POST /api/documents  (multipart, field name: "files", multiple)
export async function uploadDocuments(req, res, next) {
  try {
    const files = req.files || []
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' })

    // Process sequentially to keep embedding/load predictable.
    const results = []
    for (const file of files) {
      try {
        const doc = await ingestFile(file)
        results.push({ ok: true, document: doc })
      } catch (err) {
        results.push({ ok: false, filename: file.originalname, error: err.message })
      }
    }
    res.status(201).json({ results })
  } catch (err) {
    next(err)
  }
}

// POST /api/documents/crawl   { url, maxDepth?, maxPages?, concurrency?, requestDelay?, respectRobots? }
export async function crawlWebsiteDocument(req, res, next) {
  try {
    const { url, maxDepth, maxPages, maxFileSize, concurrency, requestDelay, respectRobots, jsRendering, fileTypes } =
      req.body || {}
    if (!url || !/^https?:\/\//i.test(url.trim())) {
      return res.status(400).json({ error: 'A valid http(s) URL is required' })
    }
    const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))
    const doc = await ingestWebsite({
      url: url.trim(),
      options: {
        maxDepth: num(maxDepth),
        maxPages: num(maxPages),
        maxFileSizeMb: num(maxFileSize),
        concurrency: num(concurrency),
        requestDelayMs: num(requestDelay),
        respectRobots: respectRobots !== false,
        jsRendering: !!jsRendering,
        fileTypes: Array.isArray(fileTypes) ? fileTypes : null,
      },
    })
    res.status(201).json({ document: doc })
  } catch (err) {
    next(err)
  }
}

// GET /api/documents
export async function listDocuments(_req, res, next) {
  try {
    const docs = await Document.find().sort({ createdAt: -1 }).lean()
    res.json({ documents: docs })
  } catch (err) {
    next(err)
  }
}

// DELETE /api/documents/:id
export async function deleteDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    await removeDocument(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

// GET /api/documents/:id/chunks
export async function getDocumentChunks(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Document not found' })

    const chunks = await Chunk.find({ documentId: req.params.id }).sort({ chunkIndex: 1 }).lean()
    res.json({ chunks })
  } catch (err) {
    next(err)
  }
}
