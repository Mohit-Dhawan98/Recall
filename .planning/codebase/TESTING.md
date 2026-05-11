# Testing Patterns

**Analysis Date:** 2026-01-28

## Test Framework

**Runner:**
- Backend: `pytest` v8.0.0+ with `pytest-asyncio` for async support
  - Config: `backend/pytest.ini` and `backend/pyproject.toml`
  - Async mode: `asyncio_mode = auto`
- Extension: Node.js custom test runner (`extension/tests/run-all.js`)
  - Individual test files run with `node test.js`
  - Custom assertion helpers (no external framework)
- Frontend: `vitest` v1.2.2+ (Vite test runner)
  - Config: `frontend/vitest.config.ts`
  - Environment: jsdom for DOM testing

**Assertion Library:**
- Backend: pytest built-in assertions (`assert` statements)
- Frontend: `@testing-library/react` + `@testing-library/jest-dom`
- Extension: Custom assertion function (`assert(condition, message)`)

**Run Commands:**
```bash
# Backend - all tests
cd backend && pytest tests/ -v

# Backend - with coverage
cd backend && pytest tests/ --cov=app

# Frontend - watch mode
cd frontend && npm run test

# Frontend - single run
cd frontend && npm run test:run

# Frontend - coverage
cd frontend && npm run test:coverage

# Extension - all tests
node extension/tests/run-all.js

# Extension - individual test
node extension/tests/manifest.test.js
```

## Test File Organization

**Location:**
- Backend: `backend/tests/` (co-located with source, separate directory)
- Frontend: `frontend/src/` (co-located with source)
- Extension: `extension/tests/` (separate tests directory)

**Naming:**
- Backend: `test_*.py` pattern (`test_api_unit.py`, `test_extractor.py`)
- Frontend: `*.test.ts` or `*.spec.ts` pattern (configured in vitest)
- Extension: `*.test.js` pattern (`manifest.test.js`, `links.test.js`)

**Structure:**
```
backend/tests/
├── __init__.py
├── conftest.py          (pytest fixtures)
├── test_api_unit.py     (API validation tests)
├── test_extractor.py    (service tests)
└── [other test files]

frontend/src/
├── App.tsx
├── [components/]
└── [pages/]
[No test files yet - setup in place]

extension/tests/
├── manifest.test.js     (Chrome manifest validation)
├── links.test.js        (Documentation link validation)
└── run-all.js          (test runner)
```

## Test Structure

**Suite Organization:**
- Backend uses class-based organization with pytest
- Frontend will use describe blocks (standard Vitest)
- Extension uses functional test approach

**Backend Pattern:**
```python
class TestArticlesValidation:
    """Tests for articles API input validation."""

    @pytest.mark.asyncio
    async def test_create_article_missing_url(self, client_unit: AsyncClient):
        """[EDGE] Create article without URL returns validation error."""
        response = await client_unit.post("/api/articles", json={})
        assert response.status_code == 422
```

**Extension Pattern:**
```javascript
function test(name, fn) {
  try {
    fn()
    results.passed++
    console.log(`✓ ${name}`)
  } catch (error) {
    results.failed++
    console.log(`✗ ${name}`)
  }
}

test('[BASE] manifest.json is valid JSON', () => {
  assert(typeof manifest === 'object', 'Manifest should be object')
})
```

**Test Categories:**
All tests are organized into three categories marked in docstrings:
- `[BASE]` - Fundamental validity, required fields, basic functionality
- `[NORMAL]` - Standard use cases, typical workflows
- `[EDGE]` - Error cases, boundary conditions, special scenarios

## Mocking

**Framework:**
- Backend: `unittest.mock` (MagicMock, AsyncMock)
- Frontend: `msw` (Mock Service Worker) for API mocking, `vitest` mocks for modules
- Extension: No external mocking framework (validates actual files)

**Patterns:**

Backend API mocking (for unit tests without database):
```python
@pytest.fixture
async def client_unit() -> AsyncGenerator[AsyncClient, None]:
    """Create test client with mocked dependencies."""
    from app.main import app
    from app.database import get_db

    async def override_get_db():
        session = AsyncMock()
        yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
```

Frontend API mocking:
```typescript
// In test setup
export const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
```

**What to Mock:**
- External services (LLM APIs, databases in unit tests)
- HTTP requests in frontend component tests
- localStorage in frontend tests

**What NOT to Mock:**
- Core business logic functions
- Data transformations
- URL normalization/hashing (test with real implementation)
- Internal state machines

## Fixtures and Factories

**Test Data:**

Backend fixtures (in `backend/tests/conftest.py`):
```python
@pytest.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        id=uuid4(),
        email="test@example.com",
        api_key="test-api-key-12345",
        settings={}
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
def sample_article_data():
    """Sample article capture data."""
    return {
        "url": "https://example.com/new-article",
        "title": "New Test Article",
        "capture_source": "extension"
    }
```

