import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
  path?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions = {}
) {
  const { initialEntries = ['/'], path = '*', ...renderOptions } = options
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: { children: ReactElement }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
export { userEvent }
