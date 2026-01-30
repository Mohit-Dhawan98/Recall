import type {
  Article,
  ArticleListResponse,
  TagSummary,
  SearchResponse,
  GraphResponse,
} from '@/api/client'

export const mockArticle: Article = {
  id: 'article-1',
  url: 'https://example.com/deep-learning-transformers',
  title: 'Understanding Deep Learning Transformers',
  author: 'Jane Smith',
  source_domain: 'example.com',
  published_at: '2024-01-15T10:00:00Z',
  captured_at: '2024-01-16T08:30:00Z',
  content_type: 'article',
  word_count: 2500,
  read_time_seconds: 600,
  language: 'en',
  summary: 'A comprehensive overview of transformer architecture and its applications in modern deep learning systems.',
  key_quotes: [
    'Attention is all you need remains the foundational insight.',
    'Self-attention enables parallel processing of sequence data.',
  ],
  capture_source: 'telegram',
  status: 'active',
  is_read_later: false,
  importance: 'normal',
  user_notes: undefined,
  processing_status: 'completed',
  tags: [
    { domain: 'technology', topic: 'machine-learning', source: 'llm' },
    { domain: 'science', topic: 'research', source: 'llm' },
  ],
  entities: [
    { entity: 'Transformer', entity_type: 'concept' },
    { entity: 'Deep Learning', entity_type: 'field' },
  ],
}

export const mockArticleProcessing: Article = {
  id: 'article-processing',
  url: 'https://example.com/pending-article',
  title: 'Pending Article Title',
  source_domain: 'example.com',
  captured_at: '2024-01-20T12:00:00Z',
  content_type: 'article',
  language: 'en',
  key_quotes: [],
  capture_source: 'pwa',
  status: 'active',
  is_read_later: false,
  importance: 'normal',
  processing_status: 'pending',
  tags: [],
  entities: [],
}

const mockArticle2: Article = {
  id: 'article-2',
  url: 'https://blog.example.com/rust-memory-safety',
  title: 'Rust and Memory Safety',
  author: 'John Doe',
  source_domain: 'blog.example.com',
  published_at: '2024-01-10T14:00:00Z',
  captured_at: '2024-01-11T09:00:00Z',
  content_type: 'article',
  word_count: 1800,
  read_time_seconds: 420,
  language: 'en',
  summary: 'An introduction to how Rust achieves memory safety without a garbage collector.',
  key_quotes: ['Ownership is the key innovation in Rust.'],
  capture_source: 'pwa',
  status: 'active',
  is_read_later: true,
  importance: 'high',
  processing_status: 'completed',
  tags: [
    { domain: 'technology', topic: 'programming', source: 'llm' },
  ],
  entities: [
    { entity: 'Rust', entity_type: 'language' },
  ],
}

const mockArticle3: Article = {
  id: 'article-3',
  url: 'https://news.example.com/climate-report-2024',
  title: 'Climate Report 2024: Key Findings',
  source_domain: 'news.example.com',
  published_at: '2024-01-18T08:00:00Z',
  captured_at: '2024-01-18T10:00:00Z',
  content_type: 'article',
  word_count: 3200,
  read_time_seconds: 780,
  language: 'en',
  summary: 'Summary of the latest climate report with key findings on global temperature trends.',
  key_quotes: [],
  capture_source: 'telegram',
  status: 'active',
  is_read_later: false,
  importance: 'normal',
  processing_status: 'completed',
  tags: [
    { domain: 'science', topic: 'climate', source: 'llm' },
    { domain: 'news', source: 'llm' },
  ],
  entities: [
    { entity: 'IPCC', entity_type: 'organization' },
  ],
}

export const mockArticles: Article[] = [mockArticle, mockArticle2, mockArticle3]

export const mockArticleListResponse: ArticleListResponse = {
  articles: mockArticles,
  total: 3,
  page: 1,
  page_size: 20,
}

export const mockEmptyArticleListResponse: ArticleListResponse = {
  articles: [],
  total: 0,
  page: 1,
  page_size: 20,
}

export const mockTags: { tags: TagSummary[] } = {
  tags: [
    { tag: 'technology', count: 5 },
    { tag: 'science', count: 3 },
    { tag: 'programming', count: 2 },
    { tag: 'news', count: 1 },
  ],
}

export const mockSearchResponse: SearchResponse = {
  results: [mockArticle, mockArticle2],
  total: 2,
  query: 'deep learning',
}

export const mockEmptySearchResponse: SearchResponse = {
  results: [],
  total: 0,
  query: 'nonexistent query',
}

export const mockGraphResponse: GraphResponse = {
  nodes: [
    {
      id: 'article-1',
      title: 'Understanding Deep Learning Transformers',
      source_domain: 'example.com',
      captured_at: '2024-01-16T08:30:00Z',
      tags: ['technology', 'science'],
    },
    {
      id: 'article-2',
      title: 'Rust and Memory Safety',
      source_domain: 'blog.example.com',
      captured_at: '2024-01-11T09:00:00Z',
      tags: ['technology'],
    },
    {
      id: 'article-3',
      title: 'Climate Report 2024: Key Findings',
      source_domain: 'news.example.com',
      captured_at: '2024-01-18T10:00:00Z',
      tags: ['science', 'news'],
    },
  ],
  edges: [
    {
      source: 'article-1',
      target: 'article-2',
      relation_type: 'shared_tag',
      strength: 0.7,
    },
    {
      source: 'article-1',
      target: 'article-3',
      relation_type: 'shared_tag',
      strength: 0.5,
    },
  ],
}

export const mockEmptyGraphResponse: GraphResponse = {
  nodes: [],
  edges: [],
}

export const mockArticleWithNotes: Article = {
  ...mockArticle,
  id: 'article-with-notes',
  user_notes: 'This is a great article about transformers. Need to revisit the attention mechanism section.',
}

export const mockArticleWithQuotes: Article = {
  ...mockArticle,
  id: 'article-with-quotes',
  key_quotes: [
    'Attention is all you need remains the foundational insight.',
    'Self-attention enables parallel processing of sequence data.',
    'The transformer architecture has revolutionized NLP.',
    'Multi-head attention allows the model to jointly attend to information from different representation subspaces.',
  ],
}
