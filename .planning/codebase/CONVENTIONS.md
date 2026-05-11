# Coding Conventions

**Analysis Date:** 2026-01-28

## Naming Patterns

**Files:**
- Backend models: `snake_case` (`articles.py`, `models.py`, `extractor.py`)
- Backend routers: `snake_case` (`articles.py`, `auth.py`, `search.py`)
- Frontend components: `PascalCase` (`ArticleCard.tsx`, `Timeline.tsx`, `Layout.tsx`)
- Frontend pages: `PascalCase` (`Settings.tsx`, `ReadLater.tsx`, `ArticleDetail.tsx`)
- Frontend utilities: `camelCase` (`client.ts`)
- Extension scripts: `camelCase` (`popup.js`, `background.js`, `options.js`)
- Tests: `snake_case.py` for pytest (`test_extractor.py`, `test_api_unit.py`)
- Tests: `.test.js` for Node tests (`manifest.test.js`, `links.test.js`)

**Functions:**
- Python: `snake_case` (e.g., `normalize_url()`, `hash_url()`, `analyze_content()`)
- TypeScript/JavaScript: `camelCase` (e.g., `captureArticle()`, `getArticles()`, `toggleReadLater()`)
- React components: PascalCase function names (`export default function ArticleCard()`)

**Variables:**
- Python: `snake_case` (e.g., `api_key`, `article_id`, `processing_status`)
- TypeScript/JavaScript: `camelCase` (e.g., `apiKey`, `articleId`, `processingStatus`)
- React: PascalCase for components passed as props, camelCase for other variables

**Types:**
- Python: PascalCase for model classes (`Article`, `User`, `Tag`, `Entity`)
- Python: PascalCase for Pydantic schemas (`ArticleResponse`, `ArticleCaptureRequest`)
- TypeScript: PascalCase interfaces (`ArticleCardProps`, `Article`, `Tag`, `Entity`)
- TypeScript: Readonly/Optional properties marked explicitly (`article?: Article`, `readonly id: string`)

**Constants:**
- Python: `UPPER_SNAKE_CASE` (limited use - mostly in config)
- TypeScript: `camelCase` (standard for const declarations, e.g., `tagColors`, `localStorageMock`)

## Code Style

**Formatting:**
- **Python:** 100-character line limit (ruff config `line-length = 100`)
- **TypeScript/JavaScript:** No strict line limit (prettier not enforced in config, but follows standard patterns)
- **Indentation:**
  - Python: 4 spaces
  - TypeScript/JavaScript: 2 spaces (standard for React)

**Linting:**
- **Backend:**
  - Tool: `ruff` (Python linter)
  - Config: `.pyproject.toml` with `line-length = 100`, selects E/F/I/N/W rules, ignores E501
  - Rules active: E (pycodestyle), F (pyflakes), I (isort), N (pep8-naming), W (pycodestyle warnings)
- **Frontend:**
  - Tool: `eslint` (ESLint)
  - Config: `--ext ts,tsx --report-unused-disable-directives --max-warnings 0`
  - Enforces zero warnings policy
- **Type Checking:**
  - Backend: `mypy` configured for Python 3.11+ with `warn_return_any = true`, `warn_unused_ignores = true`
  - Frontend: TypeScript `strict` mode (tsc enforced in build)

## Import Organization

**Order:**
1. Standard library imports (Python) / Built-in modules (JS/TS)
2. Third-party imports
3. Local imports (relative paths or aliases)

**Python Example:**
```python
import os
import asyncio
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Article
from app.schemas import ArticleResponse
```

**TypeScript Example:**
```typescript
import React from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Trash2 } from 'lucide-react'

import type { Article } from '../api/client'
import { api } from '../api/client'
```

**Path Aliases:**
- Frontend: `@` → `src/` (configured in `vitest.config.ts`)
- No path aliases in backend

## Error Handling

**Patterns:**
- **Backend (FastAPI):**
  - Raise `HTTPException` for API errors with appropriate status codes
  - Use async context managers for resource cleanup
  - Document error scenarios in docstrings
  - Example: `raise HTTPException(status_code=404, detail="Article not found")`

