# Phase 3: Backend & Bot Testing - Research

**Researched:** 2026-02-04
**Domain:** Python testing (pytest, pytest-asyncio, FastAPI, Telegram bot)
**Confidence:** HIGH

## Summary

This phase focuses on implementing comprehensive integration and unit tests for the backend capture pipeline and Telegram bot. The backend currently has basic unit tests (test_api_unit.py, test_extractor.py) and testing infrastructure (conftest.py with PostgreSQL testcontainers), but lacks integration tests for the full capture flow including background task processing and LLM mocking.

The standard approach is to use pytest with pytest-asyncio for async tests, pytest-httpx or httpx.MockTransport for mocking HTTP calls, and AsyncMock for mocking async functions. The existing conftest.py already provides excellent fixtures for database testing with testcontainers, which should be extended to support integration testing scenarios.

For the bot, python-telegram-bot's official testing approach involves either manually enqueuing updates in Application.update_queue or mocking the networking layer. Since the bot primarily extracts URLs and submits to the API (using httpx), testing should focus on message handling logic, URL extraction patterns, authorization checks, and API submission (mocked).

**Primary recommendation:** Write integration tests using existing testcontainers infrastructure with mocked LLM/external services, and write bot unit tests with mocked Update objects and mocked httpx calls.

## Standard Stack

### Core Testing Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=8.0.0 | Test framework | Industry standard Python testing framework with excellent async support |
| pytest-asyncio | >=0.23.4 | Async test support | Official pytest plugin for testing async code, required for FastAPI |
| pytest-cov | >=4.1.0 | Coverage reporting | Standard coverage tool for pytest |
| pytest-mock | Latest | Mocking utilities | Cleaner mocking syntax than unittest.mock |
| httpx | >=0.26.0 | HTTP client | Already used in production, supports AsyncClient for testing |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-httpx | Latest | Mock httpx requests | Simplest way to mock httpx calls in bot tests |
| testcontainers[postgres] | >=4.0.0 | Real database testing | Already in use for backend tests |
| aiosqlite | >=0.19.0 | SQLite async support | Fallback for tests without Docker |
| faker | >=22.5.1 | Test data generation | Already available, useful for generating test content |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pytest-httpx | httpx.MockTransport | MockTransport is built-in but pytest-httpx has cleaner API |
| pytest-httpx | respx | respx is more feature-rich but adds dependency, pytest-httpx is simpler |
| testcontainers | SQLite in-memory | testcontainers provides real PostgreSQL with pgvector, more accurate |
| AsyncMock | asynctest library | AsyncMock is built-in since Python 3.8, no extra dependency needed |

**Installation:**

Backend already has test dependencies in pyproject.toml. Add pytest-httpx:
```bash
# Backend
pip install pytest-httpx

# Bot (needs test dependencies)
pip install pytest pytest-asyncio pytest-httpx pytest-mock pytest-cov
```

## Architecture Patterns

### Backend Integration Test Structure

```
backend/tests/
├── __init__.py
├── conftest.py                    # Fixtures (already exists)
├── test_api_unit.py              # Unit tests (exists)
├── test_extractor.py             # Extractor tests (exists)
├── test_integration_capture.py   # NEW: Full capture pipeline
└── test_background_tasks.py      # NEW: Background task scenarios
```

### Bot Test Structure

```
bot/tests/
├── __init__.py
├── conftest.py                   # NEW: Bot test fixtures
├── test_message_handling.py     # NEW: Message handler tests
├── test_url_extraction.py       # NEW: URL extraction patterns
└── test_authorization.py        # NEW: Authorization checks
```

### Pattern 1: Backend Integration Test (Full Capture Flow)

**What:** Test the complete article capture pipeline from URL submission to database retrieval with mocked LLM
**When to use:** Testing end-to-end flow including background tasks
**Example:**

