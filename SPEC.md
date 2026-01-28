# Recall - Refined Specification v2

> **Tagline:** Your second brain for everything you read. Intentionally capture, connect, and rediscover knowledge.

---

## Executive Summary

This document refines the original SPEC.md based on:
1. User feedback (curation > auto-capture)
2. Technical decisions (Docker, tunneling, PWA)
3. Cost optimization (DeepSeek/Ollama, no content storage)
4. MVP scope definition

---

## Problem Statement

### What We Learned from Feedback

**Original assumption:** "Passively capture everything" = value
**Reality:** "Otherwise it will be more like browser history" — User Feedback

### Refined Problem

Knowledge workers intentionally save articles but:
- Bookmarks become a graveyard (no organization)
- Can't see connections between saved items
- Saved content never resurfaces when relevant
- "Read later" means "never read"

### What We're Building

An **intentional knowledge capture system** that:
1. **Explicitly captures** what users choose to save (not everything)
2. **AI-organizes** content with grounded tags and summaries
3. **Connects** related articles in a knowledge graph
4. **Resurfaces** relevant content when needed
5. **Self-hosted** via Docker (open source, privacy-first)

---

## Key Changes from Original Spec

| Aspect | Original | Refined |
|--------|----------|---------|
| Capture model | Passive (30s dwell) | Explicit save (click/shortcut/share) |
| Content storage | Full article text | URL + metadata + AI summary only |
| Mobile capture | Telegram only | PWA Share Target + Telegram |
| LLM | Claude/GPT-4 | DeepSeek / local Ollama |
| Graph building | LLM per connection | Tag/entity overlap (no LLM) |
| Hosting | Managed option | Self-hosted only (Docker) |
| Tunnel | Optional | Required for multi-device |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER'S DEVICES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Chrome Ext   │ │ Chrome Ext   │ │ Phone PWA    │            │
│  │ (Work PC)    │ │ (Home PC)    │ │ Share Target │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │  TUNNEL (Required)    │                          │
│              │  Cloudflare/Tailscale │                          │
│              │  /ngrok               │                          │
│              └───────────┬───────────┘                          │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                 CENTRAL SERVER (Docker)                         │
├──────────────────────────┼──────────────────────────────────────┤
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Docker Compose                        │   │
│  │                                                          │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │   │
│  │   │   Web   │  │   API   │  │   Bot   │  │ Postgres │  │   │
│  │   │ (React) │  │(FastAPI)│  │(Telegram│  │ +pgvector│  │   │
│  │   │  +PWA   │  │         │  │optional)│  │          │  │   │
│  │   └─────────┘  └─────────┘  └─────────┘  └──────────┘  │   │
│  │                     │                                    │   │
│  │                     ▼                                    │   │
│  │              ┌─────────────┐                             │   │
│  │              │ LLM Layer   │                             │   │
│  │              │ DeepSeek or │                             │   │
│  │              │ Ollama      │                             │   │
│  │              └─────────────┘                             │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Capture Methods

### 1. Chrome Extension (Primary - Desktop)

**Trigger:** Explicit user action
- Click extension icon
- Keyboard shortcut (Cmd/Ctrl+Shift+S)
- Right-click → "Save to Recall"

**Optional:** Passive suggestion mode
- After 2+ min on page matching user's saved domains
- Shows subtle prompt: "Save this?"
- Never auto-saves

### 2. PWA Share Target (Primary - Mobile)

**Setup:**
1. User visits web app on phone
2. Taps "Add to Home Screen"
3. Recall appears in native share sheet

**Flow:**
1. User in LinkedIn/Twitter/any app
2. Taps Share → Recall
3. Link captured instantly
4. Brief confirmation toast

### 3. Telegram Bot (Secondary - Mobile)

**Flow:**
1. User shares link to @RecallBot
2. Bot acknowledges: "Saved!"
3. Processes in background
4. Follow-up: "Tagged: #ai #startups"

---

## Storage Model (Lean)

### What We Store (Per Article)

