import { Document } from '../models/Document.js'
import { Chunk } from '../models/Chunk.js'
import { ingestFile, removeDocument } from '../services/ingestService.js'

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