```python
# Source: FastAPI docs + pytest-asyncio best practices
@pytest.mark.asyncio
async def test_full_capture_pipeline(client: AsyncClient, db_session: AsyncSession):
    """Integration test: URL → extract → mock LLM → storage → retrieval."""

    # Mock LLM service
    with patch('app.services.llm.call_deepseek') as mock_llm:
        mock_llm.return_value = json.dumps({
            "summary": "Test summary",
            "key_quotes": ["Quote 1"],
            "tags": [{"domain": "technology", "topic": "ai-ml"}],
            "entities": [{"entity": "Test Company", "entity_type": "company"}]
        })

        # Submit article
        response = await client.post(
            "/api/articles",
            json={"url": "https://example.com/article", "capture_source": "extension"},
            headers={"X-API-Key": "default-api-key"}
        )

        assert response.status_code == 200
        data = response.json()
        article_id = data["id"]
        assert data["status"] == "processing"

        # Wait for background task to complete (in tests, runs immediately)
        await asyncio.sleep(0.1)

        # Verify article was processed
        article = await db_session.get(Article, article_id)
        assert article.processing_status == "completed"
        assert article.summary == "Test summary"
        assert len(article.tags) > 0
        assert len(article.entities) > 0

        # Verify retrieval works
        response = await client.get(f"/api/articles/{article_id}")
        assert response.status_code == 200
        assert response.json()["summary"] == "Test summary"
```

### Pattern 2: Background Task Failure Testing

**What:** Test that background task failures mark articles as "failed" and handle retry scenarios
**When to use:** Testing error handling in async background tasks
**Example:**

```python
# Source: FastAPI background tasks testing patterns
@pytest.mark.asyncio
async def test_background_task_failure_marks_failed(db_session: AsyncSession):
    """Background task failure marks article as failed."""

    # Create article
    article = Article(
        user_id=test_user.id,
        url="https://example.com/test",
        url_hash="test123",
        title="Test",
        source_domain="example.com",
        capture_source="extension",
        processing_status="pending"
    )
    db_session.add(article)
    await db_session.commit()

    # Mock LLM to raise exception
    with patch('app.services.llm.analyze_content') as mock_analyze:
        mock_analyze.side_effect = Exception("LLM API error")

        # Run background task
        with pytest.raises(Exception):
            await process_article_background(article.id, "Test content")

        # Verify article marked as failed
        await db_session.refresh(article)
        assert article.processing_status == "failed"
```

### Pattern 3: Bot Message Handler Testing

**What:** Test bot message handlers with mocked Update objects and API calls
**When to use:** Testing bot message handling logic without real Telegram API
**Example:**

```python
# Source: python-telegram-bot testing docs
@pytest.mark.asyncio
async def test_handle_message_with_url(httpx_mock):
    """Bot extracts URL and submits to API."""

    # Mock API response
    httpx_mock.add_response(
        method="POST",
        url="http://api:8000/api/articles",
        json={"id": str(uuid4()), "status": "processing", "message": "Saved"}
    )

    # Create mock update
    update = MagicMock(spec=Update)
    update.message.text = "Check this out: https://example.com/article"
    update.message.from_user.id = 12345

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)

    # Call handler
    await handle_message(update, context)

    # Verify reply was sent
    update.message.reply_text.assert_called_once()
    assert "Saved" in update.message.reply_text.call_args[0][0]
```

### Pattern 4: Bot Authorization Testing

**What:** Test that only authorized users can interact with bot
**When to use:** Verifying filters.User authorization works correctly
**Example:**

```python
# Source: python-telegram-bot filters testing
@pytest.mark.asyncio
async def test_unauthorized_user_rejected():
    """Unauthorized user gets rejection message."""

    # Create mock update from unauthorized user
    update = MagicMock(spec=Update)
    update.message.from_user.id = 99999  # Not owner
    update.message.text = "https://example.com/test"

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)

    # Call unauthorized handler
    await handle_unauthorized(update, context)

    # Verify rejection message
    update.message.reply_text.assert_called_once()
    assert "private" in update.message.reply_text.call_args[0][0].lower()
```

### Anti-Patterns to Avoid

- **Don't test background tasks by sleeping for long periods** - Use immediate execution or controlled async waits (0.1s max)
- **Don't make real HTTP requests in tests** - Always mock external services (LLM, article fetching)
- **Don't test happy path only** - Test failure scenarios: LLM errors, network failures, invalid content
- **Don't use TestClient for async routes** - Use httpx.AsyncClient with ASGITransport instead
- **Don't mock too much in integration tests** - Mock external services (LLM, HTTP) but use real database
- **Don't ignore background task errors** - Explicitly test that errors are caught and articles marked as "failed"

