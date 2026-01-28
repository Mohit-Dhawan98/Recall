from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models import Article, Tag, User
from app.schemas import TagListResponse, TagSummary, ArticleListResponse, ArticleResponse, TagResponse, EntityResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=TagListResponse)
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tags with counts."""
    # Get tag counts for user's articles
    stmt = (
        select(
            Tag.domain,
            Tag.topic,
            func.count(Tag.id).label('count')
        )
        .join(Article, Tag.article_id == Article.id)
        .where(Article.user_id == current_user.id)
        .group_by(Tag.domain, Tag.topic)
        .order_by(func.count(Tag.id).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    tags = []
    for row in rows:
        domain, topic, count = row
        if topic:
            tag_str = f"{domain}:{topic}"
        else:
            tag_str = domain
        tags.append(TagSummary(tag=tag_str, count=count))

    return TagListResponse(tags=tags)


@router.get("/{tag}/articles", response_model=ArticleListResponse)
async def get_articles_by_tag(
    tag: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get articles with a specific tag."""
    # Parse tag (domain:topic format)
    parts = tag.split(":")
    domain = parts[0]
    topic = parts[1] if len(parts) > 1 else None

    # Build subquery for articles with this tag
    tag_subquery = select(Tag.article_id).where(Tag.domain == domain)
    if topic:
        tag_subquery = tag_subquery.where(Tag.topic == topic)

    # Get articles
    stmt = (
        select(Article)
        .where(and_(
            Article.user_id == current_user.id,
            Article.id.in_(tag_subquery)
        ))
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
        .order_by(Article.captured_at.desc())
    )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    # Apply pagination
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    articles = result.scalars().all()

    return ArticleListResponse(
        articles=[ArticleResponse(
            id=a.id,
            url=a.url,
            title=a.title,
            author=a.author,
            source_domain=a.source_domain,
            published_at=a.published_at,
            captured_at=a.captured_at,
            content_type=a.content_type,
            word_count=a.word_count,
            read_time_seconds=a.read_time_seconds,
            language=a.language,
            summary=a.summary,
            key_quotes=a.key_quotes or [],
            capture_source=a.capture_source,
            status=a.status,
            is_read_later=a.is_read_later,
            importance=a.importance,
            user_notes=a.user_notes,
            processing_status=a.processing_status,
            tags=[TagResponse(
                domain=t.domain,
                topic=t.topic,
                entity=t.entity,
                source=t.source
            ) for t in a.tags],
            entities=[EntityResponse(
                entity=e.entity,
                entity_type=e.entity_type
            ) for e in a.entities]
        ) for a in articles],
        total=total,
        page=page,
        page_size=page_size
    )
