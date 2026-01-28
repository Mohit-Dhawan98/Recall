# Project Research Summary

**Project:** Recall - Chrome Extension Auto-Capture & Testing Infrastructure
**Domain:** Browser Extension (Chrome MV3) + FastAPI Backend + React Frontend + Telegram Bot
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

Recall is a multi-layer content capture system requiring comprehensive testing infrastructure across four components: Chrome MV3 extension, FastAPI backend, React frontend, and Telegram bot. The good news: most testing tools are already configured but unused (Vitest, pytest, RTL). The critical insight from research is that Chrome MV3's service worker architecture fundamentally changes how auto-capture must be built - service workers terminate after 30 seconds, requiring state persistence in chrome.storage and event-driven architecture using chrome.alarms, not continuous timers.

The recommended approach prioritizes fixing two critical issues before any new work: (1) backend background tasks creating new DB connections per task instead of using connection pooling, and (2) Telegram bot accepting messages from any user (security hole). Only after these fixes should auto-capture implementation begin, using chrome.storage.session for dwell time tracking and chrome.alarms for threshold checks. Testing should be added incrementally as features are built, using the existing infrastructure (Vitest for frontend, pytest for backend/bot, jest for extension).

Key risks are service worker lifecycle management (state loss on suspension) and alarm reliability across extension updates. Mitigation requires designing with persistence-first architecture from day one: never store state in memory, always use chrome.storage, and recreate alarms on every service worker startup. The extension already has 51 passing tests with mocked Chrome APIs, providing a proven foundation for auto-capture testing.

## Key Findings

### Recommended Stack

The testing stack is already 80% configured - the work is writing tests, not setting up tools. Vitest + React Testing Library is installed for frontend (0 tests written), pytest is working with 46 backend tests, and the extension has 51 tests with comprehensive Chrome API mocks. The only additions needed are MSW for frontend API mocking, pytest-httpx for bot testing, and Playwright for extension E2E tests (optional).

**Core technologies:**
- **Vitest + React Testing Library**: Frontend component testing - already configured, Vite-native, faster than Jest
- **MSW (Mock Service Worker)**: API mocking at network level - add for frontend tests, reusable across test/dev environments
- **pytest + pytest-asyncio**: Backend/bot testing - existing backend infrastructure (46 tests), reuse for bot
- **httpx.AsyncClient**: Async FastAPI testing - required for testing background tasks properly (TestClient is synchronous)
- **Custom Chrome API mocks**: Extension unit tests - existing setup works (51 tests passing), extend for auto-capture
- **Playwright (optional)**: Extension E2E tests - official Chrome recommendation for MV3, use for critical flows only

**Critical version requirement:** pytest-asyncio configured with `asyncio_default_fixture_loop_scope = "function"` to prevent event loop errors.

### Expected Features

**Must have (table stakes):**
- **Domain whitelist management**: Users need control over which sites trigger auto-capture (Medium complexity - chrome.storage + UI)
- **Configurable dwell time**: Users have different reading speeds (Low complexity - default 60s, stored in settings)
- **Visual feedback on auto-capture**: In-page toast notification confirms capture happened (Low complexity - content script DOM injection)
- **Enable/disable toggle per domain**: Pause auto-capture temporarily without removing from whitelist (Low complexity - boolean flag)
- **Manual override always available**: Auto-capture supplements, doesn't replace, existing capture methods (Already exists)

**Should have (competitive differentiators):**
- **Smart article detection**: Capture articles but not homepages/listings using Mozilla Readability (Medium-High complexity - proven algorithm)
- **First-visit domain prompt**: "Add example.com to auto-capture?" during natural browsing (Medium complexity - reduces friction)
- **Subdomain vs root domain options**: Granular control "*.example.com" vs "blog.example.com" (Medium complexity - URL pattern matching)

**Defer (v2+):**
- Activity-aware pausing (needs "idle" permission, not critical)
- Capture preview before save (High complexity, contradicts passive capture philosophy)
- Bulk whitelist import/export (Power user feature, not critical for launch)

**Anti-features (explicitly avoid):**
- Auto-capture enabled by default globally (privacy concern)
- System notifications for every capture (notification fatigue)
- Auto-syncing content across devices (GDPR/privacy violation)
- Pre-checked consent boxes (dark pattern, GDPR violation)

### Architecture Approach

