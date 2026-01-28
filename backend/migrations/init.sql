-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb
);

-- Core article storage
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- URL & Identity
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,

    -- Metadata
    title TEXT NOT NULL,
    author TEXT,
    source_domain TEXT NOT NULL,
    published_at TIMESTAMP,
    captured_at TIMESTAMP DEFAULT NOW(),

    -- Content Info
    content_type TEXT NOT NULL DEFAULT 'article',
    word_count INTEGER,
    read_time_seconds INTEGER,
    language TEXT DEFAULT 'en',

    -- AI-Generated
    summary TEXT,
    key_quotes JSONB DEFAULT '[]'::jsonb,

    -- User State
    capture_source TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    is_read_later BOOLEAN DEFAULT false,
    importance TEXT DEFAULT 'normal',
    user_notes TEXT,

    -- Processing
    processing_status TEXT DEFAULT 'pending',

    UNIQUE(user_id, url_hash)
);

-- Grounded tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    topic TEXT,
    entity TEXT,
    source TEXT NOT NULL DEFAULT 'ai',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(article_id, domain, topic, entity)
);

-- Extracted entities
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    entity TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(article_id, entity, entity_type)
);

-- Embeddings
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID UNIQUE NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    embedding vector(1536),
    model TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Relations (graph edges)
CREATE TABLE IF NOT EXISTS relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_a UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    article_b UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    strength FLOAT NOT NULL CHECK (strength >= 0 AND strength <= 1),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(article_a, article_b, relation_type),
    CHECK(article_a < article_b)
);

-- User domain preferences
CREATE TABLE IF NOT EXISTS user_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    auto_suggest BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_user_captured ON articles(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(url_hash);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_read_later ON articles(user_id, is_read_later) WHERE is_read_later = true;
CREATE INDEX IF NOT EXISTS idx_articles_processing ON articles(processing_status) WHERE processing_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tags_domain_topic ON tags(domain, topic);
CREATE INDEX IF NOT EXISTS idx_tags_article ON tags(article_id);
CREATE INDEX IF NOT EXISTS idx_entities_entity ON entities(entity);
CREATE INDEX IF NOT EXISTS idx_entities_article ON entities(article_id);
CREATE INDEX IF NOT EXISTS idx_relations_articles ON relations(article_a, article_b);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '')));

-- Create default user for simple setup
INSERT INTO users (id, api_key, settings)
VALUES ('00000000-0000-0000-0000-000000000001', 'default-api-key', '{}')
ON CONFLICT (id) DO NOTHING;
