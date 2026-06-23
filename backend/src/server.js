import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { connectMongo } from './config/db.js'
import { ensureCollection } from './config/qdrant.js'
import documentRoutes from './routes/documentRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import conversationRoutes from './routes/conversationRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

// Safety net: never let a stray async error in background ingestion (or
// elsewhere) take the whole server down. Log and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason?.message || reason)
})
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err?.message || err)
})

const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/documents', documentRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/conversations', conversationRoutes)

app.use(errorHandler)

async function start() {
  try {
    await connectMongo()
    await ensureCollection()
    app.listen(env.port, () => {
      console.log(`[server] listening on http://localhost:${env.port}`)
      console.log(`[server] qdrant: ${env.qdrantMode} @ ${env.qdrantUrl}`)
      console.log(`[server] chat model: ${env.ollamaChatModel} @ ${env.ollamaChatHost}`)
      console.log(`[server] embed model: ${env.ollamaEmbedModel} @ ${env.ollamaEmbedHost}`)
    })
  } catch (err) {
    console.error('[server] failed to start:', err.message)
    process.exit(1)
  }
}

start()
