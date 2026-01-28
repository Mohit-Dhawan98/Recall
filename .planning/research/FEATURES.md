# Feature Landscape: Chrome Extension Auto-Capture

**Domain:** Browser Extension Auto-Capture Features
**Researched:** 2026-01-29
**Confidence:** MEDIUM (verified with official Chrome APIs and ecosystem patterns)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Domain whitelist management | Core requirement for selective auto-capture; users need control over which sites trigger captures | Medium | Requires chrome.storage.local, UI for add/remove, pattern matching for subdomains |
| Configurable dwell time threshold | Users have different reading speeds and content types; fixed threshold would be too rigid | Low | Default 60s is standard in reading trackers; store in chrome.storage.local |
| Visual feedback on auto-capture | Auto-save UX requires immediate feedback that action occurred; users need confidence system is working | Low | In-page toast (via content script DOM injection) avoids permission overhead vs chrome.notifications |
| Enable/disable toggle per domain | Users may want to temporarily pause auto-capture on known domain without removing from whitelist | Low | Boolean flag in storage per domain entry |
| Manual override always available | Auto-capture supplements, doesn't replace, existing manual capture; users expect control | Low | Keep existing right-click/keyboard/popup methods |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smart article detection | Captures articles but not homepages/listings; reduces noise significantly | Medium-High | Use Mozilla Readability's isProbablyReaderable() - proven, open-source algorithm (min 140 chars, scoring threshold) |
| First-visit domain prompt | "Add example.com to auto-capture?" reduces friction; discovered during natural browsing | Medium | Requires tracking visited domains, comparing to whitelist, showing prompt once per domain |
| Subdomain vs root domain options | Let users choose "*.example.com" vs "blog.example.com" granularity | Medium | Enterprise URL pattern format: "[*.]" prefix for subdomain wildcards |
| Activity-aware pausing | Pause auto-capture when user is idle (chrome.idle API); resume on return | Medium | Prevents captures during "left tab open" scenarios; requires "idle" permission |
| Capture preview before save | Show extracted content preview with option to accept/reject/edit before committing | High | Requires running Readability parse, displaying modal UI, handling user decision |
| Bulk whitelist import/export | Import list of domains from CSV/JSON; export for backup/sync | Low-Medium | Addresses common user request for whitelist extensions; JSON via chrome.storage API |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-capture on every page visit | Creates noise; captures homepages, search results, listings | Use dwell time threshold + article detection |
| System notifications for every capture | Notification fatigue; users find intrusive per research | Use subtle in-page toast; optionally batch daily summary |
| Auto-capture enabled by default globally | Privacy concern; feels like surveillance without explicit opt-in | Start disabled; prompt on first visit to each domain or require manual whitelist add |
| Syncing whitelist across devices automatically | Data privacy regulations (GDPR 2026) require explicit consent for passive data collection | Offer sync as opt-in feature with clear consent |
| Collecting/syncing actual captured content | Major privacy violation; extension could be perceived as spyware | Only sync whitelist settings, never content |
| Pre-checked opt-in boxes | Dark pattern violation per GDPR 2026 enforcement; manipulative UX | All consent checkboxes must default to unchecked |
| Making "reject auto-capture" harder than "accept" | Dark pattern; reduces user trust and violates GDPR | Equal prominence for enable/disable actions |

## Feature Dependencies

```
Foundation Layer:
- chrome.storage.local (domain whitelist persistence)
- tabs.onUpdated (page navigation detection)

Dwell Time Detection:
- tabs.onUpdated → Track page load time
- Timer logic → Compare elapsed time to threshold
- chrome.idle (optional) → Pause during inactivity

Article Detection:
- Content script injection → Access page DOM
- Mozilla Readability library → isProbablyReaderable() + parse()
- Metadata extraction → Check for article schema/Open Graph tags

Auto-Capture Flow:
Domain whitelist → Dwell time check → Article detection → Capture → Toast feedback

Feature Dependencies:
- First-visit prompt → Requires dwell time tracking (need to track time to trigger prompt)
- Subdomain options → Requires domain whitelist (extension of whitelist storage model)
- Activity-aware pausing → Requires dwell time detection (modifies timer behavior)
- Capture preview → Requires article detection (parse before commit)
```

## MVP Recommendation

For MVP auto-capture milestone, prioritize:

1. **Domain whitelist management** (Table stakes)
   - Add/remove domains via popup UI
   - Store in chrome.storage.local
   - Simple exact-match initially (no wildcards)

