# Recall Test Inventory

## Overview

This document maps all services in the Recall project to their required tests based on SPEC.md and actual functionality.

---

## Services Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Chrome Extension│   Frontend PWA  │      Telegram Bot           │
│  extension/     │   frontend/     │        bot/                 │
│  (JavaScript)   │   (React/TS)    │      (Python)               │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         └─────────────────┼──────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API                                 │
│                    backend/app/                                  │
│                    (FastAPI/Python)                              │
├─────────────────────────────────────────────────────────────────┤
│  Routers:                    │  Services:                       │
│  - articles.py               │  - extractor.py (content)        │
│  - auth.py                   │  - llm.py (AI processing)        │
│  - search.py                 │  - graph.py (relations)          │
│  - graph.py                  │                                  │
│  - tags.py                   │                                  │
│  - read_later.py             │                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Test Status

| Service | Location | Tests Exist? | Framework |
|---------|----------|--------------|-----------|
| Chrome Extension | `extension/` | ✅ Yes | Node.js (custom) |
| Frontend | `frontend/` | ❌ No | - |
| Backend API | `backend/` | ❌ No | - |
| Telegram Bot | `bot/` | ❌ No | - |

---

## 1. Backend API Tests (Python/pytest)

### 1.1 Articles Router (`backend/app/routers/articles.py`)

**Endpoints:**
- `POST /api/articles` - Create article
- `GET /api/articles` - List articles
- `GET /api/articles/{id}` - Get article
- `PATCH /api/articles/{id}` - Update article
- `DELETE /api/articles/{id}` - Delete article

#### Base Cases
| Test | Input | Expected |
|------|-------|----------|
| Create article with valid URL | `{"url": "https://example.com/article"}` | 201, article created |
| Get existing article | Valid article ID | 200, article returned |
| List articles | No params | 200, paginated list |

#### Normal Cases
| Test | Input | Expected |
|------|-------|----------|
| Create with all metadata | URL + all optional fields | 201, full article |
| List with pagination | `?page=2&limit=10` | Correct page returned |
| Update article status | `{"status": "read"}` | 200, status updated |
| Delete article | Valid ID | 204, article deleted |
| Create from different sources | `capture_source: extension/pwa/telegram` | Source recorded |

#### Edge Cases
| Test | Input | Expected |
|------|-------|----------|
| Duplicate URL | Same URL twice | 409 or dedup response |
| Invalid URL format | `"not-a-url"` | 400, validation error |
| URL normalization | `http://Example.com/PATH?utm=x` | Normalized stored |
| Very long URL | 2000+ char URL | Handled or rejected |
| Non-existent article | Random UUID | 404 |
| Empty URL | `{"url": ""}` | 400 |
| Missing URL | `{}` | 422 |
| Special characters in URL | Unicode, encoded chars | Properly handled |

### 1.2 Search Router (`backend/app/routers/search.py`)

**Endpoints:**
- `POST /api/search` - Full-text + semantic search

#### Base Cases
| Test | Input | Expected |
|------|-------|----------|
| Basic keyword search | `{"query": "python"}` | Matching articles |

#### Normal Cases
| Test | Input | Expected |
|------|-------|----------|
| Full-text search | Common word | Articles with word in title/summary |
| Semantic search | Concept query | Related articles by embedding |
| Combined search | Query + filters | Filtered semantic results |
| Search with tag filter | `{"query": "x", "tags": ["ai"]}` | Filtered results |

#### Edge Cases
| Test | Input | Expected |
|------|-------|----------|
| Empty query | `{"query": ""}` | 400 or empty results |
| Very long query | 1000+ chars | Handled |
| No results | Obscure query | Empty array, not error |
| Special characters | `"query": "c++ & python"` | Properly escaped |
| SQL injection attempt | `"'; DROP TABLE--"` | Safe, no injection |

### 1.3 Tags Router (`backend/app/routers/tags.py`)

**Endpoints:**
- `GET /api/tags` - List all tags
- `GET /api/tags/{tag}/articles` - Articles by tag

#### Base Cases
| Test | Input | Expected |
|------|-------|----------|
| List tags | No params | Tag list with counts |
| Get articles by tag | Valid tag | Articles with that tag |

#### Normal Cases
| Test | Input | Expected |
|------|-------|----------|
| Tags grouped by domain | - | technology, business, etc. |
| Tag with topic | `technology/ai-ml` | Filtered articles |

