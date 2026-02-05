"""Test message handling logic."""
import pytest
from unittest.mock import patch, AsyncMock
import httpx
from bot.main import handle_message


@pytest.mark.asyncio
async def test_handle_message_with_single_url(mock_update, mock_context):
    """[BASE] Message with one URL. Verify reply_text called with 'Saved' in response."""
    mock_update.message.text = "Check out https://example.com/article"

    with patch('bot.main.save_article', new_callable=AsyncMock) as mock_save:
        mock_save.return_value = {
            "id": "test-id",
            "status": "processing",
            "message": "Article saved"
        }

        await handle_message(mock_update, mock_context)

        # Verify save_article was called
        mock_save.assert_called_once()

        # Verify reply_text was called with success message
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "Saved" in call_args


@pytest.mark.asyncio
async def test_handle_message_with_multiple_urls(mock_update, mock_context):
    """[NORMAL] Message with two URLs. Verify save_article called twice."""
    mock_update.message.text = "Check https://example.com/one and https://example.com/two"

    with patch('bot.main.save_article', new_callable=AsyncMock) as mock_save:
        mock_save.return_value = {
            "id": "test-id",
            "status": "processing",
            "message": "Article saved"
        }

        await handle_message(mock_update, mock_context)

        # Verify save_article was called twice
        assert mock_save.call_count == 2

        # Verify reply_text was called
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "Saved" in call_args


@pytest.mark.asyncio
async def test_handle_message_no_url(mock_update, mock_context):
    """[EDGE] Message with no URLs. Verify reply_text called with 'couldn't find any links' message."""
    mock_update.message.text = "Hello there, no links here!"

    await handle_message(mock_update, mock_context)

    # Verify reply_text was called with no URLs message
    mock_update.message.reply_text.assert_called_once()
    call_args = mock_update.message.reply_text.call_args[0][0]
    assert "couldn't find any links" in call_args.lower()


@pytest.mark.asyncio
async def test_handle_message_api_error(mock_update, mock_context):
    """[EDGE] Message with URL where save_article raises HTTPStatusError. Verify reply_text called with 'Failed' in response."""
    mock_update.message.text = "Check https://example.com/article"

    with patch('bot.main.save_article', new_callable=AsyncMock) as mock_save:
        # Create a mock response for the HTTPStatusError
        mock_request = httpx.Request("POST", "http://test-api/articles")
        mock_response = httpx.Response(500, request=mock_request)
        mock_save.side_effect = httpx.HTTPStatusError(
            "Server error",
            request=mock_request,
            response=mock_response
        )

        await handle_message(mock_update, mock_context)

        # Verify reply_text was called with error message
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "Failed" in call_args


@pytest.mark.asyncio
async def test_handle_message_duplicate_url(mock_update, mock_context):
    """[NORMAL] Mock save_article to return status='duplicate'. Verify reply_text contains 'Already saved'."""
    mock_update.message.text = "Check https://example.com/article"

    with patch('bot.main.save_article', new_callable=AsyncMock) as mock_save:
        mock_save.return_value = {
            "id": "test-id",
            "status": "duplicate"
        }

        await handle_message(mock_update, mock_context)

        # Verify reply_text was called with duplicate message
        mock_update.message.reply_text.assert_called_once()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "Already saved" in call_args
