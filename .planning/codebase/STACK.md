# Technology Stack

**Analysis Date:** 2026-01-28

## Languages

**Primary:**
- Python 3.11+ - Backend API, Telegram bot, migrations
- TypeScript 5.3 - React frontend with type safety
- JavaScript (vanilla) - Chrome Extension (MV3)
- SQL - PostgreSQL database migrations and queries

**Secondary:**
- HTML/CSS - Extension UI, frontend templates
- YAML - Docker Compose orchestration

## Runtime

**Environment:**
- Python 3.11+ runtime (FastAPI backend)
- Node.js (npm-based frontend)
- Chrome/Edge for extension runtime
- Ollama (optional local LLM runtime)

**Package Manager:**
- `pip` with `pyproject.toml` (backend at `backend/pyproject.toml`)
- `npm` (frontend at `frontend/package.json`)
- No lockfile tracked (should use `requirements.txt` and `package-lock.json`)

## Frameworks

**Core:**
- FastAPI 0.109.2 - Async Python web framework for REST API (`backend/app/main.py`)
- React 18.2.0 - UI framework (`frontend/src`)
- Uvicorn 0.27.1 - ASGI server for FastAPI (`backend/`)

**Database & ORM:**
- SQLAlchemy 2.0.25 - Async ORM with PostgreSQL support (`backend/app/models.py`)
- Alembic 1.13.1 - Database migrations (`backend/migrations/`)
- asyncpg 0.29.0 - Async PostgreSQL adapter
- pgvector 0.2.5 - Vector embedding storage in PostgreSQL

**Frontend Libraries:**
- React Router DOM 6.21.3 - Client-side routing (`frontend/src/pages`)
- TanStack React Query 5.17.19 - Server state management (`frontend/src`)
- react-force-graph-2d 1.25.4 - Knowledge graph visualization
- Lucide React 0.312.0 - Icon library
- date-fns 3.3.1 - Date utilities
- clsx 2.1.0 - Conditional CSS

**Styling:**
- TailwindCSS 3.4.1 - Utility-first CSS (`frontend/tailwind.config.js`)
- PostCSS 8.4.33 - CSS processing

**Build & Dev:**
- Vite 5.0.12 - Frontend build tool and dev server (`frontend/vite.config.ts`)
- TypeScript 5.3.3 - Type checking
- Vitest 1.2.2 - Unit test runner (`frontend/vitest.config.ts`)
- vite-plugin-pwa 0.17.5 - PWA support for mobile share target

**Testing:**
- pytest 8.0.0+ - Python test runner (backend)
- pytest-asyncio 0.23.4+ - Async test support
- pytest-cov 4.1.0+ - Coverage reporting
- @testing-library/react 14.1.2 - React component testing
- @testing-library/jest-dom 6.3.0 - DOM assertions
- msw 2.1.5 - Mock Service Worker for API mocking

**Code Quality:**
- ESLint - JavaScript linting (frontend)
- ruff 0.2.0+ - Python linting (`backend/pyproject.toml`)
- mypy 1.8.0+ - Python type checking
- Prettier (inferred) - Code formatting

**Telegram Bot:**
- python-telegram-bot 20.7 - Official Telegram bot SDK (`bot/main.py`)

## Key Dependencies

**Critical:**
- httpx 0.26.0 - Async HTTP client for API calls to LLM services, article fetching
- beautifulsoup4 4.12.3 - HTML parsing
- readability-lxml 0.8.1 - Article content extraction fallback
- trafilatura 1.6.3 - Article extraction (primary method)
- lxml 5.1.0 - XML/HTML processing

**Security & Auth:**
- python-jose[cryptography] 3.3.0 - JWT token generation (`backend/app/routers/auth.py`)
- passlib[bcrypt] 1.7.4 - Password hashing
- pydantic 2.6.1 - Data validation
- pydantic-settings 2.1.0 - Environment configuration

**Infrastructure:**
- numpy 1.26.4 - Vector operations (minimal, might be pgvector dependency)
- python-multipart 0.0.9 - Multipart form handling
- aiohttp 3.9.3 - Async HTTP (if used alongside httpx)

## Configuration

**Environment:**
- Pydantic Settings (`backend/app/config.py`) - Loads from `.env` file
- Environment variables required: `DB_PASSWORD`, `SECRET_KEY`, `DEEPSEEK_API_KEY` or `OLLAMA_URL`, `PUBLIC_URL`, `TELEGRAM_BOT_TOKEN` (optional)
- `.env.example` provides template at project root

**Build:**
- Backend: Python setuptools via `pyproject.toml`
- Frontend: Vite config at `frontend/vite.config.ts`
- Docker Compose: `docker-compose.yml` (supports profiles: `local-llm`, `with-bot`, `tunnel-cloudflare`, `tunnel-tailscale`)

## Platform Requirements

**Development:**
- Python 3.11+
- Node.js 18+ (for npm)
- Docker & Docker Compose (for full stack)
- PostgreSQL 16 with pgvector extension (via `pgvector/pgvector:pg16` image)
- Optional: Ollama for local LLM (`ollama/ollama` image)

**Production:**
- Docker Compose orchestration (self-hosted)
- PostgreSQL 16 database (persistent volume at `pgdata:/var/lib/postgresql/data`)
- Tunnel provider: Cloudflare, Tailscale, or ngrok (for multi-device access)
- Optional: Telegram bot token from BotFather

**Browser Support:**
- Chrome/Edge extension: Manifest V3 compatible browsers
- Frontend PWA: Modern browsers supporting ES2020+
- PWA Share Target: iOS Safari 15+, Android Chrome

---

*Stack analysis: 2026-01-28*
