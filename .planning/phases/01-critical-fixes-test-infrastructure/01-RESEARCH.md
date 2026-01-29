# Phase 1: Critical Fixes & Test Infrastructure - Research

**Researched:** 2026-01-29
**Domain:** FastAPI + SQLAlchemy 2.0 async + pytest + python-telegram-bot
**Confidence:** HIGH

## Summary

This phase addresses critical bugs in connection pooling, bot security, LLM fallback logging, and URL normalization, plus establishes test infrastructure patterns for async FastAPI applications. The research focused on SQLAlchemy 2.0 async best practices for background tasks, FastAPI BackgroundTasks patterns, python-telegram-bot authentication, URL normalization approaches, and pytest-asyncio configurations.

The standard approach for background task database access is to create new engine instances with proper connection pool disposal, though this is suboptimal for production. FastAPI's built-in BackgroundTasks is appropriate for the current use case (article processing takes seconds, not minutes), but requires careful session management. For bot security, python-telegram-bot provides filters.User for whitelisting. URL normalization requires sorting query parameters since urllib.parse doesn't guarantee order. LLM fallback chains should use structured logging with explicit path indicators.

**Primary recommendation:** Fix background task connection pooling by passing article ID only and creating proper database session from shared pool; use filters.User for bot authentication; add structured logging to LLM fallback chain; sort query parameters in URL normalization.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.25 | Async ORM with connection pooling | Industry standard ORM with mature async support, AsyncAdaptedQueuePool for asyncio |
| FastAPI | 0.109.2 | Web framework with BackgroundTasks | Native async support, built-in background task mechanism sufficient for short tasks |
| pytest-asyncio | 0.23.4 | Async test runner | Official pytest plugin for async test support, handles event loop lifecycle |
| python-telegram-bot | 20.7 | Telegram bot framework | Most mature Python Telegram library, built-in filters for authentication |
| asyncpg | 0.29.0 | PostgreSQL async driver | Fastest async PostgreSQL driver, required by create_async_engine |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| testcontainers[postgres] | 4.0.0 | Real PostgreSQL for tests | Already in use; provides production-like test environment |
| httpx | 0.26.0 | Async HTTP client | Already in use for LLM API calls and bot API interaction |
| structlog | latest | Structured logging | For LLM fallback chain logging with context (not yet added) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BackgroundTasks | ARQ (async task queue) | ARQ adds Redis dependency but provides retry/monitoring; overkill for simple article processing |
| BackgroundTasks | Celery | Celery is mature but synchronous by default; complex setup for simple use case |
| filters.User | Manual user_id check | Filters provide cleaner separation; manual checks work but less maintainable |
| Manual query param sorting | url-normalize library | Library handles edge cases but adds dependency; manual is sufficient here |

**Installation:**
```bash
# Already installed in backend
cd backend
pip install -e ".[test]"  # Includes pytest-asyncio, testcontainers

# For structured logging (optional, recommended for LLM fallback)
pip install structlog
```

## Architecture Patterns

### Recommended Background Task Pattern (FastAPI + SQLAlchemy Async)

**Current Issue:** Creating new engine per task exhausts connection pool

**Correct Pattern:**
```python
# DON'T: Pass entire database session or create new engine
async def process_article_background(article_id, content, db_url):
    engine = create_async_engine(db_url)  # ❌ New engine per task
    # ...

# DO: Get session from dependency-injected pool
from app.database import async_session_maker

async def process_article_background(article_id: UUID):
    """Background task with proper session management."""
    async with async_session_maker() as db:
        try:
            stmt = select(Article).where(Article.id == article_id)
            result = await db.execute(stmt)
            article = result.scalar_one_or_none()

            if not article:
                return

            # Process article...
            article.processing_status = "completed"
            await db.commit()

        except Exception as e:
            logger.error(f"Background task failed for {article_id}: {e}")
            if article:
                article.processing_status = "failed"
                await db.commit()
```

**Key principles:**
1. Pass only IDs to background tasks, not ORM objects or sessions
2. Create new session inside background task using shared session maker
3. Use context manager (async with) for automatic cleanup
4. Sessions are request-scoped; background tasks outlive requests

### Telegram Bot User Authentication Pattern

**Current Issue:** Bot uses default API key for all users

**Correct Pattern:**
```python
# Source: https://docs.python-telegram-bot.org/telegram.ext.filters.html
from telegram.ext import Application, CommandHandler, MessageHandler, filters
import os

OWNER_USER_ID = int(os.getenv('TELEGRAM_OWNER_USER_ID'))  # e.g., 123456789

async def handle_message(update, context):
    """Handle incoming messages (only from owner)."""
    # filters.User ensures this is only called for owner
    # ...

def main():
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Only accept messages from owner
    application.add_handler(MessageHandler(
        filters.TEXT & filters.User(user_id=OWNER_USER_ID) & ~filters.COMMAND,
        handle_message
    ))
```

