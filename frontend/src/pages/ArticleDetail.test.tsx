import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '../test/test-utils'
import { server } from '../test/setup'
import { http, HttpResponse } from 'msw'
import {
  mockArticle,
  mockArticleProcessing,
  mockArticleWithNotes,
  mockArticleWithQuotes,
} from '../test/fixtures'
import ArticleDetail from './ArticleDetail'

const API_URL = 'http://localhost:8000'

function renderArticleDetail(id = 'article-1') {
  return renderWithProviders(<ArticleDetail />, {
    initialEntries: [`/article/${id}`],
    path: '/article/:id',
  })
}

describe('ArticleDetail', () => {
  // ─── Loading and Display ───────────────────────────────────────────

  describe('Loading and Display', () => {
    it('shows loading spinner initially', () => {
      renderArticleDetail()
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('displays article title after loading', async () => {
      renderArticleDetail()
      expect(
        await screen.findByText('Understanding Deep Learning Transformers')
      ).toBeInTheDocument()
    })

    it('displays article summary', async () => {
      renderArticleDetail()
      expect(
        await screen.findByText(mockArticle.summary!)
      ).toBeInTheDocument()
    })

    it('shows source_domain metadata', async () => {
      renderArticleDetail()
      expect(await screen.findByText('example.com')).toBeInTheDocument()
    })

    it('shows author metadata', async () => {
      renderArticleDetail()
      expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    })

    it('shows relative time metadata', async () => {
      renderArticleDetail()
      // captured_at is '2024-01-16T08:30:00Z', formatDistanceToNow will produce a relative string
      // We look for the text that ends with "ago"
      await screen.findByText('Understanding Deep Learning Transformers')
      const metaSection = document.querySelector('.flex.flex-wrap.items-center')
      expect(metaSection?.textContent).toMatch(/ago/)
    })

    it('shows read time when present', async () => {
      renderArticleDetail()
      // read_time_seconds = 600, so Math.ceil(600/60) = 10 min
      expect(await screen.findByText(/10 min read/)).toBeInTheDocument()
    })

    it('shows tags with domain:topic format', async () => {
      renderArticleDetail()
      expect(
        await screen.findByText('technology:machine-learning')
      ).toBeInTheDocument()
      expect(screen.getByText('science:research')).toBeInTheDocument()
    })

    it('shows entities with entity_type labels', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Transformer')).toBeInTheDocument()
      expect(screen.getByText('(concept)')).toBeInTheDocument()
      expect(screen.getByText('Deep Learning')).toBeInTheDocument()
      expect(screen.getByText('(field)')).toBeInTheDocument()
    })
  })

  // ─── Error States ──────────────────────────────────────────────────

  describe('Error States', () => {
    it('shows "Article not found" when API returns 404', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json(
            { detail: 'Not found' },
            { status: 404 }
          )
        })
      )
      renderArticleDetail()
      expect(await screen.findByText('Article not found')).toBeInTheDocument()
    })

    it('shows "Back to Timeline" link on error', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json(
            { detail: 'Not found' },
            { status: 404 }
          )
        })
      )
      renderArticleDetail()
      const link = await screen.findByText('Back to Timeline')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/')
    })
  })

  // ─── Status Updates ────────────────────────────────────────────────

  describe('Status Updates', () => {
    it('renders status buttons (Unread, Read, Archived)', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Unread')).toBeInTheDocument()
      expect(screen.getByText('Read')).toBeInTheDocument()
      expect(screen.getByText('Archived')).toBeInTheDocument()
    })

    it('highlights the current status', async () => {
      // mockArticle has status: 'active', which does not match any button.
      // The active status button should have the primary color class.
      // Override to return an article with status 'read':
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json({ ...mockArticle, status: 'read' })
        })
      )
      renderArticleDetail()
      const readButton = await screen.findByText('Read')
      expect(readButton).toHaveClass('bg-primary-600')
    })
  })

  // ─── Read Later ────────────────────────────────────────────────────

  describe('Read Later', () => {
    it('renders read later toggle button', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      const readLaterBtn = screen.getByTitle('Add to read later')
      expect(readLaterBtn).toBeInTheDocument()
    })

    it('button title reflects is_read_later=false state', async () => {
      // mockArticle has is_read_later: false
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByTitle('Add to read later')).toBeInTheDocument()
    })

    it('button title reflects is_read_later=true state', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json({ ...mockArticle, is_read_later: true })
        })
      )
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByTitle('Remove from read later')).toBeInTheDocument()
    })
  })

  // ─── Delete ────────────────────────────────────────────────────────

  describe('Delete', () => {
    it('delete button exists', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByTitle('Delete')).toBeInTheDocument()
    })

    it('calls confirm dialog on delete click', async () => {
      const user = userEvent.setup()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')

      await user.click(screen.getByTitle('Delete'))
      expect(confirmSpy).toHaveBeenCalledWith('Delete this article?')

      confirmSpy.mockRestore()
    })

    it('calls delete mutation when confirmed', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      let deleteCalled = false
      server.use(
        http.delete(`${API_URL}/api/articles/:id`, () => {
          deleteCalled = true
          return HttpResponse.json({ message: 'Article deleted' })
        })
      )

      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')

      await user.click(screen.getByTitle('Delete'))

      await waitFor(() => {
        expect(deleteCalled).toBe(true)
      })

      vi.restoreAllMocks()
    })
  })

  // ─── Notes ─────────────────────────────────────────────────────────

  describe('Notes', () => {
    it('shows "No notes yet" when user_notes is empty', async () => {
      // mockArticle has user_notes: undefined
      renderArticleDetail()
      expect(await screen.findByText('No notes yet')).toBeInTheDocument()
    })

    it('shows existing notes when present', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json(mockArticleWithNotes)
        })
      )
      renderArticleDetail('article-with-notes')
      expect(
        await screen.findByText(/This is a great article about transformers/)
      ).toBeInTheDocument()
    })

    it('edit button opens textarea', async () => {
      const user = userEvent.setup()
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')

      // Click the edit button (Edit2 icon button in Notes section)
      const notesSection = screen.getByText('Notes').closest('div.card')!
      const editButton = notesSection.querySelector('button')!
      await user.click(editButton)

      expect(screen.getByPlaceholderText('Add your notes...')).toBeInTheDocument()
    })

    it('cancel button closes editor without saving', async () => {
      const user = userEvent.setup()
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')

      // Open editor
      const notesSection = screen.getByText('Notes').closest('div.card')!
      const editButton = notesSection.querySelector('button')!
      await user.click(editButton)

      // Verify textarea exists
      expect(screen.getByPlaceholderText('Add your notes...')).toBeInTheDocument()

      // Click cancel
      await user.click(screen.getByText('Cancel'))

      // Textarea should be gone
      expect(screen.queryByPlaceholderText('Add your notes...')).not.toBeInTheDocument()
      // Back to "No notes yet"
      expect(screen.getByText('No notes yet')).toBeInTheDocument()
    })

    it('save button submits notes via mutation', async () => {
      const user = userEvent.setup()
      let savedNotes: string | undefined

      server.use(
        http.patch(`${API_URL}/api/articles/:id`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          savedNotes = body.user_notes as string
          return HttpResponse.json({ ...mockArticle, user_notes: savedNotes })
        })
      )

      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')

      // Open editor
      const notesSection = screen.getByText('Notes').closest('div.card')!
      const editButton = notesSection.querySelector('button')!
      await user.click(editButton)

      // Type notes
      const textarea = screen.getByPlaceholderText('Add your notes...')
      await user.type(textarea, 'My test notes')

      // Click save
      await user.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(savedNotes).toBe('My test notes')
      })
    })
  })

  // ─── Content Sections ──────────────────────────────────────────────

  describe('Content Sections', () => {
    it('shows key quotes when present', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json(mockArticleWithQuotes)
        })
      )
      renderArticleDetail('article-with-quotes')
      expect(await screen.findByText('Key Quotes')).toBeInTheDocument()
      expect(
        screen.getByText(
          /Attention is all you need remains the foundational insight/
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          /The transformer architecture has revolutionized NLP/
        )
      ).toBeInTheDocument()
    })

    it('shows processing pending message when processing_status is pending', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json(mockArticleProcessing)
        })
      )
      renderArticleDetail('article-processing')
      expect(
        await screen.findByText(
          /Article is being processed\. Tags and summary will appear soon\./
        )
      ).toBeInTheDocument()
    })

    it('shows processing failed message when processing_status is failed', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json({
            ...mockArticle,
            processing_status: 'failed',
          })
        })
      )
      renderArticleDetail()
      expect(
        await screen.findByText(
          /Processing failed\. The article was saved but AI analysis could not be completed\./
        )
      ).toBeInTheDocument()
    })
  })

  // ─── Metadata Details ─────────────────────────────────────────────

  describe('Metadata Details', () => {
    it('shows captured_at date formatted', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      // format(new Date('2024-01-16T08:30:00Z'), 'PPpp') produces a localized date string
      // Check for the "Captured" label and that the date section exists
      expect(screen.getByText('Captured')).toBeInTheDocument()
    })

    it('shows published_at when present', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Published')).toBeInTheDocument()
    })

    it('shows capture_source', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Source')).toBeInTheDocument()
      expect(screen.getByText('telegram')).toBeInTheDocument()
    })

    it('shows content_type', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Type')).toBeInTheDocument()
      // content_type is 'article' -- but the title also contains "article" context
      // Look for it specifically in the metadata section
      const typeLabel = screen.getByText('Type')
      const typeRow = typeLabel.closest('div.flex')
      expect(typeRow?.textContent).toContain('article')
    })

    it('shows word_count when present', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Word count')).toBeInTheDocument()
      // word_count is 2500, toLocaleString() = '2,500'
      expect(screen.getByText('2,500')).toBeInTheDocument()
    })

    it('shows language', async () => {
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.getByText('Language')).toBeInTheDocument()
      expect(screen.getByText('en')).toBeInTheDocument()
    })

    it('does not show published_at when absent', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json({
            ...mockArticle,
            published_at: undefined,
          })
        })
      )
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.queryByText('Published')).not.toBeInTheDocument()
    })

    it('does not show word_count when absent', async () => {
      server.use(
        http.get(`${API_URL}/api/articles/:id`, () => {
          return HttpResponse.json({
            ...mockArticle,
            word_count: undefined,
          })
        })
      )
      renderArticleDetail()
      await screen.findByText('Understanding Deep Learning Transformers')
      expect(screen.queryByText('Word count')).not.toBeInTheDocument()
    })
  })
})