## Don't Hand-Roll

Problems that have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mocking httpx calls | Manual patching of httpx.AsyncClient | pytest-httpx with httpx_mock fixture | Handles async, multiple calls, callbacks automatically |
| Async mocking | Custom Future/coroutine wrappers | AsyncMock from unittest.mock | Built-in since Python 3.8, properly handles await |
| Database setup/teardown | Manual CREATE/DROP TABLE | testcontainers fixtures (already exists) | Provides real PostgreSQL with extensions, isolated |
| Test data generation | Manual test data creation | Faker library (already available) | Generates realistic data, saves time |
| Background task testing | Custom task runners | FastAPI's BackgroundTasks in tests run immediately | Simplifies testing, no complex async coordination |
| Bot Update objects | Crafting raw Telegram JSON | MagicMock(spec=Update) | Type-safe, easier to work with |

**Key insight:** The testing ecosystem for FastAPI and async Python is mature. Use established tools rather than building custom test infrastructure. The existing conftest.py already demonstrates this well with testcontainers.

## Common Pitfalls

### Pitfall 1: Background Tasks Don't Complete in Tests

**What goes wrong:** Background tasks spawned during API tests appear to complete but aren't actually executed before assertions run
**Why it happens:** FastAPI's BackgroundTasks run asynchronously; tests need to wait for completion
**How to avoid:**
- Add small async sleep after API call: `await asyncio.sleep(0.1)`
- In tests, background tasks typically execute immediately with TestClient/AsyncClient
- Query database to verify completion rather than trusting timing
**Warning signs:** Tests pass locally but assertions fail on article.summary or processing_status

### Pitfall 2: Mocking Async Functions Incorrectly

**What goes wrong:** Patching async functions with regular Mock causes "coroutine was never awaited" warnings
**Why it happens:** Regular Mock objects don't return awaitables
**How to avoid:**
- Always use `AsyncMock` from unittest.mock for async functions
- Use `return_value` not `side_effect` for simple returns
- For async context managers, mock `__aenter__` with AsyncMock
**Warning signs:** RuntimeWarning about coroutines never awaited

### Pitfall 3: Testing with Wrong Database State

**What goes wrong:** Tests depend on data from previous tests or fail due to constraint violations
**Why it happens:** Database state not properly isolated between tests
**How to avoid:**
- Use function-scoped fixtures: `@pytest.fixture(scope="function")`
- Existing conftest.py drops/recreates tables per test - keep this pattern
- Create necessary user fixtures in each test's setup
**Warning signs:** Tests pass when run individually but fail when run together

### Pitfall 4: Not Mocking External Services

**What goes wrong:** Tests make real API calls to DeepSeek/Ollama or fetch real URLs
**Why it happens:** Forgetting to mock external HTTP calls in services
**How to avoid:**
- Mock at service layer: `patch('app.services.llm.call_deepseek')`
- Mock httpx client for URL fetching: `patch('app.services.extractor.fetch_url')`
- Use pytest-httpx for bot tests calling the API
**Warning signs:** Tests are slow (>2s), fail without internet, cost money

### Pitfall 5: Bot Tests Without Proper Mocking

**What goes wrong:** Bot tests try to contact real Telegram API or real backend
**Why it happens:** Not mocking httpx.AsyncClient used in bot's save_article function
**How to avoid:**
- Use pytest-httpx's httpx_mock fixture for all bot tests
- Mock telegram.Bot if testing beyond handlers
- Use MagicMock(spec=Update) for creating fake Telegram updates
**Warning signs:** Tests require TELEGRAM_BOT_TOKEN, make network calls, fail in CI

### Pitfall 6: Ignoring Retry Logic Testing

**What goes wrong:** Retry logic is implemented but never tested, can fail silently in production
**Why it happens:** Retry logic is complex to test and often deferred
**How to avoid:**
- Test failure→retry→success scenario with side_effect list
- Test max retries exceeded scenario
- Verify exponential backoff if implemented
**Warning signs:** Retry code exists but has no tests covering it

