from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, text
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app.database import get_db
from app.models import Article, Tag, Embedding, User
from app.schemas import SearchRequest, SearchResponse, ArticleResponse, TagResponse, EntityResponse
from app.services.llm import generate_embedding
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search_articles(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search articles using keyword, semantic, or hybrid search."""
    results = []

    if request.mode == "keyword" or request.mode == "hybrid":
        # Full-text search
        keyword_results = await keyword_search(
            db, current_user.id, request.query,
            request.tags, request.status, request.limit
        )
        results.extend(keyword_results)

    if request.mode == "semantic" or request.mode == "hybrid":
        # Semantic search
        semantic_results = await semantic_search(
            db, current_user.id, request.query,
            request.tags, request.status, request.limit
        )

        # Merge results, avoiding duplicates
        existing_ids = {r.id for r in results}
        for result in semantic_results:
            if result.id not in existing_ids:
                results.append(result)
                existing_ids.add(result.id)

    # Apply offset and limit
    results = results[request.offset:request.offset + request.limit]

    return SearchResponse(
        results=results,
        total=len(results),
        query=request.query
    )


async def keyword_search(
    db: AsyncSession,
    user_id,
    query: str,
    tags: Optional[List[str]],
    status: Optional[str],
    limit: int
) -> List[ArticleResponse]:
    """Perform full-text keyword search."""
    # Build the search query using PostgreSQL full-text search
    search_query = func.plainto_tsquery('english', query)

    stmt = (
        select(
            Article,
            func.ts_rank(
                func.to_tsvector('english', func.coalesce(Article.title, '') + ' ' + func.coalesce(Article.summary, '')),
                search_query
            ).label('rank')
        )
        .where(and_(
            Article.user_id == user_id,
            func.to_tsvector('english', func.coalesce(Article.title, '') + ' ' + func.coalesce(Article.summary, '')).op('@@')(search_query)
        ))
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
    )

    # Apply filters
    if status:
        stmt = stmt.where(Article.status == status)

    if tags:
        for tag in tags:
            parts = tag.split(":")
            tag_subquery = select(Tag.article_id).where(Tag.domain == parts[0])
            if len(parts) >= 2 and parts[1]:
                tag_subquery = tag_subquery.where(Tag.topic == parts[1])
            stmt = stmt.where(Article.id.in_(tag_subquery))

    stmt = stmt.order_by(text('rank DESC')).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    return [article_to_response(row[0]) for row in rows]


async def semantic_search(
    db: AsyncSession,
    user_id,
    query: str,
    tags: Optional[List[str]],
    status: Optional[str],
    limit: int
) -> List[ArticleResponse]:
    """Perform semantic/vector search."""
    # Generate embedding for query
    query_embedding = await generate_embedding(query)

    if not query_embedding:
        return []

    # Vector similarity search using pgvector
    # Note: This requires the embedding to be stored
    stmt = (
        select(
            Article,
            Embedding.embedding.cosine_distance(query_embedding).label('distance')
        )
        .join(Embedding, Article.id == Embedding.article_id)
        .where(Article.user_id == user_id)
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
    )

    # Apply filters
    if status:
        stmt = stmt.where(Article.status == status)

    if tags:
        for tag in tags:
            parts = tag.split(":")
            tag_subquery = select(Tag.article_id).where(Tag.domain == parts[0])
            if len(parts) >= 2 and parts[1]:
                tag_subquery = tag_subquery.where(Tag.topic == parts[1])
            stmt = stmt.where(Article.id.in_(tag_subquery))

    # Order by distance (lower is more similar)
    stmt = stmt.order_by(text('distance ASC')).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    return [article_to_response(row[0]) for row in rows]


def article_to_response(article: Article) -> ArticleResponse:
    """Convert Article model to response schema."""
    return ArticleResponse(
        id=article.id,
        url=article.url,
        title=article.title,
        author=article.author,
        source_domain=article.source_domain,
        published_at=article.published_at,
        captured_at=article.captured_at,
        content_type=article.content_type,
        word_count=article.word_count,
        read_time_seconds=article.read_time_seconds,
        language=article.language,
        summary=article.summary,
        key_quotes=article.key_quotes or [],
        capture_source=article.capture_source,
        status=article.status,
        is_read_later=article.is_read_later,
        importance=article.importance,
        user_notes=article.user_notes,
        processing_status=article.processing_status,
        tags=[TagResponse(
            domain=t.domain,
            topic=t.topic,
            entity=t.entity,
            source=t.source
        ) for t in article.tags],
        entities=[EntityResponse(
            entity=e.entity,
            entity_type=e.entity_type
        ) for e in article.entities]
    )
