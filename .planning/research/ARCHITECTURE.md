# Architecture Patterns: Auto-Capture & Testing

**Domain:** Chrome MV3 Extension with FastAPI Backend + React Frontend + Telegram Bot
**Researched:** 2026-01-29
**Confidence:** HIGH (official Chrome docs + FastAPI docs + TanStack docs)

## Executive Summary

Auto-capture in Chrome MV3 requires a fundamentally different architecture than MV2 due to service worker lifecycle constraints. Service workers terminate after 30 seconds of inactivity, making continuous dwell time tracking impossible. The solution is a **hybrid event-driven + periodic check architecture** using webNavigation events, chrome.alarms, and chrome.storage for state persistence.

Integration testing in this stack requires async-aware approaches across all layers: pytest with AsyncClient for FastAPI background tasks, React Testing Library with QueryClient wrappers for React Query, and pytest fixtures with mocked Telegram updates for the bot.

## Current Architecture (Existing)

### Component Boundaries

| Component | Responsibility | Communicates With | State |
|-----------|---------------|-------------------|-------|
| **Extension Service Worker** | Event handling, manual capture orchestration | Backend API, Content Scripts | chrome.storage only |
| **Extension Content Scripts** | DOM access, page metadata extraction | Service Worker | None (injected per-page) |
| **Extension Popup** | User-triggered capture UI | Service Worker | None (ephemeral) |
| **Backend (FastAPI)** | Article processing, LLM orchestration, API | PostgreSQL, DeepSeek/Ollama | Async background tasks |
| **Frontend (React)** | Article browsing, search, visualization | Backend API via React Query | React Query cache |
| **Bot (python-telegram-bot)** | Telegram message handling, article capture | Backend API | Polling mode, stateless |
| **Database (PostgreSQL)** | Article storage, embeddings, FTS | Backend only | Persistent |

### Current Data Flow (Manual Capture)

```
User Action (right-click/shortcut/popup)
  → Extension Service Worker receives command
  → Content Script extracts page metadata + content
  → Service Worker sends to Backend API
  → Backend creates Article record
  → Background task: LLM processing (tags, summary, embeddings)
  → Frontend polls/refetches via React Query
  → User sees processed article
```

## Recommended Architecture: Auto-Capture

### Design Constraints

**Chrome MV3 Service Worker Lifecycle:**
- Terminates after 30 seconds of inactivity
- Cannot maintain continuous state in memory
- Must use chrome.storage for persistence
- Can be awakened by: alarms, webNavigation events, messages

**Requirements:**
- Track dwell time per tab (time spent on article pages)
- Trigger capture after threshold (e.g., 60 seconds)
- Whitelist-based (only monitored domains)
- Detect article pages (skip homepages, listings)
- Survive service worker restarts

### Component Architecture for Auto-Capture

| Component | Responsibility | Communicates With | State Storage |
|-----------|---------------|-------------------|---------------|
| **Service Worker: Event Coordinator** | Listen to webNavigation, manage alarms, orchestrate capture | Content Scripts, Backend API | chrome.storage.local |
| **Service Worker: Dwell Tracker** | Calculate time on page, check thresholds | Event Coordinator | chrome.storage.session (active), chrome.storage.local (persistent) |
| **Service Worker: Whitelist Manager** | Store/query whitelisted domains | Options page, Event Coordinator | chrome.storage.local |
| **Content Script: Page Classifier** | Detect article vs non-article pages | Service Worker | None (stateless) |
| **Content Script: Metadata Extractor** | Extract article content (existing logic) | Service Worker | None (stateless) |
| **Options Page** | Whitelist management UI | Service Worker (storage) | None (reads chrome.storage) |

### Auto-Capture Data Flow

