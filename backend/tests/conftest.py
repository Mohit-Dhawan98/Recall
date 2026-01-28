"""
Pytest fixtures for backend tests.

Uses PostgreSQL via testcontainers for accurate database testing.
Falls back to mocked tests if Docker is not available.

Usage:
- Run all tests: pytest tests/
- Run with coverage: pytest tests/ --cov=app
"""

import os
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

# Check Docker availability
DOCKER_AVAILABLE = True
try:
    from testcontainers.postgres import PostgresContainer
except ImportError:
    DOCKER_AVAILABLE = False


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ═══════════════════════════════════════════════════════════════
# POSTGRESQL TEST DATABASE (via testcontainers)
# ═══════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def postgres_container():
    """Start PostgreSQL container for test session."""
    if not DOCKER_AVAILABLE:
        pytest.skip("testcontainers not available")

    with PostgresContainer(
        image="pgvector/pgvector:pg16",
        username="test",
        password="test",
        dbname="recall_test"
    ) as postgres:
        yield postgres


@pytest.fixture(scope="session")
def database_url(postgres_container):
    """Get async database URL from container."""
    # Convert to asyncpg URL
    url = postgres_container.get_connection_url()
    async_url = url.replace("postgresql://", "postgresql+asyncpg://").replace(
        "psycopg2", "asyncpg"
    )
    return async_url


@pytest.fixture(scope="function")
async def test_engine(database_url):
    """Create test database engine and tables."""
    from app.database import Base

    engine = create_async_engine(database_url, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        # Enable pgvector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        yield session


@pytest.fixture(scope="function")
async def test_user(db_session: AsyncSession):
    """Create a test user."""
    from app.models import User

    user = User(
        id=uuid4(),
        email="test@example.com",
        api_key="test-api-key-12345",
        settings={}
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
async def default_user(db_session: AsyncSession):
    """Create the default user."""
    from app.models import User

    user = User(
        api_key="default-api-key",
        settings={}
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
async def test_article(db_session: AsyncSession, test_user):
    """Create a test article."""
    from app.models import Article

    article = Article(
        id=uuid4(),
        user_id=test_user.id,
        url="https://example.com/test-article",
        url_hash="abc123def456",
        title="Test Article Title",
        author="Test Author",
        source_domain="example.com",
        content_type="article",
        word_count=500,
        read_time_seconds=150,
        language="en",
        summary="This is a test article summary.",
        key_quotes=["Quote 1", "Quote 2"],
        capture_source="extension",
        status="unread",
        is_read_later=False,
        importance="normal",
        processing_status="completed"
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article


# ═══════════════════════════════════════════════════════════════
# HTTP CLIENT WITH REAL DATABASE
# ═══════════════════════════════════════════════════════════════

@pytest.fixture(scope="function")
async def client(test_engine, default_user) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with real database."""
    from app.main import app
    from app.database import get_db

    async def override_get_db():
        async_session = async_sessionmaker(
            test_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def authenticated_client(client: AsyncClient, test_user) -> AsyncClient:
    """Client with auth headers."""
    client.headers["X-API-Key"] = test_user.api_key
    return client


# ═══════════════════════════════════════════════════════════════
# MOCK FIXTURES (for tests without Docker)
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_user():
    """Create a mock user."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    user.api_key = "test-api-key-12345"
    user.settings = {}
    user.created_at = "2024-01-01T00:00:00"
    return user


@pytest.fixture
async def client_unit() -> AsyncGenerator[AsyncClient, None]:
    """Create test client with mocked dependencies (no Docker needed)."""
    from app.main import app
    from app.database import get_db
    from app.routers.auth import get_current_user
    from app.models import User

    mock_user = MagicMock(spec=User)
    mock_user.id = uuid4()
    mock_user.email = "test@example.com"
    mock_user.api_key = "default-api-key"
    mock_user.settings = {}
    mock_user.created_at = "2024-01-01T00:00:00"

    async def override_get_db():
        session = AsyncMock()
        yield session

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════
# SAMPLE DATA FIXTURES
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def sample_article_data():
    """Sample article capture data."""
    return {
        "url": "https://example.com/new-article",
        "title": "New Test Article",
        "capture_source": "extension"
    }


@pytest.fixture
def sample_urls():
    """Sample URLs for testing."""
    return {
        "valid": "https://example.com/article",
        "with_tracking": "https://example.com/article?utm_source=twitter",
        "twitter": "https://twitter.com/user/status/12345",
        "youtube": "https://www.youtube.com/watch?v=abc123",
    }
