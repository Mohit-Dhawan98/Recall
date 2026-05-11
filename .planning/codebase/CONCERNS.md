# Codebase Concerns

**Analysis Date:** 2026-01-28

## Tech Debt

**Single-User Architecture:**
- Issue: System hardcodes "default-api-key" throughout codebase, making multi-user setup non-functional for non-trivial deployments
- Files: `backend/app/routers/auth.py` (lines 30, 40, 47), `extension/background.js` (line 65), `extension/options.js` (lines 21, 43), `frontend/src/api/client.ts` (line 16), `bot/main.py` (line 76), `backend/tests/conftest.py` (lines 128, 230)
- Impact: Only one user can effectively use the system. Multiple users on same instance cannot be isolated; all data is shared. API key generation endpoint exists but isn't integrated into UI, making it hard to set up real users
- Fix approach: Remove hardcoded key fallback; require API key in auth header; add user management UI page; migrate existing setups with migration script

**Background Task Engine Issues:**
- Issue: Background task processing creates new database engine/session for each article (line 167-176 in `backend/app/routers/articles.py`), violating DRY principle and risking connection pool exhaustion under load
- Files: `backend/app/routers/articles.py` (lines 22-113)
- Impact: Scales poorly. Each article capture spawns new DB connection, creating 50+ simultaneous articles → 50+ database connections. Pool exhaustion possible. Engine disposal may not be guaranteed if errors occur
- Fix approach: Use shared background task queue (Celery/RQ); pass article ID only to background function; reuse DB session from session pool; add proper error recovery

**LLM Fallback Chain Missing Logging:**
- Issue: Fallback chain in `backend/app/services/llm.py` silently fails without logging which fallback was used
- Files: `backend/app/services/llm.py` (lines 198-234, especially 213-214)
- Impact: Impossible to debug why articles get basic rule-based analysis instead of AI analysis. Users can't tell if DeepSeek API is failing, quota exceeded, or misconfigured
- Fix approach: Add logging at each fallback level (info level when switching to Ollama, warning when switching to rule-based); include API response codes in logs

**API Response Models Missing Proper Cascades:**
- Issue: Articles deleted but embedding may not cascade properly due to unique constraint on article_id
- Files: `backend/app/models.py` (line 109 - embedding has unique constraint but no explicit cascade cleanup verification)
- Impact: Low risk due to foreign key cascade, but embedding orphans possible if deletion path bypasses SQLAlchemy ORM
- Fix approach: Add cascade="all, delete-orphan" confirmation in integration tests; verify raw SQL deletes use CASCADE

## Known Bugs

**Telegram Bot Default API Key:**
- Symptoms: Bot uses "default-api-key" hardcoded, cannot differentiate between multiple users sending to same bot
- Files: `bot/main.py` (line 76)
- Trigger: Any message sent to bot will save under default user regardless of telegram user ID
- Workaround: Implement user mapping - store telegram user_id → api_key mapping in database

**Frontend Page Size Limits Not Enforced UI-side:**
- Symptoms: API enforces max 100 items per page, but no UI feedback if user requests 1000
- Files: `frontend/src/pages/Timeline.tsx`, `frontend/src/api/client.ts` (line 126-132)
- Trigger: User changes page_size query param manually; API returns 422 but frontend doesn't handle gracefully
- Workaround: Add client-side validation to match backend constraints (1-100 page size)

**Extension Content Injection May Fail Silently:**
- Symptoms: Extension tries to get page HTML but silently falls back to no content if injection fails
- Files: `extension/background.js` (lines 71-79)
- Trigger: Cross-origin pages, restricted pages, extension permission issues
- Workaround: Log failures to console; show notification if page content unavailable

## Security Considerations

**Hardcoded Default API Key in Production Code:**
- Risk: "default-api-key" string searchable in codebase and Git history. Any public fork exposes the key
- Files: 10+ files across extension, frontend, backend, bot
- Current mitigation: Key only works if no custom user created; single-user setup assumes trusted environment
- Recommendations:
  1. Generate unique key on first run, store in .env only
  2. Use environment variable `DEFAULT_API_KEY` with no hardcoded fallback
  3. Add pre-commit hook to prevent committing actual API keys
  4. Rotate hardcoded key in docs (if exposed in public repos)

**No Request Rate Limiting:**
- Risk: API endpoints unprotected against brute force, DoS attacks, quota exhaustion
- Files: `backend/app/main.py`, `backend/app/routers/*.py`
- Current mitigation: Only accessible behind tunnel (assumed private)
- Recommendations:
  1. Add per-user rate limiting (e.g., 100 articles/hour)
  2. Add per-IP rate limiting for auth endpoints
  3. Document that public URL should require auth proxy (nginx, Cloudflare)

