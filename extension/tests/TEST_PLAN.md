# Extension Test Plan

## Test Categories

### 1. Manifest Validation Tests (Automated)

#### Base Cases
| Test | Description | Expected |
|------|-------------|----------|
| JSON validity | manifest.json parses without error | Valid JSON object |
| Required fields | name, version, manifest_version exist | All present |

#### Normal Cases
| Test | Description | Expected |
|------|-------------|----------|
| Manifest V3 | manifest_version equals 3 | `3` |
| Version format | Version matches semver (X.Y.Z) | Valid pattern |
| Permissions exist | permissions array defined | Non-empty array |
| Required permissions | storage, activeTab present | Both present |
| Icon files exist | All referenced files found | All exist |
| Service worker exists | background.js file found | Exists |
| Popup file exists | popup.html found | Exists |
| Options page exists | options.html found | Exists |

#### Edge Cases
| Test | Description | Expected |
|------|-------------|----------|
| No SVG in icons field | Chrome doesn't support SVG here | PNG only |
| Required icon sizes | 128px size required for store | Present |
| No duplicate permissions | Permissions array unique | No duplicates |
| Host permissions format | URLs use valid patterns | Valid patterns |
| Empty strings | No empty string values | None empty |
| File path traversal | No ../ in file paths | Safe paths |

### 2. Documentation Link Tests (Automated)

#### Base Cases
| Test | Description | Expected |
|------|-------------|----------|
| README exists | extension/README.md readable | Non-empty |
| SELF_HOSTING exists | docs/SELF_HOSTING.md readable | Non-empty |

#### Normal Cases
| Test | Description | Expected |
|------|-------------|----------|
| Relative links valid | All relative links resolve | Files exist |
| Required sections | Prerequisites, Installation, Troubleshooting | All present |
| Cross-links work | README ↔ SELF_HOSTING | Both valid |

#### Edge Cases
| Test | Description | Expected |
|------|-------------|----------|
| No broken anchors | Internal #links valid | All valid |
| External URLs format | http/https URLs well-formed | Valid format |
| No circular dependencies | Links don't create loops | DAG structure |

### 3. Extension Functionality Tests (Manual - Browser Required)

#### Base Cases
| Test | Description | How to Verify |
|------|-------------|---------------|
| Extension loads | No errors on load | chrome://extensions shows no errors |
| Icon displays | Icon visible in toolbar | Visual check |
| Popup opens | Clicking icon shows popup | Click icon |

#### Normal Cases
| Test | Description | How to Verify |
|------|-------------|---------------|
| Settings save | URL and key persist | Save, reload, verify |
| Connection test works | Valid server responds | Click "Test Connection" |
| Save article works | Article appears in Recall | Save, check library |
| Keyboard shortcut | Cmd+Shift+S triggers save | Press shortcut |
| Context menu | Right-click shows option | Right-click page |

#### Edge Cases
| Test | Description | How to Verify |
|------|-------------|---------------|
| Invalid URL handling | Shows error message | Enter "not-a-url" |
| Empty API key | Shows validation error | Clear key, test |
| Network error | Graceful failure message | Disconnect, save |
| Special characters | URL-encodes properly | Save page with unicode title |
| Very long URL | Handles without crash | Save page with long URL |
| Restricted pages | Shows appropriate message | Try on chrome:// page |

## Running Tests

### Automated Tests
```bash
node extension/tests/run-all.js
```

### Manual Tests Checklist
1. [ ] Load extension in Chrome developer mode
2. [ ] Verify icon appears in toolbar (not broken/default)
3. [ ] Click icon - popup should open
4. [ ] Go to Settings - configure server URL and API key
5. [ ] Click "Test Connection" - should succeed
6. [ ] Navigate to any article page
7. [ ] Click extension icon and save
8. [ ] Verify article appears in Recall library
9. [ ] Test keyboard shortcut (Cmd/Ctrl+Shift+S)
10. [ ] Test right-click context menu

## Test Results

Date: ___________

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Manifest Tests | | | |
| Link Tests | | | |
| Manual Tests | | | |
