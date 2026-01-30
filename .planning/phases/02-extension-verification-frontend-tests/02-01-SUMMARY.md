---
phase: 02-extension-verification-frontend-tests
plan: 01
title: Test Infrastructure Setup
subsystem: frontend-testing
tags: [vitest, msw, testing-library, react-query, test-utilities]
depends_on:
  requires: []
  provides: [vitest-config, render-with-providers, test-fixtures, msw-handlers]
  affects: [02-02, 02-03, 02-04]
tech-stack:
  added: []
  patterns: [test-query-client-factory, provider-wrapper-pattern, msw-v2-handlers]
key-files:
  created:
    - frontend/src/test/test-utils.tsx
    - frontend/src/test/fixtures.ts
    - frontend/src/test/handlers.ts
  modified:
    - frontend/vite.config.ts
    - frontend/src/test/setup.ts
decisions:
  - Use ReactNode for Wrapper children type (RTL render wrapper requires ReactNode, not ReactElement)
  - Default route path '*' in renderWithProviders for catch-all matching
  - gcTime: Infinity for test QueryClient to prevent garbage collection during assertions
metrics:
  duration: 2min
  completed: 2026-01-30
---

# Phase 2 Plan 1: Test Infrastructure Setup Summary

**One-liner:** Vitest configured with jsdom, shared renderWithProviders utility with QueryClient+MemoryRouter, typed fixtures for all API types, MSW v2 handlers for all endpoints.

## What Was Done

### Task 1: Vitest config and test utilities
- Added `/// <reference types="vitest" />` and `test` block to `vite.config.ts` (globals, jsdom, setup file, CSS)
- Created `test-utils.tsx` with `createTestQueryClient()` (retry: false, gcTime: Infinity) and `renderWithProviders()` wrapping UI in QueryClientProvider + MemoryRouter with Routes/Route
- Re-exports all of `@testing-library/react` and `userEvent`

### Task 2: Shared fixtures and MSW handlers
- Created `fixtures.ts` with 12 typed exports: mockArticle, mockArticleProcessing, mockArticles, mockArticleListResponse, mockEmptyArticleListResponse, mockTags, mockSearchResponse, mockEmptySearchResponse, mockGraphResponse, mockEmptyGraphResponse, mockArticleWithNotes, mockArticleWithQuotes
- Created `handlers.ts` with MSW v2 `http`/`HttpResponse` handlers covering all 11 API endpoints (articles CRUD, read-later, search, tags, graph, auth)
- Updated `setup.ts` to import and spread shared handlers into `setupServer()`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ReactNode for Wrapper children | RTL render wrapper type expects ReactNode, not ReactElement (TS strict mode) |
| Default path '*' in renderWithProviders | Catch-all route matching simplifies tests that don't need path params |
| gcTime: Infinity for test QueryClient | Prevents garbage collection of query data during async assertions |
| MSW v2 syntax (http/HttpResponse) | Project uses msw ^2.1.5, not v1 rest/res/ctx pattern |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Wrapper children type in test-utils.tsx**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Wrapper component typed children as `ReactElement` but RTL render wrapper requires `ReactNode` (which includes undefined, null, etc.)
- **Fix:** Changed children type from `ReactElement` to `ReactNode`, added `ReactNode` import
- **Files modified:** frontend/src/test/test-utils.tsx
- **Commit:** c3b2594

## Verification Results

- `vitest run --passWithNoTests`: exits 0
- `tsc --noEmit`: compiles clean, no errors
- All fixture exports verified present (12 exports)
- handlers.ts exports handlers array with MSW v2 http namespace
- setup.ts uses setupServer(...handlers)

## Commits

| Hash | Message |
|------|---------|
| 793efb5 | feat(02-01): add vitest config and test utilities |
| c3b2594 | feat(02-01): add shared test fixtures and MSW handlers |

## Next Phase Readiness

All downstream plans (02-02, 02-03, 02-04) can now:
- Import `renderWithProviders` and `createTestQueryClient` from `@/test/test-utils`
- Import typed fixtures from `@/test/fixtures`
- Use default MSW handlers (auto-loaded via setup.ts) or override per-test with `server.use()`
- Run tests with `npm test` or `npx vitest run`
