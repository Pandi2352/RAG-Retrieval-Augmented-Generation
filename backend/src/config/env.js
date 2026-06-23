import dotenv from 'dotenv'
dotenv.config()

const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v))

// Qdrant: pick local or cloud by flipping QDRANT_MODE. Falls back to the
// legacy QDRANT_URL / QDRANT_API_KEY if the mode-specific vars aren't set.
const qdrantCloud = (process.env.QDRANT_MODE || 'local').toLowerCase() === 'cloud'
const qdrantUrl = qdrantCloud
  ? process.env.QDRANT_CLOUD_URL || process.env.QDRANT_URL
  : process.env.QDRANT_LOCAL_URL || process.env.QDRANT_URL || 'http://localhost:6333'
const qdrantApiKey = qdrantCloud
  ? process.env.QDRANT_CLOUD_API_KEY || process.env.QDRANT_API_KEY || undefined
  : undefined

export const env = {
  port: num(process.env.PORT, 5000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ollama_rag',

  qdrantMode: qdrantCloud ? 'cloud' : 'local',
  qdrantUrl,
  qdrantApiKey,
  qdrantCollection: process.env.QDRANT_COLLECTION || 'documents',

  ollamaChatHost: process.env.OLLAMA_CHAT_HOST || 'https://ollama.com',
  ollamaApiKey: process.env.OLLAMA_API_KEY || '',
  ollamaChatModel: process.env.OLLAMA_CHAT_MODEL || 'gpt-oss:120b',

  ollamaOcrHost: process.env.OLLAMA_OCR_HOST || 'http://localhost:11434',
  ollamaOcrModel: process.env.OLLAMA_OCR_MODEL || 'llama3.2-vision:11b',

  ollamaEmbedHost: process.env.OLLAMA_EMBED_HOST || 'http://localhost:11434',
  ollamaEmbedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  embedDim: num(process.env.EMBED_DIM, 768),

  chunkSize: num(process.env.CHUNK_SIZE, 1000),
  chunkOverlap: num(process.env.CHUNK_OVERLAP, 200),
  topK: num(process.env.RETRIEVAL_TOP_K, 5),
  scoreThreshold: num(process.env.SCORE_THRESHOLD, 0.4),
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 25),
}