**No Input Sanitization on User Notes:**
- Risk: User notes stored as plain text in JSONB without sanitization
- Files: `backend/app/models.py` (line 56 - user_notes)
- Current mitigation: Frontend uses React (auto-escapes); API returns as JSON
- Recommendations: Add explicit sanitization on update; validate length limits (currently none - max is TEXT which is gigabytes)

**Extension Lacks Content Security Policy:**
- Risk: Extension can execute arbitrary scripts due to permissive permissions
- Files: `extension/manifest.json` (not provided but background.js uses chrome.scripting)
- Current mitigation: Only runs on user-triggered action
- Recommendations: Add CSP headers; use host_permissions instead of blanket <all_urls>; verify script execution context

**Default User Autocreation Bypasses Setup:**
- Risk: First-time user gets auto-created with default-api-key if not found, skipping any setup flow
- Files: `backend/app/routers/auth.py` (lines 44-52)
- Current mitigation: Matches intended single-user behavior; no registration endpoint
- Recommendations: For multi-user: add admin setup flow; require explicit user creation

## Performance Bottlenecks

**Graph Building Limited to Last 100 Articles:**
- Problem: For users with 1000+ articles, only recent 100 are checked for relations
- Files: `backend/app/services/graph.py` (line 50)
- Cause: Full comparison is O(n²); 1000 articles = 1M comparisons, ~10s+ on avg hardware
- Improvement path:
  1. Add indexed tag/entity lookups for relation discovery
  2. Use database query with joins instead of loading all articles
  3. Batch relation creation (currently inserts one at a time)
  4. Consider background job to rebuild graph incrementally

**N+1 Query Problem in Article List:**
- Problem: `list_articles` uses selectinload for tags/entities, but tags subquery for filtering requires separate query
- Files: `backend/app/routers/articles.py` (lines 213-216)
- Cause: Tag filtering requires subquery; with 500 articles and tag filter, 2 full table scans
- Improvement path: Add database index on (article_id, domain, topic); use window functions in subquery

**Embedding Generation Not Cached:**
- Problem: Every article re-embeds summary + title on search, even if already computed
- Files: `backend/app/services/llm.py` (lines 237-276); `backend/app/services/graph.py` (implicit in similarity calculations)
- Cause: No cached embedding reuse during graph builds
- Improvement path: Always store embedding from initial processing; skip duplicate embedding calls

**Frontend Graph Render Limits:**
- Problem: Graph visualization limited to `max_nodes` parameter, no progressive loading
- Files: `frontend/src/pages/Graph.tsx` (line 219)
- Cause: Force-graph-2d renders all nodes at once; 200+ nodes becomes sluggish
- Improvement path: Implement focus-based rendering; start with user's recent articles + strong relations; load on zoom

## Fragile Areas

**LLM Response Parsing:**
- Files: `backend/app/services/llm.py` (lines 120-144)
- Why fragile: JSON extraction uses regex and multiple fallbacks. DeepSeek might return JSON in unexpected format
- Safe modification: Add structured output mode to DeepSeek prompt (if supported); add test cases for real LLM responses
- Test coverage: Unit tests check parse failures, but no integration tests with real API

**Background Task Exception Handling:**
- Files: `backend/app/routers/articles.py` (lines 106-111)
- Why fragile: `except Exception as e: raise e` doesn't add context; if database transaction fails, article left in "pending" state forever
- Safe modification: Mark article as "failed"; add retry logic with exponential backoff; log full stack trace
- Test coverage: No tests for background task failures

**URL Normalization and Deduplication:**
- Files: `backend/app/services/extractor.py` (lines 26-55)
- Why fragile: Doesn't handle query parameter reordering (a=1&b=2 vs b=2&a=1 seen as different)
- Safe modification: Sort query params before hashing; add test cases for URL edge cases
- Test coverage: Basic normalization tested; no edge case tests for redirects, shortened URLs

**Content Extraction Fallback Chain:**
- Files: `backend/app/services/extractor.py` (lines 145-148)
- Why fragile: If trafilatura extracts empty string (PDF, JavaScript-rendered), fallback to readability which may fail silently
- Safe modification: Add explicit error handling; return structured error instead of empty content
- Test coverage: Happy path tested; no tests for extraction failures

## Scaling Limits

