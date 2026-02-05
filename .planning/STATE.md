# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Effortlessly capture articles I read and resurface them when relevant.
**Current focus:** Phase 2 - Extension Verification & Frontend Tests

## Current Position

Phase: 3 of 6 (Backend & Bot Testing)
Plan: 1 of 2 in current phase
Status: In progress — plan 03-01 complete
Last activity: 2026-02-05 — Completed 03-01-PLAN.md (Backend integration tests)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 3 min
- Total execution time: 0.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 6min | 2min |
| 2 | 4 | 8min | 2min |
| 3 | 1 | 9min | 9min |

**Recent Trend:**
- Last 5 plans: 02-02 (2min), 02-03 (2min), 02-04 (2min), 03-01 (9min)
- Trend: Integration tests took longer due to testcontainers complexity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase planning: Prioritize critical bugs (connection pooling, bot security) before test coverage
- Phase planning: Test infrastructure setup before auto-capture to ensure reliability
- Phase planning: Auto-capture foundation before dwell tracking to reduce complexity
- 01-01: Background tasks fetch article data from database instead of passing ORM objects
- 01-01: LLM logging uses standardized 'LLM analysis:' prefix for easy filtering
- 01-01: Pass only article_id and content to background task (content as primitive string)
- 01-02: Use parse_qsl instead of manual string splitting for proper query parameter parsing
- 01-02: Use urlencode with quote_via=quote to preserve %20 encoding instead of +
- 01-02: Extract TRACKING_PARAMS to module level for maintainability
- 01-03: Use filters.User for Telegram bot authorization (cleaner than manual checks)
- 01-03: Bot requires TELEGRAM_OWNER_USER_ID env var (fails fast with clear error)
- 02-01: Use ReactNode for Wrapper children type (RTL render wrapper requires ReactNode)
- 02-01: gcTime: Infinity for test QueryClient to prevent GC during assertions
- 02-01: MSW v2 syntax (http/HttpResponse) matching msw ^2.1.5
- 02-02: Use getByRole for elements with duplicate text content (Search heading vs button)
- 02-02: vi.mock react-force-graph-2d before import for canvas-dependent components
- 02-04: Use querySelector for CSS class-based elements (spinner, card sections)
- 03-01: Patch mocks at import location (articles router) not definition location for background tasks
- 03-01: Patch AsyncSessionLocal in integration_client to ensure background tasks use test database
- 03-01: Use xfail warmup test to handle testcontainers async initialization timing

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 completed:**
- ✅ Background task connection pooling fixed (01-01)
- ✅ LLM fallback chain logging added (01-01)
- ✅ URL normalization with sorted query parameters fixed (01-02)
- ✅ Telegram bot owner-only authorization added (01-03)
- ✅ Bug fix: article.title variable (commit 45ba498)

**Phase 4-5 considerations:**
- Chrome MV3 service worker lifecycle requires careful state persistence architecture
- Alarm reliability may vary across Chrome versions (needs validation during planning)

## Session Continuity

Last session: 2026-02-05 (Phase 3 execution)
Stopped at: Completed 03-01-PLAN.md (Backend integration tests)
Resume file: None