```
1. Navigation Event (webNavigation.onCompleted)
   ↓
2. Service Worker awakens
   ↓
3. Check if domain is whitelisted (chrome.storage.local)
   ↓ YES
4. Message Content Script: "Classify this page"
   ↓
5. Content Script analyzes DOM (article heuristics)
   ↓ IS ARTICLE
6. Store navigation timestamp in chrome.storage.session
   ↓
7. Create chrome.alarm for threshold check (60s later)
   ↓
   [Service Worker may terminate here]
   ↓
8. Alarm fires after 60s, awakens Service Worker
   ↓
9. Check chrome.tabs.get(tabId) - is tab still on same URL?
   ↓ YES
10. Calculate dwell time from stored timestamp
    ↓ THRESHOLD MET
11. Message Content Script: "Extract article"
    ↓
12. Send to Backend API (existing capture flow)
    ↓
13. Toast notification: "Auto-captured!"
    ↓
14. Clear chrome.storage.session entry for this tab
```

### Storage Strategy

**chrome.storage.session (temporary, 10 MB):**
- Active dwell time tracking: `{ [tabId]: { url, startTime, domain } }`
- Cleared on extension reload/browser restart
- Fast read/write, no quotas

**chrome.storage.local (persistent, 10 MB):**
- Whitelisted domains: `{ whitelist: Set<string> }`
- Auto-capture settings: `{ dwellThreshold: 60, enableToast: true }`
- Recently captured URLs (deduplication): `{ captured: { [url]: timestamp } }`

**Why not chrome.storage.sync:**
- 1,800 write ops/hour limit (120/minute) too restrictive for dwell tracking
- Dwell time is device-specific, no need to sync across browsers

### State Persistence Pattern

Service workers can terminate at any time, so state must survive restarts:

```javascript
// On webNavigation.onCompleted (page load complete)
chrome.storage.session.set({
  [tabId]: {
    url: details.url,
    startTime: Date.now(),
    domain: new URL(details.url).hostname
  }
});

// On chrome.alarms.onAlarm (threshold check)
const data = await chrome.storage.session.get(tabId);
if (data[tabId] && data[tabId].url === currentUrl) {
  const dwellTime = Date.now() - data[tabId].startTime;
  if (dwellTime >= threshold) {
    triggerCapture(tabId);
  }
}
```

### Article Page Detection Heuristics

Content script analyzes DOM to determine if page is an article (vs homepage, listing, etc.):

**Positive signals:**
- `<article>` tag present
- High text density (>500 words in main content)
- Meta tags: `og:type="article"` or `article:published_time`
- Low link density (more text than links)
- Schema.org Article structured data

**Negative signals:**
- Multiple article previews (listing page)
- High navigation density (homepage)
- Short content (<300 words)

**Implementation:**
```javascript
// In content script
function isArticlePage() {
  // Check meta tags first (fastest)
  if (document.querySelector('meta[property="og:type"][content="article"]')) {
    return true;
  }

  // Check for article tag with substantial content
  const article = document.querySelector('article');
  if (article && article.innerText.split(/\s+/).length > 500) {
    return true;
  }

  // Check for multiple article previews (listing page)
  const articlePreviews = document.querySelectorAll('article').length;
  if (articlePreviews > 3) return false;

  // Fallback: analyze main content area
  const main = document.querySelector('main') || document.body;
  const wordCount = main.innerText.split(/\s+/).length;
  const linkCount = main.querySelectorAll('a').length;
  const textDensity = wordCount / (linkCount + 1);

  return wordCount > 500 && textDensity > 10;
}
```

## Integration Testing Architecture

### Backend: FastAPI + Async Background Tasks

**Challenge:** Background tasks run after response is sent. Standard TestClient is synchronous.

**Solution:** Use httpx AsyncClient with pytest-asyncio.

#### Test Architecture

| Layer | Tool | Purpose |
|-------|------|---------|
| HTTP Client | httpx.AsyncClient | Async request/response testing |
| Database | pytest fixture with session rollback | Isolated test database state |
| Background Tasks | Custom fixture + manual execution | Control when tasks run |
| LLM Mocking | pytest monkeypatch or responses library | Avoid API calls in tests |

