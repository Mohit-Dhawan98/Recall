// Popup script for Recall extension

let currentTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Display page info
  document.getElementById('pageTitle').textContent = tab.title || 'Untitled';
  document.getElementById('pageUrl').textContent = tab.url;

  // Check if we have settings configured
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (!result.serverUrl) {
      showStatus('Please configure server URL in settings', 'error');
      document.getElementById('saveBtn').disabled = true;
    }
  });

  // Setup event listeners
  document.getElementById('saveBtn').addEventListener('click', handleSave);
  document.getElementById('openAppBtn').addEventListener('click', handleOpenApp);
  document.getElementById('settingsLink').addEventListener('click', handleOpenSettings);
});

async function handleSave() {
  const saveBtn = document.getElementById('saveBtn');
  const originalContent = saveBtn.innerHTML;

  // Show loading state
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
  showStatus('Saving article...', 'loading');

  try {
    // Send message to background script
    const result = await chrome.runtime.sendMessage({
      action: 'saveArticle',
      url: currentTab.url,
      tab: currentTab
    });

    if (result.success) {
      showStatus(result.data?.message || 'Article saved!', 'success');
      saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved!';

      // Close popup after delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      throw new Error(result.error || 'Failed to save');
    }

  } catch (error) {
    showStatus(error.message, 'error');
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalContent;
  }
}

function handleOpenApp() {
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      chrome.tabs.create({ url: result.serverUrl });
    } else {
      showStatus('Server URL not configured', 'error');
    }
  });
}

function handleOpenSettings(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}
