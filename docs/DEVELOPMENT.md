# Recall Development Guide

## Quick Start

```bash
# Start all services (PostgreSQL + API + Frontend)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**URLs:**
- **Web App:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs (Swagger UI)

---

## Services Overview

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| `web` | 3000 | React + Vite + Nginx | Frontend PWA |
| `api` | 8000 | FastAPI + Uvicorn | REST API |
| `postgres` | 5432 | PostgreSQL 16 + pgvector | Database |
| `bot` | - | Python + python-telegram-bot | Telegram capture (optional) |
| `ollama` | 11434 | Ollama | Local LLM (optional) |

---

## Startup Commands

### Basic (DeepSeek LLM)
```bash
docker compose up -d
```
Starts: postgres, api, web

### With Telegram Bot
```bash
docker compose --profile with-bot up -d
```
Starts: postgres, api, web, bot

### With Local LLM (Ollama)
```bash
docker compose --profile local-llm up -d
```
Starts: postgres, api, web, ollama

### With Everything
```bash
docker compose --profile with-bot --profile local-llm up -d
```

### Stop All
```bash
docker compose down
```

### Stop and Remove Volumes (reset database)
```bash
docker compose down -v
```

---

## Database

**Type:** PostgreSQL 16 with pgvector extension

**Connection:**
- Host: `localhost`
- Port: `5432`
- Database: `recall`
- User: `postgres`
- Password: (from .env `DB_PASSWORD`)

**Connect with psql:**
```bash
docker compose exec postgres psql -U postgres -d recall
```

**View tables:**
```sql
\dt
```

**Tables:**
- `users` - User accounts and API keys
- `articles` - Saved articles with metadata
- `tags` - AI-generated tags (domain/topic/entity)
- `entities` - Named entities extracted from articles
- `embeddings` - 1536-dim vectors for semantic search
- `relations` - Knowledge graph connections between articles
- `user_domains` - User's domain preferences

**Sample queries:**
```sql
-- Count articles
SELECT COUNT(*) FROM articles;

-- View recent articles
SELECT title, source_domain, captured_at FROM articles ORDER BY captured_at DESC LIMIT 10;

-- Check processing status
SELECT processing_status, COUNT(*) FROM articles GROUP BY processing_status;
```

---

## Chrome Extension

### Installation
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder

### Configuration
1. Click extension icon → "Options"
2. Set:
   - API URL: `http://localhost:8000`
   - API Key: `default-api-key`
3. Save

### Usage
- **Right-click** any page → "Save to Recall"
- **Keyboard:** `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows)
- **Popup:** Click extension icon → "Save Current Page"

### Where to See Saved Articles
1. Open http://localhost:3000
2. Articles appear in the Timeline (main page)
3. Click an article to see details, tags, summary

### Verification Checklist

Use this checklist after changes to the extension to verify everything works.

**Prerequisites:**
- Fresh database: `docker compose down -v && docker compose up -d`
- Extension loaded unpacked from `extension/` folder
- Extension options configured (API URL: `http://localhost:8000`, API Key: `default-api-key`)

**Capture Flow Tests:**

