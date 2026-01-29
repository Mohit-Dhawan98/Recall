import os
import re
import asyncio
import logging
import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_OWNER_USER_ID = os.getenv('TELEGRAM_OWNER_USER_ID')
API_URL = os.getenv('API_URL', 'http://api:8000')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
USE_POLLING = os.getenv('USE_POLLING', 'true').lower() == 'true'

# URL pattern for extraction
URL_PATTERN = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "Welcome to Recall Bot! \n\n"
        "Send me any link and I'll save it to your knowledge base.\n\n"
        "Commands:\n"
        "/start - Show this message\n"
        "/help - Show help\n"
        "/status - Check connection status"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    await update.message.reply_text(
        "How to use Recall Bot:\n\n"
        "1. Simply send me a link to any article, tweet, or webpage\n"
        "2. I'll save it to your Recall knowledge base\n"
        "3. The article will be processed with AI tagging\n\n"
        "Tips:\n"
        "- Share directly from other apps using the share menu\n"
        "- You can send multiple links in one message\n"
        "- Links from text messages are automatically detected"
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{API_URL}/health")
            if response.status_code == 200:
                await update.message.reply_text("Connected to Recall server!")
            else:
                await update.message.reply_text(f"Server returned status {response.status_code}")
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        await update.message.reply_text(f"Could not connect to server: {str(e)}")


async def save_article(url: str, user_id: int) -> dict:
    """Save article to Recall API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{API_URL}/api/articles",
            json={
                "url": url,
                "capture_source": "telegram"
            },
            headers={
                "X-API-Key": "default-api-key"  # Using default user for simplicity
            }
        )
        response.raise_for_status()
        return response.json()


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming messages with URLs."""
    message = update.message
    text = message.text or message.caption or ""

    # Extract URLs from message
    urls = URL_PATTERN.findall(text)

    if not urls:
        await message.reply_text(
            "I couldn't find any links in your message. "
            "Send me a URL to save it to Recall!"
        )
        return

    # Process each URL
    results = []
    for url in urls[:5]:  # Limit to 5 URLs per message
        try:
            result = await save_article(url, message.from_user.id)

            if result.get('status') == 'duplicate':
                results.append(f"Already saved: {url[:50]}...")
            else:
                results.append(f"Saved: {url[:50]}...")

        except httpx.HTTPStatusError as e:
            logger.error(f"API error for {url}: {e}")
            results.append(f"Failed: {url[:50]}...")
        except Exception as e:
            logger.error(f"Error saving {url}: {e}")
            results.append(f"Error: {url[:50]}...")

    # Send response
    response_text = "\n".join(results)
    if len(urls) == 1 and "Saved" in results[0]:
        response_text = f"Saved! Your article is being processed with AI tagging."

    await message.reply_text(response_text)


async def handle_unauthorized(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle messages from unauthorized users."""
    logger.warning(f"Unauthorized access attempt from user {update.message.from_user.id}")
    await update.message.reply_text(
        "Sorry, this bot is private. Only the owner can use it."
    )


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle errors."""
    logger.error(f"Update {update} caused error {context.error}")

    if update and update.message:
        await update.message.reply_text(
            "Sorry, something went wrong. Please try again later."
        )


def main() -> None:
    """Start the bot."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set!")
        return

    if not TELEGRAM_OWNER_USER_ID:
        logger.error("TELEGRAM_OWNER_USER_ID not set! Bot requires owner user ID for authorization.")
        return

    # Convert to int for filters.User
    try:
        owner_user_id = int(TELEGRAM_OWNER_USER_ID)
    except ValueError:
        logger.error(f"TELEGRAM_OWNER_USER_ID must be a valid integer, got: {TELEGRAM_OWNER_USER_ID}")
        return

    # Create application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Owner filter for all handlers
    owner_filter = filters.User(user_id=owner_user_id)

    # Command handlers - only for owner
    application.add_handler(CommandHandler("start", start, filters=owner_filter))
    application.add_handler(CommandHandler("help", help_command, filters=owner_filter))
    application.add_handler(CommandHandler("status", status_command, filters=owner_filter))

    # Message handler - only for owner
    application.add_handler(MessageHandler(
        filters.TEXT & owner_filter & ~filters.COMMAND,
        handle_message
    ))

    # Catch-all for unauthorized users (must be last)
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_unauthorized
    ))

    # Add error handler
    application.add_error_handler(error_handler)

    # Start bot
    if USE_POLLING:
        logger.info("Starting bot in polling mode...")
        application.run_polling(allowed_updates=Update.ALL_TYPES)
    else:
        logger.info(f"Starting bot in webhook mode at {WEBHOOK_URL}...")
        application.run_webhook(
            listen="0.0.0.0",
            port=8443,
            url_path=TELEGRAM_BOT_TOKEN,
            webhook_url=f"{WEBHOOK_URL}/{TELEGRAM_BOT_TOKEN}"
        )


if __name__ == '__main__':
    main()
