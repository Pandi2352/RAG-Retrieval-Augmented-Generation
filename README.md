<div align="center">

# 🪶 Folio

### Chat with your documents — grounded answers, cited sources, zero hallucination guesswork.

A full-stack **RAG (Retrieval-Augmented Generation)** application. Upload PDFs, Word docs, or text files and have a streaming, source-cited conversation with them — powered by **Ollama**, **Qdrant**, and in-process **transformer embeddings**.

<br/>

![Node](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-Vector_DB-DC244C?style=for-the-badge&logo=qdrant&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-LLM-000000?style=for-the-badge&logo=ollama&logoColor=white)

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

## ✨ Features

### 📄 Documents & Ingestion
- **Multi-file upload** — drag-and-drop several files at once (PDF · DOCX · TXT · MD · CSV · JSON)
- **🌐 Website crawling** — paste a URL and crawl the site into a document. Same-hostname pages, with depth / page / concurrency / delay limits and **robots.txt** respect. (Crawlee)
  - **JavaScript Rendering toggle** — static HTML by default (fast), or headless **Chromium** for JS-heavy SPAs (React/Vue/…)
  - **Linked-file import** — downloads linked **PDF / DOCX / CSV** files (by selected type, within a max size) and ingests their text alongside the page content
  - **Skipped URLs** — anything not pulled in (other file types, external sites, email/phone links, oversized/failed imports) is listed with a reason
- **🔍 Smart PDF extraction** — tries the **embedded text layer first** (instant); falls back to **Ollama Vision OCR** only for scanned/image PDFs
- **Background processing** with **live status steps** (`Extracting / Crawling → Embeddings → Storing → Ready`)
- **Document manager** — see status, chunk counts, delete, and **scope the chat** to specific documents
- **Source text / OCR viewer** — inspect the extracted chunks per document

### 🧠 RAG & Retrieval
- **Query rewriting** — turns follow-up questions into standalone search queries using conversation context
- **Semantic search** over Qdrant with **score-threshold filtering** (drops weak matches)
- **Source attribution** — every answer cites its sources as **clickable** superscript `[1]` badges → click to open, expand, and flash the exact source
- **Source cards** — expandable per-source view with filename, similarity score, and snippet
- **In-process embeddings** — `all-MiniLM-L6-v2` via `transformers.js` (no external embedding service to run)

### 💬 Chat Experience
- **Token-by-token streaming** over Server-Sent Events with a typing caret
- **Smart auto-scroll** — pins to the bottom while streaming, pauses when you scroll up, with a **“Jump to latest”** button
- **Per-message actions** — Copy · 🔁 Regenerate · 👍/👎 Feedback (persisted) · Sources toggle
- **🔊 Read aloud** — text-to-speech that reads clean prose (markdown/bullets/citations stripped)
- **🌐 Translate** — translate any answer into **English · Tamil · Hindi · Spanish · French**
- **✏️ Highlight-to-action** — select text in an answer → **Explain · Simplify · Translate**

### ⚡ Productivity
- **📡 Document Radar** — proactively extracts **expiry / renewal / due dates** from your documents and surfaces them in a color-coded timeline (🔴 overdue/soon · 🟡 within 90 days · 🟢 later), with a badge counter for items needing attention
- **💡 Starter question chips** — auto-generated per document, shown on a fresh chat
- **➡️ Follow-up suggestions** — contextual “Related” questions after every answer (ChatGPT-style)
- **🏷️ Auto-title + tags** — conversations are automatically named and tagged after the first exchange
- **Conversation history** — rename, delete, and a **collapsible tag accordion** per chat

### 🎨 UI / UX
- **Dark mode** 🌙
- Clean, **borders-only** design system (`rounded-md`, no heavy shadows)
- **Custom scrollbars** and responsive 3-pane layout (chats · documents · chat)

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│  React + TS  │     │                  Express API                   │
│   Tailwind   │◀───▶│  /documents  /chat (SSE)  /conversations       │
└──────────────┘     └───────────────┬──────────────┬─────────────────┘
                                      │              │
                  ┌───────────────────┼──────┐   ┌───┴───────────┐
                  ▼                   ▼      ▼   ▼               ▼
            transformers.js       Ollama   Qdrant           MongoDB
            (embeddings)       (chat+OCR)  (vectors)    (text/metadata,
                                                          conversations)
