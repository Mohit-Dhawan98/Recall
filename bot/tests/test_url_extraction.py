"""Test URL extraction pattern."""
import re
import pytest
from bot.main import URL_PATTERN


def test_url_pattern_extracts_https_url():
    """[BASE] Check https://example.com/article -> ['https://example.com/article']"""
    text = "Check https://example.com/article"
    urls = URL_PATTERN.findall(text)
    assert urls == ["https://example.com/article"]


def test_url_pattern_extracts_http_url():
    """[BASE] Visit http://example.com -> ['http://example.com']"""
    text = "Visit http://example.com"
    urls = URL_PATTERN.findall(text)
    assert urls == ["http://example.com"]


def test_url_pattern_extracts_multiple_urls():
    """[NORMAL] Links: https://a.com and https://b.com -> ['https://a.com', 'https://b.com']"""
    text = "Links: https://a.com and https://b.com"
    urls = URL_PATTERN.findall(text)
    assert urls == ["https://a.com", "https://b.com"]


def test_url_pattern_extracts_url_with_path_and_query():
    """[NORMAL] https://example.com/path?utm_source=twitter&id=123 -> extracts full URL"""
    text = "Check out https://example.com/path?utm_source=twitter&id=123 for details"
    urls = URL_PATTERN.findall(text)
    assert len(urls) == 1
    assert urls[0] == "https://example.com/path?utm_source=twitter&id=123"


def test_url_pattern_no_match_without_protocol():
    """[EDGE] Visit example.com -> [] (no match without http/https)"""
    text = "Visit example.com"
    urls = URL_PATTERN.findall(text)
    assert urls == []


def test_url_pattern_no_match_plain_text():
    """[EDGE] No URLs here! -> []"""
    text = "No URLs here!"
    urls = URL_PATTERN.findall(text)
    assert urls == []
