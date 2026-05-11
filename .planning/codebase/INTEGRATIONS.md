# External Integrations

**Analysis Date:** 2026-01-28

## APIs & External Services

**LLM Services (Content Analysis):**
- DeepSeek API - Primary LLM for article tagging, summarization, entity extraction
  - SDK/Client: httpx (manual HTTP calls)
  - Auth: `DEEPSEEK_API_KEY` env var
  - Endpoint: `https://api.deepseek.com/v1/chat/completions`
  - Usage: `backend/app/services/llm.py::call_deepseek()`
  - Model: `deepseek-chat`
  - Cost: ~$0.001 per article

- Ollama (Local LLM) - Fallback when DeepSeek unavailable
  - SDK/Client: httpx (manual HTTP calls)
  - Connection: `OLLAMA_URL` env var (default: `http://ollama:11434`)
  - Endpoint: `http://ollama:11434/api/generate` for chat
  - Endpoint: `http://ollama:11434/api/embeddings` for embeddings
  - Usage: `backend/app/services/llm.py::call_ollama()`
  - Supported models: llama3.2 (default), Mistral, Qwen
  - Docker profile: `local-llm`

**Embedding Models:**
- DeepSeek Embeddings API - Via same `DEEPSEEK_API_KEY`
  - Endpoint: `https://api.deepseek.com/v1/embeddings`
  - Model: `deepseek-chat`
  - Output dimension: 1536 vectors
  - Fallback: Ollama `nomic-embed-text` model

**Messaging (Telegram Bot):**
- Telegram Bot API - Message capture via unofficial telegram channel
  - SDK/Client: `python-telegram-bot==20.7`
  - Auth: `TELEGRAM_BOT_TOKEN` env var
  - Implementation: `bot/main.py`
  - Modes: Polling (default) or Webhook
  - Polling: `USE_POLLING=true` env var
  - Webhook: `WEBHOOK_URL` env var + Docker Compose service
  - Commands: `/start`, `/help`, `/status`
  - Function: Extract URLs from messages, save to `/api/articles`

**Content Extraction (Web):**
- No external service - Uses local libraries (trafilatura, readability-lxml, BeautifulSoup)
- User-Agent spoofing: Chromium 120 User-Agent string in `backend/app/services/extractor.py::fetch_url()`

## Data Storage

**Databases:**
- PostgreSQL 16 with pgvector extension
  - Connection: `DATABASE_URL` env var (format: `postgresql://postgres:PASSWORD@host:5432/recall`)
  - Client: SQLAlchemy 2.0.25 async with asyncpg driver
  - Connection pool: 5 base + 10 overflow connections
  - Tables: `users`, `articles`, `tags`, `entities`, `embeddings`, `relations`, `user_domains`
  - Vector columns: 1536-dimensional embeddings in `embeddings.embedding` column
  - Docker image: `pgvector/pgvector:pg16`
  - Persistent volume: `pgdata:/var/lib/postgresql/data`
  - Health check: `pg_isready` command
  - Migrations: Alembic-based at `backend/migrations/` (init.sql mounted at startup)

**File Storage:**
- Local filesystem only - No external file storage
- Article content not persisted (only URL, metadata, summary, quotes)
- User data persists in PostgreSQL only

**Caching:**
- Frontend PWA cache via Workbox (runtime caching)
  - API responses cached for 24 hours
  - Cache strategy: NetworkFirst (try network, fallback to cache)
  - Implementation: `frontend/vite.config.ts::workbox` config

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication (no external provider)
  - Implementation: `backend/app/routers/auth.py`
  - Token library: `python-jose[cryptography]`
  - User model: `backend/app/models.py::User` (api_key field)
  - Default user for initial setup (simplistic approach for self-hosted)
  - Telegram bot uses: `X-API-Key: default-api-key` header (insecure, needs fixing)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Console/stdout logging via Python `logging` module
- FastAPI logs via Uvicorn
- Telegram bot logs to stdout (`logging.basicConfig()` in `bot/main.py`)
- No centralized log aggregation detected

**Health Checks:**
- PostgreSQL health check in docker-compose (pg_isready)
- API health endpoint: `GET /health` in `backend/app/main.py`
- Telegram bot status command: `/status` checks `API_URL/health`

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker Compose (local or VPS)
- Docker images: Python 3.11-slim for backend and bot, Node image (inferred) for frontend
- Multi-service architecture: web (React), api (FastAPI), bot (Telegram), postgres, ollama (optional), tunnel services (optional)

**Tunneling (For Multi-Device Access):**
- Cloudflare Tunnel - Free, stable URL
  - Image: `cloudflare/cloudflared`
  - Command: `tunnel --url http://web:3000`
  - Profile: `tunnel-cloudflare`
  - URL configuration: `PUBLIC_URL` env var

- Tailscale - Private VPN access
  - Image: `tailscale/tailscale`
  - Auth: `TAILSCALE_AUTHKEY` env var
  - Hostname: `recall`
  - Network capabilities: NET_ADMIN, SYS_MODULE + TUN device
  - Profile: `tunnel-tailscale`
  - Persistent volume: `tailscale_data:/var/lib/tailscale`

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or Jenkins

## Environment Configuration

**Required env vars:**
- `DB_PASSWORD` - PostgreSQL password (must be changed in production)
- `SECRET_KEY` - JWT signing key (must be random in production)
- Either `DEEPSEEK_API_KEY` or `OLLAMA_URL` (or both)
- `PUBLIC_URL` - Base URL for multi-device access (e.g., tunnel URL)

**Optional env vars:**
- `TELEGRAM_BOT_TOKEN` - For Telegram bot capture method
- `USE_POLLING` - Telegram polling mode (true/false)
- `OLLAMA_URL` - Local Ollama endpoint if not using DeepSeek
- `TAILSCALE_AUTHKEY` - For Tailscale tunnel profile

**Secrets location:**
- Environment variables via `.env` file (local) or docker-compose secrets (production)
- No secrets manager integration detected
- Pydantic Settings loads from `.env` at `backend/app/config.py`

## Webhooks & Callbacks

**Incoming:**
- Telegram webhook (optional): `POST /api/telegram/webhook` in FastAPI
  - Only used if `USE_POLLING=false`
  - Webhook URL: `{PUBLIC_URL}/api/telegram/webhook`
  - Port: 8443 (Telegram bot webhook port)
  - Configured in `bot/main.py::main()` with `application.run_webhook()`

**Outgoing:**
- None detected - No callbacks to external services after article processing
- PWA Share Target: Receives shares from mobile OS (one-way, not webhook)

## Extension Communication

**Chrome Extension (Manifest V3):**
- Background service worker: `extension/background.js`
- Popup UI: `extension/popup.html`
- Settings page: `extension/options.html`
- Permissions: `storage`, `activeTab`, `contextMenus`, `<all_urls>`
- Communication: Fetch to `PUBLIC_URL/api/articles` endpoint
- No external APIs called from extension directly

**Mobile PWA:**
- Share Target integration via manifest
  - Endpoint: `/share` (GET with `?title=&text=&url=`)
  - Web app manifest: Configured in `frontend/vite.config.ts`
- Service Worker: Managed by Workbox via vite-plugin-pwa

---

*Integration audit: 2026-01-28*
