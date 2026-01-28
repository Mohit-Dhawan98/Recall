// Background service worker for Recall extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-recall',
    title: 'Save to Recall',
    contexts: ['page', 'link']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-recall') {
    const url = info.linkUrl || info.pageUrl;
    await saveArticle(url, tab);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-article') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      await saveArticle(tab.url, tab);
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveArticle') {
    saveArticle(request.url, request.tab)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['serverUrl', 'apiKey'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'saveSettings') {
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function saveArticle(url, tab) {
  try {
    // Get settings
    const settings = await chrome.storage.sync.get(['serverUrl', 'apiKey']);

    if (!settings.serverUrl) {
      showNotification('Please configure Recall', 'Set your server URL in extension settings');
      return { success: false, error: 'Server URL not configured' };
    }

    const apiUrl = settings.serverUrl.replace(/\/$/, '');
    const apiKey = settings.apiKey || 'default-api-key';

    // Get page content if possible
    let content = null;
    if (tab?.id) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.documentElement.outerHTML
        });
        content = result?.result;
      } catch (e) {
        // Content script failed, proceed without content
        console.log('Could not get page content:', e);
      }
    }

    // Send to API
    const response = await fetch(`${apiUrl}/api/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        url: url,
        content: content,
        capture_source: 'extension'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Failed to save article');
    }

    const data = await response.json();

    // Show success notification
    showNotification(
      data.status === 'duplicate' ? 'Already Saved' : 'Saved!',
      data.message
    );

    return { success: true, data };

  } catch (error) {
    console.error('Error saving article:', error);
    showNotification('Error', error.message);
    return { success: false, error: error.message };
  }
}

function showNotification(title, message) {
  // Use badge for simple feedback
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
}