## Code Examples

Verified patterns for common operations:

### Testing Full Capture Pipeline with Mocked LLM

```python
# Source: Analyzed backend/app/routers/articles.py + FastAPI testing patterns
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, AsyncMock
import asyncio
import json

@pytest.mark.asyncio
async def test_capture_url_processes_with_llm(client: AsyncClient, db_session: AsyncSession):
    """Integration test: URL → extraction → LLM → storage → retrieval."""

    # Mock external services
    with patch('app.services.extractor.fetch_url') as mock_fetch:
        # Mock URL fetching
        mock_fetch.return_value = (
            '<html><body><h1>Test Article</h1><p>Content here</p></body></html>',
            'https://example.com/article'
        )

        with patch('app.services.llm.call_deepseek') as mock_llm:
            # Mock LLM response
            mock_llm.return_value = json.dumps({
                "summary": "AI analysis of test article",
                "key_quotes": ["Important quote from article"],
                "tags": [{"domain": "technology", "topic": "ai-ml"}],
                "entities": [{"entity": "OpenAI", "entity_type": "company"}]
            })

            # Submit article
            response = await client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/article",
                    "capture_source": "extension"
                },
                headers={"X-API-Key": "default-api-key"}
            )

            assert response.status_code == 200
            data = response.json()
            article_id = data["id"]
            assert data["status"] == "processing"

            # Wait for background task (runs immediately in tests)
            await asyncio.sleep(0.1)

            # Verify article processed
            from app.models import Article
            article = await db_session.get(Article, article_id)
            assert article is not None
            assert article.processing_status == "completed"
            assert article.summary == "AI analysis of test article"
            assert len(article.tags) == 1
            assert article.tags[0].domain == "technology"
            assert len(article.entities) == 1

            # Verify retrieval
            response = await client.get(
                f"/api/articles/{article_id}",
                headers={"X-API-Key": "default-api-key"}
            )
            assert response.status_code == 200
            retrieved = response.json()
            assert retrieved["summary"] == "AI analysis of test article"
            assert len(retrieved["tags"]) == 1
```

### Testing Background Task Failure Scenarios

```python
# Source: FastAPI BackgroundTasks testing + analyzed articles.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch
from uuid import uuid4

@pytest.mark.asyncio
async def test_llm_failure_marks_article_failed(db_session: AsyncSession, test_user):
    """LLM failure marks article as failed, doesn't crash."""
    from app.models import Article
    from app.routers.articles import process_article_background

    # Create article
    article = Article(
        id=uuid4(),
        user_id=test_user.id,
        url="https://example.com/test",
        url_hash="hash123",
        title="Test Article",
        source_domain="example.com",
        content_type="article",
        capture_source="extension",
        processing_status="pending"
    )
    db_session.add(article)
    await db_session.commit()

    # Mock LLM to fail
    with patch('app.services.llm.analyze_content') as mock_analyze:
        mock_analyze.side_effect = Exception("DeepSeek API timeout")

        # Run background task - should handle exception
        with pytest.raises(Exception):
            await process_article_background(article.id, "Test content")

        # Verify article marked as failed
        await db_session.refresh(article)
        assert article.processing_status == "failed"


@pytest.mark.asyncio
async def test_network_error_during_extraction_fails_gracefully(client: AsyncClient):
    """Network error during extraction returns error response."""

    with patch('app.services.extractor.fetch_url') as mock_fetch:
        mock_fetch.side_effect = Exception("Connection timeout")

        response = await client.post(
            "/api/articles",
            json={"url": "https://unreachable.com/article", "capture_source": "extension"},
            headers={"X-API-Key": "default-api-key"}
        )

        # Should return error, not crash
        assert response.status_code >= 400
```

### Testing Bot Message Handling