Auto-capture in Chrome MV3 requires a hybrid event-driven + periodic check architecture. Service workers terminate after 30 seconds, making continuous dwell time tracking impossible. The solution: use webNavigation.onCompleted to detect page loads, store dwell start time in chrome.storage.session, create chrome.alarms to check thresholds (30s minimum interval), and verify tab state when alarm fires. Content scripts handle article detection (isProbablyReaderable from Mozilla Readability) and metadata extraction. All state must survive service worker suspension.

**Major components:**
1. **Service Worker Event Coordinator** - webNavigation listener, alarm management, capture orchestration (state in chrome.storage only)
2. **Content Script Page Classifier** - article detection heuristics before starting dwell tracking (stateless, message-based)
3. **Backend Background Tasks** - LLM processing after capture (CRITICAL BUG: currently creates new DB connection per task, must fix)
4. **Frontend React Query** - async state management with caching (test with QueryClientProvider wrapper, retry: false)
5. **Telegram Bot Handlers** - async message processing (CRITICAL BUG: accepts any user, must add whitelist check)

**Integration testing approach:**
- Backend: httpx.AsyncClient (not TestClient) to properly test async background tasks
- Frontend: MSW for API mocking + test QueryClient with retries disabled
- Bot: pytest fixtures with mocked Update/Context objects
- Extension: Existing Chrome API mocks for unit tests, Playwright for E2E (optional)

### Critical Pitfalls

1. **Background tasks creating new DB connections per task** - Current code creates new engine in background tasks, bypassing connection pooling. Under load, this exhausts connections and causes 10-100x performance degradation. FIX: Use dependency injection or pass connection pool, never call create_async_engine() in task. (Phase 1: Must fix before integration tests)

2. **Service worker state lost on suspension** - Chrome terminates service workers after 30 seconds. Dwell time in global variables is lost, auto-capture breaks unpredictably. FIX: Store all state in chrome.storage.session, use chrome.alarms (not setTimeout), check alarm existence on startup. (Phase 2: Design with persistence from day one)

3. **Alarms not firing after extension update** - Chrome's update mechanism can leave old worker active while new worker waits. Alarms don't transfer. FIX: Always recreate alarms on runtime.onStartup and runtime.onInstalled, register listeners at top-level (not nested). Test update scenario explicitly. (Phase 2: Critical for reliability)

4. **Telegram bot accepts messages from anyone** - Current bot has no user ID check. Attacker can spam API, exhaust LLM credits, fill database. FIX: Add TELEGRAM_USER_ID environment variable check, reject unauthorized users immediately. (Phase 1: Security hole, fix before bot tests)

5. **React Query tests timeout on error paths** - Default retry logic (3 retries with backoff) makes error tests take 30+ seconds. FIX: Create test QueryClient with retry: false, use fresh client per test. (Phase 1: Test infrastructure setup)

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation Fixes & Test Infrastructure
**Rationale:** Two critical bugs block reliable testing and must be fixed first. Backend connection pooling affects integration test stability. Bot security hole must be closed before adding any bot features.

**Delivers:**
- Backend background tasks using connection pool (refactor process_article_background)
- Telegram bot user ID whitelist (TELEGRAM_USER_ID environment variable)
- Frontend test utilities (test QueryClient with retry: false)
- Backend test patterns (mock BackgroundTasks, async fixtures)
- MSW installation and setup for frontend

**Addresses:**
- Pitfall 1 (DB connections)
- Pitfall 4 (Bot security)
- Pitfall 5 (React Query timeouts)

**Critical dependencies resolved:** All subsequent phases depend on reliable background task execution and secure bot.

**Estimated effort:** 3-5 days (refactoring + test pattern setup)

### Phase 2: Component Test Coverage
**Rationale:** Add tests to existing manual capture flow before building auto-capture. Establishes testing patterns for each layer.

**Delivers:**
- Frontend component tests: ArticleList, SearchBar with React Query (5-10 tests)
- Backend integration tests: Full capture pipeline with mocked LLM (5-10 tests)
- Bot handler tests: URL submission, authorization, error handling (5-10 tests)
- Extension unit tests: Existing capture logic validation (verify 51 tests still pass)

**Uses:**
- Vitest + RTL with MSW for frontend
- pytest + httpx.AsyncClient for backend
- pytest-asyncio with mocked Update objects for bot
- Existing Chrome API mocks for extension

