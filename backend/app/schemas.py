from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ========== Article Schemas ==========

class ArticleCaptureRequest(BaseModel):
    url: str
    title: Optional[str] = None
    content: Optional[str] = None  # Raw content for processing
    capture_source: str = "extension"  # extension, pwa, telegram


class ArticleUpdateRequest(BaseModel):
    status: Optional[str] = None  # unread, read, archived
    is_read_later: Optional[bool] = None
    importance: Optional[str] = None  # normal, important, reference
    user_notes: Optional[str] = None


class TagResponse(BaseModel):
    domain: str
    topic: Optional[str] = None
    entity: Optional[str] = None
    source: str

    class Config:
        from_attributes = True


class EntityResponse(BaseModel):
    entity: str
    entity_type: str

    class Config:
        from_attributes = True


class ArticleResponse(BaseModel):
    id: UUID
    url: str
    title: str
    author: Optional[str] = None
    source_domain: str
    published_at: Optional[datetime] = None
    captured_at: datetime
    content_type: str
    word_count: Optional[int] = None
    read_time_seconds: Optional[int] = None
    language: str
    summary: Optional[str] = None
    key_quotes: List[str] = []
    capture_source: str
    status: str
    is_read_later: bool
    importance: str
    user_notes: Optional[str] = None
    processing_status: str
    tags: List[TagResponse] = []
    entities: List[EntityResponse] = []

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    articles: List[ArticleResponse]
    total: int
    page: int
    page_size: int


class CaptureResponse(BaseModel):
    id: UUID
    message: str
    status: str


# ========== Search Schemas ==========

class SearchRequest(BaseModel):
    query: str
    mode: str = "hybrid"  # keyword, semantic, hybrid
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    limit: int = 20
    offset: int = 0


class SearchResponse(BaseModel):
    results: List[ArticleResponse]
    total: int
    query: str


# ========== Graph Schemas ==========

class GraphNode(BaseModel):
    id: UUID
    title: str
    source_domain: str
    captured_at: datetime
    tags: List[str] = []


class GraphEdge(BaseModel):
    source: UUID
    target: UUID
    relation_type: str
    strength: float


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# ========== Tag Schemas ==========

class TagSummary(BaseModel):
    tag: str
    count: int


class TagListResponse(BaseModel):
    tags: List[TagSummary]


# ========== Read Later Schemas ==========

class ReadLaterResponse(BaseModel):
    articles: List[ArticleResponse]
    total: int


# ========== User Schemas ==========

class UserResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    api_key: str
    created_at: datetime
    settings: dict = {}

    class Config:
        from_attributes = True


class UserDomainRequest(BaseModel):
    domain: str
    auto_suggest: bool = True


class UserDomainResponse(BaseModel):
    id: UUID
    domain: str
    auto_suggest: bool

    class Config:
        from_attributes = True
