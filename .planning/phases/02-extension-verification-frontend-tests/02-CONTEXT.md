# Phase 2: Extension Verification & Frontend Tests - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify the Chrome extension works manually (all capture flows, options page, success/error states) and add comprehensive React component tests for core pages, shared components, and API hooks. Extension auto-capture is Phase 4-6 — this phase only verifies existing manual capture.

</domain>

<decisions>
## Implementation Decisions

### Extension verification scope
- Verify ALL capture flows: right-click context menu, keyboard shortcut (Cmd+Shift+S), popup save button
- Verify options page: API URL configuration works correctly
- Verify all states: success, error, duplicate, and offline/unreachable backend
- Create step-by-step checklist for verification
- Add extension setup steps to DEVELOPMENT.md for users
- Start with fresh database (empty) to verify article appears after capture

### Test coverage depth
- Test core pages: Timeline, Search, Graph, ArticleDetail
- Test shared components: ArticleCard, TagList, SearchBar
- Test API hooks: useArticles, useSearch, useTags custom hooks
- Comprehensive testing: happy path + error states + loading states + empty states + edge cases
- Accessibility checks at Claude's discretion

### Claude's Discretion
- Mocking strategy (MSW is in project deps — use whatever approach is cleanest)
- Shared fixtures vs inline test data
- Playwright vs Vitest-only for browser tests (decide based on what's practical for extension)
- Accessibility tooling (jest-axe or manual)
- Test file organization and naming conventions

### CI integration
- Add GitHub Actions workflow to run tests on push/PR
- Include both frontend and existing backend tests in CI

</decisions>

<specifics>
## Specific Ideas

- Extension verification checklist should be documented in DEVELOPMENT.md so future users/contributors can verify their setup
- User prefers comprehensive tests — don't cut corners on error states and edge cases

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-extension-verification-frontend-tests*
*Context gathered: 2026-01-29*
