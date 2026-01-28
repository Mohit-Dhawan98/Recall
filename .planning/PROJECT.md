# Recall

## What This Is

A personal knowledge capture system for saving, organizing, and resurfacing articles you read. Self-hosted, single-user by design — meant for individuals who want to own their data without relying on cloud services. Capture happens via Chrome extension, Telegram bot, or mobile PWA share sheet. AI (DeepSeek or local Ollama) handles tagging, summarization, and building a knowledge graph of connections between articles.

## Core Value

**Effortlessly capture articles I read and resurface them when relevant.** If capture requires friction or search doesn't find what I saved, the system fails.

## Requirements

### Validated

These capabilities exist and work:

- ✓ Manual article capture via Chrome extension (right-click, keyboard shortcut, popup) — existing
- ✓ Article capture via Telegram bot — existing
- ✓ Article capture via PWA share target (iOS/Android) — existing
- ✓ AI-powered tagging with grounded taxonomy (domain/topic/entity) — existing
- ✓ AI-generated summaries and key quotes extraction — existing
- ✓ Semantic search using pgvector embeddings — existing
- ✓ Keyword search with PostgreSQL FTS — existing
- ✓ Knowledge graph visualization showing article connections — existing
- ✓ Read later queue — existing
- ✓ Article detail view with tags, summary, entities — existing
- ✓ Timeline view of captured articles — existing
- ✓ LLM fallback chain: DeepSeek → Ollama → rule-based — existing

### Active

Building toward these in current milestone:

**Code Quality & Stability:**
- [ ] Lock Telegram bot to owner's Telegram user ID
- [ ] Add comprehensive frontend tests
- [ ] Add Telegram bot tests
- [ ] Add backend integration tests (end-to-end capture flow)
- [ ] Fix background task exception handling (mark failed, add retry)
- [ ] Add logging to LLM fallback chain (know which path was used)
- [ ] Fix URL normalization edge cases (query param ordering)

**Smart Auto-Capture:**
- [ ] Domain whitelist management in extension options
- [ ] Auto-capture on whitelisted domains
- [ ] Article page detection (skip homepages, listings)
- [ ] Dwell time threshold (configurable, default 60s)
- [ ] Toast notification on auto-capture
- [ ] Prompt on first visit to new domain ("Add to whitelist?")

### Out of Scope

- Multi-user / multi-tenant — intentionally single-user, self-hosted
- User registration / authentication UI — single user, API key is enough
- Mobile native app — PWA handles mobile use case
- Monetization features — free/open source for now
- Rate limiting — self-hosted assumption, trusted environment
- OAuth / social login — unnecessary for single user

## Context

**Existing codebase:** Fully functional MVP with all core features working. Tested end-to-end: Telegram → API → DeepSeek processing → PostgreSQL → Frontend display.

**Tech stack:**
- Backend: FastAPI + SQLAlchemy + PostgreSQL 16 + pgvector
- Frontend: React 18 + TypeScript + TailwindCSS + Vite
- Extension: Chrome MV3 (vanilla JS)
- Bot: python-telegram-bot
- LLM: DeepSeek API (primary) or Ollama (local fallback)
- Deployment: Docker Compose (self-hosted)

**Test coverage:**
- Backend: 46 tests passing (unit + validation, missing integration)
- Extension: 51 tests passing (mocked Chrome APIs)
- Frontend: Test setup exists, zero tests written
- Bot: No tests

**Known issues from audit:**
- Hardcoded "default-api-key" throughout (acceptable for single-user)
- Background tasks create new DB connections per article (scaling risk)
- LLM fallback silently fails without logging
- Bot accepts messages from anyone (security hole)

## Constraints

- **Self-hosted**: Must run entirely on user's hardware via Docker Compose
- **Cost-efficient**: Minimize external API costs; prefer DeepSeek ($0.14/1M tokens) over expensive alternatives
- **No cloud dependency**: Work offline with Ollama if internet unavailable
- **Single-user**: No multi-tenant complexity; one user per instance

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-user architecture | Simplicity, self-hosted target audience | ✓ Good |
| DeepSeek as primary LLM | 10-100x cheaper than OpenAI, good quality | ✓ Good |
| pgvector for embeddings | No separate vector DB, PostgreSQL does it all | ✓ Good |
| Chrome MV3 extension | Future-proof, required by Chrome | ✓ Good |
| No passive capture initially | Ship manual capture first, add smart capture later | — Pending |

---
*Last updated: 2026-01-29 after initialization*