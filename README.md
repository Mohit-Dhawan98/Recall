# Recall

> Your second brain for everything you read. Intentionally capture, connect, and rediscover knowledge.

Recall is a self-hosted knowledge management system that helps you save, organize, and rediscover articles, tweets, and other web content using AI-powered tagging and a visual knowledge graph.

## Features

- **Intentional Capture**: Save articles explicitly via browser extension, mobile PWA, or Telegram bot
- **AI-Powered Organization**: Automatic tagging, summarization, and entity extraction
- **Knowledge Graph**: Visualize connections between your saved articles
- **Semantic Search**: Find articles by concept, not just keywords
- **Privacy-First**: Self-hosted, your data stays with you
- **Cost-Effective**: Uses DeepSeek or local Ollama for AI processing

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourname/recall
cd recall

# Configure
cp .env.example .env
# Edit .env with your settings

# Start
docker-compose up -d

# Open http://localhost:3000
```

## Capture Methods

### Browser Extension
- Click extension icon to save current page
- Keyboard shortcut: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows)
- Right-click any link → "Save to Recall"

### Mobile PWA
1. Visit your Recall URL on your phone
2. Add to Home Screen
3. Share links from any app directly to Recall

### Telegram Bot
1. Set up a bot via @BotFather
2. Add token to `.env`
3. Send links to your bot

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Clients                         │
│  Chrome Extension │ PWA (iOS/Android) │ Telegram │
└─────────────────────────┬────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │  Tunnel   │
                    │(optional) │
                    └─────┬─────┘
                          │
┌─────────────────────────┴────────────────────────┐
│              Docker Compose Stack                 │
│                                                   │
│  ┌────────┐  ┌────────┐  ┌─────┐  ┌──────────┐  │
│  │  Web   │  │  API   │  │ Bot │  │PostgreSQL│  │
│  │ React  │  │FastAPI │  │     │  │+pgvector │  │
│  └────────┘  └───┬────┘  └─────┘  └──────────┘  │
│                  │                               │
│             ┌────┴────┐                          │
│             │   LLM   │                          │
│             │DeepSeek/│                          │
│             │ Ollama  │                          │
│             └─────────┘                          │
└──────────────────────────────────────────────────┘
```

## Configuration

See `.env.example` for all options:

```env
# Required
DB_PASSWORD=secure-password

# AI (choose one)
DEEPSEEK_API_KEY=your-key    # Recommended: cheap & fast
# Or use local Ollama (--profile local-llm)

# Optional
TELEGRAM_BOT_TOKEN=your-token
PUBLIC_URL=https://your-tunnel.com
```

## Multi-Device Setup

For access from multiple devices, set up a tunnel:

| Option | Pros | Cons |
|--------|------|------|
| Cloudflare Quick | Free, instant | URL changes on restart |
| Cloudflare Tunnel | Free, stable URL | Requires setup |
| Tailscale | Private, secure | Requires app on devices |
| ngrok | Easy | Paid for stable URL |

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for detailed setup instructions.

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, React Query
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, pgvector
- **AI**: DeepSeek API or Ollama (local)
- **Infrastructure**: Docker Compose

## API Endpoints

```
POST   /api/articles          # Save article
GET    /api/articles          # List articles
GET    /api/articles/:id      # Get article
PATCH  /api/articles/:id      # Update article
DELETE /api/articles/:id      # Delete article

POST   /api/search            # Search articles
GET    /api/tags              # List tags
GET    /api/graph             # Get knowledge graph
GET    /api/read-later        # Read later queue
```

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT

## Acknowledgments

- Inspired by tools like Pocket, Readwise, and Obsidian
- Built with FastAPI, React, and pgvector