Frontend fixture location (to be created):
- `frontend/src/test/fixtures.ts` - test data factories
- Mock handlers in `frontend/src/test/setup.ts`

**Location:**
- Backend: `backend/tests/conftest.py` (pytest convention)
- Frontend: `frontend/src/test/` (setup.ts and future fixtures)

## Coverage

**Requirements:**
- No coverage threshold enforced
- Coverage tools available but not required

**View Coverage:**

Backend:
```bash
cd backend && pytest tests/ --cov=app --cov-report=html
```

Frontend:
```bash
cd frontend && npm run test:coverage
```

## Test Types

**Unit Tests:**
- Scope: Single function or component in isolation
- Approach: Mock dependencies, test one behavior per test
- Backend example: `test_normalize_url_basic()` - tests URL normalization function
- Frontend example: Testing a single component with mocked props

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Real database (testcontainers for PostgreSQL), real HTTP client
- Backend example: `test_create_article_with_valid_url()` - creates article in real DB
- Not yet implemented for frontend

**E2E Tests:**
- Scope: Complete user workflows
- Approach: Not yet implemented
- Planned: Extension → API → DB flows

## Common Patterns

**Async Testing (Backend):**
```python
@pytest.mark.asyncio
async def test_create_article(self, client: AsyncClient):
    """Test creating article with real database."""
    response = await client.post("/api/articles", json={
        "url": "https://example.com/article",
        "capture_source": "extension"
    })
    assert response.status_code == 201
```

**Error Testing:**
```python
@pytest.mark.asyncio
async def test_create_article_missing_url(self, client_unit: AsyncClient):
    """[EDGE] Missing URL returns validation error."""
    response = await client_unit.post("/api/articles", json={})
    assert response.status_code == 422  # Pydantic validation error
    data = response.json()
    assert "detail" in data
```

**Database Fixtures:**
```python
@pytest.fixture(scope="function")
async def test_engine(database_url):
    """Create test database engine and tables."""
    from app.database import Base

    engine = create_async_engine(database_url, echo=False)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

**Docker-based Database Testing:**
- Uses `testcontainers-postgres` for PostgreSQL
- Skips tests gracefully if Docker unavailable
- Enables accurate integration testing with real pgvector

## Test Status by Service

**Backend API Tests:**
- Status: **46 tests passing**
- Test types: Unit tests (validation), integration tests (real database)
- Coverage areas:
  - Health endpoints
  - Articles API (CRUD, validation)
  - Search API (validation)
  - Tags API (validation)
  - Graph API (validation)
  - Read Later API (validation)
  - Auth API (basic)
  - Extractor service (URL operations)

**Extension Tests:**
- Status: **51 tests passing**
- Test types: Manifest validation, documentation link validation
- Coverage areas:
  - manifest.json validity (29 tests)
  - Documentation links (22 tests)
  - File existence, required fields, semantic versioning

**Frontend Tests:**
- Status: **Setup complete, no test files yet**
- Framework: Vitest + React Testing Library + MSW
- Test infrastructure in place:
  - `frontend/vitest.config.ts` configured
  - `frontend/src/test/setup.ts` with mocks
  - MSW mock handlers ready
  - Path alias `@` configured
- To implement: Component tests, page tests, integration tests

**Bot Tests:**
- Status: **Not yet implemented**
- Framework: To be pytest (following backend pattern)
- Scope: Command handlers, message parsing, error handling

## Test Patterns to Follow

**Naming Convention:**
Use `[BASE]`, `[NORMAL]`, `[EDGE]` prefixes in test docstrings to categorize:
```python
def test_create_article_with_valid_url(self):
    """[BASE] Create article with valid URL."""
    # basic functionality

def test_create_with_all_metadata(self):
    """[NORMAL] Create with all metadata fields."""
    # complete workflow

def test_duplicate_url_handling(self):
    """[EDGE] Handle duplicate URL deduplication."""
    # boundary condition
```

**Assertion Pattern:**
Use descriptive assertions with clear messages:
```python
assert response.status_code == 201, f"Expected 201, got {response.status_code}"
assert "id" in data, "Response should contain article ID"
```

**Fixture Scope:**
- Session-scoped: PostgreSQL container (expensive setup)
- Function-scoped: Database tables, client instances (cleanup needed)
- Module-scoped: Event loop (if needed)

## Missing Test Coverage

**High Priority (Critical path):**
- Backend integration tests for all routers (articles, search, tags, graph, read-later)
- Backend service tests (LLM, graph building, content extraction)
- Telegram bot handlers

**Medium Priority (Features):**
- Frontend component tests (ArticleCard, Timeline, Search, Graph, ReadLater)
- Frontend page tests
- API client error handling tests

**Lower Priority (E2E):**
- Extension JavaScript functionality (background.js, popup.js, options.js)
- End-to-end flows (Extension → API → Database)
- Performance benchmarks

---

*Testing analysis: 2026-01-28*
