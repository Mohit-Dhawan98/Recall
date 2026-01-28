# Testing Stack for Recall

**Project:** Recall
**Researched:** 2026-01-29
**Focus:** Testing infrastructure for React frontend, FastAPI backend, Telegram bot, and Chrome MV3 extension

## Executive Summary

The existing stack already has most testing infrastructure in place. Vitest + React Testing Library is configured but unused, pytest is working with 46 tests, and the extension has 51 passing tests with mocked Chrome APIs. The gaps are: zero frontend tests, zero bot tests, missing integration tests for the full capture pipeline, and passive capture logic in the extension.

**Key recommendation:** Build on existing infrastructure. Don't introduce new tools. Write tests with what's already configured, add MSW for API mocking, and use pytest-httpx for bot testing.

## Current State Analysis

| Layer | Framework | Tests | Status |
|-------|-----------|-------|--------|
| Frontend | Vitest + RTL + jsdom | 0 tests | Setup exists, unused |
| Backend | pytest + pytest-asyncio | 46 tests | Working, needs integration tests |
| Extension | Custom test runner | 51 tests | Working with mocked Chrome APIs |
| Bot | None | 0 tests | No test infrastructure |

## Recommended Testing Stack

### Frontend Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^1.2.2 (installed) | Test runner | Already configured, Vite-native, faster than Jest |
| @testing-library/react | ^14.1.2 (installed) | Component testing | Industry standard, tests user behavior not implementation |
| @testing-library/user-event | ^14.5.2 (installed) | User interactions | Simulates real user behavior (preferred over fireEvent) |
| @testing-library/jest-dom | ^6.3.0 (installed) | DOM assertions | Provides semantic matchers like toBeInTheDocument() |
| jsdom | ^24.0.0 (installed) | DOM simulation | Lightweight browser environment for tests |
| MSW (Mock Service Worker) | ^2.12.7 (add) | API mocking | Network-level mocking, works with any HTTP client |

**Confidence:** HIGH - All tools verified from official docs and Context7

### Backend Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pytest | 8.0.0 (installed) | Test framework | Python standard, already in use |
| pytest-asyncio | 0.23.4 (installed) | Async test support | Required for async FastAPI endpoints and DB operations |
| pytest-cov | 4.1.0 (installed) | Coverage reporting | Track test coverage gaps |
| httpx | 0.26.0 (installed) | Async HTTP client | Use AsyncClient for async endpoint tests |
| FastAPI TestClient | (built-in) | Sync endpoint testing | Simple, synchronous API tests |
| aiosqlite | 0.19.0 (installed) | Test database | In-memory SQLite for fast isolated tests |
| faker | 22.5.1 (installed) | Test data generation | Generate realistic test data |
| pytest-postgresql | Latest (add) | Real PostgreSQL tests | For integration tests requiring pgvector |

**Confidence:** HIGH - FastAPI official docs, pytest ecosystem standard

### Telegram Bot Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pytest | 8.0.0 (existing) | Test framework | Reuse backend testing infrastructure |
| pytest-asyncio | Latest (add to bot) | Async test support | python-telegram-bot v20 is fully async |
| pytest-httpx | Latest (add) | Mock Telegram API | Mock HTTP requests to Telegram servers |
| unittest.mock | (stdlib) | Mock bot objects | Mock Application, Bot, Update objects |

**Confidence:** MEDIUM - Based on python-telegram-bot wiki and community patterns, not official testing docs

### Chrome Extension Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom test runner | (existing) | Unit tests | Already works with 51 passing tests |
| chrome.* mocks | (existing) | Mock Chrome APIs | Existing mocks are comprehensive |
| Playwright | Latest (add for E2E) | End-to-end testing | Official Chrome recommendation for extension E2E tests |

**Confidence:** MEDIUM - Custom setup works, Playwright support verified from official Chrome docs

## Detailed Testing Patterns

### Frontend: React Component Testing

**Pattern: User-centric behavior testing**

```typescript
// Good: Test user behavior
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleCard } from './ArticleCard';

describe('ArticleCard', () => {
  it('navigates to article detail when clicked', async () => {
    const user = userEvent.setup();
    const article = { id: '123', title: 'Test', url: 'https://example.com' };

    render(<ArticleCard article={article} />);

    const card = screen.getByRole('article');
    await user.click(card);

    expect(window.location.pathname).toBe('/articles/123');
  });
});
```