```python
# Source: python-telegram-bot testing wiki + analyzed bot/main.py
import pytest
from unittest.mock import MagicMock, AsyncMock
from telegram import Update, Message, User
from telegram.ext import ContextTypes

@pytest.mark.asyncio
async def test_bot_extracts_url_and_submits(httpx_mock):
    """Bot extracts URL from message and submits to API."""
    from bot.main import handle_message

    # Mock API response
    httpx_mock.add_response(
        method="POST",
        url="http://api:8000/api/articles",
        json={
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "status": "processing",
            "message": "Article saved, processing..."
        }
    )

    # Create mock update
    update = MagicMock(spec=Update)
    update.message = MagicMock(spec=Message)
    update.message.text = "Check this out: https://example.com/great-article"
    update.message.from_user = MagicMock(spec=User)
    update.message.from_user.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)

    # Call handler
    await handle_message(update, context)

    # Verify reply sent
    update.message.reply_text.assert_called_once()
    reply_text = update.message.reply_text.call_args[0][0]
    assert "Saved" in reply_text or "processing" in reply_text.lower()


@pytest.mark.asyncio
async def test_bot_handles_multiple_urls(httpx_mock):
    """Bot extracts and processes multiple URLs from one message."""
    from bot.main import handle_message

    # Mock API responses for multiple calls
    httpx_mock.add_response(json={"id": "id1", "status": "processing", "message": "Saved"})
    httpx_mock.add_response(json={"id": "id2", "status": "processing", "message": "Saved"})

    update = MagicMock(spec=Update)
    update.message = MagicMock(spec=Message)
    update.message.text = "Two links: https://example.com/first and https://example.com/second"
    update.message.from_user.id = 12345
    update.message.reply_text = AsyncMock()

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)

    await handle_message(update, context)

    # Should have made 2 API calls
    assert len(httpx_mock.get_requests()) == 2
```

### Testing Bot Authorization

```python
# Source: Analyzed bot/main.py + python-telegram-bot filters docs
import pytest
from unittest.mock import MagicMock, AsyncMock
from telegram import Update
from telegram.ext import ContextTypes

@pytest.mark.asyncio
async def test_unauthorized_user_receives_rejection():
    """Unauthorized user gets rejection message."""
    from bot.main import handle_unauthorized

    update = MagicMock(spec=Update)
    update.message = MagicMock()
    update.message.from_user.id = 99999  # Not the owner
    update.message.reply_text = AsyncMock()

    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)

    await handle_unauthorized(update, context)

    # Verify rejection
    update.message.reply_text.assert_called_once()
    reply_text = update.message.reply_text.call_args[0][0]
    assert "private" in reply_text.lower()


def test_bot_requires_owner_user_id_env_var():
    """Bot fails fast if TELEGRAM_OWNER_USER_ID not set."""
    import os
    from unittest.mock import patch

    # Remove env var
    with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "test", "TELEGRAM_OWNER_USER_ID": ""}):
        with patch('bot.main.logger') as mock_logger:
            from bot.main import main

            main()

            # Should log error about missing owner ID
            mock_logger.error.assert_called()
            assert "TELEGRAM_OWNER_USER_ID" in str(mock_logger.error.call_args)
```

### Testing URL Extraction

