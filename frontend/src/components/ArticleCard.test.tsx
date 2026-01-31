import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import { mockArticle, mockArticleProcessing } from '../test/fixtures'
import ArticleCard from './ArticleCard'
import type { Article } from '../api/client'

describe('ArticleCard', () => {
  it('displays article title, summary, source_domain, author, and relative time', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    expect(screen.getByText('Understanding Deep Learning Transformers')).toBeInTheDocument()
    expect(screen.getByText(/A comprehensive overview of transformer architecture/)).toBeInTheDocument()
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    // Relative time is rendered by date-fns formatDistanceToNow — just check it exists as text with "ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('title links to /article/{id}', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    const link = screen.getByRole('link', { name: /Understanding Deep Learning Transformers/ })
    expect(link).toHaveAttribute('href', '/article/article-1')
  })

  it('shows read time when read_time_seconds is present', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    // 600 seconds = 10 min read
    expect(screen.getByText('10 min read')).toBeInTheDocument()
  })

  it('does not show read time when read_time_seconds is absent', () => {
    const articleNoReadTime: Article = {
      ...mockArticle,
      id: 'no-read-time',
      read_time_seconds: undefined,
    }

    renderWithProviders(
      <ArticleCard article={articleNoReadTime} />
    )

    expect(screen.queryByText(/min read/)).not.toBeInTheDocument()
  })

  it('shows processing spinner when processing_status is pending', () => {
    renderWithProviders(
      <ArticleCard article={mockArticleProcessing} />
    )

    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('does not show processing spinner when processing_status is completed', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
  })

  it('displays up to 4 tags with +N overflow count', () => {
    const articleManyTags: Article = {
      ...mockArticle,
      id: 'many-tags',
      tags: [
        { domain: 'technology', topic: 'machine-learning', source: 'llm' },
        { domain: 'science', topic: 'research', source: 'llm' },
        { domain: 'business', topic: 'startups', source: 'llm' },
        { domain: 'culture', topic: 'media', source: 'llm' },
        { domain: 'career', topic: 'engineering', source: 'llm' },
        { domain: 'news', source: 'llm' },
      ],
    }

    renderWithProviders(
      <ArticleCard article={articleManyTags} />
    )

    // First 4 tags displayed
    expect(screen.getByText('technology:machine-learning')).toBeInTheDocument()
    expect(screen.getByText('science:research')).toBeInTheDocument()
    expect(screen.getByText('business:startups')).toBeInTheDocument()
    expect(screen.getByText('culture:media')).toBeInTheDocument()
    // 5th and 6th tags hidden, +2 overflow shown
    expect(screen.getByText('+2')).toBeInTheDocument()
    // Tags beyond 4 should not be rendered
    expect(screen.queryByText('career:engineering')).not.toBeInTheDocument()
  })

  it('displays tag domain only when topic is absent', () => {
    const articleDomainOnlyTag: Article = {
      ...mockArticle,
      id: 'domain-only-tag',
      tags: [{ domain: 'news', source: 'llm' }],
    }

    renderWithProviders(
      <ArticleCard article={articleDomainOnlyTag} />
    )

    expect(screen.getByText('news')).toBeInTheDocument()
  })

  it('read later button calls onToggleReadLater with article id', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()

    renderWithProviders(
      <ArticleCard article={mockArticle} onToggleReadLater={handleToggle} />
    )

    const readLaterButton = screen.getByTitle('Add to read later')
    await user.click(readLaterButton)

    expect(handleToggle).toHaveBeenCalledWith('article-1')
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('delete button calls onDelete with article id', async () => {
    const user = userEvent.setup()
    const handleDelete = vi.fn()

    renderWithProviders(
      <ArticleCard article={mockArticle} onDelete={handleDelete} />
    )

    const deleteButton = screen.getByTitle('Delete')
    await user.click(deleteButton)

    expect(handleDelete).toHaveBeenCalledWith('article-1')
    expect(handleDelete).toHaveBeenCalledTimes(1)
  })

  it('external link has correct href and target="_blank"', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    const externalLink = screen.getByTitle('Open original')
    expect(externalLink).toHaveAttribute('href', 'https://example.com/deep-learning-transformers')
    expect(externalLink).toHaveAttribute('target', '_blank')
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('handles article with no summary without crashing', () => {
    const articleNoSummary: Article = {
      ...mockArticle,
      id: 'no-summary',
      summary: undefined,
    }

    renderWithProviders(
      <ArticleCard article={articleNoSummary} />
    )

    // Title still renders
    expect(screen.getByText('Understanding Deep Learning Transformers')).toBeInTheDocument()
    // No summary paragraph
    expect(screen.queryByText(/A comprehensive overview/)).not.toBeInTheDocument()
  })

  it('handles article with no tags (no tag section rendered)', () => {
    const articleNoTags: Article = {
      ...mockArticle,
      id: 'no-tags',
      tags: [],
    }

    renderWithProviders(
      <ArticleCard article={articleNoTags} />
    )

    // Title renders
    expect(screen.getByText('Understanding Deep Learning Transformers')).toBeInTheDocument()
    // No tag elements
    expect(screen.queryByText('technology:machine-learning')).not.toBeInTheDocument()
  })

  it('handles article with no author (no author shown)', () => {
    const articleNoAuthor: Article = {
      ...mockArticle,
      id: 'no-author',
      author: undefined,
    }

    renderWithProviders(
      <ArticleCard article={articleNoAuthor} />
    )

    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    // Source domain still shows
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('does not render read later button when onToggleReadLater is not provided', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    expect(screen.queryByTitle('Add to read later')).not.toBeInTheDocument()
  })

  it('does not render delete button when onDelete is not provided', () => {
    renderWithProviders(
      <ArticleCard article={mockArticle} />
    )

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
  })

  it('shows "Remove from read later" title when article is_read_later is true', () => {
    const readLaterArticle: Article = {
      ...mockArticle,
      id: 'read-later',
      is_read_later: true,
    }

    renderWithProviders(
      <ArticleCard article={readLaterArticle} onToggleReadLater={vi.fn()} />
    )

    expect(screen.getByTitle('Remove from read later')).toBeInTheDocument()
  })
})
