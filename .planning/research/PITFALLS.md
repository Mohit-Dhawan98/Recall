# Domain Pitfalls: Testing & Extension Development

**Domain:** Testing React/FastAPI applications + Chrome MV3 passive capture
**Researched:** 2026-01-29
**Confidence:** HIGH (verified with official docs and recent community sources)

## Critical Pitfalls

Mistakes that cause rewrites, production bugs, or major issues.

---

### Pitfall 1: Background Tasks Creating New DB Connections Per Task

**What goes wrong:** FastAPI background tasks create a new database engine and session for each task, bypassing connection pooling. With 100s of concurrent captures, you exhaust database connections and degrade performance catastrophically.

**Why it happens:** The request's AsyncSession scope ends when the response is sent, before background tasks execute. Developers naively create new engines in background tasks (lines 34-35 of `/backend/app/routers/articles.py`).

**Consequences:**
- Connection pool exhaustion under load
- Database connection leaks
- "too many connections" errors
- 10-100x slower background processing
- Silent failures when pool exhausted

**Prevention:**
- **USE:** Dependency injection with `Depends()` that provides session from shared pool
- **OR:** Pass connection pool (not engine) to background task, create session from pool
- **OR:** Use task queue (Celery, arq) with worker process that maintains connection pool
- **NEVER:** Call `create_async_engine()` inside background task

**Detection:**
- Monitor database connection count during load testing
- Check for "remaining connection slots are reserved" errors
- Profile background task execution time
- Warning sign: connection count grows linearly with background tasks

**Phase mapping:** Phase 1 (Testing foundation) - Must fix before adding integration tests or they'll be flaky

