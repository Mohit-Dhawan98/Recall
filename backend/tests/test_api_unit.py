"""
Unit tests for API endpoints.

These tests use mocked database dependencies and don't require PostgreSQL.
They test the API contract, validation, and error handling.
"""

import pytest
from httpx import AsyncClient


# ═══════════════════════════════════════════════════════════════
# HEALTH & ROOT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

class TestHealthEndpoints:
    """Tests for health check endpoints."""

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client_unit: AsyncClient):
        """[BASE] Root endpoint returns API info."""
        response = await client_unit.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Recall API"
        assert "version" in data

    @pytest.mark.asyncio
    async def test_health_check(self, client_unit: AsyncClient):
        """[BASE] Health endpoint returns ok."""
        response = await client_unit.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_auth_health_check(self, client_unit: AsyncClient):
        """[BASE] Auth health endpoint returns ok."""
        response = await client_unit.get("/api/auth/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ═══════════════════════════════════════════════════════════════
# ARTICLES API - VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════

class TestArticlesValidation:
    """Tests for articles API input validation."""

    @pytest.mark.asyncio
    async def test_create_article_missing_url(self, client_unit: AsyncClient):
        """[EDGE] Create article without URL returns validation error."""
        response = await client_unit.post("/api/articles", json={})
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_pagination_invalid_page_zero(self, client_unit: AsyncClient):
        """[EDGE] Pagination with page=0 returns validation error."""
        response = await client_unit.get("/api/articles?page=0")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_invalid_page_negative(self, client_unit: AsyncClient):
        """[EDGE] Pagination with negative page returns validation error."""
        response = await client_unit.get("/api/articles?page=-1")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_invalid_page_size_zero(self, client_unit: AsyncClient):
        """[EDGE] Pagination with page_size=0 returns validation error."""
        response = await client_unit.get("/api/articles?page_size=0")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_pagination_oversized_page(self, client_unit: AsyncClient):
        """[EDGE] Pagination with page_size > max returns validation error."""
        response = await client_unit.get("/api/articles?page_size=1000")
        assert response.status_code == 422  # max is 100

    @pytest.mark.asyncio
    async def test_invalid_uuid_format(self, client_unit: AsyncClient):
        """[EDGE] Invalid UUID format returns 422."""
        response = await client_unit.get("/api/articles/not-a-uuid")
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════
# SEARCH API - VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════

class TestSearchValidation:
    """Tests for search API input validation."""

    @pytest.mark.asyncio
    async def test_search_missing_query(self, client_unit: AsyncClient):
        """[EDGE] Search without query field returns validation error."""
        response = await client_unit.post("/api/search", json={"mode": "keyword"})
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════
# AUTH API - TESTS
# ═══════════════════════════════════════════════════════════════

class TestAuthAPI:
    """Tests for authentication API."""

    @pytest.mark.asyncio
    async def test_get_me_returns_user(self, client_unit: AsyncClient):
        """[NORMAL] Get current user returns user info."""
        response = await client_unit.get("/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "api_key" in data


# ═══════════════════════════════════════════════════════════════
# TAGS API - VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════

class TestTagsValidation:
    """Tests for tags API validation."""

    @pytest.mark.asyncio
    async def test_empty_tag_name(self, client_unit: AsyncClient):
        """[EDGE] Empty tag name returns 404."""
        response = await client_unit.get("/api/tags//articles")
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════
# GRAPH API - VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════

class TestGraphValidation:
    """Tests for graph API validation."""

    @pytest.mark.asyncio
    async def test_subgraph_invalid_uuid(self, client_unit: AsyncClient):
        """[EDGE] Subgraph with invalid UUID returns 422."""
        response = await client_unit.get("/api/graph/article/not-a-uuid")
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════
# READ LATER API - VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════

class TestReadLaterValidation:
    """Tests for read later API validation."""

    @pytest.mark.asyncio
    async def test_toggle_invalid_uuid(self, client_unit: AsyncClient):
        """[EDGE] Toggle read later with invalid UUID returns 422."""
        response = await client_unit.patch("/api/articles/not-a-uuid/read-later")
        assert response.status_code == 422
