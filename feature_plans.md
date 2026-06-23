# Ollama RAG Feature Plans & Roadmap

This document outlines proposed feature enhancements, architectural upgrades, and UI/UX improvements for the **Ollama RAG** application. These features aim to turn the project from a basic RAG system into a production-grade, highly performant, and user-friendly document intelligence assistant.

---

## 🚀 1. Core Retrieval & Search Upgrades

To improve the relevance of retrieved context and answer accuracy:

### 🔍 Hybrid Search (Dense + Sparse)
*   **What**: Combine dense semantic search (Qdrant vectors) with sparse keyword matching (MongoDB text search or BM25).
*   **Why**: Semantic search excels at capturing concepts, but can miss exact keywords (e.g., product IDs, error codes, specific names). Combining both ensures the best of both worlds.
*   **Implementation**:
    *   Perform a text search query on MongoDB in parallel with the Qdrant vector search.
    *   Apply Reciprocal Rank Fusion (RRF) to merge and score the results.

### 🔄 Re-ranking (Cross-Encoders)
*   **What**: Retrieve a larger set of chunks from Qdrant (e.g., `top_k = 20`) and use a lightweight re-ranking model to select the top 5 most relevant chunks.
*   **Why**: Bi-encoders used for initial search are fast but less precise. A cross-encoder re-ranker evaluates the query and chunk together, drastically improving precision.
*   **Implementation**: Integrate a re-ranker model via a cloud service or local worker (e.g., `BAAI/bge-reranker-large`).

### 🧬 Query Expansion & Sub-Query Generation
*   **What**: Generate 3-5 variations of the user's query or break complex multi-part questions into sub-queries.
*   **Why**: A user's query might be phrased differently than the document text. Query expansion retrieves a broader set of matching documents.

---

## 📂 2. Data Ingestion & Processing

To support more file types and improve text chunk quality:

### 🧩 Semantic Chunking
*   **What**: Move from fixed character-based chunking with overlap to semantic boundary-based chunking.
*   **Why**: Sentences or paragraphs split in the middle of a thought lose context. Chunking based on headers, HTML/Markdown structure, or sentence embeddings keeps coherent thoughts together.
*   **Implementation**: Implement a layout-aware parser for Markdown and PDFs.

### 🌐 Web Scraping & URL Import
*   **What**: Allow users to paste a website URL, YouTube link (with transcript), or API documentation endpoint to ingest its content.
*   **Why**: Expands the sources of knowledge beyond static local files.

### 🖼️ OCR (Optical Character Recognition) for PDFs & Images
*   **What**: Support text extraction from scanned PDFs, diagrams, and images.
*   **Why**: Many enterprise documents are scans of paper forms/contracts.
*   **Implementation**: Integrate `tesseract.js` or a cloud OCR API during the text extraction stage.

---

## 💬 3. Chat & Session Management

To turn the chat interface into a multi-session workplace tool:

### 🗂️ Chat History & Sessions
*   **What**: Store multiple distinct chat conversations in MongoDB.
*   **Why**: Users need to switch context between different topics or tasks without losing history.
*   **Implementation**: Create a `Conversation` model in Mongo containing messages, timestamps, and references to specific active documents.

### 🧠 Summarized Context & Long-term Memory
*   **What**: When conversation history grows beyond the LLM's context window, summarize earlier exchanges.
*   **Why**: Prevents out-of-token errors and maintains conversation continuity.

---

## 🎨 4. Premium UI/UX Features Roadmap

To create a visually stunning, production-ready, and highly interactive user interface, we propose the following UI/UX feature enhancements:

### 📱 1. Responsive Layout & Mobile Collapsible Sidebar
*   **What**: Adapt the layout to tablet and mobile screens, implementing a collapsible hamburger drawer for the sidebar.
*   **Why**: Users need to interact with the chat or review documents on mobile/tablet devices.
*   **Implementation**: Use CSS media queries and Tailwind classes (`lg:flex`, `hidden`, etc.) to toggle a slide-over navigation overlay for mobile screens.

### 🌒 2. Theme Toggle (System / Dark / Light Modes)
*   **What**: Add a toggle button in the header to switch between Dark Mode, Light Mode, and System Default.
*   **Why**: Matches modern application aesthetics, reduces eye strain, and provides customized accessibility.
*   **Implementation**: Configure Tailwind's `darkMode: 'class'` and store theme preferences in `localStorage`, adding deep slate (`bg-slate-900`/`text-slate-100`) styling.

### 📝 3. Rich Markdown & Syntax Highlighted Code Renderer
*   **What**: Render markdown formatted output (headers, lists, tables, bold, italics) and syntax-highlighted code blocks in the chat response bubble.
*   **Why**: Code snippets and structured data (like tables) are difficult to read in plain text.
*   **Implementation**: Install `react-markdown` and `react-syntax-highlighter` in the frontend, customizing code blocks with a quick-copy button.

### 📂 4. Document Library Categories, Search & Filter
*   **What**: Add folder-like grouping, search queries, and tag filtering (e.g. "Legal", "Finance") in the Document List.
*   **Why**: Managing a large number of uploaded documents becomes difficult without organization.
*   **Implementation**: Add a metadata tag column to the Document model and create a search/tag selector bar in the document sidebar.

### 🔍 5. Chat History Search & Pinning
*   **What**: Add a search bar to search past chat session titles and a pin icon to pin crucial chats to the top of the sidebar.
*   **Why**: Helps users organize and quickly locate active research lines.
*   **Implementation**: Add an `isPinned` boolean field to the Conversation model and sort by `isPinned: -1, updatedAt: -1`.

### 👁️ 6. Highlighted Source Citation Preview Drawer
*   **What**: Clicking on an inline citation index (e.g., `[1]`) opens the right-side OCR drawer and automatically scrolls to and highlights the exact matching chunk.
*   **Why**: Provides instant verification of LLM assertions in the source document.
*   **Implementation**: Target the matched chunk index and scroll the chunk div in `OcrDrawer` into view using CSS highlighting.

### 🔄 7. Regenerate Response, Stop Stream & Feedback Icons
*   **What**: Add controls to regenerate the last AI response, stop active token generation, and rate answers (Thumbs Up/Down).
*   **Why**: Improves LLM control and allows collection of feedback data for RAG tuning.
*   **Implementation**: Expose standard REST endpoints for ratings and wire the abort controller to a visible "Stop" button in the response area.

### 📊 8. Execution Trace & RAG Inspector Panel
*   **What**: A collapsible "Inspector" trace panel detailing how the RAG pipeline generated the response:
    1.  The query rewriting transition (original query vs rewritten query).
    2.  Retrieved chunks list with raw cosine similarity scores.
    3.  Total token counts and processing latency.
*   **Why**: Builds trust by showing transparency in search performance and grounding metrics.
