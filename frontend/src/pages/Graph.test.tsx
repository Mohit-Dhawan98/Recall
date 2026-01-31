import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/test-utils'
import { server } from '../test/setup'
import { http, HttpResponse } from 'msw'

// Mock react-force-graph-2d BEFORE importing Graph component
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn((props: any) => (
    <div
      data-testid="force-graph"
      data-node-count={props.graphData?.nodes?.length || 0}
      data-link-count={props.graphData?.links?.length || 0}
    />
  )),
}))

// Also mock useNavigate from react-router-dom for navigation tests
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import Graph from './Graph'

const API_URL = 'http://localhost:8000'

describe('Graph', () => {
  it('renders force graph component after loading', async () => {
    renderWithProviders(<Graph />)

    // Wait for the force-graph to appear
    const graph = await screen.findByTestId('force-graph')
    expect(graph).toBeInTheDocument()
  })

  it('renders graph with correct node count from API data', async () => {
    renderWithProviders(<Graph />)

    const graph = await screen.findByTestId('force-graph')
    // Default mock has 3 nodes
    expect(graph).toHaveAttribute('data-node-count', '3')
  })

  it('renders graph with correct link count from API data', async () => {
    renderWithProviders(<Graph />)

    const graph = await screen.findByTestId('force-graph')
    // Default mock has 2 edges
    expect(graph).toHaveAttribute('data-link-count', '2')
  })

  it('shows error state when API fails', async () => {
    server.use(
      http.get(`${API_URL}/api/graph`, () => {
        return HttpResponse.json(
          { detail: 'Graph service error' },
          { status: 500 }
        )
      })
    )

    renderWithProviders(<Graph />)

    expect(await screen.findByText('Failed to load graph')).toBeInTheDocument()
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument()
  })

  it('shows empty state when no connections', async () => {
    server.use(
      http.get(`${API_URL}/api/graph`, () => {
        return HttpResponse.json({
          nodes: [],
          edges: [],
        })
      })
    )

    renderWithProviders(<Graph />)

    expect(await screen.findByText(/No connections to display/)).toBeInTheDocument()
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument()
  })

  it('zoom controls render', () => {
    renderWithProviders(<Graph />)

    // Three zoom control buttons: ZoomIn, ZoomOut, Reset (Maximize2)
    const buttons = screen.getAllByRole('button')
    // Should have at least 3 zoom control buttons
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })

  it('legend renders with relation type labels', async () => {
    renderWithProviders(<Graph />)

    // The legend displays relation types with spaces instead of underscores
    expect(screen.getByText('SAME TOPIC')).toBeInTheDocument()
    expect(screen.getByText('SAME AUTHOR')).toBeInTheDocument()
    expect(screen.getByText('SAME DOMAIN')).toBeInTheDocument()
    expect(screen.getByText('SAME ENTITY')).toBeInTheDocument()
    expect(screen.getByText('SIMILAR')).toBeInTheDocument()
  })

  it('legend items have colored indicators', () => {
    renderWithProviders(<Graph />)

    // Check that the legend color dots are rendered with correct colors
    // The component uses inline style={{ backgroundColor: color }}
    const sameTopicLabel = screen.getByText('SAME TOPIC')
    const colorDot = sameTopicLabel.previousElementSibling
    expect(colorDot).toHaveStyle({ backgroundColor: '#6366f1' })
  })

  it('renders Knowledge Graph heading', () => {
    renderWithProviders(<Graph />)

    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument()
  })

  it('does not show empty state when graph has nodes', async () => {
    renderWithProviders(<Graph />)

    // Wait for graph to load
    await screen.findByTestId('force-graph')

    expect(screen.queryByText(/No connections to display/)).not.toBeInTheDocument()
  })
})
