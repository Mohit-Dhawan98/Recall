# Phase 02: Extension Verification & Frontend Tests — Research

**Researched:** 2026-01-30
**Status:** Complete

## Summary

Phase 2 has two distinct workstreams: (1) manual Chrome extension verification with documented checklist, and (2) comprehensive frontend component tests using the already-installed Vitest + React Testing Library + MSW stack.

The project's test infrastructure is partially set up. The `frontend/src/test/setup.ts` file already configures MSW's `setupServer()`, localStorage mocking, and `import.meta.env` mocking. However, there is no vitest configuration in `vite.config.ts` (no `test` property), no test files exist yet, and no GitHub Actions CI workflow exists. The key work is: (a) add vitest config to vite.config.ts, (b) create a test render utility wrapping QueryClientProvider + MemoryRouter, (c) write tests for all target components/pages, (d) mock canvas-dependent ForceGraph2D, and (e) create a CI workflow.

**Primary recommendation:** Add vitest `test` config to the existing `vite.config.ts`, create a shared `renderWithProviders` utility that wraps components in QueryClientProvider + MemoryRouter, use MSW `http` handlers (v2 API) for all API mocking, mock `react-force-graph-2d` with `vi.mock()` for Graph page tests, and add a GitHub Actions workflow with separate frontend/backend jobs.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^1.2.2 | Test runner | Vite-native, shares vite.config.ts, fast HMR |
| @testing-library/react | ^14.1.2 | Component rendering/queries | Standard for behavior-focused React testing |
| @testing-library/jest-dom | ^6.3.0 | DOM matchers (toBeInTheDocument, etc.) | Extends expect with DOM assertions |
| @testing-library/user-event | ^14.5.2 | User interaction simulation | Better than fireEvent for realistic interactions |
| msw | ^2.1.5 | Network-level API mocking | Intercepts fetch at network layer, reusable handlers |
| jsdom | ^24.0.0 | Browser DOM simulation | Vitest environment for component rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-canvas-mock | vi.mock('react-force-graph-2d') | Module mock is simpler; no extra dep needed. Use module mock. |
| MemoryRouter | createMemoryRouter | createMemoryRouter is for data routers (v6.4+). This project uses BrowserRouter, so MemoryRouter is the right fit. |
| Shared handler files | Inline MSW handlers per test | Shared handlers reduce duplication but inline gives per-test control. Use shared base + inline overrides. |

**No new packages needed. Everything is already installed.**

## Architecture Patterns

### Recommended Test File Structure
```
frontend/src/
├── test/
│   ├── setup.ts              # Already exists: MSW server, localStorage, env mocks
│   ├── test-utils.tsx         # NEW: renderWithProviders, createTestQueryClient
│   ├── handlers.ts            # NEW: Shared MSW handlers for common API responses
│   └── fixtures.ts            # NEW: Shared test data (articles, tags, graph data)
├── components/
│   ├── ArticleCard.tsx
│   └── ArticleCard.test.tsx   # Colocated test file
├── pages/
│   ├── Timeline.tsx
│   ├── Timeline.test.tsx      # Colocated test file
│   ├── Search.tsx
│   ├── Search.test.tsx
│   ├── Graph.tsx
│   ├── Graph.test.tsx
│   ├── ArticleDetail.tsx
│   └── ArticleDetail.test.tsx
└── api/
    └── client.ts              # Types exported from here are used in fixtures
```

### Pattern 1: Test Render Utility with Providers
A shared `renderWithProviders` function wrapping components in QueryClientProvider + MemoryRouter. Creates a new QueryClient per test (retry: false, gcTime: Infinity).

### Pattern 2: MSW Handlers with http Namespace (v2 API)
MSW v2 uses `http` and `HttpResponse` instead of `rest` and `res()`. The project has msw ^2.1.5, so use v2 API.

### Pattern 3: Per-Test Handler Overrides for Error States
Use `server.use()` to override handlers for specific test cases. setup.ts already calls `server.resetHandlers()` in afterEach.

### Pattern 4: Module Mock for Canvas-Based Components
Mock react-force-graph-2d entirely with `vi.mock()` since canvas is not available in jsdom. Test loading/error/empty states and data transformation, not canvas rendering.

### Anti-Patterns to Avoid
- Mocking React Query hooks directly (mock at network level with MSW instead)
- Sharing a single QueryClient across tests (create new per test)
- Using `waitForElementToBeRemoved` for loading states (use `findBy*` queries)
- Testing implementation details (assert on what user sees)
- Forgetting `retry: false` (causes test timeouts)

## Common Pitfalls

1. **Missing Vitest Configuration** - No `test` property in vite.config.ts yet
2. **MSW v2 vs v1 API Confusion** - Use `http`/`HttpResponse`, not `rest`/`res`/`ctx`
3. **React Query Retries Causing Test Timeouts** - Set `retry: false` in test QueryClient
4. **Stale Closures in Assertions** - Use `screen.findByText()` (async) not `screen.getByText()` (sync) for API data
5. **Missing Providers** - Always use `renderWithProviders` utility
6. **MSW Handler Leakage** - setup.ts already handles this with `server.resetHandlers()`
7. **Graph Page Canvas Errors** - Mock entire `react-force-graph-2d` module

## Open Questions

1. **ResizeObserver in jsdom** - Graph component uses clientWidth/clientHeight. If errors occur, add global mock in setup.ts.
2. **window.confirm in ArticleDetail** - Mock with `vi.spyOn(window, 'confirm').mockReturnValue(true)` for delete tests.
3. **date-fns formatDistanceToNow** - Use `vi.useFakeTimers()` or regex matchers like `/ago$/`.

## Extension Verification Approach

Manual process documented as a checklist in DEVELOPMENT.md.

### Capture Flows to Verify
1. Right-click context menu → background.js `saveArticle(url, tab)`
2. Keyboard shortcut (Cmd+Shift+S) → background.js commands handler
3. Popup save button → popup.js sendMessage → background.js

### States to Verify
- Success: Badge checkmark, article in API
- Duplicate: Badge checkmark with "Already Saved" message
- Error (no server URL): "Please configure Recall" notification
- Error (server unreachable): "Connection failed" error
- Error (API error): Error message in popup status

### Verification Checklist Structure
Start from fresh database (`docker compose down -v && docker compose up -d`), expand existing Chrome Extension section in DEVELOPMENT.md.

## CI Workflow Pattern

GitHub Actions with two parallel jobs:
- `frontend-tests`: Node 20, npm ci, npm run test:run
- `backend-tests`: Python 3.12, uv sync, uv run pytest tests/ -v

## Sources

- TanStack Query v5 Testing Docs (official wrapper pattern, retry config)
- Vitest Configuration Docs (test config options, globals, environment)
- MSW v2 Quick Start (http handler syntax)
- TkDodo's Testing React Query Blog (best practices from React Query maintainer)
- React Router Testing Library docs (MemoryRouter pattern)
- Direct codebase analysis of all component and extension source files

---
*Research date: 2026-01-30*
*Phase: 02-extension-verification-frontend-tests*