#### Edge Cases
| Test | Input | Expected |
|------|-------|----------|
| Non-existent tag | `fake-tag` | Empty or 404 |
| Tag with special chars | URL-encoded tag | Properly handled |

### 1.4 Graph Router (`backend/app/routers/graph.py`)

**Endpoints:**
- `GET /api/graph` - Full knowledge graph
- `GET /api/graph/article/{id}` - Article subgraph

#### Base Cases
| Test | Input | Expected |
|------|-------|----------|
| Get full graph | No params | Nodes and edges |
| Get article subgraph | Article ID | Related nodes |

#### Normal Cases
| Test | Input | Expected |
|------|-------|----------|
| Graph has correct relations | - | SAME_TOPIC, SAME_AUTHOR, etc. |
| Subgraph depth | `?depth=2` | N-level connections |

#### Edge Cases
| Test | Input | Expected |
|------|-------|----------|
| Empty graph | No articles | Empty nodes/edges |
| Large graph | 1000+ articles | Performance OK |
| Orphan article | Article with no relations | Node, no edges |

### 1.5 Read Later Router (`backend/app/routers/read_later.py`)

**Endpoints:**
- `GET /api/read-later` - Read later queue
- `PATCH /api/articles/{id}/read-later` - Toggle read later

#### Base/Normal/Edge Cases
| Test | Input | Expected |
|------|-------|----------|
| Get read later list | - | Articles with is_read_later=true |
| Toggle on | Article not in queue | Added to queue |
| Toggle off | Article in queue | Removed from queue |
| Toggle non-existent | Invalid ID | 404 |

### 1.6 Auth Router (`backend/app/routers/auth.py`)

#### Cases
| Test | Input | Expected |
|------|-------|----------|
| Valid API key | Correct key | Authenticated |
| Invalid API key | Wrong key | 401 |
| Missing API key | No header | 401 |
| Expired key | Old key | 401 |

---

## 2. Backend Services Tests

### 2.1 Extractor Service (`backend/app/services/extractor.py`)

| Test | Input | Expected |
|------|-------|----------|
| Extract from article URL | News article | Title, author, content |
| Extract from Twitter/X | Tweet URL | Tweet content |
| Extract from YouTube | Video URL | Title, description |
| Handle paywalled content | Paywalled URL | Graceful degradation |
| Handle 404 | Dead URL | Error handling |
| Handle timeout | Slow server | Timeout error |
| HTML cleanup | Messy HTML | Clean text |

### 2.2 LLM Service (`backend/app/services/llm.py`)

| Test | Input | Expected |
|------|-------|----------|
| Generate summary | Article content | 50-300 word summary |
| Extract tags | Article content | Grounded taxonomy tags |
| Extract entities | Article content | People, companies, products |
| Generate embedding | Summary | 1536-dim vector |
| Fallback to Ollama | DeepSeek fails | Uses local LLM |
| Fallback to rule-based | No LLM available | Basic extraction |
| Handle rate limit | API quota exceeded | Graceful retry |

### 2.3 Graph Service (`backend/app/services/graph.py`)

**Relation Types from SPEC:**
- SAME_TOPIC (2+ shared tags)
- SAME_AUTHOR (same author)
- SAME_DOMAIN (same source website)
- SAME_ENTITY (same company/person/product)
- SIMILAR (embedding similarity > 0.8)

| Test | Input | Expected |
|------|-------|----------|
| SAME_TOPIC detection | 2 articles, shared tags | Relation created |
| SAME_AUTHOR detection | Same author | Relation created |
| SAME_DOMAIN detection | Same domain | Relation created |
| SAME_ENTITY detection | Shared entities | Relation created |
| SIMILAR detection | High embedding similarity | Relation created |
| Strength calculation | Tag overlap | Correct strength value |
| No false relations | Unrelated articles | No relation |

---

## 3. Frontend Tests (React/Vitest)

### 3.1 Components

| Component | Tests Needed |
|-----------|--------------|
| ArticleCard | Renders, click handlers, status badge |
| Timeline | Pagination, infinite scroll, filtering |
| Search | Input handling, results display |
| Graph | Renders nodes/edges, interactions |
| ReadLater | Toggle functionality, queue display |
| Settings | Form validation, API key save |
| Share (PWA) | Share target handling |

### 3.2 API Client (`frontend/src/api/client.ts`)

| Test | Description |
|------|-------------|
| GET articles | Fetches list, handles errors |
| POST article | Creates article |
| Search | Sends query, returns results |
| Error handling | Network errors, 4xx, 5xx |

