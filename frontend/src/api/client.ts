const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': localStorage.getItem('apiKey') || 'default-api-key',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
}

// Types
export interface Tag {
  domain: string;
  topic?: string;
  entity?: string;
  source: string;
}

export interface Entity {
  entity: string;
  entity_type: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  author?: string;
  source_domain: string;
  published_at?: string;
  captured_at: string;
  content_type: string;
  word_count?: number;
  read_time_seconds?: number;
  language: string;
  summary?: string;
  key_quotes: string[];
  capture_source: string;
  status: string;
  is_read_later: boolean;
  importance: string;
  user_notes?: string;
  processing_status: string;
  tags: Tag[];
  entities: Entity[];
}

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  page_size: number;
}

export interface CaptureResponse {
  id: string;
  message: string;
  status: string;
}

export interface SearchResponse {
  results: Article[];
  total: number;
  query: string;
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface GraphNode {
  id: string;
  title: string;
  source_domain: string;
  captured_at: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  relation_type: string;
  strength: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// API Functions
export const api = {
  // Articles
  captureArticle: (url: string, captureSource = 'pwa') =>
    request<CaptureResponse>('/api/articles', {
      method: 'POST',
      body: { url, capture_source: captureSource },
    }),

  getArticles: (page = 1, pageSize = 20, status?: string, tag?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (status) params.append('status', status);
    if (tag) params.append('tag', tag);
    return request<ArticleListResponse>(`/api/articles?${params}`);
  },

  getArticle: (id: string) => request<Article>(`/api/articles/${id}`),

  updateArticle: (id: string, updates: Partial<Article>) =>
    request<Article>(`/api/articles/${id}`, {
      method: 'PATCH',
      body: updates,
    }),

  deleteArticle: (id: string) =>
    request<{ message: string }>(`/api/articles/${id}`, { method: 'DELETE' }),

  toggleReadLater: (id: string) =>
    request<{ is_read_later: boolean }>(`/api/articles/${id}/read-later`, {
      method: 'PATCH',
    }),

  // Search
  search: (query: string, mode = 'hybrid', tags?: string[], limit = 20) =>
    request<SearchResponse>('/api/search', {
      method: 'POST',
      body: { query, mode, tags, limit },
    }),

  // Tags
  getTags: () => request<{ tags: TagSummary[] }>('/api/tags'),

  // Graph
  getGraph: (maxNodes = 100) =>
    request<GraphResponse>(`/api/graph?max_nodes=${maxNodes}`),

  getArticleGraph: (articleId: string, maxNodes = 20) =>
    request<GraphResponse>(`/api/graph/article/${articleId}?max_nodes=${maxNodes}`),

  // Read Later
  getReadLater: (page = 1, pageSize = 20) =>
    request<{ articles: Article[]; total: number }>(
      `/api/read-later?page=${page}&page_size=${pageSize}`
    ),

  // Auth
  getMe: () => request<{ id: string; email?: string; api_key: string }>('/api/auth/me'),

  generateApiKey: () =>
    request<{ api_key: string }>('/api/auth/api-key', { method: 'POST' }),
};

export default api;
