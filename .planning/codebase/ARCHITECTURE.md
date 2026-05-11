# Architecture

**Analysis Date:** 2026-01-28

## Pattern Overview

**Overall:** Microservices with async processing pipeline

**Key Characteristics:**
- Multi-tier architecture (frontend, API, background processing, database)
- Asynchronous background processing for LLM tasks
- API-first design with independent client applications (browser extension, web, bot)
- Event-driven capture with deferred enrichment (immediate capture → background AI processing)
- Graph-based knowledge connections using rule-based relations

## Layers

**Presentation Layer:**
- Purpose: User-facing interfaces for capturing and accessing knowledge
- Location: `frontend/src`, `extension/`, `bot/`
- Contains: React components, Chrome MV3 extension, Telegram bot
- Depends on: Backend API, environment configuration
- Used by: End users

**API Layer:**
- Purpose: HTTP REST API handling all business logic and data access
- Location: `backend/app/main.py`, `backend/app/routers/`
- Contains: FastAPI routers (articles, search, graph, tags, read_later, auth)
- Depends on: Database, LLM services, content extraction
- Used by: Web frontend, extension, bot, PWA

**Service Layer:**
- Purpose: Core business logic for content extraction, AI processing, and graph building
- Location: `backend/app/services/`
- Contains: `extractor.py` (content extraction), `llm.py` (AI analysis), `graph.py` (relation building)
- Depends on: Database models, external APIs (DeepSeek/Ollama)
- Used by: Routers for background processing

**Data Layer:**
- Purpose: Persistent storage and ORM abstractions
- Location: `backend/app/models.py`, `backend/app/database.py`
- Contains: SQLAlchemy models, async session management, pgvector integration
- Depends on: PostgreSQL database
- Used by: All service and router layers

**Infrastructure Layer:**
- Purpose: Docker containerization and orchestration
- Location: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `bot/Dockerfile`
- Contains: Service definitions, networking, volumes, health checks
- Depends on: Docker, PostgreSQL, pgvector
- Used by: Deployment and development

## Data Flow

**Article Capture Flow (Sync + Async):**

1. **Capture Event** → User triggers save via extension/PWA/Telegram
2. **Immediate Storage** → `POST /api/articles` → Extractor.extract_content() → Store URL + metadata in Articles table
3. **Response** → Return article ID + "pending" status immediately (< 500ms)
4. **Background Processing** → process_article_background() task runs async:
   - Fetch/extract content (trafilatura + readability fallback)
   - LLM Analysis: generate summary, tags, entities via DeepSeek or Ollama
   - Generate Embedding: title+summary → 1536-dim vector
   - Build Relations: compare with recent articles (tag overlap, entity match, embedding similarity)
   - Store tags, entities, embedding, relations
   - Update article status to "completed" or "failed"

**Search Flow (Keyword + Semantic):**

1. `POST /api/search` → SearchRequest (query, mode, filters)
2. **Keyword Branch** → FTS on title+summary+key_quotes using PostgreSQL
3. **Semantic Branch** → Generate embedding for query → pgvector cosine_similarity search
4. **Merge Results** → Combine both modes, deduplicate, apply limit
5. Return ArticleResponse list

**Graph Building Flow (Rule-Based):**

1. After article embedding is ready, `build_relations_for_article()` triggered
2. Compare new article against recent 100 articles:
   - **SAME_TOPIC**: 2+ shared (domain, topic) tags → strength = overlap_ratio
   - **SAME_AUTHOR**: Same author field → strength = 1.0
   - **SAME_DOMAIN**: Same source_domain → strength = 0.5
   - **SAME_ENTITY**: Shared named entities → strength = entity_ratio
   - **SIMILAR**: Embedding cosine_similarity > 0.8 → strength = similarity_score
3. Store Relation records with constraints (article_a < article_b)
4. Return relations for frontend visualization

**State Management:**

