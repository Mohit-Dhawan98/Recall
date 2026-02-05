# Roadmap: Recall

## Overview

This milestone stabilizes the existing MVP by fixing critical bugs in backend connection pooling and Telegram bot security, adds comprehensive test coverage across all components (backend, frontend, extension, bot), and implements smart auto-capture functionality that passively saves articles based on dwell time and domain whitelists. The journey moves from critical fixes that ensure reliable testing, through incremental test coverage for each component, to building auto-capture with service worker-resilient architecture, culminating in full integration tests.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Critical Fixes & Test Infrastructure** - Fix blocking bugs and set up test patterns
- [ ] **Phase 2: Extension Verification & Frontend Tests** - Manual extension testing and React component tests
- [ ] **Phase 3: Backend & Bot Testing** - Integration tests for capture flow and bot authorization
- [ ] **Phase 4: Auto-Capture Foundation** - Domain whitelist and article detection
- [ ] **Phase 5: Dwell Time Tracking** - Service worker-resilient time tracking with alarms
- [ ] **Phase 6: Auto-Capture Integration & Polish** - Connect tracking to capture, add UX feedback and documentation

## Phase Details

### Phase 1: Critical Fixes & Test Infrastructure
**Goal**: Backend background tasks use connection pooling reliably, Telegram bot only accepts owner messages, and test utilities are configured for all components
**Depends on**: Nothing (first phase)
**Requirements**: QUAL-02, QUAL-01, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Backend processes 50 concurrent article captures without connection pool exhaustion
  2. Telegram bot rejects messages from unauthorized user IDs with error message
  3. LLM service logs show which fallback path was used (DeepSeek/Ollama/rule-based) for each article
  4. URLs with different query param ordering hash to the same article (no duplicates)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Fix connection pooling and add LLM fallback logging
- [x] 01-02-PLAN.md — URL normalization with sorted query parameters (TDD)
- [x] 01-03-PLAN.md — Telegram bot owner-only authorization

### Phase 2: Extension Verification & Frontend Tests
**Goal**: Extension manually verified working in Chrome, frontend has tests for core components with React Query integration
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Extension loads unpacked in Chrome, captures article via right-click, and article appears in backend API
  2. Timeline component renders article list with loading/error states correctly
  3. ArticleCard displays title, summary, tags, and handles click navigation
  4. Search page submits query and displays results with proper error handling
  5. Graph page loads and renders article connections without crashing
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Test infrastructure setup (vitest config, test utils, fixtures, MSW handlers)
- [x] 02-02-PLAN.md — Component and page tests (ArticleCard, Timeline, Search, Graph)
- [x] 02-03-PLAN.md — Extension verification checklist & CI pipeline
- [x] 02-04-PLAN.md — ArticleDetail page tests

### Phase 3: Backend & Bot Testing
**Goal**: Backend has integration tests for full capture pipeline, bot has unit tests for message handling and authorization
**Depends on**: Phase 2
**Requirements**: TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Backend integration test captures URL, processes with mocked LLM, stores in database, and retrieves via API
  2. Bot test suite verifies URL extraction from messages, authorization checks, and API submission
  3. Background task failure scenarios are tested and articles marked as "failed" with retry logic
  4. Extension E2E test (if implemented) validates manual capture flow in real Chrome environment
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Backend integration tests for capture pipeline and failure scenarios
- [x] 03-02-PLAN.md — Bot unit tests for URL extraction, message handling, and authorization

### Phase 4: Auto-Capture Foundation
**Goal**: Users can manage domain whitelist in extension options and extension detects article pages using Readability heuristics
**Depends on**: Phase 3
**Requirements**: AUTO-01, AUTO-03
**Success Criteria** (what must be TRUE):
  1. User can add, remove, and view whitelisted domains in extension options page
  2. Extension distinguishes article pages from homepages/listings before starting tracking
  3. Whitelist persists across browser restarts using chrome.storage.local
  4. Extension checks domain against whitelist on page load and skips non-whitelisted sites
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 5: Dwell Time Tracking
**Goal**: Extension tracks dwell time with configurable threshold and pauses when user is idle, using service worker-resilient architecture
**Depends on**: Phase 4
**Requirements**: AUTO-02, AUTO-06
**Success Criteria** (what must be TRUE):
  1. Extension tracks time spent on whitelisted article pages with configurable threshold (default 60s)
  2. Dwell timer pauses when user is idle and resumes when active using chrome.idle API
  3. Timer state persists across service worker suspensions using chrome.storage.session
  4. Alarms are recreated on extension startup and survive updates
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 6: Auto-Capture Integration & Polish
**Goal**: Auto-capture triggers article save, shows visual feedback, includes first-visit prompts, and has complete documentation
**Depends on**: Phase 5
**Requirements**: AUTO-04, AUTO-05, DOCS-01, DOCS-02, TEST-05
**Success Criteria** (what must be TRUE):
  1. Extension shows non-blocking toast notification when auto-capture occurs
  2. Extension prompts "Add to whitelist?" on first visit to new domain (article page only)
  3. README guides users through creating Telegram bot via BotFather with screenshots
  4. README explains how to find Telegram user ID and configure TELEGRAM_USER_ID env var
  5. Playwright E2E test validates full auto-capture flow (navigate, wait, verify capture)
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Fixes & Test Infrastructure | 3/3 | ✓ Complete | 2026-01-29 |
| 2. Extension Verification & Frontend Tests | 4/4 | ✓ Complete | 2026-01-30 |
| 3. Backend & Bot Testing | 2/2 | ✓ Complete | 2026-02-05 |
| 4. Auto-Capture Foundation | 0/0 | Not started | - |
| 5. Dwell Time Tracking | 0/0 | Not started | - |
| 6. Auto-Capture Integration & Polish | 0/0 | Not started | - |
