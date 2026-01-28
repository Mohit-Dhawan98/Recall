from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.models import User
from app.schemas import GraphResponse, GraphNode, GraphEdge
from app.services.graph import get_article_graph, get_full_graph
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("", response_model=GraphResponse)
async def get_graph(
    max_nodes: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the full knowledge graph."""
    articles, relations = await get_full_graph(db, current_user.id, max_nodes)

    nodes = []
    for article in articles:
        tag_strs = []
        for tag in article.tags:
            if tag.topic:
                tag_strs.append(f"{tag.domain}:{tag.topic}")
            else:
                tag_strs.append(tag.domain)

        nodes.append(GraphNode(
            id=article.id,
            title=article.title,
            source_domain=article.source_domain,
            captured_at=article.captured_at,
            tags=tag_strs
        ))

    edges = [
        GraphEdge(
            source=rel.article_a,
            target=rel.article_b,
            relation_type=rel.relation_type,
            strength=rel.strength
        )
        for rel in relations
    ]

    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/article/{article_id}", response_model=GraphResponse)
async def get_article_subgraph(
    article_id: UUID,
    max_nodes: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get subgraph centered on a specific article (focus mode)."""
    articles, relations = await get_article_graph(
        db, article_id, current_user.id, max_nodes
    )

    nodes = []
    for article in articles:
        tag_strs = []
        for tag in article.tags:
            if tag.topic:
                tag_strs.append(f"{tag.domain}:{tag.topic}")
            else:
                tag_strs.append(tag.domain)

        nodes.append(GraphNode(
            id=article.id,
            title=article.title,
            source_domain=article.source_domain,
            captured_at=article.captured_at,
            tags=tag_strs
        ))

    edges = [
        GraphEdge(
            source=rel.article_a,
            target=rel.article_b,
            relation_type=rel.relation_type,
            strength=rel.strength
        )
        for rel in relations
    ]

    return GraphResponse(nodes=nodes, edges=edges)