**Sources:**
- [FastAPI background tasks with async database session](https://dev.to/whchi/testing-fastapi-with-async-database-session-1b5d)
- [Async APIs with FastAPI: Patterns, Pitfalls & Best Practices](https://shiladityamajumder.medium.com/async-apis-with-fastapi-patterns-pitfalls-best-practices-2d72b2b66f25)
- [FastAPI database connection pooling discussion](https://github.com/fastapi/fastapi/discussions/9097)

---

### Pitfall 2: Service Worker State Lost on Suspension (Dwell Time Tracking)

**What goes wrong:** Chrome terminates service workers after 30 seconds of inactivity. Any dwell time tracked in global variables is lost. User visits page for 50 seconds → service worker suspends at 30s → auto-capture never fires because timer state is gone.

**Why it happens:** Developers treat service workers like persistent background pages (MV2 mental model). Global variables, `setTimeout`, and in-memory counters don't survive suspension.

**Consequences:**
- Dwell time tracking resets unpredictably
- Auto-capture fires too early or never
- User sees inconsistent behavior ("Why did it capture at 20s on one tab but not 60s on another?")
- Impossible to debug because suspension timing varies

**Prevention:**
1. **Store dwell time state in chrome.storage.session:**
   ```javascript
   // On page focus/visit
   await chrome.storage.session.set({
     [`dwellStart_${tabId}`]: Date.now()
   });

   // On alarm/check
   const data = await chrome.storage.session.get(`dwellStart_${tabId}`);
   const elapsed = Date.now() - data.dwellStart;
   ```

2. **Use chrome.alarms API (not setTimeout):**
   - Alarms survive suspension and wake service worker
   - Minimum 30s interval (Chrome 120+)
   - Register listener at top-level (not in async function)

3. **Check alarm existence on startup:**
   ```javascript
   chrome.runtime.onStartup.addListener(async () => {
     const alarm = await chrome.alarms.get('dwellCheck');
     if (!alarm) {
       chrome.alarms.create('dwellCheck', { periodInMinutes: 1 });
     }
   });
   ```

**Detection:**
- Test with `chrome://serviceworker-internals/` - manually stop worker
- Warning sign: setTimeout callbacks never fire after 30s
- Monitor `chrome.storage.session` for missing keys

**Phase mapping:** Phase 2 (Auto-capture) - Implement correctly from start or tracking will be unreliable

**Sources:**
- [Chrome extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome MV3 service worker suspension testing (eyeo)](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension)
- [MV3 alarms persistence discussion](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE)

---

### Pitfall 3: Alarms Not Firing After Extension Update

**What goes wrong:** After Chrome auto-updates the extension, alarms stop firing. Service worker shows "ACTIVATED" status but is actually broken. Dwell time checks never run, auto-capture silently fails.

**Why it happens:** Chrome's service worker update mechanism can leave old worker activated while new worker waits. Alarms registered by old worker don't transfer to new worker. Documented Chrome bug affecting MV3 extensions.

**Consequences:**
- Auto-capture breaks for all users after update
- No error messages or warnings
- Appears working in dev/test but fails in production
- Users must reinstall extension to fix

**Prevention:**
1. **Always check and recreate alarms on service worker startup:**
   ```javascript
   // Top-level, synchronous registration
   chrome.runtime.onStartup.addListener(ensureAlarms);
   chrome.runtime.onInstalled.addListener(ensureAlarms);

   async function ensureAlarms() {
     const existing = await chrome.alarms.get('dwellCheck');
     if (!existing) {
       chrome.alarms.create('dwellCheck', { periodInMinutes: 1 });
     }
   }
   ```

2. **Register alarm listeners at top-level (not nested):**
   ```javascript
   // GOOD - top-level, synchronous
   chrome.alarms.onAlarm.addListener((alarm) => {
     if (alarm.name === 'dwellCheck') handleDwellCheck();
   });

   // BAD - nested in async function
   async function setupListeners() {
     chrome.alarms.onAlarm.addListener(...); // Won't survive restart
   }
   ```

3. **Test update scenario explicitly:**
   - Load unpacked extension
   - Change version in manifest.json
   - Reload extension
   - Verify alarms still firing

**Detection:**
- Check `chrome://serviceworker-internals/` for duplicate workers (ACTIVATED + WAITING)
- Monitor alarm firing with `chrome.alarms.getAll()`
- Add logging to alarm handlers: "Alarm fired: [timestamp]"

**Phase mapping:** Phase 2 (Auto-capture) - Critical for reliability, must test before release

**Sources:**
- [MV3 service worker broken after auto-update](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/POU6sW-I39M/m/PljS3_zbAgAJ)
- [Confusion regarding alarms in MV3](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/hWEe4I93P_E)
- [Chrome alarms API documentation (updated 2026-01-07)](https://developer.chrome.com/docs/extensions/reference/api/alarms)

---

### Pitfall 4: Telegram Bot Accepts Messages from Anyone (Security Hole)

**What goes wrong:** Bot currently accepts messages from any Telegram user (`/bot/main.py` lines 83-122). Attacker can spam your API with malicious URLs, exhaust LLM credits, or fill database with garbage.

**Why it happens:** MVP focused on functionality, deferred security. `message.from_user.id` is ignored, no whitelist check.

**Consequences:**
- Unauthorized users can capture articles to your database
- LLM API costs balloon from abuse
- Database filled with attacker's content
- Potential XSS if attacker saves malicious content
- Single-user system becomes multi-user by accident

**Prevention:**
1. **Lock bot to owner's Telegram user ID (environment variable):**
   ```python
   ALLOWED_USER_ID = int(os.getenv('TELEGRAM_USER_ID'))

   async def handle_message(update: Update, context):
       if update.message.from_user.id != ALLOWED_USER_ID:
           await update.message.reply_text("Unauthorized. This bot is private.")
           return
       # ... rest of handler
   ```

2. **Alternative: User whitelist in chrome.storage:**
   - For multi-user self-hosted instances
   - Admin command to add/remove users
   - Check whitelist before processing

3. **Add rate limiting per user:**
   - Even with whitelist, prevent accidental abuse
   - 10 captures per minute, 100 per hour

**Detection:**
- Monitor unique user IDs in logs
- Alert on captures from unexpected users
- Warning sign: sudden spike in capture volume

**Phase mapping:** Phase 1 (Security hardening) - Fix immediately, before adding bot tests

**Sources:**
- [How to secure Telegram bot with authentication](https://silicon.blog/2023/05/16/how-to-secure-your-telegram-bot-app-with-a-simple-authentication-method/)
- [Python Telegram bot user authentication](https://community.latenode.com/t/python-telegram-bot-how-to-authenticate-users-with-their-id/7262)

---

### Pitfall 5: React Query Tests Timeout Because Retry Logic Not Disabled

**What goes wrong:** Tests fail with timeout errors when testing error scenarios. React Query retries failed queries 3 times with exponential backoff (default), making error tests take 30+ seconds before timing out.

**Why it happens:** React Query production defaults optimize UX (retry on transient failures), but break tests. Developer writes test for 404 error, test hangs because React Query retries 3 times before test assertion can check error state.

**Consequences:**
- Error path tests timeout instead of failing fast
- Test suite takes minutes instead of seconds
- Flaky tests (sometimes timeout, sometimes pass depending on timing)
- Developers disable tests with `.skip()` instead of fixing root cause

**Prevention:**
1. **Create test-specific QueryClient with retries disabled:**
   ```typescript
   // test-utils.tsx
   export function createTestQueryClient() {
     return new QueryClient({
       defaultOptions: {
         queries: {
           retry: false, // Disable retries in tests
           cacheTime: 0, // No caching between tests
         },
       },
     });
   }

   // In test
   const queryClient = createTestQueryClient();
   render(
     <QueryClientProvider client={queryClient}>
       <MyComponent />
     </QueryClientProvider>
   );
   ```

2. **Use fresh QueryClient per test (not shared):**
   ```typescript
   // BAD - shared client
   const queryClient = new QueryClient();
   beforeEach(() => queryClient.clear()); // Race conditions

   // GOOD - isolated client
   beforeEach(() => {
     queryClient = createTestQueryClient(); // Fresh per test
   });
   ```

3. **Always await async state with waitFor:**
   ```typescript
   // Wait for success state before assertions
   await waitFor(() => expect(result.current.isSuccess).toBe(true));
   expect(result.current.data).toEqual(expected);
   ```

**Detection:**
- Tests that take >5s to fail
- Timeout errors on error path tests
- Network tab shows 3 identical failed requests

**Phase mapping:** Phase 1 (Frontend tests) - Set up test utils correctly from start

**Sources:**
- [Testing React Query (TkDodo)](https://tkdodo.eu/blog/testing-react-query)
- [Common mistakes with React Query](https://nickb.dev/blog/pitfalls-of-react-query/)
- [TanStack Query testing documentation](https://tanstack.com/query/v4/docs/react/guides/testing)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or hard-to-debug issues.

---

### Pitfall 6: Using waitFor for Side Effects Instead of Assertions Only

**What goes wrong:** Test puts side effects inside `waitFor()` callback. React Testing Library calls the callback multiple times (polling), so side effects run unpredictably. Mock function called 5 times instead of 1, state updates race with assertions.

**Why it happens:** Developer misunderstands `waitFor` purpose. Treats it like "wait then do something" instead of "repeatedly check until assertion passes."

**Consequences:**
- Flaky tests (pass locally, fail in CI)
- Mock call counts wrong (`expect(mock).toHaveBeenCalledTimes(1)` fails)
- State mutations from side effects break subsequent assertions
- Hard to debug because timing-dependent

**Prevention:**
```typescript
// BAD - side effects in waitFor
await waitFor(() => {
  mockFunction(); // Called multiple times!
  expect(result).toBe(expected);
});

// GOOD - side effects outside, assertions inside
mockFunction(); // Called once
await waitFor(() => expect(result).toBe(expected));
```

**Phase mapping:** Phase 1 (Frontend tests) - Review pattern in all async tests

**Sources:**
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Library async waits](https://reflect.run/articles/async-waits-in-react-testing-library/)

---

### Pitfall 7: Using getBy Instead of findBy for Async Elements

**What goes wrong:** Test uses `getByRole` to find element that appears after async operation. Test fails with "element not found" even though element renders 100ms later.

**Why it happens:** `getBy*` queries throw immediately if element not found. `findBy*` queries retry with `waitFor` under the hood.

**Consequences:**
- Tests fail on fast machines, pass on slow ones (timing-dependent)
- Developers add arbitrary `await sleep(500)` instead of using proper queries
- CI failures hard to reproduce locally

**Prevention:**
```typescript
// BAD - synchronous query for async element
const button = screen.getByRole('button', { name: /submit/i }); // Throws!

// GOOD - async query with built-in waiting
const button = await screen.findByRole('button', { name: /submit/i });
```

**Rule:** If element appears after data fetch, state update, or animation, use `findBy*`.

**Phase mapping:** Phase 1 (Frontend tests) - Lint rule can catch this

**Sources:**
- [Testing Library async methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [ESLint rule: await-async-queries](https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/await-async-queries.md)

---

### Pitfall 8: Testing FastAPI Background Tasks Without Awaiting Completion

**What goes wrong:** Test calls endpoint that starts background task, test asserts database state immediately. Test fails because background task hasn't finished yet. Developer adds `time.sleep(1)` workaround.

**Why it happens:** FastAPI's `BackgroundTasks` executes after response is sent. Test receives 200 response but background work is still running.

**Consequences:**
- Flaky tests (timing-dependent)
- Tests take longer due to arbitrary sleeps
- Integration tests don't actually test background task logic

**Prevention:**
1. **Mock BackgroundTasks in tests, manually execute tasks:**
   ```python
   @pytest.fixture
   def mock_background_tasks(monkeypatch):
       tasks = []

       class MockBackgroundTasks:
           def add_task(self, func, *args, **kwargs):
               tasks.append((func, args, kwargs))

       monkeypatch.setattr("fastapi.BackgroundTasks", MockBackgroundTasks)
       return tasks

   async def test_article_capture(client, mock_background_tasks):
       response = await client.post("/api/articles", json=data)
       assert response.status_code == 200

       # Manually execute background task
       func, args, kwargs = mock_background_tasks[0]
       await func(*args, **kwargs)

       # Now assert database state
       article = await db.get(Article, article_id)
       assert article.processing_status == "completed"
   ```

2. **Alternative: Poll database with timeout:**
   ```python
   async def wait_for_processing(db, article_id, timeout=5):
       start = time.time()
       while time.time() - start < timeout:
           article = await db.get(Article, article_id)
           if article.processing_status == "completed":
               return article
           await asyncio.sleep(0.1)
       raise TimeoutError("Background task didn't complete")
   ```

**Phase mapping:** Phase 1 (Integration tests) - Set up pattern before writing tests

**Sources:**
- [How to test BackgroundTasks discussion](https://github.com/fastapi/fastapi/discussions/7703)
- [Testing FastAPI with async database session](https://dev.to/whchi/testing-fastapi-with-async-database-session-1b5d)

---

### Pitfall 9: SQLAlchemy AsyncSession Scope Mismatch in Tests

**What goes wrong:** Test fixture creates session with "session" scope, test functions have "function" scope. Event loop closed between tests, session operations fail with "Event loop is closed" error.

**Why it happens:** pytest-asyncio event loop handling is subtle. Session outlives event loop, or session tied to different event loop than test.

**Consequences:**
- Tests fail with cryptic event loop errors
- "RuntimeError: Event loop is closed"
- Works when running single test, fails when running suite
- Different behavior on different Python versions

**Prevention:**
```python
# GOOD - aligned scopes
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")  # Match test scope
async def db_session(test_engine):
    async_session = sessionmaker(test_engine, class_=AsyncSession)
    async with async_session() as session:
        yield session
    # Session closes at end of test

@pytest.mark.asyncio
async def test_something(db_session):  # function scope
    # db_session lifetime matches test lifetime
    ...
```

**Key rule:** Session fixture scope must be <= test function scope.

**Phase mapping:** Phase 1 (Backend tests) - Fix conftest.py before adding integration tests

**Sources:**
- [Transactional unit tests with Pytest and async SQLAlchemy](https://www.core27.co/post/transactional-unit-tests-with-pytest-and-async-sqlalchemy)
- [pytest-asyncio event loop scope issues](https://github.com/pytest-dev/pytest-asyncio/issues/624)
- [pytest-async-sqlalchemy plugin](https://pypi.org/project/pytest-async-sqlalchemy/)

---

### Pitfall 10: Missing User ID Verification in Telegram Bot Tests

**What goes wrong:** Tests mock bot messages but don't set `update.message.from_user.id`. Production code checks user ID against whitelist, test passes with empty/null user ID that would be rejected in production.

**Why it happens:** python-telegram-bot mocking requires explicit user object creation. Developers focus on message text, forget to mock full Update structure.

**Consequences:**
- Tests pass but production bot rejects all messages
- Security checks not actually tested
- False confidence in test coverage

**Prevention:**
```python
from telegram import Update, User, Message
from unittest.mock import MagicMock

@pytest.fixture
def mock_update():
    update = MagicMock(spec=Update)

    # Must set user ID explicitly
    update.message = MagicMock(spec=Message)
    update.message.from_user = MagicMock(spec=User)
    update.message.from_user.id = 12345  # Test user ID
    update.message.text = "https://example.com"

    return update

async def test_authorized_user(mock_update):
    # TELEGRAM_USER_ID env var must match mock user ID
    with patch.dict(os.environ, {'TELEGRAM_USER_ID': '12345'}):
        await handle_message(mock_update, context)
        # Assert message processed

async def test_unauthorized_user(mock_update):
    mock_update.message.from_user.id = 99999  # Different ID
    with patch.dict(os.environ, {'TELEGRAM_USER_ID': '12345'}):
        await handle_message(mock_update, context)
        # Assert message rejected
```

**Phase mapping:** Phase 1 (Bot tests) - Write authorization tests first

**Sources:**
- [python-telegram-bot testing wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests)
- [PTB testing in official docs](https://docs.python-telegram-bot.org/en/v21.5/testing.html)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

---

### Pitfall 11: Empty waitFor Callbacks

**What goes wrong:** Test has `await waitFor(() => {})` with empty callback. Works today because of coincidental timing, breaks when async operation changes slightly.

**Why it happens:** Developer wants "wait one tick" behavior, misuses `waitFor` as generic delay.

**Prevention:**
```typescript
// BAD - empty waitFor
await waitFor(() => {}); // What are we waiting for?

// GOOD - specific assertion
await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());

// If you truly need one tick (rare):
await act(async () => {
  await Promise.resolve();
});
```

**Phase mapping:** Phase 1 (Frontend tests) - ESLint rule can catch

**Sources:**
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

### Pitfall 12: Forgetting to Await findBy Queries

**What goes wrong:** Developer writes `const button = screen.findByRole(...)` without `await`. Test fails immediately instead of waiting, error message confusing.

**Why it happens:** Muscle memory from `getByRole` (synchronous) transfers to `findByRole` (async).

**Prevention:**
```typescript
// BAD - missing await
const button = screen.findByRole('button'); // Returns Promise!

// GOOD - awaited
const button = await screen.findByRole('button');
```

**Phase mapping:** Phase 1 (Frontend tests) - ESLint plugin enforces this

**Sources:**
- [ESLint rule: await-async-queries](https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/await-async-queries.md)

---

### Pitfall 13: Using fireEvent Instead of userEvent

**What goes wrong:** Test uses `fireEvent.click()` to simulate clicks. Behavior doesn't match real user interaction (no hover, focus, pointer events), causes false positives.

**Why it happens:** `fireEvent` is lower-level API, easier to find in docs. `userEvent` requires additional import.

**Prevention:**
```typescript
import userEvent from '@testing-library/user-event';

// BAD - low-level event
fireEvent.click(button);

// GOOD - simulates real user
const user = userEvent.setup();
await user.click(button);
```

**Phase mapping:** Phase 1 (Frontend tests) - Set up pattern in test-utils.tsx

**Sources:**
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Backend integration tests | Background task DB connection pooling (Pitfall 1) | Refactor `process_article_background` to use connection pool before writing integration tests |
| Phase 1: Bot security | Unauthorized users (Pitfall 4) | Add user ID whitelist before any other bot work |
| Phase 1: Frontend test setup | React Query retry timeouts (Pitfall 5) | Create test-utils.tsx with proper QueryClient config |
| Phase 2: Auto-capture implementation | Service worker suspension state loss (Pitfall 2) | Use chrome.storage.session + chrome.alarms from day 1 |
| Phase 2: Auto-capture reliability | Alarms not firing after update (Pitfall 3) | Implement alarm recreation on startup, test update scenario |
| Phase 2: Dwell time tracking | setTimeout doesn't survive suspension | Never use setTimeout, only chrome.alarms (30s minimum) |
| All phases: Async tests | waitFor side effects (Pitfall 6) | Code review checklist item |
| All phases: Integration tests | Background tasks not awaited (Pitfall 8) | Mock BackgroundTasks and manually execute in tests |

---

## Testing Strategy Recommendations

Based on pitfalls research, here's the recommended testing approach order:

### Phase 1: Foundation (Do First)
1. **Fix Pitfall 4** - Lock bot to owner user ID (security)
2. **Fix Pitfall 1** - Refactor background task DB connection (reliability)
3. **Set up frontend test utils** - Address Pitfall 5 (React Query config)
4. **Set up backend test patterns** - Address Pitfall 8 (background task mocking)
5. Write unit tests with proper patterns in place

### Phase 2: Integration Tests
1. Backend integration tests (end-to-end capture flow)
2. Bot integration tests with real Update objects (Pitfall 10)
3. Test background task database operations

### Phase 3: Auto-Capture Implementation
1. **Design with Pitfall 2 in mind** - State in chrome.storage, not globals
2. **Design with Pitfall 3 in mind** - Alarm recreation on startup
3. Implement with proper alarm handling from start
4. Test service worker suspension explicitly

### Phase 4: Reliability Testing
1. Load test background tasks (verify Pitfall 1 fix holds)
2. Test extension update scenario (verify Pitfall 3 fix works)
3. Test service worker suspension with chrome://serviceworker-internals

---

## Sources

**React Query Testing:**
- [Testing React Query (TkDodo)](https://tkdodo.eu/blog/testing-react-query)
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [React Query pitfalls](https://nickb.dev/blog/pitfalls-of-react-query/)
- [TanStack Query testing guide](https://tanstack.com/query/v4/docs/react/guides/testing)
- [Testing Library async methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [Async waits in React Testing Library](https://reflect.run/articles/async-waits-in-react-testing-library/)

**FastAPI Testing:**
- [FastAPI background tasks official docs](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Testing FastAPI with async database session](https://dev.to/whchi/testing-fastapi-with-async-database-session-1b5d)
- [Async APIs with FastAPI: Patterns & Pitfalls](https://shiladityamajumder.medium.com/async-apis-with-fastapi-patterns-pitfalls-best-practices-2d72b2b66f25)
- [FastAPI database connection pooling](https://github.com/fastapi/fastapi/discussions/9097)
- [How to test BackgroundTasks](https://github.com/fastapi/fastapi/discussions/7703)
- [Transactional unit tests with Pytest and async SQLAlchemy](https://www.core27.co/post/transactional-unit-tests-with-pytest-and-async-sqlalchemy)
- [pytest-async-sqlalchemy plugin](https://pypi.org/project/pytest-async-sqlalchemy/)

**Chrome MV3 Extensions:**
- [Chrome extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) (updated 2026-01-20)
- [Chrome alarms API documentation](https://developer.chrome.com/docs/extensions/reference/api/alarms) (updated 2026-01-07)
- [eyeo's journey to testing service worker suspension](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension)
- [MV3 service worker broken after auto-update](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/POU6sW-I39M/m/PljS3_zbAgAJ)
- [MV3, inactive service workers, and alarms](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE)
- [Confusion regarding alarms in MV3](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/hWEe4I93P_E)

**Telegram Bot Testing:**
- [python-telegram-bot testing wiki](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests)
- [PTB testing in official docs](https://docs.python-telegram-bot.org/en/v21.5/testing.html)
- [How to write integration tests for Telegram bots](https://dev.to/blueset/how-to-write-integration-tests-for-a-telegram-bot-4c0e)
- [Telegram bot security and user authentication](https://silicon.blog/2023/05/16/how-to-secure-your-telegram-bot-app-with-a-simple-authentication-method/)

**Confidence Assessment:**
- React Query testing: HIGH (official docs, authoritative blog posts from maintainer)
- FastAPI background tasks: HIGH (official docs, verified community patterns)
- Chrome MV3 service workers: HIGH (official Chrome docs updated Jan 2026, developer community discussions)
- Telegram bot testing: MEDIUM (official wiki, community blog posts)