2. **Configurable dwell time** (Table stakes)
   - Global setting (default 60s)
   - Timer starts on tabs.onUpdated (status: "complete")
   - Reset timer on navigation

3. **In-page toast notification** (Table stakes)
   - Content script injects styled div
   - "Captured [page title]" message
   - Auto-dismiss after 3 seconds
   - No chrome.notifications permission needed

4. **Smart article detection** (Differentiator - killer feature)
   - Integrate @mozilla/readability library
   - Use isProbablyReaderable() before capture
   - Only proceed if likely article (filters out homepages/listings)

5. **Enable/disable per domain** (Table stakes)
   - Toggle in popup when viewing whitelisted domain
   - Pause temporarily without removing from list

Defer to post-MVP:

- **First-visit prompt**: Adds UX polish but increases complexity (need domain visit tracking, prompt UI, timing logic). Start with manual whitelist addition.

- **Subdomain wildcards**: Nice-to-have for power users; exact domain matching sufficient for MVP. Add when user feedback indicates need.

- **Activity-aware pausing**: Useful but requires additional permission ("idle"). Defer until core flow validated; risk of permission fatigue on install.

- **Capture preview**: High complexity; requires modal UI, edit interface, decision handling. Contradicts "passive capture" philosophy - better as manual feature than auto-capture blocker.

- **Bulk import/export**: Power user feature; not critical for initial rollout. Add when whitelist size becomes pain point (10+ domains).

## Implementation Notes

### Domain Whitelist Storage Model

```json
{
  "autoCapture": {
    "enabled": true,
    "dwellTimeSeconds": 60,
    "domains": {
      "example.com": {
        "enabled": true,
        "addedAt": 1738195200000,
        "captureCount": 42
      },
      "blog.another.com": {
        "enabled": false,
        "addedAt": 1738281600000,
        "captureCount": 7
      }
    }
  }
}
```

### Dwell Time Detection Pattern

```javascript
// Background service worker (Manifest V3)
let pageTimers = new Map(); // tabId -> {url, startTime}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const domain = new URL(tab.url).hostname;

    // Check if domain is whitelisted
    chrome.storage.local.get(['autoCapture'], (result) => {
      if (result.autoCapture?.domains?.[domain]?.enabled) {
        pageTimers.set(tabId, {
          url: tab.url,
          startTime: Date.now(),
          domain: domain
        });

        // Start dwell timer
        const threshold = result.autoCapture.dwellTimeSeconds * 1000;
        setTimeout(() => checkAndCapture(tabId), threshold);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pageTimers.delete(tabId);
});

chrome.tabs.onActivated.addListener(({tabId}) => {
  // Optional: track active tab for more accurate dwell time
});
```

### Article Detection Pattern

```javascript
// Content script
import Readability from '@mozilla/readability';

function isArticlePage() {
  // Quick check before full parse
  const isProbablyArticle = new Readability(document.cloneNode(true))
    .isProbablyReaderable();

  if (!isProbablyArticle) {
    return false;
  }

  // Additional heuristics
  const hasArticleSchema = document.querySelector(
    'script[type="application/ld+json"]'
  )?.textContent.includes('"@type":"Article"');

  const hasOpenGraph = document.querySelector(
    'meta[property="og:type"][content="article"]'
  );

  return isProbablyArticle || hasArticleSchema || hasOpenGraph;
}
```

### Toast Notification Pattern (No Permissions)

