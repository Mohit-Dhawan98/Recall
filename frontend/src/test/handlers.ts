import { http, HttpResponse } from 'msw'
import {
  mockArticle,
  mockArticleListResponse,
  mockTags,
  mockSearchResponse,
  mockGraphResponse,
} from './fixtures'

const API_URL = 'http://localhost:8000'

export const handlers = [
  // GET /api/articles - List articles
  http.get(`${API_URL}/api/articles`, () => {
    return HttpResponse.json(mockArticleListResponse)
  }),

  // POST /api/articles - Capture article
  http.post(`${API_URL}/api/articles`, async () => {
    return HttpResponse.json(
      { id: 'new-article-id', message: 'Article captured', status: 'processing' },
      { status: 201 }
    )
  }),

  // GET /api/articles/:id - Get single article
  http.get(`${API_URL}/api/articles/:id`, ({ params }) => {
    return HttpResponse.json({ ...mockArticle, id: params.id as string })
  }),

  // PATCH /api/articles/:id - Update article
  http.patch(`${API_URL}/api/articles/:id`, async ({ request, params }) => {
    const updates = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockArticle, id: params.id as string, ...updates })
  }),

  // DELETE /api/articles/:id - Delete article
  http.delete(`${API_URL}/api/articles/:id`, () => {
    return HttpResponse.json({ message: 'Article deleted' })
  }),

  // PATCH /api/articles/:id/read-later - Toggle read later
  http.patch(`${API_URL}/api/articles/:id/read-later`, () => {
    return HttpResponse.json({ is_read_later: true })
  }),

  // POST /api/search - Search articles
  http.post(`${API_URL}/api/search`, () => {
    return HttpResponse.json(mockSearchResponse)
  }),

  // GET /api/tags - Get tags
  http.get(`${API_URL}/api/tags`, () => {
    return HttpResponse.json(mockTags)
  }),

  // GET /api/graph - Get knowledge graph
  http.get(`${API_URL}/api/graph`, () => {
    return HttpResponse.json(mockGraphResponse)
  }),

  // GET /api/graph/article/:id - Get article graph
  http.get(`${API_URL}/api/graph/article/:id`, () => {
    return HttpResponse.json(mockGraphResponse)
  }),

  // GET /api/read-later - Get read later list
  http.get(`${API_URL}/api/read-later`, () => {
    return HttpResponse.json({
      articles: mockArticleListResponse.articles.filter(a => a.is_read_later),
      total: 1,
    })
  }),

  // GET /api/auth/me - Get current user
  http.get(`${API_URL}/api/auth/me`, () => {
    return HttpResponse.json({ id: 'user-1', email: 'test@example.com', api_key: 'test-api-key' })
  }),

  // POST /api/auth/api-key - Generate new API key
  http.post(`${API_URL}/api/auth/api-key`, () => {
    return HttpResponse.json({ api_key: 'new-test-api-key' })
  }),
]
