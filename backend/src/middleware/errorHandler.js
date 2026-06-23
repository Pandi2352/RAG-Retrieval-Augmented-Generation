import multer from 'multer'

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message)
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message
    return res.status(400).json({ error: msg })
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
}