```javascript
// Content script - DOM-based toast
function showCaptureToast(pageTitle) {
  const toast = document.createElement('div');
  toast.id = 'recall-capture-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    ">
      ✓ Captured: ${pageTitle}
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

## Complexity Assessment

| Phase | Feature Set | Estimated Effort |
|-------|-------------|------------------|
| **Phase 1: Foundation** | Domain whitelist (no wildcards) + storage | 2-3 days |
| **Phase 2: Dwell Time** | Timer logic + tabs.onUpdated integration | 2-3 days |
| **Phase 3: Article Detection** | Readability integration + heuristics | 3-4 days |
| **Phase 4: Auto-Capture** | Combine all + toast notification | 2-3 days |
| **Phase 5: Polish** | Settings UI + per-domain toggle | 2-3 days |

**Total MVP Estimate:** 11-16 days

Post-MVP features (deferred):
- First-visit prompt: +3-4 days
- Subdomain wildcards: +2-3 days
- Activity-aware pausing: +2-3 days (+ "idle" permission UX cost)
- Capture preview: +5-7 days
- Bulk import/export: +2-3 days

## User Experience Flow

### Initial Setup
1. User installs extension (already has manual capture working)
2. New "Auto-Capture" section appears in popup
3. Initially empty; "Add current site" button prominent
4. User manually adds first domain to whitelist

### Ongoing Use
1. User visits whitelisted domain (e.g., blog.example.com)
2. Reads article for 60+ seconds (configurable)
3. Article detection confirms page is article (not homepage)
4. Extension captures article automatically
5. Subtle toast appears: "✓ Captured: Article Title"
6. Toast auto-dismisses after 3 seconds

### Domain Management
1. Click extension icon on any page
2. If current domain whitelisted: show "✓ Auto-capture enabled" with toggle
3. If not whitelisted: show "Add to auto-capture" button
4. Settings page lists all whitelisted domains with remove buttons
5. Global dwell time setting (default 60s, range 15-300s)

## Privacy & Consent Considerations

Per GDPR 2026 enforcement patterns researched:

1. **Opt-In, Not Opt-Out**: Auto-capture must be disabled by default; users explicitly add domains
2. **No Dark Patterns**: Equal prominence for enable/disable; no pre-checked boxes
3. **Transparent Storage**: Clear explanation that only whitelist settings stored locally, never content
4. **No Passive Consent**: "Continued use = consent" insufficient; require affirmative action
5. **Audit Trail**: Track when domains added (timestamp) for user's own records

## Sources

### Official Chrome Documentation (HIGH confidence)
- [chrome.idle API Reference](https://developer.chrome.com/docs/extensions/reference/api/idle)
- [chrome.tabs API Reference](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Declare Permissions Best Practices](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

### Open Source Libraries (HIGH confidence)
- [Mozilla Readability GitHub](https://github.com/mozilla/readability)

### Browser Extension UX Patterns (MEDIUM confidence)
- [UX Best Practices for Browser Extensions - Plasmo](https://www.plasmo.com/blog/posts/ux-best-practices-that-will-make-your-browser-extension-successful)
- [User Experience Best Practices - Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/user-experience-best-practices/)
- [Notifications in Chrome Extension - Mosh Feu](https://moshfeu.medium.com/notifications-in-chrome-extension-50aac17b3b7d)

### Domain Whitelist Patterns (MEDIUM confidence)
- [Enterprise Policy URL Pattern Format](https://chromeenterprise.google/policies/url-patterns/)
- [Strict URL Whitelist GitHub](https://github.com/romikette/Strict-URL-Whitelist)

### Auto-Save UX Research (MEDIUM confidence)
- [Autosave Design Pattern - UI Patterns](https://ui-patterns.com/patterns/autosave)
- [Auto-Saving Forms Done Right - Code Miner 42](https://blog.codeminer42.com/auto-saving-forms-done-right-1-2/)
- [The UX Shift Every Platform Must Get Right: Auto-Save - Medium](https://medium.com/design-bootcamp/the-ux-shift-every-modern-platform-must-get-right-auto-save-28247b7d4fd2)

### Privacy & GDPR 2026 (MEDIUM confidence)
- [Complete GDPR Compliance Guide 2026](https://secureprivacy.ai/blog/gdpr-compliance-2026)
- [Dark Pattern Avoidance 2026 Checklist](https://secureprivacy.ai/blog/dark-pattern-avoidance-2026-checklist)
- [Data Privacy Trends in 2026](https://cookie-script.com/news/data-privacy-trends-2026)

### Article Detection & Reading Apps (MEDIUM confidence)
- [Instapaper vs Pocket Comparison - Zapier](https://zapier.com/blog/instapaper-vs-pocket/)
- [Open Graph Checker Extension](https://coywolf.com/news/social-media/open-graph-checker/)
- [Fast Schema Markup Checker - Chrome Web Store](https://chromewebstore.google.com/detail/fast-schema-markup-checke/lddhiobdanelpbaghblpeohcjomclocl)

### Time Tracking Extensions (MEDIUM-LOW confidence, ecosystem survey)
- [7 Best Time Tracking Chrome Extensions 2026 - Toggl](https://toggl.com/blog/time-tracking-chrome-extension)
- [Web Activity Time Tracker GitHub](https://github.com/Stigmatoz/web-activity-time-tracker)