**Avoids:**
- Pitfall 8 (Background tasks not awaited)
- Pitfall 6 (waitFor side effects)
- Pitfall 10 (Missing user ID verification)

**Estimated effort:** 5-7 days (writing tests, pattern refinement)

### Phase 3: Auto-Capture Foundation
**Rationale:** Build core auto-capture components with persistence-first architecture. No dwell tracking yet, just whitelist + article detection.

**Delivers:**
- Domain whitelist storage (chrome.storage.local)
- Options page UI for whitelist management
- Article detection in content script (Mozilla Readability integration)
- Domain checking in service worker (filter whitelisted domains)

**Addresses:**
- Table stakes: Domain whitelist management
- Differentiator: Smart article detection
- No state persistence issues yet (no timers)

**Avoids:**
- Pitfall 2 (Service worker state) - not tracking dwell yet
- Anti-feature: Auto-capture enabled by default (whitelist is opt-in)

**Estimated effort:** 4-6 days (storage + UI + detection logic)

### Phase 4: Dwell Time Tracking
**Rationale:** Most complex part of auto-capture. Requires chrome.alarms, storage.session, and service worker lifecycle handling.

**Delivers:**
- webNavigation.onCompleted listener
- chrome.storage.session state management
- chrome.alarms periodic checks (30s minimum interval)
- Tab state validation (check URL hasn't changed)
- Alarm recreation on service worker startup

**Addresses:**
- Table stakes: Configurable dwell time threshold
- Pitfall 2: Service worker suspension (chrome.storage.session)
- Pitfall 3: Alarms after update (recreate on startup)

**Critical testing:**
- Service worker suspension test (chrome://serviceworker-internals)
- Extension update scenario test
- Alarm persistence test

**Estimated effort:** 5-7 days (complex lifecycle management)

### Phase 5: Auto-Capture Integration
**Rationale:** Connect dwell tracking to existing capture flow. Add user feedback.

**Delivers:**
- Trigger capture from alarm handler (reuse existing code)
- Deduplication (check chrome.storage.local for recent captures)
- In-page toast notification (content script DOM injection)
- Per-domain enable/disable toggle

**Addresses:**
- Table stakes: Visual feedback, per-domain toggle
- Integration with existing backend capture flow
- No new Chrome permissions needed (toast is DOM-based)

**Estimated effort:** 3-5 days (mostly UI polish)

### Phase 6: Comprehensive Test Suite
**Rationale:** Add integration tests for full auto-capture flow across all layers.

**Delivers:**
- Extension integration test: Navigation → dwell → capture
- Backend integration test: Auto-capture → LLM → storage
- E2E test with Playwright (optional, critical flows only)
- Load test background tasks (verify connection pooling fix)

**Validates:**
- Pitfall 1 fix holds under load
- Pitfall 2 handling works (service worker restart resilience)
- Pitfall 3 fix works (test update scenario)

**Estimated effort:** 4-6 days (integration + E2E tests)

### Phase Ordering Rationale

**Why Phase 1 first:** Critical bugs block reliable testing. Connection pooling affects integration test stability (tests will be flaky if background tasks fail randomly). Bot security hole is unacceptable for any deployment, even local. Test infrastructure setup prevents pitfalls 5, 6, 8 from affecting all subsequent work.

**Why Phase 2 before auto-capture:** Establishes testing patterns for each component. Auto-capture will reuse these patterns. Tests validate existing manual capture works correctly before building on top of it.

**Why Phase 3 before Phase 4:** Whitelist and article detection have no state persistence challenges - they're stateless components. Build and test these first to reduce complexity. Phase 4 (dwell tracking) is the hardest part due to service worker lifecycle; isolating it after foundation is solid reduces risk.

**Why Phase 6 last:** Integration tests require all components working together. Load testing validates architectural decisions (connection pooling, alarm reliability) but only makes sense after features are complete.

**Deferred to post-MVP:** First-visit prompt (adds UX complexity), subdomain wildcards (power user feature), activity-aware pausing (needs "idle" permission), capture preview (contradicts passive capture philosophy).

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Dwell Time Tracking):** Chrome MV3 service worker lifecycle edge cases need validation through testing. Alarm behavior varies across Chrome versions. Research flag: Test on Chrome 120+ (30s alarm minimum) vs older versions.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation Fixes):** Backend connection pooling is standard FastAPI pattern, well-documented.
- **Phase 2 (Component Tests):** Testing patterns verified from official docs (Vitest, pytest, RTL).
- **Phase 3 (Whitelist + Detection):** Mozilla Readability is proven library, chrome.storage.local is straightforward API.
- **Phase 5 (Integration):** Reuses existing manual capture code path.
- **Phase 6 (Test Suite):** Extension test patterns already established (51 tests exist).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools verified from official docs (Vitest, pytest, FastAPI, Chrome APIs). Versions checked, installation commands provided. |
| Features | MEDIUM | Chrome API patterns HIGH confidence (official docs), UX patterns MEDIUM (ecosystem survey, not research studies). |
| Architecture | HIGH | Chrome MV3 service worker lifecycle documented officially (updated Jan 2026). FastAPI async patterns from official docs. React Query testing from maintainer blog. |
| Pitfalls | HIGH | Critical pitfalls (1-5) verified from official sources, community bug reports, and existing codebase analysis. Moderate/minor pitfalls from Testing Library docs and FastAPI discussions. |