```
~2-3 KB per article (vs ~50KB for full text)

├── url (canonical, normalized)
├── url_hash (for dedup)
├── title
├── author (if extractable)
├── source_domain
├── published_at
├── captured_at
├── content_type (article/tweet/video/pdf)
├── word_count
├── read_time_seconds
├── summary (AI-generated, 50-300 words)
├── key_quotes (3-5 important sentences)
├── language
├── capture_source (extension/pwa/telegram)
└── status (unread/read/archived)
```

### What We DON'T Store

- Full article content (copyright, storage)
- Original HTML
- Images (just thumbnail URL reference)

### Why This Works

- **Search:** Summary + key quotes are searchable
- **Context:** Enough to remember what article was about
- **Legal:** No copyright issues (transformative summary)
- **Storage:** 25x smaller than full text

---

## Grounded Tag Taxonomy

### Structure

```
Level 1: Domain (fixed)
├── technology
├── business
├── science
├── culture
└── career

Level 2: Topic (semi-fixed, expandable)
technology:
├── ai-ml
├── programming
├── startups
├── crypto-web3
├── security
├── devtools
├── data-science
└── hardware

business:
├── strategy
├── marketing
├── leadership
├── finance
├── operations
└── economics

science:
├── research
├── climate
├── biology
├── physics
├── space
└── medicine

culture:
├── media
├── society
├── politics
├── philosophy
└── arts

career:
├── productivity
├── learning
├── job-market
└── skills

Level 3: Entity (dynamic, extracted)
├── People (Elon Musk, Sam Altman)
├── Companies (OpenAI, Google)
├── Products (ChatGPT, Claude)
└── Concepts (transformer, RAG)

Special Tags (cross-domain):
├── tutorial
├── opinion
├── news
├── research-paper
├── case-study
└── announcement
```

---

## Graph Model (Simplified)

### Relation Types (5 Only)

```
SAME_TOPIC    - Share 2+ tags
SAME_AUTHOR   - Same author/publication
SAME_DOMAIN   - Same source website
SAME_ENTITY   - Mention same company/person/product
SIMILAR       - High embedding similarity (>0.8)
```

### Graph Building (No LLM Needed)

```python
def build_relations(new_article, existing_articles):
    relations = []

    for existing in existing_articles:
        # Tag overlap → SAME_TOPIC
        shared_tags = new_article.tags & existing.tags
        if len(shared_tags) >= 2:
            relations.append({
                "type": "SAME_TOPIC",
                "strength": len(shared_tags) / max(len(new_article.tags), len(existing.tags))
            })

        # Same author → SAME_AUTHOR
        if new_article.author == existing.author:
            relations.append({"type": "SAME_AUTHOR", "strength": 1.0})

        # Same domain → SAME_DOMAIN
        if new_article.domain == existing.domain:
            relations.append({"type": "SAME_DOMAIN", "strength": 0.5})

        # Entity overlap → SAME_ENTITY
        shared_entities = new_article.entities & existing.entities
        if shared_entities:
            relations.append({
                "type": "SAME_ENTITY",
                "strength": len(shared_entities) / 5  # Normalize
            })

        # Embedding similarity → SIMILAR
        similarity = cosine_similarity(new_article.embedding, existing.embedding)
        if similarity > 0.8:
            relations.append({"type": "SIMILAR", "strength": similarity})

    return relations
```

---

## LLM Integration

### Primary: DeepSeek API

```
Cost: ~$0.001 per article (10x cheaper than GPT-4)
Quality: Good enough for tagging/summarization
```

### Fallback: Local Ollama

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    profiles:
      - local-llm
```

Models: Llama 3.2, Mistral, Qwen

### LLM Fallback Chain

```
1. DeepSeek API (cheap, fast)
   ↓ (if fails/quota exceeded)
2. Local Ollama (free, slower)
   ↓ (if not configured)
3. Rule-based extraction (no LLM)
   - Title → topic guess
   - Domain → category
   - Mark as "pending_analysis"
```

### LLM Usage Per Article

```
1. Content Analysis (required):
   - Summary generation
   - Tag extraction
   - Entity extraction
   Cost: ~$0.001