**Pattern: API mocking with MSW**

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/articles', () => {
    return HttpResponse.json([
      { id: '1', title: 'Article 1', tags: ['tech'] }
    ]);
  }),

  http.post('/api/articles', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: '123', ...body }, { status: 201 });
  })
];

// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/setupTests.ts
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Pattern: Testing async data fetching**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArticleList } from './ArticleList';

it('displays articles after loading', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ArticleList />
    </QueryClientProvider>
  );

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Article 1')).toBeInTheDocument();
  });
});
```

**What to test:**
- User interactions (clicks, form submissions, keyboard navigation)
- Conditional rendering based on props/state
- API integration via mocked responses
- Error states and loading states
- Accessibility (ARIA roles, keyboard navigation)

**What NOT to test:**
- Implementation details (state variables, internal functions)
- Third-party library behavior (React Query, router)
- Styling/CSS (use visual regression testing instead)

**Confidence:** HIGH - Patterns from official Vitest and Testing Library docs

### Backend: FastAPI Integration Testing

**Pattern: Sync tests with TestClient**

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_capture_article():
    response = client.post(
        "/api/articles",
        json={"url": "https://example.com/article"},
        headers={"X-API-Key": "test-key"}
    )
    assert response.status_code == 201
    assert "id" in response.json()
```

**Pattern: Async tests with AsyncClient**

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_article_processing_async():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        # Trigger capture
        response = await ac.post(
            "/api/articles",
            json={"url": "https://example.com"}
        )
        article_id = response.json()["id"]

        # Verify processing completed
        detail = await ac.get(f"/api/articles/{article_id}")
        assert detail.json()["status"] == "processed"
```

**Pattern: Database fixtures with cleanup**

```python
# conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    db = TestingSessionLocal()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

**Pattern: Testing background tasks**

```python
@pytest.mark.asyncio
async def test_llm_processing_task(db_session):
    from app.tasks import process_article_with_llm

    article = Article(url="https://example.com", status="pending")
    db_session.add(article)
    db_session.commit()

    await process_article_with_llm(article.id)

    db_session.refresh(article)
    assert article.status == "processed"
    assert article.summary is not None
    assert len(article.tags) > 0
```

**Integration test strategy:**
- Use SQLite for fast unit-style tests (no external dependencies)
- Use PostgreSQL with pytest-postgresql for integration tests requiring pgvector
- Scope fixtures at function level for isolation
- Test the full capture pipeline: URL → extraction → LLM → storage → search

**Confidence:** HIGH - FastAPI official patterns, verified with official docs

### Telegram Bot Testing

**Pattern: Mocking bot updates**

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from telegram import Update, Message, Chat, User
from bot.main import handle_message

@pytest.mark.asyncio
async def test_handle_url_message():
    # Create mock objects
    update = MagicMock(spec=Update)
    context = MagicMock()

    # Setup message
    update.message = MagicMock(spec=Message)
    update.message.text = "https://example.com/article"
    update.message.chat = MagicMock(spec=Chat)
    update.message.chat.id = 12345
    update.effective_user = MagicMock(spec=User)
    update.effective_user.id = 67890

    # Mock reply
    update.message.reply_text = AsyncMock()

    # Execute handler
    await handle_message(update, context)

    # Verify response
    update.message.reply_text.assert_called_once()
    assert "Saved" in update.message.reply_text.call_args[0][0]
```

**Pattern: Mocking Telegram API calls with pytest-httpx**

```python
import pytest
from httpx import AsyncClient
from pytest_httpx import HTTPXMock

@pytest.mark.asyncio
async def test_send_message_api(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.telegram.org/bot<TOKEN>/sendMessage",
        json={"ok": True, "result": {"message_id": 123}}
    )

    async with AsyncClient() as client:
        response = await client.post(
            "https://api.telegram.org/bot<TOKEN>/sendMessage",
            json={"chat_id": 12345, "text": "Test"}
        )
        assert response.json()["ok"] is True
```

**Pattern: Testing authorization**

```python
@pytest.mark.asyncio
async def test_rejects_unauthorized_user():
    update = MagicMock(spec=Update)
    update.effective_user.id = 99999  # Wrong user ID
    update.message.reply_text = AsyncMock()

    await handle_message(update, context)

    update.message.reply_text.assert_called_once_with(
        "Unauthorized user"
    )
