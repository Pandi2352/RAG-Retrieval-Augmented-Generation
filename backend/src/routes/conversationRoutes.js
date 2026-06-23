import { Router } from 'express'
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  updateConversation,
  setMessageFeedback,
  editMessage,
  deleteMessage,
} from '../controllers/conversationController.js'

const router = Router()

router.get('/', listConversations)
router.post('/', createConversation)
router.get('/:id', getConversation)
router.delete('/:id', deleteConversation)
router.patch('/:id', updateConversation)
router.patch('/:id/messages/:messageId/feedback', setMessageFeedback)
router.patch('/:id/messages/:messageId', editMessage)
router.delete('/:id/messages/:messageId', deleteMessage)

export default router
