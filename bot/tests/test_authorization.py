"""Test authorization and environment validation."""
import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from bot.main import handle_unauthorized, main
import logging


@pytest.mark.asyncio
async def test_unauthorized_user_gets_rejection(mock_update, mock_context):
    """[BASE] Call handle_unauthorized with mock update from user 99999. Verify reply_text contains 'private'."""
    # Set user ID to unauthorized user
    mock_update.message.from_user.id = 99999

    await handle_unauthorized(mock_update, mock_context)

    # Verify reply_text was called with rejection message
    mock_update.message.reply_text.assert_called_once()
    call_args = mock_update.message.reply_text.call_args[0][0]
    assert "private" in call_args.lower()


@pytest.mark.asyncio
async def test_unauthorized_logs_warning(mock_update, mock_context, caplog):
    """[NORMAL] Call handle_unauthorized and verify logger.warning was called with user ID."""
    # Set user ID to unauthorized user
    mock_update.message.from_user.id = 99999

    with caplog.at_level(logging.WARNING):
        await handle_unauthorized(mock_update, mock_context)

    # Verify warning was logged with user ID
    assert any("99999" in record.message for record in caplog.records)


def test_main_exits_without_bot_token():
    """[EDGE] Call main() with TELEGRAM_BOT_TOKEN='' in env. Verify it returns without crashing."""
    with patch.dict(os.environ, {
        "TELEGRAM_BOT_TOKEN": "",
        "TELEGRAM_OWNER_USER_ID": "12345",
    }):
        # Import main fresh to pick up patched env vars
        import importlib
        import bot.main
        importlib.reload(bot.main)

        # Should return without error
        result = bot.main.main()
        assert result is None


def test_main_exits_without_owner_id():
    """[EDGE] Call main() with TELEGRAM_OWNER_USER_ID='' in env. Verify it returns without crashing."""
    with patch.dict(os.environ, {
        "TELEGRAM_BOT_TOKEN": "test-token",
        "TELEGRAM_OWNER_USER_ID": "",
    }):
        # Import main fresh to pick up patched env vars
        import importlib
        import bot.main
        importlib.reload(bot.main)

        # Should return without error
        result = bot.main.main()
        assert result is None


def test_main_exits_with_invalid_owner_id():
    """[EDGE] Call main() with TELEGRAM_OWNER_USER_ID='not-a-number'. Verify it returns without crashing."""
    with patch.dict(os.environ, {
        "TELEGRAM_BOT_TOKEN": "test-token",
        "TELEGRAM_OWNER_USER_ID": "not-a-number",
    }):
        # Import main fresh to pick up patched env vars
        import importlib
        import bot.main
        importlib.reload(bot.main)

        # Should return without error
        result = bot.main.main()
        assert result is None
