import multer from 'multer'
import { env } from '../config/env.js'

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

const ALLOWED_EXT = new Set(['pdf', 'docx', 'txt', 'md', 'markdown', 'csv', 'json', 'log'])

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop()
    if (ALLOWED.has(file.mimetype) || ALLOWED_EXT.has(ext)) cb(null, true)
    else cb(new Error(`Unsupported file type: ${file.originalname}`))
  },
})
