from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, User
from app.schemas import ReadLaterResponse, ArticleResponse, TagResponse, EntityResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/read-later", tags=["read-later"])


@router.get("", response_model=ReadLaterResponse)
async def get_read_later(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get read-later queue."""
    # Get articles marked for read later
    stmt = (
        select(Article)
        .where(and_(
            Article.user_id == current_user.id,
            Article.is_read_later == True
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

    return ReadLaterResponse(
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
        total=total
    )
