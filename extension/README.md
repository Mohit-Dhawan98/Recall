# Recall Chrome Extension

Save articles to your personal knowledge base with one click.

## Prerequisites

Before installing the extension, you need:

1. **Recall server running** - Either locally or via a tunnel
2. **API key** - Generated from the Recall web app Settings page

If you haven't set up the server yet, see the [Self-Hosting Guide](../docs/SELF_HOSTING.md).

## Installation

### Step 1: Open Chrome Extensions

Navigate to `chrome://extensions/` in your Chrome browser.

### Step 2: Enable Developer Mode

Toggle "Developer mode" in the top-right corner of the extensions page.

### Step 3: Load the Extension

1. Click the "Load unpacked" button
2. Navigate to and select this `extension` folder
3. The Recall extension should now appear in your extensions list

### Step 4: Pin the Extension (Recommended)

1. Click the puzzle piece icon in Chrome's toolbar
2. Find "Recall" in the list
3. Click the pin icon to keep it visible in your toolbar

## Configuration

### Step 1: Open Settings

1. Click the Recall extension icon in your toolbar
2. Click "Settings" in the popup footer

### Step 2: Enter Server URL

Enter your Recall server URL:
- **Local**: `http://localhost:3000`
- **Cloudflare Tunnel**: `https://your-tunnel.trycloudflare.com`
- **Tailscale**: `http://recall.your-tailnet.ts.net`

### Step 3: Enter API Key

1. Open your Recall web app
2. Go to Settings
3. Copy your API key
4. Paste it in the extension settings

### Step 4: Test Connection

Click "Test Connection" to verify everything works. You should see a success message.

## Usage

### Save Current Page

**Option 1: Click the icon**
- Click the Recall icon in your toolbar
- The popup shows the page title and URL
- Click "Save" to add it to your library

**Option 2: Keyboard shortcut**
- Mac: `Cmd+Shift+S`
- Windows/Linux: `Ctrl+Shift+S`

**Option 3: Context menu**
- Right-click anywhere on the page
- Select "Save to Recall"

### Save a Link

- Right-click any link on a page
- Select "Save to Recall"
- The linked page will be saved (not the current page)

## Troubleshooting

### "Connection failed" error

1. **Check server is running**: Open your Recall URL in a browser
2. **Verify URL format**: Include `http://` or `https://`
3. **Check for typos**: Ensure the URL matches exactly
4. **Test the health endpoint**: Visit `{your-url}/health` - should return OK

### Extension icon is grayed out

This is normal on certain pages where extensions can't run:
- Chrome internal pages (`chrome://...`)
- Chrome Web Store
- New tab page (depending on settings)

### Keyboard shortcut not working

1. Go to `chrome://extensions/shortcuts`
2. Find "Recall"
3. Verify or reassign the shortcut
4. Check for conflicts with other extensions

### Saves are stuck on "pending"

This usually means AI processing is delayed:
1. Check that your LLM (DeepSeek/Ollama) is configured
2. View server logs: `docker-compose logs api`
3. Articles will still be saved, just without AI-generated metadata

### "Invalid API key" error

1. Generate a new API key in Recall web app Settings
2. Copy the full key (no extra spaces)
3. Paste into extension settings
4. Click "Test Connection"

## Updating the Extension

When you pull updates to the Recall repository:

1. Go to `chrome://extensions/`
2. Find the Recall extension
3. Click the refresh icon (circular arrow)
4. Or click "Remove" and re-add it

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Recall"
3. Click "Remove"
4. Confirm removal

## Privacy

The extension only sends data to your configured Recall server. No data is sent to third parties. The extension requests these permissions:

- **storage**: Save your settings locally
- **activeTab**: Read the current page's URL and title when you click save
- **contextMenus**: Add "Save to Recall" to right-click menu
- **host_permissions**: Send saved articles to your Recall server

## Development

### Regenerating Icons

If you modify `icons/icon.svg`, regenerate the PNG icons:

```bash
node extension/scripts/generate-icons.js
```

This creates the required PNG files (16x16, 32x32, 48x48, 128x128) from the SVG source.

### Running Tests

```bash
node extension/tests/run-all.js
```