2. Embedding (required):
   - Summary → vector
   Cost: ~$0.0001

3. Graph Building:
   - NO LLM (rule-based)
   Cost: $0
```

---

## Database Schema

```sql
-- Core article storage
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    source_domain TEXT NOT NULL,
    published_at TIMESTAMP,
    captured_at TIMESTAMP DEFAULT NOW(),
    content_type TEXT NOT NULL,
    word_count INTEGER,
    read_time_seconds INTEGER,
    language TEXT DEFAULT 'en',
    summary TEXT NOT NULL,
    key_quotes JSONB,
    capture_source TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    is_read_later BOOLEAN DEFAULT false,
    importance TEXT DEFAULT 'normal',
    user_notes TEXT,
    processing_status TEXT DEFAULT 'pending',
    UNIQUE(user_id, url_hash)
);

-- Grounded tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    topic TEXT,
    source TEXT NOT NULL,
    UNIQUE(article_id, domain, topic)
);

-- Extracted entities
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    entity TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    UNIQUE(article_id, entity, entity_type)
);

-- Embeddings
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID UNIQUE NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    embedding vector(1536),
    model TEXT NOT NULL
);

-- Relations (graph edges)
CREATE TABLE relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    article_a UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_b UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    strength FLOAT NOT NULL CHECK (strength >= 0 AND strength <= 1),
    UNIQUE(article_a, article_b, relation_type),
    CHECK(article_a < article_b)
);
```

---

## API Endpoints

```
# Capture
POST   /api/capture              # Save article
GET    /api/articles             # List articles (paginated)
GET    /api/articles/:id         # Get article details
PATCH  /api/articles/:id         # Update status/notes
DELETE /api/articles/:id         # Delete article

# Search
POST   /api/search               # Full-text + semantic search
GET    /api/tags                 # List all tags
GET    /api/tags/:tag/articles   # Articles by tag

# Graph
GET    /api/graph                # Full graph (nodes + edges)
GET    /api/graph/article/:id    # Subgraph for article

# Read Later
GET    /api/read-later           # Read later queue
PATCH  /api/articles/:id/read-later  # Toggle read later

# Telegram Webhook
POST   /api/telegram/webhook     # Telegram bot webhook
```

---

## MVP Scope

### Phase 1: Core Capture + Storage
- [x] Docker Compose setup (web, api, postgres)
- [x] Database schema + migrations
- [x] Chrome Extension (explicit save only)
- [x] `/api/capture` endpoint
- [x] URL normalization + dedup
- [x] Basic content extraction (Readability.js)

### Phase 2: AI Processing
- [x] DeepSeek/Ollama integration
- [x] Summary generation
- [x] Tag extraction (grounded taxonomy)
- [x] Entity extraction
- [x] Embedding generation (pgvector)

### Phase 3: Web App
- [x] Timeline view (list of saves)
- [x] Search (full-text + semantic)
- [x] Tag filtering
- [x] Read-later queue view
- [x] PWA manifest + share target

### Phase 4: Graph + Mobile
- [x] Graph builder (rule-based relations)
- [x] Focus mode graph view
- [x] Telegram bot (save links)
- [x] Tunnel documentation

### Phase 5: Polish
- [x] Extension settings page
- [x] Error handling + retries
- [x] Self-hosting documentation
- [x] README + setup guide

---

## Success Criteria

### Technical
- Article capture < 2s (acknowledgment)
- AI processing < 10s (background)
- Search response < 500ms
- Graph render < 1s (focus mode, 50 nodes)

### Functional
- Extension saves to any tunnel URL
- PWA share works on iOS + Android
- Telegram bot saves links
- Search finds articles by keyword + concept
- Graph shows meaningful connections

### Self-Hosting
- Single `docker-compose up` starts everything
- Works with free Cloudflare tunnel
- Works without LLM API (Ollama fallback)
- Clear documentation for setup

---

## Explicitly NOT in MVP

- Auto-capture (passive mode)
- Reading goals / gamification
- Daily digests / reminders
- Recommendations ("you might like")
- Collaborative features
- Mobile native app
- Browser history import
- Full-text content storage
