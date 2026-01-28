import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => {
    if (key === 'apiKey') return 'test-api-key'
    return null
  },
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:8000',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  },
})

// MSW server setup for API mocking
export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