**Alternative (manual check pattern):**
```python
async def handle_message(update, context):
    user_id = update.message.from_user.id

    if user_id != OWNER_USER_ID:
        await update.message.reply_text("Unauthorized")
        return

    # Continue processing...
```

### URL Normalization with Query Parameter Sorting

**Current Issue:** `a=1&b=2` vs `b=2&a=1` treated as different URLs

**Correct Pattern:**
```python
# Source: https://docs.python.org/3/library/urllib.parse.html
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

def normalize_url(url: str) -> str:
    """Normalize URL for deduplication."""
    parsed = urlparse(url)

    # Remove tracking parameters
    tracking_params = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'fbclid', 'gclid', 'source', 'mc_cid', 'mc_eid'
    }

    if parsed.query:
        # Parse, filter, and SORT query parameters
        params = parse_qsl(parsed.query)
        filtered_params = [
            (k, v) for k, v in params
            if k not in tracking_params
        ]
        # Sort by key, then by value for consistent ordering
        sorted_params = sorted(filtered_params)
        query = urlencode(sorted_params)
    else:
        query = ''

    # Reconstruct URL without fragment, with trailing slash removed
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path.rstrip('/'),  # Remove trailing slash
        parsed.params,
        query,
        ''  # Remove fragment
    ))

    return normalized
```

### LLM Fallback Chain with Logging

**Current Issue:** Silent fallback without logging which path was used

**Correct Pattern:**
```python
import logging

logger = logging.getLogger(__name__)

async def analyze_content(title: str, content: str, source_domain: str) -> AnalysisResult:
    """Analyze content using LLM with fallback chain."""
    truncated_content = content[:4000] if len(content) > 4000 else content
    prompt = ANALYSIS_PROMPT.format(...)

    # Try DeepSeek first
    logger.info("Attempting DeepSeek API for analysis")
    response = await call_deepseek(prompt)

    if response:
        logger.info("✓ DeepSeek API succeeded")
        parsed = parse_llm_response(response)
        if parsed:
            return AnalysisResult(...)
        logger.warning("DeepSeek returned unparseable response")
    else:
        logger.warning("DeepSeek API failed or unavailable")

    # Fallback to Ollama
    logger.info("Attempting Ollama fallback")
    response = await call_ollama(prompt)

    if response:
        logger.info("✓ Ollama succeeded")
        parsed = parse_llm_response(response)
        if parsed:
            return AnalysisResult(...)
        logger.warning("Ollama returned unparseable response")
    else:
        logger.warning("Ollama failed or unavailable")

    # Fallback to rule-based
    logger.info("Using rule-based analysis fallback")
    return rule_based_analysis(title, content, source_domain)
```

**Structured logging alternative (recommended):**
```python
import structlog

logger = structlog.get_logger()

async def analyze_content(...):
    logger.info("llm.analysis.start", title=title[:50])

    response = await call_deepseek(prompt)
    if response:
        logger.info("llm.analysis.success", provider="deepseek")
        # ...
    else:
        logger.warning("llm.analysis.failed", provider="deepseek",
                      fallback="ollama")
        # ...
```

### Pytest-Asyncio Test Fixture Pattern

**Already implemented correctly in conftest.py:**

```python
# Function-scoped event loop (best practice for isolation)
@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Session-scoped database container
@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer(image="pgvector/pgvector:pg16") as postgres:
        yield postgres

# Function-scoped database tables (fresh for each test)
@pytest.fixture(scope="function")
async def test_engine(database_url):
    engine = create_async_engine(database_url, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()  # Critical: dispose engine to avoid connection leaks
```

### Anti-Patterns to Avoid

