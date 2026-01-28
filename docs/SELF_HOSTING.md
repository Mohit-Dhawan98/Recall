# Self-Hosting Guide

This guide walks you through setting up Recall on your own server or computer.

## Prerequisites

- Docker and Docker Compose installed
- 2GB+ RAM available
- (Optional) DeepSeek API key for AI features
- (Optional) Telegram bot token for mobile capture

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/yourname/recall
cd recall
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required
DB_PASSWORD=your-secure-password-here

# Optional - AI Features
DEEPSEEK_API_KEY=your-deepseek-api-key

# Optional - Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 2. Start Services

```bash
# Basic setup (web + api + database)
docker-compose up -d

# With Telegram bot
docker-compose --profile with-bot up -d

# With local LLM (Ollama)
docker-compose --profile local-llm up -d
```

### 3. Access Recall

Open http://localhost:3000 in your browser.

## Multi-Device Access (Tunneling)

To access Recall from your phone or other devices, you need to expose it via a tunnel.

### Option A: Cloudflare Quick Tunnel (Easiest)

Free, random URL that changes on restart:

```bash
docker-compose --profile tunnel-cloudflare up -d

# Get your tunnel URL
docker-compose logs cloudflare-tunnel | grep "trycloudflare.com"
```

### Option B: Cloudflare Tunnel (Stable URL)

1. Create a tunnel at https://one.dash.cloudflare.com/
2. Get your tunnel token
3. Update docker-compose.yml with your token
4. Start with `--profile tunnel-cloudflare`

### Option C: Tailscale (Private Network)

Best for personal use - your devices only:

1. Sign up at https://tailscale.com
2. Get an auth key from https://login.tailscale.com/admin/settings/keys
3. Add to `.env`:
   ```
   TAILSCALE_AUTHKEY=tskey-auth-xxxxx
   ```
4. Start:
   ```bash
   docker-compose --profile tunnel-tailscale up -d
   ```
5. Access at: `http://recall.your-tailnet.ts.net`

### Option D: ngrok

```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Start tunnel
ngrok http 3000
```

## Installing the Chrome Extension

### Prerequisites

- Recall server running (locally or via tunnel)
- API key from Recall web app Settings

### Quick Install

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this repository
5. Pin the extension for easy access (click puzzle icon → pin)

### Configure

1. Click the Recall extension icon
2. Click "Settings" in the footer
3. Enter your server URL:
   - Local: `http://localhost:3000`
   - Tunnel: `https://your-tunnel.trycloudflare.com`
4. Enter your API key (from Recall web app → Settings)
5. Click "Test Connection" to verify

### Troubleshooting

**Connection failed?**
- Verify server is running: `docker-compose ps`
- Test URL in browser: `{your-url}/health`
- Check for typos in the URL

**Keyboard shortcut not working?**
- Check `chrome://extensions/shortcuts`
- Reassign if conflicting with another extension

For detailed instructions, see the [Extension README](../extension/README.md).

## Setting Up the Mobile App (PWA)

1. Open your tunnel URL on your phone
2. iOS: Tap Share → "Add to Home Screen"
3. Android: Tap menu (⋮) → "Install app"
4. Recall will appear as an app
5. Share links from any app to Recall!

## Setting Up Telegram Bot

1. Message @BotFather on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token
4. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-token
   ```
5. Restart:
   ```bash
   docker-compose --profile with-bot up -d
   ```
6. Message your bot to save links!

## LLM Configuration

### DeepSeek (Recommended)

Cheapest option with good quality:

1. Sign up at https://platform.deepseek.com/
2. Get an API key
3. Add to `.env`:
   ```
   DEEPSEEK_API_KEY=your-key
   ```

Cost: ~$0.001 per article

### Local Ollama

Free, runs on your machine:

```bash
# Start Ollama container
docker-compose --profile local-llm up -d

# Pull a model
docker-compose exec ollama ollama pull llama3.2

# Or for embeddings
docker-compose exec ollama ollama pull nomic-embed-text
```

Note: Requires 8GB+ RAM for good performance.

### No LLM (Rule-based)

If no LLM is configured, Recall will:
- Use basic rule-based tagging
- Not generate summaries
- Still save and organize your articles

## Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres recall > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres recall
```

## Upgrading

```bash
git pull
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Can't connect from extension

1. Check that your server is running: `docker-compose ps`
2. Verify your tunnel URL is correct
3. Test with: `curl https://your-tunnel-url/health`

### AI processing stuck on "pending"

1. Check API logs: `docker-compose logs api`
2. Verify your LLM API key is correct
3. Ensure you have network access to DeepSeek or Ollama

### Database issues

```bash
# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Out of memory

- Reduce Ollama model size
- Or use DeepSeek API instead of local LLM

## Architecture

```
┌─────────────────────────────────────────┐
│            Your Devices                 │
│  Extension │ PWA │ Telegram Bot        │
└──────────────────┬──────────────────────┘
                   │
            ┌──────┴──────┐
            │   Tunnel    │
            │ (optional)  │
            └──────┬──────┘
                   │
┌──────────────────┴──────────────────────┐
│           Docker Compose                │
│                                         │
│  ┌─────┐ ┌─────┐ ┌────┐ ┌──────────┐   │
│  │ Web │ │ API │ │Bot │ │PostgreSQL│   │
│  │:3000│ │:8000│ │    │ │ +pgvector│   │
│  └─────┘ └──┬──┘ └────┘ └──────────┘   │
│             │                           │
│        ┌────┴────┐                      │
│        │   LLM   │                      │
│        │DeepSeek │                      │
│        │or Ollama│                      │
│        └─────────┘                      │
└─────────────────────────────────────────┘
```

## Security Considerations

- Change default passwords in `.env`
- Use HTTPS (tunnels provide this automatically)
- Don't expose ports directly to the internet
- Consider Tailscale for private access
- Regularly backup your database
