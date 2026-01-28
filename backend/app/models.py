from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=True)
    api_key = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    settings = Column(JSONB, default={})

    articles = relationship("Article", back_populates="user", cascade="all, delete-orphan")
    domains = relationship("UserDomain", back_populates="user", cascade="all, delete-orphan")


class Article(Base):
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # URL & Identity
    url = Column(Text, nullable=False)
    url_hash = Column(Text, nullable=False)

    # Metadata
    title = Column(Text, nullable=False)
    author = Column(Text)
    source_domain = Column(Text, nullable=False)
    published_at = Column(DateTime)
    captured_at = Column(DateTime, server_default=func.now())

    # Content Info
    content_type = Column(Text, nullable=False, default="article")
    word_count = Column(Integer)
    read_time_seconds = Column(Integer)
    language = Column(Text, default="en")

    # AI-Generated
    summary = Column(Text)
    key_quotes = Column(JSONB, default=[])

    # User State
    capture_source = Column(Text, nullable=False)
    status = Column(Text, default="unread")
    is_read_later = Column(Boolean, default=False)
    importance = Column(Text, default="normal")
    user_notes = Column(Text)

    # Processing
    processing_status = Column(Text, default="pending")

    __table_args__ = (
        UniqueConstraint("user_id", "url_hash"),
    )

    user = relationship("User", back_populates="articles")
    tags = relationship("Tag", back_populates="article", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="article", cascade="all, delete-orphan")
    embedding = relationship("Embedding", back_populates="article", uselist=False, cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    domain = Column(Text, nullable=False)
    topic = Column(Text)
    entity = Column(Text)
    source = Column(Text, nullable=False, default="ai")
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("article_id", "domain", "topic", "entity"),
    )

    article = relationship("Article", back_populates="tags")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    entity = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("article_id", "entity", "entity_type"),
    )

    article = relationship("Article", back_populates="entities")


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, unique=True)
    embedding = Column(Vector(1536))
    model = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    article = relationship("Article", back_populates="embedding")


class Relation(Base):
    __tablename__ = "relations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    article_a = Column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    article_b = Column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(Text, nullable=False)
    strength = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("article_a", "article_b", "relation_type"),
        CheckConstraint("article_a < article_b"),
        CheckConstraint("strength >= 0 AND strength <= 1"),
    )


class UserDomain(Base):
    __tablename__ = "user_domains"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain = Column(Text, nullable=False)
    auto_suggest = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "domain"),
    )

    user = relationship("User", back_populates="domains")
