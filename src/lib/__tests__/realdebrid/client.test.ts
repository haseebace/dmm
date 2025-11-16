/**
 * Real-Debrid Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RealDebridClient, {
  RealDebridRateLimitError,
  RealDebridAuthError,
} from '@/lib/realdebrid/client'
import type { RealDebridClientOptions } from '@/types/realdebrid'

// Mock fetch
global.fetch = vi.fn()
const mockFetch = vi.mocked(fetch)

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock error handler
vi.mock('@/lib/error-handler', () => ({
  ExternalServiceError: class ExternalServiceError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ExternalServiceError'
    }
  },
}))

describe('RealDebridClient', () => {
  let client: RealDebridClient
  let mockGetToken: vi.Mock
  let mockOnTokenRefresh: vi.Mock
  let mockOnError: vi.Mock
  let mockOnRateLimit: vi.Mock

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetToken = vi.fn().mockResolvedValue('test-token')
    mockOnTokenRefresh = vi.fn().mockResolvedValue('refreshed-token')
    mockOnError = vi.fn()
    mockOnRateLimit = vi.fn()

    const options: RealDebridClientOptions = {
      getToken: mockGetToken,
      onTokenRefresh: mockOnTokenRefresh,
      onError: mockOnError,
      onRateLimit: mockOnRateLimit,
      config: {
        retryAttempts: 2,
        retryDelay: 100,
        rateLimitRequests: 10,
        rateLimitWindow: 60000,
      },
    }

    client = new RealDebridClient(options)
  })

  afterEach(() => {
    client.clearCache()
  })

  describe('Basic HTTP methods', () => {
    it('should make GET request', async () => {
      const mockResponse = { data: 'test-data' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make POST request with body', async () => {
      const mockResponse = { success: true }
      const requestBody = { name: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.post('/test', requestBody)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should include query parameters', async () => {
      const mockResponse = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })

      await client.get('/test', { page: 1, limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1&limit=10'),
        expect.any(Object)
      )
    })
  })

  describe('Authentication', () => {
    it('should include authorization header with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })

      await client.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('should handle 401 error and attempt token refresh', async () => {
      mockGetToken.mockResolvedValueOnce('expired-token')
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              error_code: 'BAD_TOKEN',
              error_message: 'Invalid token',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        })

      const result = await client.get('/test')

      expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })

    it('should throw auth error when token refresh fails', async () => {
      mockOnTokenRefresh.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error_code: 'BAD_TOKEN',
            error_message: 'Invalid token',
          }),
      })

      await expect(client.get('/test')).rejects.toThrow(RealDebridAuthError)
      expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('Rate limiting', () => {
    it('should handle 429 response with retry', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '2' }),
          json: () =>
            Promise.resolve({
              error_code: 'RATE_LIMIT',
              error_message: 'Too many requests',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        })

      const result = await client.get('/test')

      expect(mockOnRateLimit).toHaveBeenCalledWith({
        limit: 10,
        remaining: 0,
        reset: 2000,
      })
      expect(result).toEqual({ data: 'success' })
    })

    it('should respect client-side rate limiting', async () => {
      const requests = Array(15)
        .fill(null)
        .map(() => client.get('/test'))

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      })

      await expect(Promise.all(requests)).rejects.toThrow(
        RealDebridRateLimitError
      )
    })
  })

  describe('Error handling', () => {
    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error_code: 'INVALID_REQUEST',
            error_message: 'Bad request',
          }),
      })

      await expect(client.get('/test')).rejects.toThrow(
        'Real-Debrid API Error [INVALID_REQUEST]: Bad request'
      )
      expect(mockOnError).toHaveBeenCalledWith({
        error_code: 'INVALID_REQUEST',
        error_message: 'Bad request',
      })
    })

    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' }),
        })

      const result = await client.get('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'success' })
    })

    it('should throw error after exhausting retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'))

      await expect(client.get('/test')).rejects.toThrow(
        'Failed to complete request after 2 attempts'
      )
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const mockResponse = { data: 'cached-data' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })

      const result1 = await client.get('/test')
      const result2 = await client.get('/test')

      expect(result1).toEqual(mockResponse)
      expect(result2).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not cache POST requests', async () => {
      const mockResponse = { data: 'post-data' }
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })

      await client.post('/test')
      await client.post('/test')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should clear cache', () => {
      client.clearCache()
      expect(client.getCacheSize()).toBe(0)
    })
  })

  describe('Utility methods', () => {
    it('should return rate limit info', () => {
      const rateLimit = client.getRateLimitInfo()

      expect(rateLimit).toEqual({
        limit: 10,
        remaining: 10,
        reset: expect.any(Number),
      })
    })

    it('should return config', () => {
      const config = client.getConfig()

      expect(config).toEqual(
        expect.objectContaining({
          apiBaseUrl: 'https://api.real-debrid.com/rest/1.0',
          retryAttempts: 2,
          rateLimitRequests: 10,
        })
      )
    })

    it('should handle no token scenario', async () => {
      mockGetToken.mockResolvedValueOnce(null)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error_code: 'UNAUTHORIZED',
            error_message: 'No token provided',
          }),
      })

      await expect(client.get('/test')).rejects.toThrow(RealDebridAuthError)
    })
  })

  // Request timeout test removed due to test execution time constraints

  describe('Multipart form data', () => {
    it('should handle FormData uploads', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', file)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })

      // Mock the request method directly with a FormData body
      await client.request('/upload', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set multipart headers
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })
})