1. **Right-click context menu:**
   - Navigate to any article page (e.g., https://example.com)
   - Right-click → "Save to Recall"
   - Expected: Badge shows checkmark briefly, article appears at http://localhost:3000

2. **Keyboard shortcut:**
   - Navigate to any article page
   - Press Cmd+Shift+S (Mac) / Ctrl+Shift+S (Windows)
   - Expected: Badge shows checkmark briefly, article appears in Timeline

3. **Popup save button:**
   - Click extension icon to open popup
   - Page title and URL should be displayed
   - Click "Save Current Page"
   - Expected: Button shows "Saved!", popup closes after delay, article appears in Timeline

4. **Duplicate detection:**
   - Try saving the same URL again via any method
   - Expected: Badge shows checkmark with "Already Saved" message

**Error State Tests:**

5. **No server URL configured:**
   - Remove server URL from extension options
   - Try to save an article
   - Expected: Popup shows "Please configure server URL in settings"

6. **Server unreachable:**
   - Stop the backend: `docker compose stop api`
   - Try to save an article
   - Expected: Error message about connection failure
   - Restart: `docker compose start api`

7. **Options page:**
   - Open extension options page
   - Set API URL to `http://localhost:8000`
   - Click "Test Connection"
   - Expected: "Connection successful!" message
   - Change URL to invalid, test connection
   - Expected: "Connection failed" message

**Verification Complete:**
- [ ] All 3 capture methods work (context menu, shortcut, popup)
- [ ] Duplicate detection works
- [ ] Error states handled (no URL, server down)
- [ ] Options page saves and tests connection
- [ ] Articles appear in Timeline with correct title/URL

---

## Telegram Bot

### Setup
1. Create bot with @BotFather on Telegram
2. Add token to `.env`: `TELEGRAM_BOT_TOKEN=your-token`
3. Start with bot profile: `docker compose --profile with-bot up -d`

### Usage
- Send any URL to the bot
- Bot extracts URL and saves to Recall
- Commands: `/start`, `/help`, `/status`

### View Bot Logs
```bash
docker compose logs -f bot
```

---

## API Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### Save Article
```bash
curl -X POST http://localhost:8000/api/articles \
  -H "Content-Type: application/json" \
  -H "X-API-Key: default-api-key" \
  -d '{"url": "https://example.com/article", "capture_source": "test"}'
```

### List Articles
```bash
curl http://localhost:8000/api/articles \
  -H "X-API-Key: default-api-key"
```

### Search
```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: default-api-key" \
  -d '{"query": "machine learning", "mode": "keyword"}'
```

### Full API Docs
Open http://localhost:8000/docs for interactive Swagger UI

---

## Testing

### Backend Tests
```bash
cd backend
uv run pytest tests/ -v
```

### Extension Tests
```bash
node extension/tests/run-all.js
```

### Frontend Tests
```bash
cd frontend
npm run test:run
```

---

## Logs & Debugging

### View All Logs
```bash
docker compose logs -f
```

### View Specific Service
```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
docker compose logs -f bot
```

### API Request/Response Debug
Check http://localhost:8000/docs - test endpoints interactively

### Database Debug
```bash
docker compose exec postgres psql -U postgres -d recall -c "SELECT * FROM articles LIMIT 5;"
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `SECRET_KEY` | Yes | - | JWT signing key |
| `DEEPSEEK_API_KEY` | One of | - | DeepSeek API key |
| `OLLAMA_URL` | One of | - | Ollama endpoint |
| `PUBLIC_URL` | No | localhost:3000 | Public URL for multi-device |
| `TELEGRAM_BOT_TOKEN` | No | - | Telegram bot token |
| `USE_POLLING` | No | true | Bot polling vs webhook |
| `TAILSCALE_AUTHKEY` | No | - | Tailscale VPN key |

---

## Troubleshooting

### "Connection refused" on API
```bash
# Check if containers are running
docker compose ps

# Check API logs
docker compose logs api
```

### "Database connection failed"
```bash
# Check postgres is healthy
docker compose ps postgres

# Restart postgres
docker compose restart postgres
```

### Extension not saving
1. Check extension options (API URL and key)
2. Check browser console for errors
3. Check API logs: `docker compose logs -f api`

### Articles stuck in "pending"
LLM processing failed. Check:
```bash
docker compose logs api | grep -i error
```

### Reset everything
```bash
docker compose down -v
docker compose up -d
```

---

## File Structure

```
Recall/
├── backend/           # FastAPI API
│   ├── app/
│   │   ├── main.py        # App entry
│   │   ├── models.py      # SQLAlchemy models
│   │   ├── schemas.py     # Pydantic schemas
│   │   ├── routers/       # API endpoints
│   │   └── services/      # Business logic
│   └── tests/
├── frontend/          # React PWA
│   ├── src/
│   │   ├── pages/         # Route components
│   │   ├── components/    # Reusable components
│   │   └── api/           # API client
│   └── package.json
├── extension/         # Chrome Extension
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html/js
│   └── options.html/js
├── bot/               # Telegram Bot
│   └── main.py
├── docker-compose.yml
├── .env               # Environment config
└── docs/
    ├── DEVELOPMENT.md     # This file
    └── SELF_HOSTING.md    # Production deployment
```