#### Pattern 1: Testing Endpoints with Background Tasks

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.anyio
async def test_capture_article_with_processing():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        # POST article capture request
        response = await client.post("/api/articles", json={
            "url": "https://example.com/article",
            "content": "Article text...",
            "api_key": "test-key"
        })

        assert response.status_code == 201
        article_id = response.json()["id"]

        # Background task is now running (or queued)
        # Need to wait for it to complete
        await asyncio.sleep(0.1)  # Allow task to start

        # Verify article was processed
        article_response = await client.get(f"/api/articles/{article_id}")
        article = article_response.json()

        assert article["tags"] is not None  # LLM processing completed
        assert article["summary"] is not None
```

**Issue:** No reliable way to know when background task completes.

#### Pattern 2: Controlled Background Task Execution (Recommended)

```python
import pytest
from unittest.mock import Mock
from fastapi import BackgroundTasks

@pytest.fixture
def captured_tasks():
    """Fixture that captures background tasks for manual execution."""
    tasks = []

    original_add_task = BackgroundTasks.add_task

    def capture_task(self, func, *args, **kwargs):
        tasks.append((func, args, kwargs))

    BackgroundTasks.add_task = capture_task

    yield tasks

    BackgroundTasks.add_task = original_add_task

@pytest.mark.anyio
async def test_capture_with_controlled_tasks(captured_tasks, async_client):
    response = await async_client.post("/api/articles", json={
        "url": "https://example.com/article",
        "content": "Article text...",
        "api_key": "test-key"
    })

    assert response.status_code == 201
    article_id = response.json()["id"]

    # Manually execute background tasks
    for func, args, kwargs in captured_tasks:
        if asyncio.iscoroutinefunction(func):
            await func(*args, **kwargs)
        else:
            func(*args, **kwargs)

    # Now verify processing completed
    article_response = await async_client.get(f"/api/articles/{article_id}")
    article = article_response.json()

    assert article["tags"] is not None
```

#### Pattern 3: Database Fixture with Async Session

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

@pytest_asyncio.fixture
async def async_db_session():
    """Async database session with automatic rollback."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False
    )

    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()  # Rollback after test

    await engine.dispose()

@pytest.mark.anyio
async def test_with_database(async_db_session):
    # Use async_db_session for database operations
    article = Article(url="https://example.com", content="Test")
    async_db_session.add(article)
    await async_db_session.commit()

    result = await async_db_session.execute(
        select(Article).where(Article.url == "https://example.com")
    )
    fetched = result.scalar_one()

    assert fetched.content == "Test"
```

#### Pattern 4: Mocking LLM API Calls

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.fixture
def mock_deepseek():
    """Mock DeepSeek API to avoid actual API calls."""
    with patch('app.services.llm.DeepSeekClient') as mock:
        mock_instance = AsyncMock()
        mock_instance.generate_tags.return_value = ["tech", "ai"]
        mock_instance.generate_summary.return_value = "Article summary"
        mock_instance.generate_embedding.return_value = [0.1, 0.2, ...]
        mock.return_value = mock_instance
        yield mock_instance

@pytest.mark.anyio
async def test_article_processing(mock_deepseek, async_client):
    response = await async_client.post("/api/articles/process/123")

    assert response.status_code == 200
    mock_deepseek.generate_tags.assert_called_once()
    mock_deepseek.generate_summary.assert_called_once()