- **Sharing AsyncSession across concurrent tasks:** Each concurrent task needs its own session instance; sessions are not thread/task-safe
- **Passing ORM objects to background tasks:** Objects expire when request session closes; pass IDs instead
- **Not disposing AsyncEngine:** Leads to connection pool exhaustion and event loop warnings
- **Using session.query() with async:** Legacy pattern doesn't work; use select() statements
- **Session-scoped event loops in tests:** Reduces isolation; use function scope unless specific need for shared loop

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background task queue | Custom job runner with threading | FastAPI BackgroundTasks (current needs) or ARQ (future scaling) | BackgroundTasks handles execution lifecycle, error boundaries; ARQ adds retry/monitoring if needed later |
| User authentication for bot | Custom auth middleware | filters.User or filters.Chat | Built-in filters provide thread-safe whitelist management with add/remove methods |
| URL normalization | Regex-based custom normalizer | urllib.parse + manual sorting | Edge cases (punycode, port numbers, path normalization) are complex; standard library handles most |
| Async test fixtures | Custom async setup/teardown | pytest-asyncio with testcontainers | Event loop lifecycle, fixture cleanup, and session management are error-prone; pytest-asyncio is battle-tested |
| LLM fallback orchestration | Custom retry logic | Simple if/else chain with logging (current) or LiteLLM (if multi-provider) | Current needs are simple; LiteLLM adds complexity unless managing many providers |

**Key insight:** FastAPI BackgroundTasks is sufficient for processing that completes in seconds. Only move to ARQ/Celery when tasks take minutes, need retries, or require monitoring dashboards. Current article processing (LLM + embedding + graph) should complete in 5-15 seconds, well within BackgroundTasks capability.

## Common Pitfalls

### Pitfall 1: Creating New Engine in Background Task
**What goes wrong:** Each background task creates a new engine with its own connection pool, leading to hundreds of database connections under load. PostgreSQL has connection limits (default 100), causing "too many connections" errors.

**Why it happens:** Misunderstanding SQLAlchemy's engine/session architecture. Engine owns the connection pool and should be application-scoped, not task-scoped.

**How to avoid:**
1. Create engine once at app startup
2. Create async_sessionmaker from that engine
3. Background tasks get new session from the maker, not new engine
4. Use dependency injection pattern already in conftest.py

**Warning signs:**
- Connection pool exhaustion errors in logs
- Increasing database connection count in `pg_stat_activity`
- Slow background task execution due to connection overhead

### Pitfall 2: Passing Database Session to Background Task
**What goes wrong:** The session is tied to the request lifecycle and closes when the request completes, causing "Session is closed" errors in the background task.

**Why it happens:** FastAPI's dependency injection provides request-scoped sessions. Background tasks outlive the request.

**How to avoid:**
1. Pass only primitive values (UUIDs, strings, ints) to background tasks
2. Create fresh session inside background task
3. Use context manager for automatic cleanup

**Warning signs:**
- "Session is closed" errors in background task logs
- Intermittent background task failures (race condition based on task speed)
- DetachedInstanceError when accessing ORM object attributes

### Pitfall 3: Not Logging LLM Fallback Path
**What goes wrong:** Silent degradation where all requests use rule-based fallback but it's not obvious in logs. Cost and quality tracking become impossible.

**Why it happens:** Error handling catches exceptions but doesn't log which fallback was used.

**How to avoid:**
1. Log at INFO level when attempting each provider
2. Log at WARNING level when provider fails
3. Log at INFO level when fallback succeeds
4. Include provider name in all log messages

**Warning signs:**
- Unexpectedly low LLM API costs (all requests using free fallback)
- Poor quality tags/summaries without knowing why
- Unable to debug which provider is failing

### Pitfall 4: Query Parameter Order Sensitivity
**What goes wrong:** Same URL with different parameter order creates duplicate entries (`?a=1&b=2` vs `?b=2&a=1` both saved).

**Why it happens:** Python dicts before 3.7 were unordered; even with ordered dicts, URL construction from dict.items() doesn't guarantee consistent order across requests.

**How to avoid:**
1. Parse query string with parse_qsl (preserves order)
2. Sort parameters by key, then value
3. Reconstruct query string with urlencode
4. Document that parameter order is normalized

**Warning signs:**
- Duplicate detection failing for URLs that should match
- Multiple entries for same article in database
- Hash collisions where there shouldn't be any

### Pitfall 5: Sharing AsyncSession Between Tests
**What goes wrong:** Test pollution where one test's data affects another, or connection pool exhaustion from unclosed sessions.

**Why it happens:** Using session-scoped or module-scoped session fixtures for convenience/speed.

**How to avoid:**
1. Use function-scoped fixtures by default (already in conftest.py)
2. Always dispose engine in fixture cleanup
3. Drop/recreate tables between tests (already doing this)
4. Only use broader scopes when setup cost is prohibitive (rare)

**Warning signs:**
- Flaky tests that pass/fail based on execution order
- Tests pass individually but fail when run together
- Connection pool warnings in test output

### Pitfall 6: Missing Telegram User ID Validation
**What goes wrong:** Bot accepts messages from anyone, creating articles under wrong user or exposing API to unauthorized access.

**Why it happens:** Environment variable not set, or validation happens after API call.