```python
# Source: Analyzed bot/main.py URL_PATTERN regex
import re

def test_url_pattern_extraction():
    """URL_PATTERN correctly extracts various URL formats."""
    from bot.main import URL_PATTERN

    test_cases = [
        ("Check https://example.com/article", ["https://example.com/article"]),
        ("http://test.com and https://other.com", ["http://test.com", "https://other.com"]),
        ("https://example.com/path?utm_source=twitter&id=123", ["https://example.com/path?utm_source=twitter&id=123"]),
        ("No URLs here!", []),
        ("twitter.com/user/status/123 (not a full URL)", []),
    ]

    for text, expected_urls in test_cases:
        found = URL_PATTERN.findall(text)
        assert found == expected_urls
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| unittest.mock for async | AsyncMock from unittest.mock | Python 3.8 (2019) | Simpler async mocking, no need for asynctest library |
| TestClient for all tests | AsyncClient for async routes | FastAPI 0.65+ | Proper async handling, avoid warnings |
| Manual mock setup | pytest-httpx for httpx mocking | 2020+ | Cleaner API, handles async automatically |
| SQLite in-memory | testcontainers with real DB | 2018+ | More accurate tests, catches PostgreSQL-specific issues |
| Manual Update creation | MagicMock(spec=Update) | pytest-mock | Type-safe mocking, IDE support |
| pytest.mark.asyncio per test | asyncio_mode = "auto" in pytest.ini | pytest-asyncio 0.21+ | Less boilerplate, automatic detection |

**Deprecated/outdated:**
- asynctest library: Use built-in AsyncMock instead
- pytest-aiohttp: Use httpx for all async HTTP testing
- aioresponses: Use pytest-httpx or respx for httpx mocking
- Manual Future objects: Use AsyncMock with return_value

## Open Questions

1. **Retry Logic Implementation Status**
   - What we know: Prior decisions mention "retry logic" for failed articles, but no retry implementation found in codebase
   - What's unclear: Is retry logic already implemented? Should tests verify manual retry via re-processing API call?
   - Recommendation: If no automated retry exists, test that failed articles can be re-processed via manual trigger (PATCH endpoint or background job)

2. **Extension E2E Test Scope**
   - What we know: Success criteria mentions "Extension E2E test (if implemented)" - unclear if this is required
   - What's unclear: Is Chrome extension E2E testing part of Phase 3 or a separate phase?
   - Recommendation: Check with user - if required, research Playwright/Puppeteer for Chrome extension testing

3. **LLM Mocking Specificity**
   - What we know: Tests should mock LLM, but unclear whether to test both DeepSeek and Ollama fallback paths
   - What's unclear: Should tests verify the fallback chain (DeepSeek → Ollama → rule-based)?
   - Recommendation: Test primary path (mocked DeepSeek) in integration tests, test fallback chain in unit tests for llm.py

4. **Bot Test Coverage Scope**
   - What we know: Bot is simple (URL extraction → API call), needs authorization tests
   - What's unclear: Should tests cover command handlers (/start, /help, /status) or just message handling?
   - Recommendation: Test message handling (core functionality) and authorization. Commands are trivial, can be optional.

## Sources

### Primary (HIGH confidence)

- [FastAPI Async Tests Documentation](https://fastapi.tiangolo.com/advanced/async-tests/) - Official FastAPI async testing guide
- [python-telegram-bot Testing Documentation](https://docs.python-telegram-bot.org/en/stable/testing.html) - Official PTB testing patterns
- [pytest-asyncio Documentation](https://pytest-asyncio.readthedocs.io/) - Official pytest-asyncio guide
- [pytest-httpx Documentation](https://colin-b.github.io/pytest_httpx/) - Official pytest-httpx usage
- Backend codebase analysis:
  - `/Users/mohitdhawan/Recall/backend/app/routers/articles.py` - Capture pipeline and background tasks
  - `/Users/mohitdhawan/Recall/backend/app/services/llm.py` - LLM service with fallback chain
  - `/Users/mohitdhawan/Recall/backend/tests/conftest.py` - Existing test infrastructure
  - `/Users/mohitdhawan/Recall/bot/main.py` - Bot implementation with authorization

### Secondary (MEDIUM confidence)

- [Fast and Furious: Async Testing with FastAPI](https://weirdsheeplabs.com/blog/fast-and-furious-async-testing-with-fastapi-and-pytest) - Real-world patterns
- [Testing FastAPI CRUD APIs with Pytest](https://pytest-with-eric.com/pytest-advanced/pytest-fastapi-testing/) - Comprehensive tutorial
- [Testing Background Tasks in FastAPI](https://testdriven.io/tips/079fd0c1-3a6c-4dd9-a3fe-807e0c6b0935/) - Background task patterns
- [How to Mock httpx with pytest-mock](https://til.simonwillison.net/pytest/mock-httpx) - httpx mocking strategies
- [Python-telegram-bot Testing Wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests) - Community testing patterns

### Tertiary (LOW confidence)

- Various Stack Overflow discussions on pytest-asyncio and FastAPI testing
- Community blog posts about testing async Python code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are industry standard, versions verified in codebase
- Architecture: HIGH - Patterns derived from official docs and analyzed codebase structure
- Pitfalls: HIGH - Based on common issues in FastAPI/async testing and codebase analysis
- Bot testing: MEDIUM - Less established patterns than FastAPI, but official docs provide clear guidance

**Research date:** 2026-02-04
**Valid until:** ~60 days (March 2026) - Testing patterns are stable, pytest-asyncio is mature