- **Article Processing Status**: pending → completed/failed
- **Article Read Status**: unread → read (user action)
- **Read Later Queue**: is_read_later boolean flag
- **Graph Visibility**: Relations stored, queried for subgraph visualization

## Key Abstractions

**Article (Core Entity):**
- Purpose: Represents a saved piece of content
- Examples: `backend/app/models.py` line 24-69
- Pattern: SQLAlchemy ORM model with relationships to tags, entities, embedding, user

**ExtractedContent (Value Object):**
- Purpose: Immutable result of content extraction before database storage
- Examples: `backend/app/services/extractor.py` line 12-24
- Pattern: Dataclass containing extracted metadata, title, content, language

**AnalysisResult (Value Object):**
- Purpose: Structured output from LLM analysis
- Examples: `backend/app/services/llm.py` line 10-15
- Pattern: Dataclass with summary, key_quotes, tags (list of dicts), entities (list of dicts)

**Relation (Graph Edge):**
- Purpose: Typed connection between articles with strength score
- Examples: `backend/app/models.py` line 117-132
- Pattern: SQLAlchemy model enforcing unique constraints and strength bounds (0-1)

**Tag (Grounded Taxonomy):**
- Purpose: Hierarchical organizational label (domain + topic + optional entity)
- Examples: `backend/app/models.py` line 71-86, `backend/app/services/llm.py` line 18-27
- Pattern: 3-level taxonomy (domains: technology, business, science, culture, career)

## Entry Points

**Backend API:**
- Location: `backend/app/main.py`
- Triggers: HTTP requests to /api/* endpoints
- Responsibilities: CORS setup, router mounting, health checks

**Chrome Extension:**
- Location: `extension/background.js`
- Triggers: Context menu click, keyboard shortcut (Cmd/Ctrl+Shift+S), message from popup
- Responsibilities: Extract tab URL/content, POST to /api/articles, show notifications

**Web Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser navigation to /
- Responsibilities: Initialize React+Router, setup React Query client, render Layout

**Telegram Bot:**
- Location: `bot/main.py`
- Triggers: Telegram user sends message or command
- Responsibilities: Extract URLs from message, POST to /api/articles, reply with status

**PWA Share Target:**
- Location: `frontend/public/manifest.json` (manifest defines share_target)
- Triggers: Native share sheet on iOS/Android → "Recall" app selected
- Responsibilities: Handle shared URL, navigate to /share page, capture via API

## Error Handling

**Strategy:** Graceful degradation with fallback chains

**Patterns:**

- **Content Extraction**: Trafilatura → Readability fallback → mark as "pending_analysis"
- **LLM Processing**: DeepSeek API → Ollama local → Rule-based extraction (no LLM)
- **Embedding**: Generate from summary, skip if LLM unavailable
- **Extension Capture**: POST with/without content (if content script fails)
- **Article Storage**: Deduplication by url_hash, return 409 if duplicate
- **Background Tasks**: Mark as "failed" on exception, log error, don't crash API

## Cross-Cutting Concerns

**Logging:**
- Backend: Python logging via app.routers and app.services
- Frontend: Console logging + React Query dev tools
- Bot: Telegram logger to stdout
- Pattern: Structured logging at INFO level for flows, ERROR for exceptions

**Validation:**
- Backend: Pydantic schemas in `backend/app/schemas.py` for request/response validation
- Extension: Client-side URL validation before POST
- Frontend: React hook validation via React Query mutation onSuccess
- Pattern: Fail-fast validation at input boundaries

**Authentication:**
- Mechanism: X-API-Key header (simple token-based, not JWT)
- Storage: User.api_key in database (one per user)
- Location: `backend/app/routers/auth.py` get_current_user() dependency
- Pattern: Dependency injection in FastAPI routers

**Rate Limiting:** Not implemented (self-hosted assumption)

**CORS:** Allow-all policy in `backend/app/main.py` line 16-22 (self-hosted, same origin not guaranteed)

---

*Architecture analysis: 2026-01-28*
