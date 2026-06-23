import mammoth from 'mammoth'
import { createRequire } from 'module'
import { ocrClient, OCR_MODEL } from '../config/ollama.js'

// pdf-parse ships as CommonJS with a debug block that runs test code on import;
// require the lib file directly to avoid triggering it.
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

/**
 * Extract plain text from an uploaded file buffer based on its type.
 */
export async function extractText(buffer, mimeType, filename = '', onProgress) {
  const ext = filename.toLowerCase().split('.').pop()

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    // 1) Fast path: most PDFs have an embedded text layer. Extract it directly
    //    and skip the (slow) vision OCR entirely.
    if (onProgress) await onProgress('Checking for embedded text...')
    try {
      const data = await pdfParse(buffer)
      const text = data.text || ''
      const pages = data.numpages || 1
      const nonWs = text.replace(/\s/g, '').length
      // Heuristic: a real text layer has meaningful text per page; scanned PDFs
      // return little or nothing here.
      if (nonWs >= 100 && nonWs / pages >= 50) {
        console.log(`[documentService] "${filename}" has a text layer (${nonWs} chars over ${pages} pages) — skipping OCR.`)
        if (onProgress) await onProgress('Extracted embedded text')
        return text
      }
      console.log(`[documentService] "${filename}" has little/no text layer (${nonWs} chars) — falling back to Vision OCR.`)
    } catch (err) {
      console.warn(`[documentService] pdf-parse failed for "${filename}" (${err.message}) — falling back to Vision OCR.`)
    }

    // 2) Fallback: scanned / image-only PDF → Ollama Vision OCR, page by page.
    console.log(`[documentService] Running Ollama Vision OCR (${OCR_MODEL}) for "${filename}"...`)
    if (onProgress) await onProgress('Converting PDF to images...')

    try {
      const { pdf } = await import('pdf-to-img')
      const doc = await pdf(buffer, { scale: 2 })
      
      let ocrText = ''
      let pageIndex = 1

      for await (const page of doc) {
        console.log(`[ocr] Sending page ${pageIndex} of "${filename}" to Ollama OCR Client (${OCR_MODEL})...`)
        if (onProgress) await onProgress(`Running OCR (Page ${pageIndex})...`)
        const base64Image = page.toString('base64')

        const res = await ocrClient.chat({
          model: OCR_MODEL,
          messages: [
            {
              role: 'user',
              content: 'Transcribe all text from this image exactly. Return ONLY the transcribed text. Do not add any introductory or concluding remarks, explanations, or commentary.',
              images: [base64Image]
            }
          ]
        })

        const pageText = res.message?.content || ''
        if (pageText.trim()) {
          ocrText += pageText + '\n'
        }
        pageIndex++
      }

      const cleanText = ocrText.replace(/[\s\n\r\t]+/g, '')
      if (cleanText.length < 5) {
        throw new Error('Ollama OCR completed but extracted no text from the PDF')
      }

      console.log(`[documentService] Ollama OCR completed successfully for "${filename}" (${ocrText.length} characters extracted)`)
      return ocrText
    } catch (err) {
      console.error('[documentService] Ollama OCR extraction failed:', err.message)
      throw new Error(`Ollama OCR extraction failed: ${err.message}`)
    }
  }

  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }

  // txt, md, csv, json, and anything else text-like
  if (
    mimeType?.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'csv', 'json', 'log'].includes(ext)
  ) {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported file type: ${mimeType || ext || 'unknown'}`)
}