**How to avoid:**
1. Use filters.User at handler registration time
2. Validate TELEGRAM_OWNER_USER_ID at startup (fail fast)
3. Return clear error message for unauthorized users
4. Log unauthorized access attempts

**Warning signs:**
- API key "default-api-key" used for all captures
- Articles appearing from unknown sources
- Unexpected API usage

## Code Examples

Verified patterns from official sources:

### Background Task with Shared Connection Pool
```python
# Source: FastAPI docs + SQLAlchemy async docs
# https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from app.database import async_session_maker  # Shared across app

async def process_article_background(article_id: UUID):
    """Background task using shared connection pool."""
    # Get session from shared pool - no new engine!
    async with async_session_maker() as db:
        try:
            # Fetch article
            stmt = select(Article).where(Article.id == article_id)
            result = await db.execute(stmt)
            article = result.scalar_one_or_none()

            if not article:
                logger.warning(f"Article {article_id} not found")
                return

            # Process with LLM
            analysis = await analyze_content(
                article.title,
                article.content,
                article.source_domain
            )

            # Update article
            article.summary = analysis.summary
            article.processing_status = "completed"
            await db.commit()

        except Exception as e:
            logger.error(f"Processing failed for {article_id}: {e}")
            if article:
                article.processing_status = "failed"
                await db.commit()

# In the endpoint
@router.post("")
async def capture_article(
    request: ArticleCaptureRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Create article...
    db.add(article)
    await db.commit()
    await db.refresh(article)

    # Pass only ID, not session or ORM object
    background_tasks.add_task(process_article_background, article.id)

    return CaptureResponse(id=article.id, status="processing")
```

### Telegram Bot Owner-Only Filter
```python
# Source: https://docs.python-telegram-bot.org/telegram.ext.filters.html

import os
from telegram import Update
from telegram.ext import Application, MessageHandler, filters, ContextTypes

# Load from environment
OWNER_USER_ID = int(os.getenv('TELEGRAM_OWNER_USER_ID'))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle messages - only called for owner due to filter."""
    urls = URL_PATTERN.findall(update.message.text or "")

    for url in urls:
        result = await save_article(url, update.message.from_user.id)
        # ...

def main():
    if not os.getenv('TELEGRAM_OWNER_USER_ID'):
        raise ValueError("TELEGRAM_OWNER_USER_ID must be set")

    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Whitelist owner only
    application.add_handler(MessageHandler(
        filters.TEXT & filters.User(user_id=OWNER_USER_ID) & ~filters.COMMAND,
        handle_message
    ))

    application.run_polling()
```

### URL Normalization with Sorted Parameters
```python
# Source: https://docs.python.org/3/library/urllib.parse.html

from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
import hashlib

def normalize_url(url: str) -> str:
    """Normalize URL for deduplication.

    - Removes tracking parameters
    - Sorts query parameters for consistent ordering
    - Removes trailing slashes and fragments
    """
    parsed = urlparse(url)

    tracking_params = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'fbclid', 'gclid', 'source', 'mc_cid', 'mc_eid'
    }

    if parsed.query:
        # Parse to list of tuples (preserves multiple values for same key)
        params = parse_qsl(parsed.query)

        # Filter tracking parameters
        filtered = [(k, v) for k, v in params if k not in tracking_params]

        # Sort by key, then value (stable ordering)
        sorted_params = sorted(filtered)

        # Rebuild query string
        query = urlencode(sorted_params)
    else:
        query = ''

    # Reconstruct without fragment, with normalized path
    normalized = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path.rstrip('/'),  # Remove trailing slash
        parsed.params,
        query,
        ''  # No fragment
    ))

    return normalized

def hash_url(url: str) -> str:
    """Create hash of normalized URL."""
    normalized = normalize_url(url)
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]
```

