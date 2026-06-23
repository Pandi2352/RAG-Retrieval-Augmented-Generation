# RAG Chatbot — UI Plan & 50-Point Optimization Checklist

Scope: Express + MongoDB + Qdrant + Xenova embeddings + Ollama (chat `glm-5.2:cloud`, Vision OCR) backend; React + TypeScript + Tailwind frontend.

---

## Part A — UI/UX Plan

### Layout (3-pane workspace)
```
┌──────────────┬───────────────────────────────┬──────────────────┐
│  Sidebar     │           Chat                │  Source / Doc     │
│  ──────────  │  ───────────────────────────  │  Inspector        │
│  Conversa-   │  message stream (markdown)    │  (slide-in)       │
│  tions       │  + inline [1][2] citations    │                   │
│  ──────────  │                               │  highlighted      │
│  Documents   │  ───────────────────────────  │  chunk / page     │
│  + status    │  composer (textarea + send)   │                   │
└──────────────┴───────────────────────────────┴──────────────────┘
```
- **Left rail**: collapsible. Tabs for *Conversations* and *Documents*. Search box at top.
- **Center**: chat. Markdown rendering, code blocks, copy button, citation chips.
- **Right inspector**: opens when a citation/source is clicked — shows the exact chunk (and PDF page image from your OCR pipeline) with the matched text highlighted.

### Core UI flows to implement
1. **Markdown answers** — render assistant text as Markdown (`react-markdown` + `remark-gfm`), with syntax-highlighted code and GitHub-style tables.
2. **Inline clickable citations** — turn `[1]` markers into chips that scroll/open the right-side inspector to that chunk.
3. **Streaming polish** — token-by-token render, blinking caret, auto-scroll that pauses when the user scrolls up.
4. **Per-message actions** — copy, regenerate, thumbs up/down (store feedback), "show sources".
5. **Upload UX** — drag-drop with per-file progress driven by `statusStep` (Extracting → OCR page N → Embedding → Storing → Ready), retry on failure.
6. **Empty & loading states** — skeletons for conversation/doc lists; friendly empty state with suggested questions.
7. **Suggested prompts** — chips generated from document summaries on first open.
8. **Responsive + mobile** — rail collapses to a drawer; inspector becomes a bottom sheet.
9. **Dark mode** — Tailwind `dark:` variants + system preference + toggle.
10. **Keyboard** — `Enter` send / `Shift+Enter` newline, `Ctrl+K` command palette, `Esc` close inspector.

### Visual system
- Tailwind tokens: one accent (indigo), neutral slate scale, semantic colors for trust badges (green/amber/red) and doc status.
- Consistent radius (`rounded-xl`), soft shadows, `prose` class for answer typography.
- Micro-interactions: source chip hover preview, status pulse, send-button state.

---

## Part B — 50-Point Optimization Checklist

### UI / UX (1–14)
- [ ] 1. Render assistant messages as **Markdown** (tables, lists, code) instead of plain text.
- [ ] 2. Make `[n]` **citations clickable** → open source inspector and highlight the chunk.
- [ ] 3. Add a **source inspector panel** showing the matched chunk + PDF page image with highlight.
- [ ] 4. Stream tokens with a **typing caret** and smart auto-scroll (pause when user scrolls up).
- [ ] 5. Add **copy / regenerate / 👍👎 feedback** buttons per assistant message.
- [ ] 6. Show **per-file upload progress** wired to `statusStep`, with retry on failure.
- [ ] 7. Display a **groundedness/trust badge** (grounded / partial / unsupported) per answer.
- [ ] 8. Add **skeleton loaders** + empty states for conversations, documents, and chat.
- [ ] 9. Generate **suggested questions** (chips) per document / on first conversation open.
- [ ] 10. Add **document collections/folders + tags**; scope chat to a collection.
- [ ] 11. **Search & filter** for conversations and documents in the sidebar.
- [ ] 12. **Export conversation** to Markdown / PDF; optional shareable read-only link.
- [ ] 13. **Dark mode** + responsive layout (drawer rail, bottom-sheet inspector on mobile).
- [ ] 14. **Keyboard shortcuts** + command palette (`Ctrl+K`) for new chat, upload, switch docs.

