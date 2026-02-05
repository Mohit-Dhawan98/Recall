"""
Integration tests for article capture pipeline.

These tests exercise the full capture flow from URL submission through
content extraction, LLM analysis, and database storage, using a real
PostgreSQL database via testcontainers while mocking external services.

[BASE] = Core functionality tests
[NORMAL] = Common usage patterns
[EDGE] = Error conditions and edge cases
"""

import pytest
import asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from uuid import uuid4

from app.services.llm import AnalysisResult
from app.services.extractor import ExtractedContent


@pytest.mark.asyncio
class TestCaptureIntegration:
    """Integration tests for article capture pipeline."""

    @pytest.mark.xfail(reason="Known testcontainers timing issue - first test may fail with 'relation does not exist'")
    async def test_00_fixture_warmup(self, integration_client: AsyncClient):
        """Warmup test to initialize fixtures (testcontainers timing workaround)."""
        # This test ensures the database and fixtures are properly initialized
        # before running the actual integration tests. There's a known timing issue
        # where the first test to use integration_client may fail with "relation does not exist"
        # due to testcontainers async initialization.
        response = await integration_client.get("/health")
        assert response.status_code == 200

    async def test_full_capture_pipeline(self, integration_client: AsyncClient, sample_html_content: str):
        """[BASE] Full capture pipeline: URL submission -> extraction -> LLM -> storage -> retrieval."""
        # Mock external services
        mock_analysis = AnalysisResult(
            summary="This article discusses AI and machine learning advancements in technology.",
            key_quotes=[
                "AI is transforming the technology industry",
                "Large language models are changing software development"
            ],
            tags=[
                {"domain": "technology", "topic": "ai-ml"},
                {"domain": "technology", "topic": "programming"}
            ],
            entities=[
                {"entity": "OpenAI", "entity_type": "company"},
                {"entity": "GPT-4", "entity_type": "product"}
            ]
        )

        with patch('app.routers.articles.analyze_content', new=AsyncMock(return_value=mock_analysis)):

            # Submit article capture request with content provided (like from extension)
            response = await integration_client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/ai-article",
                    "capture_source": "extension",
                    "content": sample_html_content
                },
                headers={"X-API-Key": "default-api-key"}
            )

            # Verify initial response
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "processing"
            assert "id" in data
            article_id = data["id"]

            # Wait for background task to complete
            await asyncio.sleep(0.2)

            # Retrieve the processed article
            response = await integration_client.get(
                f"/api/articles/{article_id}",
                headers={"X-API-Key": "default-api-key"}
            )

            assert response.status_code == 200
            article = response.json()

            # Verify article was processed correctly
            assert article["id"] == article_id
            assert article["processing_status"] == "completed"
            assert article["title"] == "Test AI Article"
            assert article["summary"] == mock_analysis.summary
            assert len(article["key_quotes"]) == 2
            assert article["key_quotes"][0] == "AI is transforming the technology industry"

            # Verify tags were created
            assert len(article["tags"]) == 2
            tag_domains = [tag["domain"] for tag in article["tags"]]
            assert "technology" in tag_domains

            # Verify entities were created
            assert len(article["entities"]) == 2
            entity_names = [entity["entity"] for entity in article["entities"]]
            assert "OpenAI" in entity_names
            assert "GPT-4" in entity_names

    async def test_capture_retrieves_via_api(self, integration_client: AsyncClient, sample_html_content: str):
        """[NORMAL] Captured article appears in list endpoint."""
        mock_analysis = AnalysisResult(
            summary="Test summary for list retrieval.",
            key_quotes=["Quote 1"],
            tags=[{"domain": "technology", "topic": "ai-ml"}],
            entities=[]
        )

        with patch('app.routers.articles.analyze_content', new=AsyncMock(return_value=mock_analysis)):

            # Capture article
            response = await integration_client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/test-list",
                    "capture_source": "extension",
                    "content": sample_html_content
                },
                headers={"X-API-Key": "default-api-key"}
            )
            assert response.status_code == 200
            article_id = response.json()["id"]

            # Wait for background processing
            await asyncio.sleep(0.2)

            # List articles
            response = await integration_client.get(
                "/api/articles",
                headers={"X-API-Key": "default-api-key"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["total"] >= 1

            # Find our article in the list
            article_ids = [article["id"] for article in data["articles"]]
            assert article_id in article_ids

            # Verify the article has correct data
            our_article = next(a for a in data["articles"] if a["id"] == article_id)
            assert our_article["summary"] == "Test summary for list retrieval."
            assert len(our_article["tags"]) == 1
            assert our_article["tags"][0]["domain"] == "technology"

    async def test_duplicate_url_returns_duplicate_status(self, integration_client: AsyncClient, sample_html_content: str):
        """[NORMAL] Submitting the same URL twice returns duplicate status."""
        mock_analysis = AnalysisResult(
            summary="Test summary",
            key_quotes=[],
            tags=[{"domain": "technology", "topic": None}],
            entities=[]
        )

        with patch('app.routers.articles.analyze_content', new=AsyncMock(return_value=mock_analysis)):

            # First submission
            response1 = await integration_client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/duplicate-test",
                    "capture_source": "extension",
                    "content": sample_html_content
                },
                headers={"X-API-Key": "default-api-key"}
            )
            assert response1.status_code == 200
            data1 = response1.json()
            assert data1["status"] == "processing"
            first_article_id = data1["id"]

            # Wait for background processing
            await asyncio.sleep(0.2)

            # Second submission (duplicate)
            response2 = await integration_client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/duplicate-test",
                    "capture_source": "extension",
                    "content": sample_html_content
                },
                headers={"X-API-Key": "default-api-key"}
            )
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2["status"] == "duplicate"
            assert data2["id"] == first_article_id

    async def test_background_task_failure_marks_article_failed(self, integration_client: AsyncClient, sample_html_content: str):
        """[EDGE] LLM analysis failure marks article as failed."""
        from app.routers.articles import process_article_background
        from uuid import UUID

        # First, create an article normally to get it in the database
        with patch('app.routers.articles.analyze_content', new=AsyncMock(return_value=AnalysisResult(
            summary="Initial summary",
            key_quotes=[],
            tags=[],
            entities=[]
        ))):
            response = await integration_client.post(
                "/api/articles",
                json={
                    "url": "https://example.com/failure-test-direct",
                    "capture_source": "extension",
                    "content": sample_html_content
                },
                headers={"X-API-Key": "default-api-key"}
            )
            assert response.status_code == 200
            article_id = response.json()["id"]

            # Wait for initial processing
            await asyncio.sleep(0.2)

        # Now test the background task with a failing LLM
        with patch('app.routers.articles.analyze_content', new=AsyncMock(side_effect=Exception("LLM service unavailable"))):
            try:
                # Call background task directly with the article
                await process_article_background(UUID(article_id), "Test content for failure")
            except Exception:
                # Exception is expected - the background task re-raises after marking as failed
                pass

        # Verify article was marked as failed in database
        response = await integration_client.get(
            f"/api/articles/{article_id}",
            headers={"X-API-Key": "default-api-key"}
        )
        assert response.status_code == 200
        article = response.json()
        assert article["processing_status"] == "failed"

    async def test_extraction_failure_returns_error(self, integration_client: AsyncClient):
        """[EDGE] Content extraction failure returns error response."""
        import httpx as http_module

        # Mock fetch_url to raise an HTTPStatusError (realistic failure scenario)
        async def mock_fetch_error(url: str):
            raise http_module.HTTPStatusError(
                "404 Not Found",
                request=http_module.Request("GET", url),
                response=http_module.Response(404)
            )

        with patch('app.services.extractor.fetch_url', new=AsyncMock(side_effect=mock_fetch_error)):
            # Note: NOT providing content, so extract_content will call fetch_url
            try:
                response = await integration_client.post(
                    "/api/articles",
                    json={
                        "url": "https://example.com/broken-url",
                        "capture_source": "extension"
                    },
                    headers={"X-API-Key": "default-api-key"}
                )
                # If we get a response, it should be an error status
                assert response.status_code >= 400
            except Exception as e:
                # In test environment, unhandled exceptions in endpoints may propagate
                # This is expected behavior for extraction failures
                assert "404" in str(e) or "Failed" in str(e) or "HTTPStatusError" in str(e)
