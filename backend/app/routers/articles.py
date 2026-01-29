from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID

from app.database import get_db, AsyncSessionLocal
from app.models import Article, Tag, Entity, Embedding, User
from app.schemas import (
    ArticleCaptureRequest, ArticleResponse, ArticleListResponse,
    ArticleUpdateRequest, CaptureResponse, TagResponse, EntityResponse
)
from app.services.extractor import extract_content, hash_url
from app.services.llm import analyze_content, generate_embedding
from app.services.graph import build_relations_for_article, save_relations
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/articles", tags=["articles"])


async def process_article_background(article_id: UUID, content: str):
    """Background task to process article with LLM.

    Args:
        article_id: UUID of the article to process
        content: Extracted article content (passed as primitive string, not ORM object)
    """
    async with AsyncSessionLocal() as db:
        try:
            # Fetch article
            stmt = (
                select(Article)
                .where(Article.id == article_id)
                .options(
                    selectinload(Article.tags),
                    selectinload(Article.entities),
                    selectinload(Article.embedding)
                )
            )
            result = await db.execute(stmt)
            article = result.scalar_one_or_none()

            if not article:
                return

            # Analyze content
            analysis = await analyze_content(article.title, content, article.source_domain)

            # Update article
            article.summary = analysis.summary
            article.key_quotes = analysis.key_quotes
            article.processing_status = "completed"

            # Add tags
            for tag_data in analysis.tags:
                tag = Tag(
                    article_id=article.id,
                    domain=tag_data["domain"],
                    topic=tag_data.get("topic"),
                    entity=tag_data.get("entity"),
                    source="ai"
                )
                db.add(tag)

            # Add entities
            for entity_data in analysis.entities:
                entity = Entity(
                    article_id=article.id,
                    entity=entity_data["entity"],
                    entity_type=entity_data["entity_type"]
                )
                db.add(entity)

            await db.commit()

            # Generate embedding
            embedding_text = f"{title}\n\n{analysis.summary}"
            embedding_vector = await generate_embedding(embedding_text)

            if embedding_vector:
                embedding = Embedding(
                    article_id=article.id,
                    embedding=embedding_vector,
                    model="deepseek"
                )
                db.add(embedding)
                await db.commit()

            # Refresh article to get updated relations
            await db.refresh(article)

            # Build relations
            relations = await build_relations_for_article(db, article, article.user_id)
            if relations:
                await save_relations(db, relations, article.user_id)

        except Exception as e:
            # Mark as failed
            if article:
                article.processing_status = "failed"
                await db.commit()
            raise e


@router.post("", response_model=CaptureResponse)
async def capture_article(
    request: ArticleCaptureRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new article."""
    from app.config import get_settings
    settings = get_settings()

    # Check for duplicate
    url_hash = hash_url(request.url)
    stmt = select(Article).where(and_(
        Article.user_id == current_user.id,
        Article.url_hash == url_hash
    ))
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return CaptureResponse(
            id=existing.id,
            message="Article already saved",
            status="duplicate"
        )

    # Extract content
    extracted = await extract_content(request.url, request.content)

    # Create article
    article = Article(
        user_id=current_user.id,
        url=extracted.url,
        url_hash=extracted.url_hash,
        title=request.title or extracted.title,
        author=extracted.author,
        source_domain=extracted.source_domain,
        word_count=extracted.word_count,
        read_time_seconds=extracted.word_count // 200 * 60 if extracted.word_count else None,
        content_type=extracted.content_type,
        language=extracted.language,
        capture_source=request.capture_source,
        processing_status="pending"
    )

    db.add(article)
    await db.commit()
    await db.refresh(article)

    # Process in background
    background_tasks.add_task(process_article_background, article.id, extracted.content)

    return CaptureResponse(
        id=article.id,
        message="Article saved, processing...",
        status="processing"
    )


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List articles with pagination and filtering."""
    # Base query
    stmt = (
        select(Article)
        .where(Article.user_id == current_user.id)
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
    )

    # Apply filters
    if status:
        stmt = stmt.where(Article.status == status)

    if tag:
        # Filter by tag (domain:topic format)
        parts = tag.split(":")
        if len(parts) >= 1:
            tag_subquery = select(Tag.article_id).where(Tag.domain == parts[0])
            if len(parts) >= 2 and parts[1]:
                tag_subquery = tag_subquery.where(Tag.topic == parts[1])
            stmt = stmt.where(Article.id.in_(tag_subquery))

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    # Apply pagination and ordering
    stmt = stmt.order_by(Article.captured_at.desc())
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


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single article by ID."""
    stmt = (
        select(Article)
        .where(and_(
            Article.id == article_id,
            Article.user_id == current_user.id
        ))
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
    )
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

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


@router.patch("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: UUID,
    request: ArticleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update article status, notes, etc."""
    stmt = (
        select(Article)
        .where(and_(
            Article.id == article_id,
            Article.user_id == current_user.id
        ))
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities)
        )
    )
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Update fields
    if request.status is not None:
        article.status = request.status
    if request.is_read_later is not None:
        article.is_read_later = request.is_read_later
    if request.importance is not None:
        article.importance = request.importance
    if request.user_notes is not None:
        article.user_notes = request.user_notes

    await db.commit()
    await db.refresh(article)

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


@router.delete("/{article_id}")
async def delete_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an article."""
    stmt = select(Article).where(and_(
        Article.id == article_id,
        Article.user_id == current_user.id
    ))
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await db.delete(article)
    await db.commit()

    return {"message": "Article deleted"}


@router.patch("/{article_id}/read-later")
async def toggle_read_later(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle read-later status."""
    stmt = select(Article).where(and_(
        Article.id == article_id,
        Article.user_id == current_user.id
    ))
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.is_read_later = not article.is_read_later
    await db.commit()

    return {"is_read_later": article.is_read_later}