### Async Test with Database Fixture
```python
# Source: pytest-asyncio docs + testcontainers pattern
# Already implemented in conftest.py

@pytest.mark.asyncio
async def test_capture_article_duplicate(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_article: Article
):
    """Test duplicate detection works with normalized URLs."""
    # test_article already exists with url="https://example.com/test-article"

    # Try to capture same URL with different query param order
    response = await authenticated_client.post(
        "/api/articles",
        json={
            "url": "https://example.com/test-article?b=2&a=1",  # Different order
            "capture_source": "extension"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "duplicate"  # Should detect as duplicate
    assert data["id"] == str(test_article.id)  # Same article
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sync SQLAlchemy 1.4 | async SQLAlchemy 2.0 | Jan 2023 (SQLAlchemy 2.0 release) | Must use select() instead of query(), AsyncSession required, connection pooling automatic |
| pytest event_loop module scope | function scope default | pytest-asyncio 0.21 (2023) | Better test isolation, slightly slower but safer |
| Manual user ID checking | filters.User | python-telegram-bot 13+ (2021) | Cleaner handler code, built-in thread-safe whitelist management |
| BackgroundTasks with passed session | BackgroundTasks with new session | FastAPI best practices (2024+) | Prevents session lifecycle bugs, documented in discussions |

**Deprecated/outdated:**
- `session.query()`: Replaced by `select()` in SQLAlchemy 2.0 async; query() still works in sync but not supported in async sessions
- Passing DB engine URL string to background tasks: Creates connection pool per task; use shared sessionmaker instead
- Using `asyncio.gather()` with single session: Not concurrency-safe; use separate sessions per task or TaskGroup with separate sessions

## Open Questions

Things that couldn't be fully resolved:

1. **Should we add ARQ for background tasks now or later?**
   - What we know: FastAPI BackgroundTasks works for tasks under ~30 seconds; ARQ adds retry/monitoring but requires Redis
   - What's unclear: Expected load and article processing time under real usage
   - Recommendation: Start with BackgroundTasks (current fix), monitor processing times in production, migrate to ARQ if tasks take >30s or retry logic needed

2. **Should we use structlog or standard logging for LLM fallbacks?**
   - What we know: Standard logging is simpler (already in use), structlog provides JSON output for easier parsing
   - What's unclear: Whether we'll build LLM cost dashboards or just need basic monitoring
   - Recommendation: Use standard logging with structured messages (provider=X in message), migrate to structlog if we build dashboards

3. **Should bot support multiple owners or just one?**
   - What we know: Requirements specify "owner" (singular), filters.User supports multiple user IDs
   - What's unclear: Future requirements for team usage
   - Recommendation: Single owner for now (TELEGRAM_OWNER_USER_ID), easy to extend to list later if needed

## Sources

### Primary (HIGH confidence)
- [SQLAlchemy 2.0 Async I/O Documentation](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) - Session lifecycle, connection pooling, AsyncEngine.dispose()
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) - Official BackgroundTasks usage
- [urllib.parse Documentation](https://docs.python.org/3/library/urllib.parse.html) - Query parameter parsing, no built-in sorting
- [python-telegram-bot filters Module](https://docs.python-telegram-bot.org/telegram.ext.filters.html) - filters.User and filters.Chat for whitelisting
- [pytest-asyncio Concepts](https://pytest-asyncio.readthedocs.io/en/latest/concepts.html) - Event loop scoping, fixture best practices

### Secondary (MEDIUM confidence)
- [SQLAlchemy Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) - AsyncAdaptedQueuePool details
- [FastAPI Background Tasks with Database Sessions](https://github.com/fastapi/fastapi/discussions/8502) - Community discussion on session lifecycle
- [Async SQLAlchemy Journey: From Confusion to Clarity](https://shanechang.com/p/async-sqlalchemy-journey/) - Common pitfalls and solutions
- [FastAPI Background Tasks vs Celery vs ARQ](https://medium.com/@komalbaparmar007/fastapi-background-tasks-vs-celery-vs-arq-picking-the-right-asynchronous-workhorse-b6e0478ecf4a) - Task queue comparison (Dec 2025)
- [pytest-asyncio Event Loop Scope Best Practices](https://github.com/pytest-dev/pytest-asyncio/discussions/535) - Official discussion on scope selection

### Tertiary (LOW confidence - community examples)
- [Building High-Performance Async APIs with FastAPI, SQLAlchemy 2.0](https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg) - Performance patterns
- [How to secure Telegram Bot with authentication](https://silicon.blog/2023/05/16/how-to-secure-your-telegram-bot-app-with-a-simple-authentication-method/) - User ID whitelisting examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries from official requirements.txt and pyproject.toml, verified with official docs
- Architecture patterns: HIGH - Patterns verified against SQLAlchemy 2.0 docs, FastAPI docs, python-telegram-bot docs
- Pitfalls: HIGH - Documented in official SQLAlchemy error messages and FastAPI GitHub discussions
- Code examples: HIGH - All examples based on official documentation patterns with source URLs

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days for stable domain)

**Notes:**
- Existing test infrastructure in conftest.py already follows best practices (function-scoped loop, testcontainers, proper engine disposal)
- Current codebase issues match documented anti-patterns exactly (new engine per task, no LLM logging, missing bot auth)
- No breaking changes expected in SQLAlchemy 2.x, pytest-asyncio, or python-telegram-bot for next 3-6 months
