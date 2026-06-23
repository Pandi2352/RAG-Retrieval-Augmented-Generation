import { Router } from 'express'
import { upload } from '../middleware/upload.js'
import {
  uploadDocuments,
  crawlWebsiteDocument,
  listDocuments,
  deleteDocument,
  getDocumentChunks,
} from '../controllers/documentController.js'

const router = Router()

router.post('/', upload.array('files', 20), uploadDocuments)
router.post('/crawl', crawlWebsiteDocument)
router.get('/', listDocuments)
router.delete('/:id', deleteDocument)
router.get('/:id/chunks', getDocumentChunks)

export default router
