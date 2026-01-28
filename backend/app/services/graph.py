from typing import List, Dict, Set, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
import numpy as np

from app.models import Article, Tag, Entity, Embedding, Relation


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


async def build_relations_for_article(
    db: AsyncSession,
    new_article: Article,
    user_id: UUID
) -> List[Dict]:
    """Build relations between new article and existing articles."""
    # Get new article's tags, entities, and embedding
    new_tags: Set[Tuple[str, str]] = set()
    for tag in new_article.tags:
        new_tags.add((tag.domain, tag.topic or ""))

    new_entities: Set[str] = set()
    for entity in new_article.entities:
        new_entities.add(entity.entity.lower())

    new_embedding = None
    if new_article.embedding and new_article.embedding.embedding:
        new_embedding = new_article.embedding.embedding

    # Get existing articles with their tags, entities, and embeddings
    stmt = (
        select(Article)
        .where(and_(
            Article.user_id == user_id,
            Article.id != new_article.id
        ))
        .options(
            selectinload(Article.tags),
            selectinload(Article.entities),
            selectinload(Article.embedding)
        )
        .order_by(Article.captured_at.desc())
        .limit(100)  # Only check recent 100 articles for efficiency
    )

    result = await db.execute(stmt)
    existing_articles = result.scalars().all()

    relations = []

    for existing in existing_articles:
        article_relations = []

        # Get existing article's data
        existing_tags: Set[Tuple[str, str]] = set()
        for tag in existing.tags:
            existing_tags.add((tag.domain, tag.topic or ""))

        existing_entities: Set[str] = set()
        for entity in existing.entities:
            existing_entities.add(entity.entity.lower())

        # SAME_TOPIC: Share 2+ tags
        shared_tags = new_tags & existing_tags
        if len(shared_tags) >= 2:
            strength = len(shared_tags) / max(len(new_tags), len(existing_tags), 1)
            article_relations.append({
                "type": "SAME_TOPIC",
                "strength": min(strength, 1.0)
            })

        # SAME_AUTHOR: Same author/publication
        if (new_article.author and existing.author and
            new_article.author.lower() == existing.author.lower()):
            article_relations.append({
                "type": "SAME_AUTHOR",
                "strength": 1.0
            })

        # SAME_DOMAIN: Same source website
        if new_article.source_domain == existing.source_domain:
            article_relations.append({
                "type": "SAME_DOMAIN",
                "strength": 0.5
            })

        # SAME_ENTITY: Mention same company/person/product
        shared_entities = new_entities & existing_entities
        if shared_entities:
            strength = len(shared_entities) / 5  # Normalize to max of 5 entities
            article_relations.append({
                "type": "SAME_ENTITY",
                "strength": min(strength, 1.0)
            })

        # SIMILAR: High embedding similarity
        if new_embedding and existing.embedding and existing.embedding.embedding:
            similarity = cosine_similarity(
                list(new_embedding),
                list(existing.embedding.embedding)
            )
            if similarity > 0.8:
                article_relations.append({
                    "type": "SIMILAR",
                    "strength": similarity
                })

        # Add relations with proper ordering (article_a < article_b)
        for rel in article_relations:
            if str(new_article.id) < str(existing.id):
                article_a, article_b = new_article.id, existing.id
            else:
                article_a, article_b = existing.id, new_article.id

            relations.append({
                "article_a": article_a,
                "article_b": article_b,
                "relation_type": rel["type"],
                "strength": rel["strength"]
            })

    return relations


async def save_relations(
    db: AsyncSession,
    relations: List[Dict],
    user_id: UUID
):
    """Save relations to database, updating existing ones if needed."""
    for rel in relations:
        # Check if relation already exists
        stmt = select(Relation).where(and_(
            Relation.article_a == rel["article_a"],
            Relation.article_b == rel["article_b"],
            Relation.relation_type == rel["relation_type"]
        ))
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update strength if higher
            if rel["strength"] > existing.strength:
                existing.strength = rel["strength"]
        else:
            # Create new relation
            new_relation = Relation(
                user_id=user_id,
                article_a=rel["article_a"],
                article_b=rel["article_b"],
                relation_type=rel["relation_type"],
                strength=rel["strength"]
            )
            db.add(new_relation)

    await db.commit()


async def get_article_graph(
    db: AsyncSession,
    article_id: UUID,
    user_id: UUID,
    max_nodes: int = 20
) -> Tuple[List[Article], List[Relation]]:
    """Get subgraph centered on an article (focus mode)."""
    # Get relations involving this article
    stmt = select(Relation).where(and_(
        Relation.user_id == user_id,
        or_(
            Relation.article_a == article_id,
            Relation.article_b == article_id
        )
    )).order_by(Relation.strength.desc()).limit(max_nodes - 1)

    result = await db.execute(stmt)
    relations = result.scalars().all()

    # Collect related article IDs
    related_ids = {article_id}
    for rel in relations:
        related_ids.add(rel.article_a)
        related_ids.add(rel.article_b)

    # Fetch articles
    stmt = (
        select(Article)
        .where(Article.id.in_(related_ids))
        .options(selectinload(Article.tags))
    )
    result = await db.execute(stmt)
    articles = result.scalars().all()

    return articles, relations


async def get_full_graph(
    db: AsyncSession,
    user_id: UUID,
    max_nodes: int = 100
) -> Tuple[List[Article], List[Relation]]:
    """Get full user graph (with limits)."""
    # Get recent articles
    stmt = (
        select(Article)
        .where(Article.user_id == user_id)
        .options(selectinload(Article.tags))
        .order_by(Article.captured_at.desc())
        .limit(max_nodes)
    )
    result = await db.execute(stmt)
    articles = result.scalars().all()

    article_ids = [a.id for a in articles]

    # Get relations between these articles
    if len(article_ids) > 1:
        stmt = select(Relation).where(and_(
            Relation.user_id == user_id,
            Relation.article_a.in_(article_ids),
            Relation.article_b.in_(article_ids)
        ))
        result = await db.execute(stmt)
        relations = result.scalars().all()
    else:
        relations = []

    return articles, relations