```

**What to test:**
- Message handlers for different message types (URL, text, commands)
- User authorization (only owner can use bot)
- Error handling (invalid URLs, API failures)
- Integration with backend API (article capture)

**Confidence:** MEDIUM - Based on python-telegram-bot wiki and community patterns

### Chrome Extension Testing

**Pattern: Unit tests with mocked Chrome APIs (existing)**

The extension already has 51 passing tests using custom Chrome API mocks. Continue this pattern for passive capture logic:

```javascript
// Example pattern from existing tests
describe('Auto-capture', () => {
  beforeEach(() => {
    chrome.storage.local.get = jest.fn((keys, callback) => {
      callback({ whitelist: ['example.com'] });
    });
  });

  it('captures after dwell time on whitelisted domain', () => {
    // Test auto-capture logic
  });

  it('skips non-article pages', () => {
    // Test article detection
  });
});
```

**Pattern: E2E tests with Playwright (new)**

For end-to-end testing of the full extension in a real browser:

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    headless: false, // Extensions require headed mode
    launchOptions: {
      args: [
        `--disable-extensions-except=./dist`,
        `--load-extension=./dist`,
      ],
    },
  },
});

// e2e/capture.spec.js
import { test, expect } from '@playwright/test';

test('captures article via right-click', async ({ page, context }) => {
  // Get extension ID
  let [background] = context.serviceWorkers();
  const extensionId = background.url().split('/')[2];

  // Navigate to article
  await page.goto('https://example.com/article');

  // Trigger context menu capture
  await page.click('body', { button: 'right' });
  await page.click('text=Save to Recall');

  // Verify notification
  await expect(page.locator('.notification')).toContainText('Saved');
});
```