### Retrieval & RAG quality (15–26)
- [ ] 15. Add **hybrid search**: Qdrant sparse (BM25) vectors fused with dense via RRF.
- [ ] 16. Add a **cross-encoder reranker** (e.g. `Xenova/ms-marco-MiniLM-L-6-v2`) over top-N.
- [ ] 17. **Parent-child chunking**: retrieve small chunks, feed model the parent context.
- [ ] 18. **Multi-query expansion**: generate N query variants, merge & dedupe results.
- [ ] 19. Try **HyDE** (embed a hypothetical answer) in addition to query rewriting.
- [ ] 20. **Contextual chunk enrichment**: prepend an LLM-written 1-line context to each chunk before embedding.
- [ ] 21. **Tune `SCORE_THRESHOLD` and `topK`** empirically against an eval set.
- [ ] 22. **Deduplicate / merge** near-identical retrieved chunks before context assembly.
- [ ] 23. **Maximal Marginal Relevance (MMR)** to diversify retrieved chunks.
- [ ] 24. **Metadata filtering** (document, collection, date) pushed into the Qdrant query.
- [ ] 25. **Normalize/clean text** before embedding (whitespace, headers/footers, page numbers).
- [ ] 26. **Verify embedding dim consistency** (MiniLM = 384) across collection + recreate guard.

### Ingestion, chunking & OCR (27–33)
- [ ] 27. **Semantic / sentence-aware chunking** instead of fixed-size character windows.
- [ ] 28. **Table-aware OCR**: prompt the vision model to emit tables as Markdown/JSON.
- [ ] 29. **Skip OCR for native-text PDFs** (try text-layer extraction first, OCR only as fallback) to cut cost/latency.
- [ ] 30. **Parallelize OCR pages** with a concurrency cap instead of strictly sequential.
- [ ] 31. **Deduplicate documents** by content hash to avoid re-ingesting the same file.
- [ ] 32. **Auto-summary + keyword/entity extraction** per document at ingest time.
- [ ] 33. **Store page/position metadata** per chunk for precise citation highlighting.

### Answer quality & prompting (34–39)
- [ ] 34. **Groundedness self-check** pass: flag claims not supported by sources.
- [ ] 35. **Explicit "I don't know"** behavior when retrieval is empty/low-score (already partly done — harden it).
- [ ] 36. **Inline citation enforcement** in the system prompt + post-validate that cited `[n]` exist.
- [ ] 37. **Conversation summarization / sliding window** to cap history token growth.
- [ ] 38. **Agentic multi-step mode** for complex questions (decompose → retrieve → synthesize).
- [ ] 39. **Answer caching** keyed by (normalized query + doc set) for repeated questions.

### Performance & cost (40–44)
- [ ] 40. **Embedding cache** keyed by chunk hash to avoid recomputation on re-upload.
- [ ] 41. **Batch embeddings** efficiently (already batched — profile and raise batch size).
- [ ] 42. **Stream first token fast**: run retrieval in parallel with prompt assembly where possible.
- [ ] 43. **Index Mongo** queries (`documentId`, conversation `updatedAt`) and paginate lists.
- [ ] 44. **Quantize vectors** in Qdrant (scalar/product quantization) for memory at scale.

### Reliability & observability (45–48)
- [ ] 45. **Retry with backoff** for Ollama/Qdrant calls; graceful per-stage error surfacing in UI.
- [ ] 46. **Structured logging + request IDs**; log retrieval scores per query.
- [ ] 47. **Eval harness**: golden Q&A set scoring retrieval recall + answer faithfulness on each change.
- [ ] 48. **Health/readiness endpoints** for Mongo, Qdrant, Ollama; show status in UI.

### Security & privacy (49–50)
- [ ] 49. **AuthN/AuthZ + per-user document isolation** (filter Qdrant + Mongo by owner).
- [ ] 50. **Input limits & sanitization**: file-type/size validation, prompt-injection guardrails on retrieved content, rate limiting.

---

### Suggested order of attack
1. **UI essentials** (1–6) — makes everything else demoable.
2. **Retrieval wins** (15, 16, 17) — hybrid + rerank + parent-child = the biggest quality jump.
3. **Signature features** (2, 3, 7) — clickable citations + trust badge.
4. **Eval harness** (47) — so every later change is measurable.
