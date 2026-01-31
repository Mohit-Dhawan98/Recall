import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import { server } from '../test/setup'
import { http, HttpResponse } from 'msw'
import Timeline from './Timeline'

const API_URL = 'http://localhost:8000'

describe('Timeline', () => {
  it('renders article list after loading', async () => {
    renderWithProviders(<Timeline />)

    // Articles load asynchronously via useQuery
    expect(await screen.findByText('Understanding Deep Learning Transformers')).toBeInTheDocument()
    expect(await screen.findByText('Rust and Memory Safety')).toBeInTheDocument()
    expect(await screen.findByText('Climate Report 2024: Key Findings')).toBeInTheDocument()
  })

  it('shows error state when API returns 500', async () => {
    server.use(
      http.get(`${API_URL}/api/articles`, () => {
        return HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500 }
        )
      })
    )

    renderWithProviders(<Timeline />)

    expect(await screen.findByText('Failed to load articles. Please try again.')).toBeInTheDocument()
  })

  it('shows empty state when no articles', async () => {
    server.use(
      http.get(`${API_URL}/api/articles`, () => {
        return HttpResponse.json({
          articles: [],
          total: 0,
          page: 1,
          page_size: 20,
        })
      })
    )

    renderWithProviders(<Timeline />)

    expect(await screen.findByText('No articles yet.')).toBeInTheDocument()
    expect(screen.getByText(/Save articles using the browser extension/)).toBeInTheDocument()
  })

  it('renders filter buttons', () => {
    renderWithProviders(<Timeline />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Unread')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('Add Article button opens modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Timeline />)

    const addButton = screen.getByText('Add Article')
    await user.click(addButton)

    expect(screen.getByPlaceholderText('Paste article URL...')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('Add Article modal submits URL via capture mutation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Timeline />)

    // Open modal
    await user.click(screen.getByText('Add Article'))

    // Type URL
    const input = screen.getByPlaceholderText('Paste article URL...')
    await user.type(input, 'https://example.com/new-article')

    // Submit
    const saveButton = screen.getByText('Save')
    await user.click(saveButton)

    // Modal should close after successful submit
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Paste article URL...')).not.toBeInTheDocument()
    })
  })

  it('pagination renders when totalPages > 1', async () => {
    server.use(
      http.get(`${API_URL}/api/articles`, () => {
        return HttpResponse.json({
          articles: [
            {
              id: 'a1',
              url: 'https://example.com/1',
              title: 'Article 1',
              source_domain: 'example.com',
              captured_at: '2024-01-16T08:30:00Z',
              content_type: 'article',
              language: 'en',
              key_quotes: [],
              capture_source: 'pwa',
              status: 'active',
              is_read_later: false,
              importance: 'normal',
              processing_status: 'completed',
              tags: [],
              entities: [],
            },
          ],
          total: 40,
          page: 1,
          page_size: 20,
        })
      })
    )

    renderWithProviders(<Timeline />)

    // Wait for articles to load
    expect(await screen.findByText('Article 1')).toBeInTheDocument()

    // Pagination controls should appear
    expect(screen.getByText('Previous')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('does not show pagination when only one page of results', async () => {
    renderWithProviders(<Timeline />)

    // Default mock has 3 articles with total=3, page_size=20 => 1 page
    expect(await screen.findByText('Understanding Deep Learning Transformers')).toBeInTheDocument()

    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('Cancel button closes add modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Timeline />)

    // Open modal
    await user.click(screen.getByText('Add Article'))
    expect(screen.getByPlaceholderText('Paste article URL...')).toBeInTheDocument()

    // Cancel
    await user.click(screen.getByText('Cancel'))

    // Modal should be gone
    expect(screen.queryByPlaceholderText('Paste article URL...')).not.toBeInTheDocument()
  })

  it('renders Timeline heading', () => {
    renderWithProviders(<Timeline />)

    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })
})
