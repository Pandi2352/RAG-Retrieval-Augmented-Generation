import { Ollama } from 'ollama'
import { env } from './env.js'

// Cloud Ollama for chat/generation (gpt-oss:120b on https://ollama.com)
export const chatClient = new Ollama({
  host: env.ollamaChatHost,
  headers: env.ollamaApiKey
    ? { Authorization: 'Bearer ' + env.ollamaApiKey }
    : undefined,
})

// Separate client for embeddings (local by default).
export const embedClient = new Ollama({
  host: env.ollamaEmbedHost,
  headers:
    env.ollamaApiKey &&
    (env.ollamaEmbedHost === env.ollamaChatHost || env.ollamaEmbedHost.includes('ollama.com'))
      ? { Authorization: 'Bearer ' + env.ollamaApiKey }
      : undefined,
})


export const CHAT_MODEL = env.ollamaChatModel
export const EMBED_MODEL = env.ollamaEmbedModel

// Separate client for OCR (local/custom).
export const ocrClient = new Ollama({
  host: env.ollamaOcrHost,
  headers:
    env.ollamaApiKey &&
    (env.ollamaOcrHost === env.ollamaChatHost || env.ollamaOcrHost.includes('ollama.com'))
      ? { Authorization: 'Bearer ' + env.ollamaApiKey }
      : undefined,
})

export const OCR_MODEL = env.ollamaOcrModel