**Overall confidence:** HIGH

### Gaps to Address

**Chrome MV3 alarm minimum interval:** Documentation says 30 seconds minimum in Chrome 120+, but community reports suggest this varies by Chrome version and update channel. During Phase 4, validate on target Chrome versions (stable, beta, dev channels).

**Mozilla Readability performance at scale:** Research confirms isProbablyReaderable() works, but no data on performance impact when running on every page load. During Phase 3, profile content script performance on slow devices and article-heavy sites.

**LLM API failover strategy:** Backend has DeepSeek + Ollama fallback, but research didn't cover failure modes (rate limits, API downtime). During Phase 2 integration tests, validate fallback chain and error handling.

**Extension update mechanism reliability:** Pitfall 3 (alarms not firing after update) is documented in community discussions but marked as intermittent. During Phase 4, test update scenario across multiple Chrome versions to quantify reliability.

**Multi-tab dwell tracking edge cases:** Research covers single-tab tracking, but user may open same URL in multiple tabs. During Phase 4, decide behavior: track per-tab (could capture same article twice) or deduplicate by URL (more complex state management).

## Sources

### Primary (HIGH confidence)
- **Chrome Extension APIs:** [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [chrome.alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms), [chrome.webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation), [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) (updated 2026-01-20)
- **FastAPI Testing:** [Async Tests](https://fastapi.tiangolo.com/advanced/async-tests/), [Testing Tutorial](https://fastapi.tiangolo.com/tutorial/testing/)
- **React Query Testing:** [Testing React Query (TkDodo)](https://tkdodo.eu/blog/testing-react-query), [TanStack Testing Guide](https://tanstack.com/query/v3/docs/framework/react/guides/testing)
- **Testing Library:** [Common Mistakes (Kent C. Dodds)](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library), [Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- **python-telegram-bot:** [Testing Wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests), [Official Testing Docs](https://docs.python-telegram-bot.org/en/stable/testing.html)

### Secondary (MEDIUM confidence)
- **Chrome MV3 Patterns:** [eyeo's Journey to Testing MV3 Service Worker Suspension](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension), [Building Persistent Chrome Extension MV3](https://rahulnegi20.medium.com/building-persistent-chrome-extension-using-manifest-v3-198000bf1db6)
- **Extension UX Patterns:** [UX Best Practices (Plasmo)](https://www.plasmo.com/blog/posts/ux-best-practices-that-will-make-your-browser-extension-successful), [Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/user-experience-best-practices/)
- **FastAPI Patterns:** [Async APIs Patterns & Pitfalls](https://shiladityamajumder.medium.com/async-apis-with-fastapi-patterns-pitfalls-best-practices-2d72b2b66f25), [Mastering Integration Testing (Alex Jacobs)](https://alex-jacobs.com/posts/fastapitests/)
- **React Testing Patterns:** [Async Waits in RTL](https://reflect.run/articles/async-waits-in-react-testing-library/), [React Query Pitfalls](https://nickb.dev/blog/pitfalls-of-react-query/)

### Tertiary (LOW confidence, ecosystem survey)
- Mozilla Readability library (proven open-source, used by Firefox Reader View)
- GDPR 2026 compliance patterns (compliance guides, not legal advice)
- Time tracking extension patterns (ecosystem survey for dwell time UX)

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
