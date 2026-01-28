"""
Tests for the Extractor service.

Test categories:
- BASE: URL parsing and hashing
- NORMAL: Content extraction from various sources
- EDGE: Error handling, timeouts, special URLs
"""

import pytest
from app.services.extractor import (
    normalize_url,
    hash_url,
    detect_content_type,
    estimate_read_time,
    ExtractedContent
)


# ═══════════════════════════════════════════════════════════════
# BASE CASES - URL normalization and hashing
# ═══════════════════════════════════════════════════════════════

class TestExtractorBase:
    """Base case tests for URL utilities."""

    def test_normalize_url_basic(self):
        """[BASE] Basic URL normalization."""
        url = "https://example.com/article"
        result = normalize_url(url)
        assert result == "https://example.com/article"

    def test_hash_url_consistent(self):
        """[BASE] URL hash is consistent."""
        url = "https://example.com/article"
        hash1 = hash_url(url)
        hash2 = hash_url(url)
        assert hash1 == hash2

    def test_hash_url_different_urls(self):
        """[BASE] Different URLs produce different hashes."""
        hash1 = hash_url("https://example.com/article1")
        hash2 = hash_url("https://example.com/article2")
        assert hash1 != hash2


# ═══════════════════════════════════════════════════════════════
# NORMAL CASES - URL normalization
# ═══════════════════════════════════════════════════════════════

class TestUrlNormalization:
    """Normal case tests for URL normalization."""

    def test_remove_utm_parameters(self):
        """[NORMAL] Remove UTM tracking parameters."""
        url = "https://example.com/article?utm_source=twitter&utm_medium=social"
        result = normalize_url(url)
        assert "utm_source" not in result
        assert "utm_medium" not in result

    def test_remove_ref_parameter(self):
        """[NORMAL] Remove ref parameter."""
        url = "https://example.com/article?ref=homepage"
        result = normalize_url(url)
        assert "ref=" not in result

    def test_remove_fbclid_parameter(self):
        """[NORMAL] Remove Facebook click ID."""
        url = "https://example.com/article?fbclid=abc123"
        result = normalize_url(url)
        assert "fbclid" not in result

    def test_remove_gclid_parameter(self):
        """[NORMAL] Remove Google click ID."""
        url = "https://example.com/article?gclid=xyz789"
        result = normalize_url(url)
        assert "gclid" not in result

    def test_preserve_meaningful_parameters(self):
        """[NORMAL] Preserve non-tracking parameters."""
        url = "https://example.com/search?q=python&page=2"
        result = normalize_url(url)
        assert "q=python" in result
        assert "page=2" in result

    def test_remove_fragment(self):
        """[NORMAL] Remove URL fragment."""
        url = "https://example.com/article#section-1"
        result = normalize_url(url)
        assert "#" not in result

    def test_remove_trailing_slash(self):
        """[NORMAL] Remove trailing slash."""
        url = "https://example.com/article/"
        result = normalize_url(url)
        assert result == "https://example.com/article"

    def test_mixed_tracking_and_valid_params(self):
        """[NORMAL] Handle mix of tracking and valid parameters."""
        url = "https://example.com/article?id=123&utm_source=twitter&section=news"
        result = normalize_url(url)
        assert "id=123" in result
        assert "section=news" in result
        assert "utm_source" not in result


# ═══════════════════════════════════════════════════════════════
# CONTENT TYPE DETECTION
# ═══════════════════════════════════════════════════════════════

