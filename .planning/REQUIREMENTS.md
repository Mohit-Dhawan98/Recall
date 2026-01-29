# Requirements: Recall

**Defined:** 2026-01-29
**Core Value:** Effortlessly capture articles I read and resurface them when relevant.

## v1 Requirements

Requirements for current milestone: code quality fixes, testing, and smart auto-capture.

### Code Quality

- [ ] **QUAL-01**: Bot only responds to owner's Telegram user ID (configurable via env var)
- [ ] **QUAL-02**: Background tasks use shared connection pool instead of new engine per task
- [ ] **QUAL-03**: LLM service logs which fallback path was used (DeepSeek/Ollama/rule-based)
- [ ] **QUAL-04**: URL normalization handles query param ordering and trailing slashes consistently

### Testing

- [ ] **TEST-01**: Extension manually verified working in Chrome (load unpacked, save article, check API)
- [ ] **TEST-02**: Frontend has component tests for Timeline, ArticleCard, Search, and Graph pages
- [ ] **TEST-03**: Backend has integration tests for full capture flow (URL → extraction → LLM → storage → retrieval)
- [ ] **TEST-04**: Bot has unit tests for message handling, URL extraction, and authorization checks
- [ ] **TEST-05**: Extension has E2E tests via Playwright for manual capture flow

### Auto-Capture Core

- [ ] **AUTO-01**: User can manage domain whitelist in extension options (add, remove, view)
- [ ] **AUTO-02**: Extension tracks dwell time with configurable threshold (default 60s)
- [ ] **AUTO-03**: Extension detects article pages vs homepages/listings using Readability heuristics
- [ ] **AUTO-04**: Extension shows non-blocking toast notification when auto-capture occurs

### Auto-Capture UX

- [ ] **AUTO-05**: Extension prompts "Add to whitelist?" on first visit to new domain
- [ ] **AUTO-06**: Dwell timer pauses when user is idle (chrome.idle API integration)

### Documentation

- [ ] **DOCS-01**: README guides users through creating their own Telegram bot via BotFather
- [ ] **DOCS-02**: README explains how to find and configure Telegram user ID for bot security

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Auto-Capture Enhancements

- **AUTO-V2-01**: Per-domain capture settings (different dwell times, rules)
- **AUTO-V2-02**: Capture history view in extension popup
- **AUTO-V2-03**: Sync whitelist across devices via chrome.storage.sync

### Data Management

- **DATA-01**: Export articles to JSON/CSV
- **DATA-02**: Database backup/restore scripts with documentation

### Performance

- **PERF-01**: Add pgvector IVFFLAT index when embedding count > 10k
- **PERF-02**: Migrate background tasks to Celery/arq if scale requires

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user / multi-tenant | Intentionally single-user, self-hosted design |
| Shared Telegram bot | Complexity doesn't fit single-user model; each user creates own bot |
| User registration UI | Single user, API key is sufficient |
| Mobile native app | PWA handles mobile use case |
| Rate limiting | Self-hosted assumption, trusted environment |
| OAuth / social login | Unnecessary for single user |
| Real-time sync | Polling/refresh is sufficient for personal use |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUAL-01 | Phase 1 | Complete |
| QUAL-02 | Phase 1 | Complete |
| QUAL-03 | Phase 1 | Complete |
| QUAL-04 | Phase 1 | Complete |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 3 | Pending |
| TEST-05 | Phase 6 | Pending |
| AUTO-01 | Phase 4 | Pending |
| AUTO-02 | Phase 5 | Pending |
| AUTO-03 | Phase 4 | Pending |
| AUTO-04 | Phase 6 | Pending |
| AUTO-05 | Phase 6 | Pending |
| AUTO-06 | Phase 5 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after Phase 1 completion*
