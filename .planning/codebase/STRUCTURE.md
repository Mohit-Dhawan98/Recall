# Codebase Structure

**Analysis Date:** 2026-01-28

## Directory Layout

```
Recall/
├── backend/                    # FastAPI backend (Python)
├── frontend/                   # React web app + PWA (TypeScript/React)
├── extension/                  # Chrome MV3 extension (JavaScript)
├── bot/                        # Telegram bot (Python)
├── docs/                       # Documentation
├── .planning/                  # GSD planning artifacts
├── docker-compose.yml          # Service orchestration
├── .env.example                # Environment template
├── README.md                   # Project overview
└── SPEC.md                     # Detailed specification
```

## Directory Purposes

**backend/**
- Purpose: FastAPI REST API server, business logic, database access
- Contains: Python app code, service layer, routers, models, schemas
- Key files: `app/main.py` (app entry), `app/models.py` (ORM), `app/services/` (business logic)

**frontend/**
- Purpose: React web application and PWA (progressive web app)
- Contains: React components, pages, API client, styling
- Key files: `src/main.tsx` (React entry), `src/App.tsx` (routing), `src/pages/` (route components)

**extension/**
- Purpose: Chrome extension manifest v3 for capturing articles
- Contains: Background worker, popup UI, options page, icons
- Key files: `manifest.json` (MV3 config), `background.js` (service worker), `popup.html`

**bot/**
- Purpose: Telegram bot for receiving and saving article links
- Contains: Python telegram bot handler with API integration
- Key files: `main.py` (bot entry, message handlers)

**docs/**
- Purpose: User-facing documentation
- Contains: Setup guides, self-hosting instructions

## Key File Locations

**Entry Points:**

- `backend/app/main.py`: FastAPI app initialization, CORS, router mounting
- `frontend/src/main.tsx`: React DOM render, QueryClient setup, BrowserRouter
- `extension/background.js`: Service worker for Chrome, context menu, keyboard commands
- `extension/popup.html`: Popup UI triggered by extension icon
- `bot/main.py`: Telegram Application initialization, handlers, polling/webhook setup

**Configuration:**

- `backend/app/config.py`: Pydantic Settings (database_url, LLM keys, public_url)
- `frontend/.env`: Frontend env (built into VITE_API_URL)
- `.env.example`: Template for required env vars (DB_PASSWORD, DEEPSEEK_API_KEY, etc.)
- `docker-compose.yml`: Service definitions, volumes, profiles (bot, local-llm, tunnels)

**Core Logic:**

- `backend/app/models.py`: SQLAlchemy ORM models (Article, Tag, Entity, Embedding, Relation, User)
- `backend/app/schemas.py`: Pydantic request/response schemas for all endpoints
- `backend/app/services/extractor.py`: Content extraction (URL fetch, trafilatura, readability)
- `backend/app/services/llm.py`: LLM integration (DeepSeek API, Ollama, embedding generation)
- `backend/app/services/graph.py`: Relation building (tag overlap, entity match, similarity)

**API Routes:**

- `backend/app/routers/articles.py`: POST /api/articles (capture), GET/PATCH/DELETE articles
- `backend/app/routers/search.py`: POST /api/search (keyword + semantic search)
- `backend/app/routers/graph.py`: GET /api/graph, /api/graph/article/:id
- `backend/app/routers/tags.py`: GET /api/tags, /api/tags/:tag/articles
- `backend/app/routers/read_later.py`: GET /api/read-later, PATCH article read_later flag
- `backend/app/routers/auth.py`: User/API key authentication

**Frontend Pages:**

- `frontend/src/pages/Timeline.tsx`: Main article list view (reverse chronological)
- `frontend/src/pages/Search.tsx`: Keyword + semantic search interface
- `frontend/src/pages/Graph.tsx`: Knowledge graph visualization (focus mode)
- `frontend/src/pages/ReadLater.tsx`: Read later queue view
- `frontend/src/pages/ArticleDetail.tsx`: Single article detail modal/page
- `frontend/src/pages/Settings.tsx`: User settings (API key, preferences)
- `frontend/src/pages/Share.tsx`: PWA share target page (receives shared URL)

**Frontend Components:**

- `frontend/src/components/Layout.tsx`: Main layout wrapper (header, sidebar, outlet)
- `frontend/src/components/ArticleCard.tsx`: Reusable article list item component
- `frontend/src/api/client.ts`: API fetch wrapper (POST /articles, GET /search, etc.)

**Database:**

- `backend/app/database.py`: SQLAlchemy async engine, AsyncSessionLocal, get_db dependency
- `backend/migrations/init.sql`: Initial schema creation (users, articles, tags, etc.)

**Testing:**

- `backend/tests/`: Backend test files (if present)
- `frontend/src/test/setup.ts`: Frontend test configuration
- `extension/tests/`: Extension test files

## Naming Conventions

**Files:**

- Python backend files: `snake_case.py` (e.g., `extractor.py`, `llm.py`)
- React components: `PascalCase.tsx` (e.g., `ArticleCard.tsx`, `Timeline.tsx`)
- Extension files: `kebab-case.js` or direct names (e.g., `background.js`, `popup.js`)
- Routers: `<entity>.py` matching model names (e.g., `articles.py`, `tags.py`)
- Services: `<concern>.py` by function (e.g., `extractor.py`, `llm.py`)

**Directories:**

- Feature-based for frontend: `pages/`, `components/`, `api/`
- Feature-based for backend: `routers/`, `services/`, `models.py` (single file)
- Test directories: `tests/` or `src/test/`

## Where to Add New Code

**New Feature (e.g., Export to Note-Taking App):**
- Primary code: `backend/app/routers/exports.py` (new router)
- Service logic: `backend/app/services/exporters.py` (new service)
- Frontend: `frontend/src/pages/Exports.tsx` (new page)
- Tests: `backend/tests/test_exports.py`, `frontend/src/test/exports.test.ts`

**New Component (e.g., Filter Widget):**
- Implementation: `frontend/src/components/FilterWidget.tsx`
- Styling: Inline with Tailwind classes (no separate CSS files)
- Tests: `frontend/src/test/FilterWidget.test.ts`

**New API Endpoint (e.g., GET /api/articles/:id/related):**
- Router logic: `backend/app/routers/articles.py` (add new route function)
- Service logic: `backend/app/services/graph.py` or new service
- Schema: `backend/app/schemas.py` (add request/response classes)
- Tests: `backend/tests/test_articles.py`

**Utilities & Helpers:**
- Shared backend helpers: `backend/app/utils.py` (create if needed)
- Shared frontend hooks: `frontend/src/hooks/` (create directory, e.g., `useArticles.ts`)
- Extension utilities: `extension/scripts/` (e.g., `url-extractor.js`)

**Database Migrations (if using Alembic):**
- Create: `backend/migrations/versions/xxxxx_description.py`
- Or modify: `backend/migrations/init.sql` for new schema

## Special Directories

**backend/app/routers/**
- Purpose: API endpoint definitions
- Generated: No
- Committed: Yes
- Pattern: One router per domain (articles, search, graph, tags, read_later, auth)

**backend/app/services/**
- Purpose: Business logic layer
- Generated: No
- Committed: Yes
- Pattern: One service per concern (extractor, llm, graph)

**frontend/src/pages/**
- Purpose: Route-level components (one per URL path)
- Generated: No (create by hand)
- Committed: Yes
- Mapping: Timeline (/), Search (/search), Graph (/graph), ReadLater (/read-later), ArticleDetail (/article/:id), Settings (/settings), Share (/share)

**frontend/src/components/**
- Purpose: Reusable components
- Generated: No
- Committed: Yes
- Pattern: ArticleCard (list item), Layout (wrapper), etc.

**frontend/src/api/**
- Purpose: API client and hooks
- Generated: No
- Committed: Yes
- Contains: `client.ts` (HTTP wrapper), potentially React Query hooks

**extension/icons/**
- Purpose: Extension icon assets (PNG, SVG)
- Generated: No (manually created/designed)
- Committed: Yes
- Sizes: 16px, 48px, 128px (as specified in manifest.json)

**frontend/public/**
- Purpose: Static assets, manifest.json (PWA), favicon
- Generated: No
- Committed: Yes
- PWA manifest used for Share Target API, app installation

**.planning/codebase/**
- Purpose: GSD mapping documents
- Generated: Yes (by /gsd:map-codebase)
- Committed: Yes
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**backend/migrations/**
- Purpose: Database schema and initialization
- Generated: No (written by hand or Alembic)
- Committed: Yes
- Current: `init.sql` (schema creation)

**docker-compose.yml volumes:**
- `pgdata/`: PostgreSQL data persistence
- `ollama_data/`: Ollama model cache (optional)
- `tailscale_data/`: Tailscale VPN state (optional)

---

*Structure analysis: 2026-01-28*