```

**Ingestion pipeline**
```
Upload ─▶ extract text (PDF text-layer → Vision OCR fallback / mammoth / plain)
Crawl  ─▶ Cheerio or Playwright (JS) → page text + skipped-URL list
       ─▶ chunk (overlap) ─▶ embed (MiniLM) ─▶ Qdrant (vectors) + MongoDB (text)
       ─▶ generate starter questions + extract key dates (Radar)
```

**Query pipeline**
```
Ask ─▶ rewrite query ─▶ embed ─▶ Qdrant search (top-k + threshold)
    ─▶ build cited context ─▶ stream grounded answer (SSE)
    ─▶ follow-up suggestions ─▶ auto-title + tags (first turn)
```

### 🧩 Tech Stack

| Layer        | Technology                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| **Frontend** | React 18 · TypeScript · Tailwind CSS · Vite                                |
| **Backend**  | Node.js 20 · Express (ES modules) · Server-Sent Events                     |
| **Vectors**  | Qdrant (local via Docker **or** Qdrant Cloud)                              |
| **Database** | MongoDB + Mongoose (documents, chunks, conversations)                      |
| **LLM**      | Ollama — chat + vision OCR (cloud or local)                                |
| **Embeddings** | `@xenova/transformers` — `all-MiniLM-L6-v2` (384-dim, runs in-process)   |
| **Parsing**  | `pdf-parse` (text layer) + `pdf-to-img` vision OCR · `mammoth` (DOCX) · native text |
| **Crawling** | `@crawlee/cheerio` (static) · `@crawlee/playwright` + Chromium (JS rendering) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **Docker** (for Qdrant + MongoDB) — or your own instances
- An **Ollama** setup for chat + OCR:
  - **Cloud** chat model → an [Ollama Cloud](https://ollama.com) API key, **or**
  - **Local** Ollama (`ollama serve`) with a chat model and a vision model (e.g. `ollama pull llama3.2-vision`)

> 💡 **Embeddings need no setup** — they run in-process via `transformers.js` (the model downloads automatically on first use).

> 🌐 **Website crawling with JavaScript Rendering** needs a headless browser — run once after `npm install`:
> ```bash
> npx playwright install chromium
> ```
> Static-HTML crawling and file uploads work without it.

### 1️⃣ Infrastructure
```bash
docker compose up -d        # Qdrant (:6333) + MongoDB (:27017)
```

### 2️⃣ Backend
```bash
cd backend
cp .env.example .env        # then fill in OLLAMA_API_KEY / models
npm install
npm run dev                 # http://localhost:5000
```

### 3️⃣ Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173  (proxies /api → :5000)
```

Open **http://localhost:5173**, upload a document, wait for **Ready**, and start asking. 🎉

---

## ⚙️ Configuration

All settings live in `backend/.env` (see `.env.example`).

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | API port | `5000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/ollama_rag` |
| `QDRANT_MODE` | `local` or `cloud` — **one-line switch** | `local` |
| `QDRANT_LOCAL_URL` | Local Qdrant URL | `http://localhost:6333` |
| `QDRANT_CLOUD_URL` / `QDRANT_CLOUD_API_KEY` | Qdrant Cloud cluster (used when mode=`cloud`) | — |
| `QDRANT_COLLECTION` | Collection name | `documents` |
| `OLLAMA_CHAT_HOST` | Chat host (`https://ollama.com` or local) | `https://ollama.com` |
| `OLLAMA_API_KEY` | Ollama Cloud key (for chat / cloud OCR) | — |
| `OLLAMA_CHAT_MODEL` | Chat / generation model | `gpt-oss:120b` |
| `OLLAMA_OCR_HOST` / `OLLAMA_OCR_MODEL` | Vision model for PDF OCR | `http://localhost:11434` / `llama3.2-vision:11b` |
| `EMBED_DIM` | Embedding dimension (**384** for MiniLM) | `768` |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunking | `1000` / `200` |
| `RETRIEVAL_TOP_K` | Chunks retrieved per query | `5` |
| `SCORE_THRESHOLD` | Min similarity (raise = stricter) | `0.4` |
| `MAX_UPLOAD_MB` | Max upload size | `25` |
| `CRAWL_MAX_PAGES_CAP` | Safety cap when crawl "Max Pages" is left blank | `100` |