```

### Frontend: React + React Query Testing

**Challenge:** React Query manages async state with caching, retries, and background refetching.

**Solution:** Wrap components in QueryClientProvider with test-specific configuration.

#### Test Architecture

| Layer | Tool | Purpose |
|-------|------|---------|
| Component Rendering | @testing-library/react | Render components in test environment |
| Async Waiting | waitFor, findBy queries | Wait for React Query to resolve |
| Query Client | Custom wrapper | Provide QueryClient with test config |
| API Mocking | MSW (Mock Service Worker) or jest.mock | Mock fetch/axios calls |

#### Pattern 1: QueryClient Test Wrapper

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        cacheTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {}, // Suppress error logs in tests
    },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Usage
test('renders article list', async () => {
  const { findByText } = renderWithQueryClient(<ArticleList />);

  // Wait for query to complete
  const article = await findByText('Sample Article Title');
  expect(article).toBeInTheDocument();
});
```

#### Pattern 2: Testing Custom Hooks with React Query

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArticles } from './useArticles';

test('useArticles hook fetches articles', async () => {
  const queryClient = createTestQueryClient();

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useArticles(), { wrapper });

  // Initially loading
  expect(result.current.isLoading).toBe(true);

  // Wait for query to resolve
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Check data
  expect(result.current.data).toHaveLength(3);
  expect(result.current.data[0].title).toBe('Article 1');
});
```

#### Pattern 3: Mocking API with MSW (Recommended)

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.get('/api/articles', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, title: 'Article 1', url: 'https://example.com/1' },
      { id: 2, title: 'Article 2', url: 'https://example.com/2' },
    ]));
  }),

  rest.post('/api/articles', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({
      id: 3,
      title: 'New Article',
      url: req.body.url,
    }));
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('creates new article', async () => {
  const { findByText } = renderWithQueryClient(<CreateArticleForm />);

  // Fill form and submit
  fireEvent.change(screen.getByLabelText('URL'), {
    target: { value: 'https://example.com/new' }
  });
  fireEvent.click(screen.getByText('Submit'));

  // Wait for success message
  const successMsg = await findByText('Article created!');
  expect(successMsg).toBeInTheDocument();
});
```

#### Pattern 4: Testing Query Invalidation

```typescript
test('refetches articles after mutation', async () => {
  const queryClient = createTestQueryClient();

  const { findByText, getByText } = renderWithQueryClient(
    <ArticleListWithCreate />,
    queryClient
  );

  // Initial list
  await findByText('Article 1');

  // Create new article
  fireEvent.click(getByText('Add Article'));

  // Should refetch and show new article
  await waitFor(() => {
    expect(getByText('New Article')).toBeInTheDocument();
  });
});
```

### Bot: python-telegram-bot Testing

**Challenge:** Bot handlers are async and depend on Telegram context (Update, CallbackContext).

**Solution:** Use pytest-asyncio with mocked Update/Context objects.

#### Test Architecture

| Layer | Tool | Purpose |
|-------|------|---------|
| Async Testing | pytest-asyncio | Run async handler tests |
| Telegram Mocking | pytest fixtures | Create mock Update, CallbackContext |
| API Mocking | pytest monkeypatch or responses | Mock Backend API calls |

#### Pattern 1: Mock Telegram Update Fixture

```python
import pytest
from telegram import Update, User, Message, Chat
from telegram.ext import CallbackContext

@pytest.fixture
def mock_update():
    """Create a mock Telegram Update object."""
    user = User(id=123456, first_name="Test", is_bot=False)
    chat = Chat(id=123456, type="private")
    message = Message(
        message_id=1,
        date=datetime.now(),
        chat=chat,
        from_user=user,
        text="/start"
    )

    return Update(update_id=1, message=message)

@pytest.fixture
def mock_context(mocker):
    """Create a mock CallbackContext."""
    context = mocker.Mock(spec=CallbackContext)
    context.bot = mocker.Mock()
    context.args = []
    context.user_data = {}
    return context
```

#### Pattern 2: Testing Message Handlers