### 3.3 Pages

| Page | Tests Needed |
|------|--------------|
| Timeline | Loads articles, scroll behavior |
| ArticleDetail | Shows full article info |
| Graph | Graph visualization |
| ReadLater | Queue management |
| Search | Search flow |
| Settings | API key config |

---

## 4. Chrome Extension Tests (Node.js)

### 4.1 Existing Tests ✅

Location: `extension/tests/`

- `manifest.test.js` - 29 tests (base, normal, edge)
- `links.test.js` - 22 tests (documentation validation)

### 4.2 Additional Tests Needed

| Test Area | Tests Needed |
|-----------|--------------|
| background.js | API communication, context menu, shortcuts |
| popup.js | Save flow, error states, loading |
| options.js | Settings save/load, connection test |
| URL handling | Normalization, special chars |

---

## 5. Telegram Bot Tests (Python/pytest)

### 5.1 Command Handlers

| Test | Input | Expected |
|------|-------|----------|
| /start | Command | Welcome message |
| /help | Command | Help text |
| /status | Command | Connection status |

### 5.2 Message Handling

| Test | Input | Expected |
|------|-------|----------|
| Single URL | `https://example.com` | Saved confirmation |
| Multiple URLs | 3 URLs in message | All processed |
| No URL | Plain text | "No links found" |
| Invalid URL | `not-a-url` | Not extracted |
| URL with text | `Check this out: https://...` | URL extracted |
| Max URLs | 6+ URLs | Only first 5 processed |

### 5.3 Error Handling

| Test | Input | Expected |
|------|-------|----------|
| API down | Valid URL | Error message |
| Duplicate URL | Already saved | "Already saved" |
| API timeout | Slow response | Timeout handling |

---

## 6. Integration Tests

### 6.1 End-to-End Flows

| Flow | Steps | Validation |
|------|-------|------------|
| Extension → API → DB | Save from extension | Article in database |
| PWA → API → DB | Share from mobile | Article saved |
| Bot → API → DB | Send link to bot | Article saved |
| API → LLM → DB | Save article | Tags/summary generated |
| Graph building | Save related articles | Relations created |
| Search | Save + search | Article found |

### 6.2 Multi-Service Tests

| Test | Services | Validation |
|------|----------|------------|
| Full capture flow | Extension + API + LLM | Complete article with AI metadata |
| Deduplication | Multiple sources | Same URL not duplicated |
| Graph consistency | API + Graph service | Relations match rules |

---

## 7. Performance Tests

Based on SPEC.md success criteria:

| Metric | Target | Test |
|--------|--------|------|
| Article capture acknowledgment | < 2s | Time API response |
| AI processing | < 10s | Time background job |
| Search response | < 500ms | Time search endpoint |
| Graph render (50 nodes) | < 1s | Time graph endpoint |

---

## 8. Test Implementation Priority

### Phase 1: Critical Path (High Priority)
1. ✅ Extension manifest validation
2. ⬜ Backend API - articles CRUD
3. ⬜ Backend API - auth
4. ⬜ LLM service - fallback chain

### Phase 2: Core Features (Medium Priority)
5. ⬜ Search functionality
6. ⬜ Graph building
7. ⬜ Read later queue
8. ⬜ Content extraction

### Phase 3: Clients (Medium Priority)
9. ⬜ Frontend components
10. ⬜ Extension functionality
11. ⬜ Telegram bot handlers

### Phase 4: Integration (Lower Priority)
12. ⬜ E2E flows
13. ⬜ Performance tests

---

## 9. Test Commands (To Be Implemented)

```bash
# Backend (pytest)
cd backend && pytest tests/ -v

# Frontend (vitest)
cd frontend && npm test

# Extension (node)
node extension/tests/run-all.js

# Bot (pytest)
cd bot && pytest tests/ -v

# All tests
./scripts/run-all-tests.sh
```

---

## 10. Files to Create

### Backend
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` (fixtures)
- `backend/tests/test_articles.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_search.py`
- `backend/tests/test_graph.py`
- `backend/tests/test_tags.py`
- `backend/tests/test_read_later.py`
- `backend/tests/test_extractor.py`
- `backend/tests/test_llm.py`
- `backend/tests/test_graph_service.py`

### Frontend
- `frontend/src/__tests__/` directory
- `frontend/vitest.config.ts`
- Component tests

### Bot
- `bot/tests/__init__.py`
- `bot/tests/test_handlers.py`
- `bot/tests/test_message_parsing.py`