**Playwright setup for MV3:**
- Requires unpacked extension (build directory)
- Must run in headed mode (headless doesn't support extensions, though chromium channel may)
- Access service worker via `context.serviceWorkers()`
- Test ephemeral service worker behavior (may suspend between actions)

**Confidence:** MEDIUM - Playwright support verified from official docs, but MV3 specifics need validation

## Installation Commands

### Frontend (already installed, just add MSW)

```bash
cd frontend
npm install -D msw@^2.12.7
npx msw init ./public --save
```

### Backend (add pytest-postgresql for integration tests)

```bash
cd backend
# Add to requirements-test.txt
echo "pytest-postgresql==5.1.0" >> requirements-test.txt
pip install -r requirements-test.txt
```

### Bot (create test infrastructure)

```bash
cd bot
# Add to requirements.txt or create requirements-test.txt
pip install pytest pytest-asyncio pytest-httpx
```

### Extension (add Playwright for E2E)

```bash
cd extension
npm install -D @playwright/test
npx playwright install chromium
```

## Testing Strategy by Layer

### Frontend Component Tests
- **Scope:** User interactions, conditional rendering, API integration
- **Mocking:** MSW for API calls, no backend required
- **Isolation:** Each test resets MSW handlers
- **Speed:** Fast (jsdom, no real browser)
- **Coverage target:** 70%+ (focus on critical user paths)

### Backend Unit Tests
- **Scope:** Individual functions, validators, utilities
- **Mocking:** Mock external services (LLM APIs, Telegram)
- **Database:** SQLite in-memory for speed
- **Speed:** Very fast (<1s for full suite)
- **Coverage target:** 80%+

### Backend Integration Tests
- **Scope:** Full capture pipeline (URL → extraction → LLM → storage → search)
- **Database:** Real PostgreSQL with pgvector (pytest-postgresql)
- **External services:** Mock LLM APIs, mock Telegram
- **Speed:** Slower (real DB, full flow)
- **Coverage target:** Critical paths only

### Telegram Bot Tests
- **Scope:** Message handlers, authorization, API integration
- **Mocking:** Mock Telegram API (pytest-httpx), mock backend API
- **Isolation:** No real Telegram calls, no real DB
- **Speed:** Fast
- **Coverage target:** 70%+

### Extension Unit Tests
- **Scope:** Capture logic, article detection, whitelist management
- **Mocking:** Mock Chrome APIs (existing pattern)
- **Isolation:** No real DOM, no real browser
- **Speed:** Very fast
- **Coverage target:** 80%+

### Extension E2E Tests
- **Scope:** User flows (right-click capture, auto-capture, popup)
- **Browser:** Real Chromium with extension loaded
- **Backend:** Mock or use test backend
- **Speed:** Slow (real browser, service worker lifecycle)
- **Coverage target:** Critical flows only (3-5 tests)

## Mocking Strategies

### Frontend: Network-level mocking with MSW
- **Why:** Intercepts fetch/httpx at network level, reusable across test and dev
- **Setup:** Define handlers once, use in tests and Storybook
- **Pattern:** Default handlers for happy path, override per-test for errors

### Backend: Dependency injection
- **Why:** FastAPI's dependency system makes overrides clean
- **Setup:** Override `get_db`, `get_llm_client` in tests
- **Pattern:** Fixture-based overrides scoped to test function

### Telegram Bot: Mock update objects
- **Why:** python-telegram-bot uses Update objects, easy to construct
- **Setup:** Mock Update, Message, User objects with unittest.mock
- **Pattern:** Helper functions to create common update scenarios

### Extension: Mock Chrome APIs
- **Why:** Chrome APIs aren't available in Node test environment
- **Setup:** Already exists (51 tests passing)
- **Pattern:** Mock chrome.storage, chrome.tabs, chrome.runtime

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend test runner | Vitest | Jest | Vitest already configured, faster, Vite-native |
| Frontend component testing | Testing Library | Enzyme | Enzyme unmaintained, Testing Library industry standard |
| API mocking | MSW | fetch-mock | MSW works at network level, reusable in dev/Storybook |
| Backend async testing | httpx.AsyncClient | TestClient | TestClient doesn't support async, httpx required for async DB |
| Backend integration DB | pytest-postgresql | Docker PostgreSQL | pytest-postgresql faster, auto-cleanup, CI-friendly |
| Bot testing | pytest + mocks | ptbtest | ptbtest unmaintained, needs updating to PTB v20 |
| Extension E2E | Playwright | Puppeteer | Playwright better MV3 support, official Chrome recommendation |

## Common Pitfalls and Prevention

### Pitfall 1: Testing Implementation Details
**What goes wrong:** Tests break when refactoring even though behavior unchanged
**Why it happens:** Testing internal state, private functions, component structure
**Prevention:** Use Testing Library queries (getByRole, getByText), test user-visible behavior
**Detection:** Ask "Could I write this test without looking at the code?"

### Pitfall 2: Not Awaiting Async Operations
**What goes wrong:** Tests pass/fail inconsistently, race conditions
**Why it happens:** Forgetting await on userEvent, waitFor, async queries
**Prevention:** Always await user-event methods, use waitFor for async updates
**Detection:** Flaky tests, "act" warnings in test output

### Pitfall 3: Shared State Between Tests
**What goes wrong:** Tests fail when run together but pass in isolation
**Why it happens:** Database not cleaned, MSW handlers not reset, module-level state
**Prevention:** afterEach cleanup, function-scoped fixtures, resetHandlers
**Detection:** Tests fail in CI but pass locally, order-dependent failures

### Pitfall 4: Testing Library Behavior
**What goes wrong:** Redundant tests, tight coupling to dependencies
**Why it happens:** Testing that React Query caches, or that React Router navigates
**Prevention:** Trust well-tested libraries, test your code's integration only
**Detection:** Tests that don't verify your business logic

### Pitfall 5: Async Event Loop Issues with pytest-asyncio
**What goes wrong:** RuntimeError: Event loop is closed
**Why it happens:** Fixture scope mismatch, multiple event loops
**Prevention:** Set asyncio_default_fixture_loop_scope = "function" in pyproject.toml
**Detection:** Event loop errors in async tests

### Pitfall 6: TestClient vs AsyncClient Confusion
**What goes wrong:** "TestClient doesn't support await" errors
**Why it happens:** Using TestClient in async test functions
**Prevention:** Use TestClient for sync tests, AsyncClient for async tests
**Detection:** TypeError when trying to await TestClient response

### Pitfall 7: Chrome Extension Service Worker Lifecycle
**What goes wrong:** E2E tests fail because service worker suspended
**Why it happens:** MV3 service workers are ephemeral, may not be active
**Prevention:** Trigger wake events (open popup, send message) before assertions
**Detection:** Intermittent E2E failures, "service worker not active" errors

### Pitfall 8: Telegram Bot Mock Object Construction
**What goes wrong:** AttributeError when accessing mock properties
**Why it happens:** Incomplete mock objects, missing required attributes
**Prevention:** Use spec=Update, spec=Message to ensure correct interface
**Detection:** AttributeError in bot handler tests

## Confidence Assessment

| Testing Layer | Confidence | Rationale |
|---------------|------------|-----------|
| Frontend Stack | HIGH | Official Vitest docs, Testing Library docs, MSW verified |
| Backend Stack | HIGH | FastAPI official docs, pytest ecosystem standard |
| Bot Testing | MEDIUM | python-telegram-bot wiki, community patterns (not official testing docs) |
| Extension Unit | HIGH | Existing setup works (51 tests passing) |
| Extension E2E | MEDIUM | Playwright support verified but MV3 specifics less documented |

## Sources

### Frontend Testing
- [Vitest Component Testing Guide](https://vitest.dev/guide/browser/component-testing)
- [React Testing with Vitest & React Testing Library - Medium](https://vaskort.medium.com/bulletproof-react-testing-with-vitest-rtl-deeaabce9fef)
- [Testing Library User-Event Introduction](https://testing-library.com/docs/user-event/intro/)
- [user-event vs fireEvent Best Practices - Medium](https://medium.com/@ignatovich.dm/best-practices-for-using-react-testing-library-0f71181bb1f4)
- [MSW GitHub Repository](https://github.com/mswjs/msw)
- [MSW Official Documentation](https://mswjs.io/)
- [Vitest + MSW + RTL Setup - DEV Community](https://dev.to/medaymentn/react-unit-testing-using-vitest-rtl-and-msw-216j)

### Backend Testing
- [FastAPI Testing Tutorial](https://fastapi.tiangolo.com/tutorial/testing/)
- [FastAPI Async Tests Documentation](https://fastapi.tiangolo.com/advanced/async-tests/)
- [Mastering Integration Testing with FastAPI - Alex Jacobs](https://alex-jacobs.com/posts/fastapitests/)
- [FastAPI Testing Best Practices - Frugal Testing](https://www.frugaltesting.com/blog/what-is-fastapi-testing-tools-frameworks-and-best-practices)
- [pytest-async-sqlalchemy PyPI](https://pypi.org/project/pytest-async-sqlalchemy/)
- [pytest-postgresql PyPI](https://pypi.org/project/pytest-postgresql/)
- [Async Testing with Pytest - Medium](https://medium.com/@connect.hashblock/async-testing-with-pytest-mastering-pytest-asyncio-and-event-loops-for-fastapi-and-beyond-37c613f1cfa3)

### Telegram Bot Testing
- [Writing Tests - python-telegram-bot Wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests)
- [Testing in PTB - Official Docs](https://docs.python-telegram-bot.org/en/stable/testing.html)
- [pytest-httpx PyPI](https://pypi.org/project/pytest-httpx/)
- [End-to-end tests for Telegram bots - ShallowDepth](https://shallowdepth.online/posts/2021/12/end-to-end-tests-for-telegram-bots/)

### Chrome Extension Testing
- [Unit testing Chrome Extensions - Chrome Developers](https://developer.chrome.com/docs/extensions/mv3/unit-testing/)
- [Playwright Chrome Extensions Documentation](https://playwright.dev/docs/chrome-extensions)
- [jest-webextension-mock GitHub](https://github.com/clarkbw/jest-webextension-mock)
- [Testing Chrome Extensions with Playwright - BrowserStack](https://www.browserstack.com/guide/playwright-chrome-extension)
- [How to Build E2E Tests for Chrome Extensions Using Playwright - DEV Community](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)

---

**Research Quality Indicators:**
- ✓ All major testing layers covered (frontend, backend, bot, extension)
- ✓ Specific versions and rationale provided
- ✓ Verified with official documentation (FastAPI, Vitest, Playwright, python-telegram-bot)
- ✓ Confidence levels assigned honestly (HIGH for verified, MEDIUM for community patterns)
- ✓ Actionable patterns with code examples
- ✓ Common pitfalls catalogued with prevention strategies
- ✓ Sources cited for all claims
