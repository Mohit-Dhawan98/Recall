---
phase: 01-critical-fixes-test-infrastructure
plan: 02
subsystem: backend
tags: [url-normalization, deduplication, urllib, testing, tdd]

# Dependency graph
requires:
  - phase: 00-initial
    provides: Existing extractor.py with basic URL normalization
provides:
  - URL normalization with sorted query parameters for consistent hashing
  - Comprehensive test coverage for URL edge cases
  - TRACKING_PARAMS module-level constant for reusability
affects: [article-capture, duplicate-detection, data-integrity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD cycle (RED-GREEN-REFACTOR) for fixing existing functionality
    - Module-level constants for shared configuration

key-files:
  created: []
  modified:
    - backend/app/services/extractor.py
    - backend/tests/test_extractor.py

key-decisions:
  - "Use parse_qsl instead of manual string splitting for proper query parameter parsing"
  - "Use urlencode with quote_via=quote to preserve %20 encoding instead of +"
  - "Extract TRACKING_PARAMS to module level for maintainability"

patterns-established:
  - "TDD pattern: Write failing tests first, implement fix, refactor for clarity"
  - "URL normalization: Sort parameters alphabetically for consistent deduplication"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 1 Plan 2: URL Normalization Fix Summary

**URL normalization now sorts query parameters alphabetically, fixing duplicate article detection when same URL has different parameter ordering**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T11:17:24Z
- **Completed:** 2026-01-29T11:20:52Z
- **Tasks:** 3 (TDD cycle)
- **Files modified:** 2

## Accomplishments
- Fixed URL normalization bug causing duplicate articles with different query parameter ordering
- Added 10 comprehensive test cases for URL normalization edge cases
- Hash consistency verified: URLs differing only in param order now produce identical hashes
- All 56 backend tests pass with no regressions

## Task Commits

Each task was committed atomically following TDD cycle:

1. **Task 1: RED - Write failing tests for URL normalization** - `7760252` (test)
   - Added tests for param sorting, hash consistency, duplicates, complex URLs
   - 6 tests failed as expected (RED phase confirmed)

2. **Task 2: GREEN - Fix normalize_url to sort query parameters** - `ae7452c` (feat)
   - Replaced manual string splitting with parse_qsl for proper parsing
   - Added sorted() to sort query parameters alphabetically
   - Used urlencode with quote_via=quote for proper encoding
   - All 42 tests pass (GREEN phase confirmed)

3. **Task 3: REFACTOR - Clean up and verify no regressions** - `4acfacf` (refactor)
   - Moved TRACKING_PARAMS to module level for reusability
   - Consolidated imports on single line
   - All 56 backend tests pass with no regressions

_Note: TDD cycle produced 3 commits (test → feat → refactor) as designed_

## Files Created/Modified

- `backend/app/services/extractor.py` - Fixed normalize_url to use parse_qsl, sort params, and properly rebuild URL
- `backend/tests/test_extractor.py` - Added 10 comprehensive tests for URL normalization edge cases

## Decisions Made

**1. Use parse_qsl instead of manual string splitting**
- Rationale: Handles edge cases like encoded characters, special chars, duplicate keys
- Implementation: `params = parse_qsl(parsed.query)` instead of `params.split('&')`

**2. Use urlencode with quote_via=quote**
- Rationale: Preserves %20 encoding for spaces instead of converting to +
- Implementation: `urlencode(sorted_params, quote_via=quote)`
- Ensures consistent encoding across all URLs

**3. Extract TRACKING_PARAMS to module level**
- Rationale: Makes it easier to maintain and potentially reuse
- Implementation: Module-level constant instead of function-local variable
- Improves code organization and maintainability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD cycle executed smoothly. All tests passed in GREEN phase on first implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for deployment:**
- URL normalization fix is backward compatible
- Existing articles will continue to work
- New captures will benefit from improved deduplication

**No blockers:**
- All tests pass
- No database migrations needed
- No API changes

**Data integrity improvement:**
- URLs like `?a=1&b=2` and `?b=2&a=1` now produce same hash
- Prevents duplicate articles in database
- Existing duplicates (if any) can be cleaned up in Phase 2

---
*Phase: 01-critical-fixes-test-infrastructure*
*Completed: 2026-01-29*