> ⚠️ Embeddings use `all-MiniLM-L6-v2` (**384-dim**) — set `EMBED_DIM=384` so the Qdrant collection matches.
>
> 🔁 **Switch Qdrant local ↔ cloud** by flipping a single line: `QDRANT_MODE=local|cloud`.

---

## 🔌 API Reference

### Documents
| Method | Route | Body / Notes |
| --- | --- | --- |
| `POST` | `/api/documents` | multipart, field `files` (multiple) |
| `POST` | `/api/documents/crawl` | `{ url, maxDepth?, maxPages?, concurrency?, requestDelay?, respectRobots?, jsRendering? }` |
| `GET` | `/api/documents` | list all documents + status |
| `DELETE` | `/api/documents/:id` | delete doc + its vectors/chunks |
| `GET` | `/api/documents/:id/chunks` | inspect extracted chunks |

### Chat
| Method | Route | Body |
| --- | --- | --- |
| `POST` | `/api/chat` | `{ message, conversationId?, documentIds?, regenerate? }` → **SSE** |

**SSE events:** `conversationId` · `rewritten` · `sources` · `token` · `followups` · `title` · `done` · `error`

### Conversations
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/conversations` | list (title, tags, updatedAt) |
| `POST` | `/api/conversations` | create |
| `GET` | `/api/conversations/:id` | full history |
| `PATCH` | `/api/conversations/:id` | rename / set selected docs |
| `DELETE` | `/api/conversations/:id` | delete |
| `PATCH` | `/api/conversations/:id/messages/:messageId/feedback` | 👍 / 👎 |

### Health
| Method | Route |
| --- | --- |
| `GET` | `/api/health` |

---

## 🗂️ Project Structure

```
ollama-rag/
├── docker-compose.yml          # Qdrant + MongoDB
├── backend/
│   └── src/
│       ├── config/             # env, db, qdrant, ollama clients
│       ├── models/             # Document, Chunk, Conversation
│       ├── services/           # ingest, document(OCR), crawl (web), chunking,
│       │                       #   embedding, vector, rag, suggestion, radar
│       ├── controllers/        # document, chat, conversation
│       ├── routes/             # /documents, /chat, /conversations
│       ├── middleware/         # upload (multer), error handler
│       └── server.js
└── frontend/
    └── src/
        ├── components/         # Chat, MessageBubble, Sources, FileUpload,
        │                       #   WebScrape, DocumentList, ConversationList,
        │                       #   OcrDrawer, RadarDrawer, Onboarding, ThemeToggle
        ├── api.ts              # REST + SSE client
        ├── types.ts
        └── App.tsx
```

---

## 🗺️ Roadmap

Ideas on deck (see `RAG_OPTIMIZATION.md` for the full 50-point checklist):

- [ ] 🔐 **Authentication + per-user isolation** — scope documents & conversations by owner
- [ ] 🔔 **Error toasts** — surface upload/crawl/network failures in the UI
- [ ] 📱 **Mobile-responsive layout** — drawer sidebar + bottom sheets
- [ ] 🔀 **Hybrid search** (dense + BM25) + **cross-encoder reranking**
- [ ] 🟢 **Groundedness / trust badge** (answer-vs-sources self-check)
- [ ] 🗂️ **Projects / Workspaces** — group docs + chats + custom instructions
- [ ] 🪪 **Smart Document Cards** — auto-extract structured fields + cross-document consistency checks
- [ ] 🔒 **Privacy mode** — detect & mask PII

**Done recently:** ✅ Website crawling (static + JS rendering) · ✅ linked-file import · ✅ clickable citations · ✅ Document Radar · ✅ read-aloud + translate · ✅ dark mode

---

<div align="center">

Built with 🦙 Ollama · ⚡ Qdrant · 🍃 MongoDB · ⚛️ React

</div>
