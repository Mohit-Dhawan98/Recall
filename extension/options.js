// Options page script for Recall extension

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(['serverUrl', 'apiKey'], (result) => {
    if (result.serverUrl) {
      document.getElementById('serverUrl').value = result.serverUrl;
    }
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });

  // Setup event listeners
  document.getElementById('saveBtn').addEventListener('click', handleSave);
  document.getElementById('testBtn').addEventListener('click', handleTest);
});

function handleSave() {
  const serverUrl = document.getElementById('serverUrl').value.trim().replace(/\/$/, '');
  const apiKey = document.getElementById('apiKey').value.trim() || 'default-api-key';

  if (!serverUrl) {
    showStatus('Please enter a server URL', 'error');
    return;
  }

  // Validate URL format
  try {
    new URL(serverUrl);
  } catch {
    showStatus('Invalid URL format', 'error');
    return;
  }

  chrome.storage.sync.set({ serverUrl, apiKey }, () => {
    showStatus('Settings saved!', 'success');
  });
}

async function handleTest() {
  const serverUrl = document.getElementById('serverUrl').value.trim().replace(/\/$/, '');
  const apiKey = document.getElementById('apiKey').value.trim() || 'default-api-key';

  if (!serverUrl) {
    showStatus('Please enter a server URL first', 'error');
    return;
  }

  showStatus('Testing connection...', 'loading');

  try {
    const response = await fetch(`${serverUrl}/api/auth/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (response.ok) {
      showStatus('Connection successful!', 'success');
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';

  if (type === 'success') {
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
}