```python
import pytest
from bot.handlers import start_handler, article_handler

@pytest.mark.asyncio
async def test_start_command(mock_update, mock_context):
    """Test /start command handler."""
    await start_handler(mock_update, mock_context)

    # Verify bot sent reply
    mock_context.bot.send_message.assert_called_once()
    call_args = mock_context.bot.send_message.call_args

    assert call_args[1]['chat_id'] == 123456
    assert 'Welcome' in call_args[1]['text']

@pytest.mark.asyncio
async def test_article_url_handler(mock_update, mock_context, monkeypatch):
    """Test article URL submission."""
    # Mock API call to backend
    mock_post = AsyncMock(return_value={"id": 123, "status": "processing"})
    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    # Update message with article URL
    mock_update.message.text = "https://example.com/article"

    await article_handler(mock_update, mock_context)

    # Verify API was called
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "https://example.com/article" in str(call_args)

    # Verify user got confirmation
    mock_context.bot.send_message.assert_called()
```

#### Pattern 3: Testing User Authorization

```python
import pytest
from bot.handlers import authorized_only

@pytest.mark.asyncio
async def test_unauthorized_user_blocked(mock_update, mock_context):
    """Test that unauthorized users cannot use the bot."""
    # Set different user ID
    mock_update.message.from_user.id = 999999  # Not the owner

    @authorized_only
    async def protected_handler(update, context):
        await context.bot.send_message(
            chat_id=update.message.chat_id,
            text="Protected content"
        )

    await protected_handler(mock_update, mock_context)

    # Should send unauthorized message
    mock_context.bot.send_message.assert_called_once()
    call_args = mock_context.bot.send_message.call_args
    assert 'Unauthorized' in call_args[1]['text']
```

#### Pattern 4: Integration Test with Backend

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_article_capture_flow_e2e(mock_update, mock_context):
    """End-to-end test: User sends URL → Bot → Backend → Response."""

    # Mock backend API
    with patch('httpx.AsyncClient') as mock_client:
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": 123,
            "url": "https://example.com/article",
            "status": "processing"
        }
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response

        # Send article URL
        mock_update.message.text = "https://example.com/article"
        await article_handler(mock_update, mock_context)

        # Verify backend was called
        mock_client.return_value.__aenter__.return_value.post.assert_called()

        # Verify user notification
        assert mock_context.bot.send_message.call_count >= 1

        # Check confirmation message
        calls = mock_context.bot.send_message.call_args_list
        confirmation_text = calls[-1][1]['text']
        assert 'saved' in confirmation_text.lower() or 'processing' in confirmation_text.lower()
