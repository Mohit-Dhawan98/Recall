"""Bot test fixtures."""
import os
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from telegram import Update, Message, User, Chat
from telegram.ext import ContextTypes


@pytest.fixture(autouse=True)
def mock_env_vars():
    """Set required environment variables for all bot tests."""
    with patch.dict(os.environ, {
        "TELEGRAM_BOT_TOKEN": "test-token-12345",
        "TELEGRAM_OWNER_USER_ID": "12345",
        "API_URL": "http://test-api:8000",
    }):
        yield


@pytest.fixture
def mock_update():
    """Create a mock Telegram Update object."""
    update = MagicMock(spec=Update)
    update.message = MagicMock(spec=Message)
    update.message.from_user = MagicMock(spec=User)
    update.message.from_user.id = 12345
    update.message.chat = MagicMock(spec=Chat)
    update.message.reply_text = AsyncMock()
    return update


@pytest.fixture
def mock_context():
    """Create a mock bot context."""
    return MagicMock(spec=ContextTypes.DEFAULT_TYPE)