class TestContentTypeDetection:
    """Tests for content type detection."""

    def test_detect_article(self):
        """[NORMAL] Detect standard article."""
        result = detect_content_type("https://example.com/blog/post", "")
        assert result == "article"

    def test_detect_tweet_twitter(self):
        """[NORMAL] Detect Twitter tweet."""
        result = detect_content_type("https://twitter.com/user/status/123", "")
        assert result == "tweet"

    def test_detect_tweet_x(self):
        """[NORMAL] Detect X.com tweet."""
        result = detect_content_type("https://x.com/user/status/123", "")
        assert result == "tweet"

    def test_detect_youtube_video(self):
        """[NORMAL] Detect YouTube video."""
        result = detect_content_type("https://www.youtube.com/watch?v=abc", "")
        assert result == "video"

    def test_detect_youtube_short(self):
        """[NORMAL] Detect YouTube short URL."""
        result = detect_content_type("https://youtu.be/abc123", "")
        assert result == "video"

    def test_detect_pdf(self):
        """[NORMAL] Detect PDF document."""
        result = detect_content_type("https://example.com/doc.pdf", "")
        assert result == "pdf"

    def test_detect_arxiv(self):
        """[NORMAL] Detect arXiv paper."""
        result = detect_content_type("https://arxiv.org/abs/2401.12345", "")
        assert result == "research-paper"

    def test_detect_github(self):
        """[NORMAL] Detect GitHub repository."""
        result = detect_content_type("https://github.com/user/repo", "")
        assert result == "repository"


# ═══════════════════════════════════════════════════════════════
# READ TIME ESTIMATION
# ═══════════════════════════════════════════════════════════════

class TestReadTimeEstimation:
    """Tests for read time estimation."""

    def test_estimate_read_time_short(self):
        """[NORMAL] Estimate time for short article (200 words = 1 min)."""
        result = estimate_read_time(200)
        assert result == 60  # 60 seconds

    def test_estimate_read_time_medium(self):
        """[NORMAL] Estimate time for medium article (1000 words = 5 min)."""
        result = estimate_read_time(1000)
        assert result == 300  # 300 seconds

    def test_estimate_read_time_long(self):
        """[NORMAL] Estimate time for long article (4000 words = 20 min)."""
        result = estimate_read_time(4000)
        assert result == 1200  # 1200 seconds

    def test_estimate_read_time_zero(self):
        """[EDGE] Estimate time for zero words."""
        result = estimate_read_time(0)
        assert result == 0


# ═══════════════════════════════════════════════════════════════
# EDGE CASES
# ═══════════════════════════════════════════════════════════════

class TestExtractorEdge:
    """Edge case tests for extractor."""

    def test_normalize_empty_query(self):
        """[EDGE] Normalize URL with no query string."""
        url = "https://example.com/article"
        result = normalize_url(url)
        assert "?" not in result

    def test_normalize_only_tracking_params(self):
        """[EDGE] URL with only tracking parameters."""
        url = "https://example.com/article?utm_source=twitter"
        result = normalize_url(url)
        assert "?" not in result or result.endswith("?")

    def test_hash_similar_urls_same(self):
        """[EDGE] Similar URLs with tracking params produce same hash."""
        url1 = "https://example.com/article"
        url2 = "https://example.com/article?utm_source=twitter"
        assert hash_url(url1) == hash_url(url2)

    def test_hash_url_case_sensitivity(self):
        """[EDGE] URL hash is case-sensitive for path."""
        hash1 = hash_url("https://example.com/Article")
        hash2 = hash_url("https://example.com/article")
        # Path is typically case-sensitive
        assert hash1 != hash2

    def test_normalize_url_with_port(self):
        """[EDGE] Normalize URL with port number."""
        url = "https://example.com:8080/article"
        result = normalize_url(url)
        assert ":8080" in result

    def test_normalize_url_unicode(self):
        """[EDGE] Normalize URL with unicode characters."""
        url = "https://example.com/文章"
        result = normalize_url(url)
        assert "文章" in result or "%E6%96%87%E7%AB%A0" in result

    def test_detect_content_type_case_insensitive(self):
        """[EDGE] Content type detection is case-insensitive."""
        result1 = detect_content_type("https://TWITTER.COM/user/status/123", "")
        result2 = detect_content_type("https://Twitter.com/user/status/123", "")
        assert result1 == result2 == "tweet"

    def test_normalize_url_double_slash_path(self):
        """[EDGE] Handle double slashes in path."""
        url = "https://example.com//article//page"
        result = normalize_url(url)
        assert result.startswith("https://example.com/")

    def test_normalize_url_special_characters(self):
        """[EDGE] Handle special characters in URL."""
        url = "https://example.com/article?title=hello%20world"
        result = normalize_url(url)
        assert "title=hello%20world" in result