```

### Extension: Chrome MV3 Testing

**Challenge:** Service workers, content scripts, and Chrome APIs must be mocked.

**Solution:** Use Jest with chrome API mocks + puppeteer for E2E tests.

#### Test Architecture (Existing)

Based on PROJECT.md: "Extension: 51 tests passing (mocked Chrome APIs)"

The existing extension testing architecture uses mocked Chrome APIs. For auto-capture, additional test patterns needed:

#### Pattern 1: Testing webNavigation Event Handling

```javascript
describe('Auto-capture: Navigation events', () => {
  beforeEach(() => {
    chrome.storage.session.get.mockClear();
    chrome.storage.local.get.mockClear();
  });

  test('starts tracking dwell time on article page load', async () => {
    // Mock storage: domain is whitelisted
    chrome.storage.local.get.mockResolvedValue({
      whitelist: ['example.com']
    });

    // Mock content script response: is article
    chrome.tabs.sendMessage.mockResolvedValue({
      isArticle: true
    });

    // Trigger navigation event
    const details = {
      tabId: 123,
      url: 'https://example.com/article',
      frameId: 0
    };

    await handleNavigationCompleted(details);

    // Should store timestamp in session
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      123: expect.objectContaining({
        url: 'https://example.com/article',
        startTime: expect.any(Number),
        domain: 'example.com'
      })
    });

    // Should create alarm
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      `dwell-check-123`,
      expect.objectContaining({
        delayInMinutes: 1
      })
    );
  });

  test('ignores non-whitelisted domains', async () => {
    chrome.storage.local.get.mockResolvedValue({
      whitelist: ['example.com']
    });

    const details = {
      tabId: 123,
      url: 'https://other-site.com/page',
      frameId: 0
    };

    await handleNavigationCompleted(details);

    // Should not track
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});
```

#### Pattern 2: Testing Alarm-Based Threshold Checks

```javascript
describe('Auto-capture: Dwell time threshold', () => {
  test('triggers capture when threshold met', async () => {
    // Mock session storage: tab has been tracked for 60s
    const startTime = Date.now() - 65000; // 65 seconds ago
    chrome.storage.session.get.mockResolvedValue({
      123: {
        url: 'https://example.com/article',
        startTime,
        domain: 'example.com'
      }
    });

    // Mock tab: still on same URL
    chrome.tabs.get.mockResolvedValue({
      id: 123,
      url: 'https://example.com/article'
    });

    // Mock content script: extract article
    chrome.tabs.sendMessage.mockResolvedValue({
      url: 'https://example.com/article',
      title: 'Article Title',
      content: 'Article content...'
    });

    // Trigger alarm
    await handleDwellAlarm({ name: 'dwell-check-123' });

    // Should send to backend
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/articles'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('https://example.com/article')
      })
    );

    // Should clear session storage
    expect(chrome.storage.session.remove).toHaveBeenCalledWith('123');
  });

  test('does not capture if tab navigated away', async () => {
    const startTime = Date.now() - 65000;
    chrome.storage.session.get.mockResolvedValue({
      123: {
        url: 'https://example.com/article',
        startTime,
        domain: 'example.com'
      }
    });

    // Tab now on different URL
    chrome.tabs.get.mockResolvedValue({
      id: 123,
      url: 'https://example.com/other-page'
    });

    await handleDwellAlarm({ name: 'dwell-check-123' });

    // Should not capture
    expect(global.fetch).not.toHaveBeenCalled();

    // Should clear session storage (old entry)
    expect(chrome.storage.session.remove).toHaveBeenCalledWith('123');
  });
});
```

## Build Order Implications

### Phase 1: Auto-Capture Foundation
**Components to build first:**
1. Whitelist storage & options page (foundation for all auto-capture)
2. Article page detection in content script (determines what to track)
3. Domain checking in service worker (filtering logic)

**Why this order:**
- Whitelist is simplest, no dependencies
- Article detection is stateless, can be tested independently
- Both are prerequisites for dwell tracking

**Testing implications:**
- Can write unit tests immediately (no integration needed)
- Chrome API mocks already exist

### Phase 2: Dwell Time Tracking
**Components to build:**
1. webNavigation.onCompleted listener
2. chrome.storage.session state management
3. chrome.alarms periodic checks
4. Tab state validation

**Why this order:**
- Navigation listener is entry point
- Storage must work before alarms (alarms read storage)
- Tab validation is final check before capture

**Testing implications:**
- Need to mock chrome.storage, chrome.alarms, chrome.tabs
- Time-based tests require jest.useFakeTimers()
- Integration test: navigation → storage → alarm → capture decision

### Phase 3: Auto-Capture Integration
**Components to build:**
1. Trigger capture from alarm handler
2. Deduplication (check chrome.storage.local for recent captures)
3. Toast notification
4. User prompts ("Add to whitelist?")

**Why this order:**
- Reuses existing manual capture code path
- Deduplication prevents spam
- UI polish (toasts, prompts) comes last

**Testing implications:**
- Integration test with mocked backend API
- E2E test with puppeteer (if critical)

### Phase 4: Comprehensive Test Suite
**Tests to add (in parallel with features):**

**Backend:**
- [ ] Integration test: Article capture → background task → LLM processing
- [ ] Integration test: Failed LLM fallback chain
- [ ] Integration test: Duplicate URL handling
- [ ] Unit test: URL normalization edge cases

**Frontend:**
- [ ] Component test: ArticleList with React Query
- [ ] Component test: SearchBar with debounce
- [ ] Hook test: useArticles with pagination
- [ ] Integration test: Create article → invalidate query → refetch

**Bot:**
- [ ] Handler test: /start command
- [ ] Handler test: Article URL submission
- [ ] Integration test: Authorization check
- [ ] Integration test: Backend API failure handling

**Extension:**
- [ ] Unit test: Article page detection heuristics
- [ ] Unit test: Whitelist domain matching
- [ ] Integration test: Navigation → dwell tracking → capture
- [ ] Integration test: Service worker restart resilience

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing State in Service Worker Memory
**What:** Tracking dwell time in global variables or class properties in service worker.

**Why bad:** Service worker terminates after 30 seconds. All memory state is lost. Dwell time tracking breaks.

**Instead:** Use chrome.storage.session for active tracking, chrome.storage.local for persistence.

**Detection:** If you see `let dwellTimeMap = {}` or `this.activeTabState = {}` in service worker, it's wrong.

### Anti-Pattern 2: Continuous Polling for Dwell Time
**What:** Using setInterval or setTimeout to check dwell time every second.

**Why bad:** Prevents service worker from terminating, wastes CPU, violates Chrome's event-driven architecture.

**Instead:** Use chrome.alarms with minimum 30-second intervals. Check threshold once when alarm fires.

**Detection:** `setInterval(checkDwellTime, 1000)` in service worker = violation.

### Anti-Pattern 3: Synchronous TestClient for Async FastAPI Tests
**What:** Using `from fastapi.testclient import TestClient` for testing endpoints with async background tasks.

**Why bad:** TestClient uses httpx synchronously. Won't properly test async code paths. Background tasks may not execute.

**Instead:** Use `httpx.AsyncClient` with `ASGITransport` and `@pytest.mark.anyio`.

**Detection:** `def test_...` (not async) testing async endpoint = likely wrong.

### Anti-Pattern 4: Testing React Query Without Disabling Retries
**What:** Using default QueryClient configuration in tests (retries=3, exponential backoff).

**Why bad:** Failed queries retry 3 times with delays, causing tests to timeout. Unpredictable test timing.

**Instead:** Create test QueryClient with `retry: false` and `cacheTime: Infinity`.

**Detection:** Tests timeout after 5+ seconds = likely default retry behavior.

### Anti-Pattern 5: Mocking React Query Hooks Directly
**What:** Using `jest.mock('@tanstack/react-query')` to mock `useQuery`, `useMutation`.

**Why bad:** Loses React Query's caching, invalidation, refetching logic. Tests don't match real behavior.

**Instead:** Mock at the network layer (MSW) or the data fetching function layer. Keep React Query real.

**Detection:** `jest.mock('@tanstack/react-query')` = code smell.

### Anti-Pattern 6: Testing Bot Handlers Without Async Context
**What:** Testing python-telegram-bot handlers as sync functions or without proper Update/Context mocks.

**Why bad:** Handlers are async and depend on Telegram context. Sync tests don't test real behavior.

**Instead:** Use `@pytest.mark.asyncio` and create fixtures for Update, CallbackContext.

**Detection:** `def test_handler(...)` not `async def test_handler(...)` = likely incomplete.

### Anti-Pattern 7: chrome.storage.sync for Dwell Time Tracking
**What:** Using chrome.storage.sync to store dwell time state because "it syncs across devices."

**Why bad:** 1,800 write ops/hour limit = ~30 writes/minute. Dwell tracking updates frequently. Quota exceeded.

**Instead:** Use chrome.storage.session (temporary) and chrome.storage.local (persistent). Dwell time is device-specific anyway.

**Detection:** `chrome.storage.sync.set` in dwell tracking code = quota violation risk.

### Anti-Pattern 8: Awaiting Background Tasks in FastAPI Response
**What:** `await background_task()` in the endpoint before returning response.

**Why bad:** Defeats purpose of background tasks. User waits for LLM processing (slow). Poor UX.

**Instead:** Add task to BackgroundTasks, return 201 immediately. Frontend polls for completion.

**Detection:** `await process_article_llm(...)` in endpoint code = blocking response.

## Scalability Considerations

| Concern | Current (100 articles) | Medium (10K articles) | Large (1M articles) |
|---------|----------------------|----------------------|---------------------|
| **Extension: Dwell tracking** | chrome.storage.session (10 active tabs) | Same (tab count doesn't scale with articles) | Same |
| **Extension: Whitelist storage** | chrome.storage.local (10 domains) | chrome.storage.local (100 domains, <1KB) | chrome.storage.local (1000 domains, ~10KB) |
| **Backend: Background tasks** | FastAPI BackgroundTasks (same process) | Celery + Redis (separate workers) | Celery + Redis + rate limiting |
| **Backend: Database connections** | New connection per article (bad, current issue) | Connection pool (asyncpg) | Connection pool + read replicas |
| **Frontend: Article list** | Fetch all, client-side filter | Pagination (20 per page) | Pagination + virtual scroll + cursor-based |
| **Bot: Message rate** | No rate limiting (single user) | Same | Same (single-user assumption) |
| **PostgreSQL: Vector search** | pgvector HNSW index | Same (HNSW scales to millions) | Partitioning by month + warm cache |

**Critical scaling changes needed at 10K articles:**
1. Replace FastAPI BackgroundTasks with Celery (separate worker process)
2. Fix database connection pooling (already flagged in PROJECT.md)
3. Add pagination to frontend queries

**Already built for scale:**
- pgvector HNSW index (efficient at 1M+ vectors)
- Single-user assumption (no multi-tenancy complexity)
- LLM cost optimization (DeepSeek $0.14/1M tokens)

## Sources

**Chrome Extension Architecture:**
- [The extension service worker lifecycle | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [chrome.storage API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.webNavigation API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [chrome.alarms API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Chrome Extension Development: The Complete System Architecture Guide for 2026](https://jinlow.medium.com/chrome-extension-development-the-complete-system-architecture-guide-for-2026-9ae81415f93e)
- [Building persistent Chrome Extension using Manifest V3](https://rahulnegi20.medium.com/building-persistent-chrome-extension-using-manifest-v3-198000bf1db6)

**FastAPI Testing:**
- [Async Tests - FastAPI](https://fastapi.tiangolo.com/advanced/async-tests/)
- [How to test BackgroundTasks? · fastapi/fastapi · Discussion #7703](https://github.com/fastapi/fastapi/discussions/7703)
- [Fast and furious: async testing with FastAPI and pytest](https://weirdsheeplabs.com/blog/fast-and-furious-async-testing-with-fastapi-and-pytest)
- [Developing and Testing an Asynchronous API with FastAPI and Pytest | TestDriven.io](https://testdriven.io/blog/fastapi-crud/)

**React Query Testing:**
- [Testing React Query | TkDodo's blog](https://tkdodo.eu/blog/testing-react-query)
- [Testing | TanStack Query React Docs](https://tanstack.com/query/v3/docs/framework/react/guides/testing)
- [How To Test React Query Hook using Jest](https://medium.com/@ghewadesumit/how-to-test-react-query-hook-using-jest-11d01a0a0acd)
- [How to Test React Hooks with @testing-library/react-hooks](https://oneuptime.com/blog/post/2026-01-15-test-react-hooks-testing-library/view)

**python-telegram-bot Testing:**
- [Testing in PTB - python-telegram-bot v22.5](https://docs.python-telegram-bot.org/en/stable/testing.html)
- [End-to-end tests for Telegram bots | ShallowDepth](https://shallowdepth.online/posts/2021/12/end-to-end-tests-for-telegram-bots/)
- [How to Write Integration Tests for a Telegram Bot](https://blog.1a23.com/2020/03/06/how-to-write-integration-tests-for-a-telegram-bot/)