**Vector Database Queries Unindexed:**
- Current capacity: pgvector without IVFFLAT indexes; works fine for <10k embeddings
- Limit: 100k embeddings → similarity search may become slow (sequential scan)
- Scaling path: Add IVFFLAT index on embeddings.embedding; monitor query time at scale

**Single PostgreSQL Instance:**
- Current capacity: Docker Compose with single Postgres; works for single user
- Limit: Concurrent connections exhaust; backup strategy missing
- Scaling path: Add connection pooling (PgBouncer); implement automated backups; plan migration to managed DB

**No Pagination for Tag/Entity Lists:**
- Current capacity: `getTags` returns all tags without limit
- Limit: 10k+ tags returned on large datasets
- Scaling path: Add pagination to `/api/tags` endpoint; implement tag aggregation (count by domain)

## Dependencies at Risk

**TypeScript in Frontend with Minimal Type Coverage:**
- Risk: `any` and `unknown` types used 10+ times; API response types may drift from schema
- Files: `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`
- Impact: Refactoring backend API could break frontend without compile errors
- Migration plan: Enable `strict: true` in tsconfig; add runtime validation with zod/io-ts

**Readability and Trafilatura May Stop Working:**
- Risk: Both are web scraping libraries; changes to website structure may break extraction
- Files: `backend/app/services/extractor.py` (imports on lines 4, 5)
- Impact: Articles captured with minimal/no content if both fail
- Migration plan: Add Mercury or Mozilla's Readability.js for comparison; implement user feedback to improve extraction

**Python 3.12 in Backend:**
- Risk: Testing uses testcontainers which may lag behind Python releases
- Impact: CI may fail on new Python versions
- Migration plan: Pin Python to 3.12; monitor testcontainers releases

## Missing Critical Features

**No User Authentication Flow:**
- Problem: Extension/frontend hardcode API key; no login/registration UI
- Blocks: Multi-user deployments; sharing instance with family/team
- Priority: High if shipping beyond single-user
- Solution: Add login page; implement oauth option (or simple password-based with hashed storage)

**No Data Export/Backup:**
- Problem: No built-in way to export articles or backup database
- Blocks: User switching self-hosted instances; data recovery on corruption
- Priority: Medium for self-hosted; high for production
- Solution: Add `/api/export` endpoint (CSV/JSON); document PostgreSQL backup strategy

**No Article Deduplication on Resubmit:**
- Problem: Duplicate detection by URL hash, but no UI feedback showing article already saved
- Blocks: User experience - unclear if save succeeded
- Priority: Low
- Solution: Return article detail instead of "duplicate" message; show in timeline

## Test Coverage Gaps

**Frontend Tests Not Yet Implemented:**
- What's not tested: All React components, hooks, API calls, user interactions
- Files: `frontend/src/**/*.tsx` - zero test files found
- Risk: Regressions in UI not caught; refactoring breaks UI without CI failures
- Priority: High - 100% of frontend untested

**Bot Not Tested:**
- What's not tested: All bot commands, message parsing, API integration
- Files: `bot/main.py` - no test files in `bot/` directory
- Risk: Breaking changes to Telegram API not caught; user-facing errors in production
- Priority: High if bot is customer-facing feature

**Backend Tests Missing Integration Scenarios:**
- What's not tested: End-to-end article capture flow (extension → API → processing → database); graph building with real articles; search accuracy
- Files: `backend/tests/` - 46 tests passing but mostly unit/validation
- Risk: Flow breaking changes not caught (e.g., background task failure)
- Priority: Medium - add integration test for capture-to-search flow

**Background Task Exception Paths:**
- What's not tested: Background task failures (LLM timeout, DB connection loss, malformed extraction)
- Files: `backend/app/routers/articles.py` (lines 22-113) - function not tested
- Risk: Articles silently fail to process; users see "pending" forever
- Priority: High - articles stuck in processing state

**Extension Tests Missing Real Chrome API:**
- What's not tested: Actual chrome.storage, chrome.tabs, chrome.scripting calls
- Files: `extension/tests/*.js` - tests mock chrome API
- Risk: Extension breaks on new Chrome version; context menu doesn't work
- Priority: Medium - real integration test on Chrome version

**Graph Relation Accuracy:**
- What's not tested: Whether relations (SAME_TOPIC, SAME_AUTHOR, etc.) match expected real-world articles
- Files: `backend/app/services/graph.py` - no test fixtures with known article sets
- Risk: Graph shows noise; users don't find relevant connections
- Priority: Medium - add fixtures with known related articles

---

*Concerns audit: 2026-01-28*