- **Frontend (React):**
  - Catch errors from `api.request()` calls
  - Display error messages via error state or toast notifications
  - Example: `throw new Error(error.detail || 'Request failed')`

- **Services (Python):**
  - Return meaningful error responses or raise exceptions
  - Fallback chains: e.g., DeepSeek API → Ollama → rule-based extraction
  - No silent failures; log or bubble up errors

- **Extension (JavaScript):**
  - Handle API communication errors with user feedback
  - Test cases explicitly validate error states
  - Console logging for debugging

## Logging

**Framework:**
- Python backend: `print()` statements or standard Python `logging` module
- TypeScript/JavaScript: `console.log()` / `console.error()` for development

**Patterns:**
- Log before background task execution (if used)
- Log errors with context
- No sensitive data in logs (API keys, passwords)
- Test setup includes cleanup logging

## Comments

**When to Comment:**
- Complex business logic (e.g., graph relation calculations)
- Non-obvious algorithm choices
- Workarounds or edge cases
- API contract documentation (docstrings)

**JSDoc/TSDoc:**
- Backend: Module-level docstrings on services and routers
- Frontend: Minimal use; types provide documentation
- Extension: File-level comments explaining test categories ([BASE], [NORMAL], [EDGE])

**Example from codebase:**
```python
"""
Unit tests for API endpoints.

These tests use mocked database dependencies and don't require PostgreSQL.
They test the API contract, validation, and error handling.
"""
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Python routers: typically 20-50 lines (async handlers)
- Backend services: utility functions 10-30 lines
- React components: 30-100 lines for most components

**Parameters:**
- Python: Use typed parameters with type hints
- TypeScript: Use interfaces for complex parameter objects
- Example: `async def process_article(article_id: UUID, content: str)`

**Return Values:**
- Python: Explicitly typed return values with `->` notation
- Return domain models or Pydantic schemas from API endpoints
- React components: Always return JSX or null
- Frontend utils: Return typed data structures

**Docstrings:**
- Backend routers: Include docstring describing endpoint
- Backend services: Include docstring for complex functions
- Example format: `"""[BASE/NORMAL/EDGE] Description of what test does."""`

## Module Design

**Exports:**
- **Backend:**
  - Routers: Include in `app.include_router()` pattern
  - Services: Import functions directly
  - Models: Use `from app.models import Article`

- **Frontend:**
  - Components: Export as default (`export default function ArticleCard()`)
  - API client: Named exports (`export const api = { ... }`)
  - Types: Export interfaces (`export interface Article { ... }`)

**Barrel Files:**
- Backend: `__init__.py` files exist but minimal (often empty)
- Frontend: No explicit barrel file pattern observed
- Extension: No module structure (flat file pattern)

## Database/ORM Patterns

**SQLAlchemy (Backend):**
- Models inherit from `Base`
- Use relationships with `back_populates` for bidirectional relationships
- Define constraints in `__table_args__`
- Primary keys: UUIDs with `default=uuid.uuid4`
- Timestamps: Use `server_default=func.now()` for created_at

**Example:**
```python
class Article(Base):
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    url = Column(Text, nullable=False)

    user = relationship("User", back_populates="articles")

    __table_args__ = (
        UniqueConstraint("user_id", "url_hash"),
    )
```

## Async/Await Patterns

**Backend:**
- FastAPI endpoints use `async def`
- Database sessions: `async with AsyncSession`
- Use `await` for all async operations
- Background tasks: Use FastAPI's `BackgroundTasks` dependency

**Frontend:**
- API calls wrap in async `request<T>()` function
- React Query handles async state management
- Use `await fetch()` directly in utilities

## Schema Validation

**Backend (Pydantic):**
- Request bodies: Define as Pydantic models (e.g., `ArticleCaptureRequest`)
- Responses: Separate response schema classes (e.g., `ArticleResponse`)
- Config: Use `from_attributes = True` for ORM models
- Optional fields: Use `Optional[str] = None` pattern

**Frontend (TypeScript):**
- API response types: Define as interfaces matching backend responses
- No runtime validation (trust backend API contracts)
- Use type guards for optional fields

---

*Convention analysis: 2026-01-28*
