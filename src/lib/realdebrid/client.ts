/**
 * Real-Debrid API Client
 *
 * Core HTTP client for interacting with Real-Debrid REST API v1.0
 * Handles authentication, rate limiting, caching, and error handling
 */

import { logger } from '@/lib/logger'
import { ExternalServiceError } from '@/lib/error-handler'
import {
  ApiError,
  RequestOptions,
  RealDebridConfig,
  RealDebridClientOptions,
  RateLimitInfo,
  RealDebridApiError,
  RealDebridRateLimitError,
  RealDebridAuthError,
} from '@/types/realdebrid'

// Default configuration
const DEFAULT_CONFIG: RealDebridConfig = {
  apiBaseUrl: 'https://api.real-debrid.com/rest/1.0',
  apiVersion: '1.0',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second base delay
  rateLimitRequests: 100,
  rateLimitWindow: 60000, // 1 minute
  cacheEnabled: true,
  cacheTtl: 300000, // 5 minutes
}

// Simple in-memory cache for API responses
class ApiCache {
  private cache = new Map<string, { data: unknown; expires: number }>()

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  set<T>(key: string, data: T, ttl: number): void {
    const expires = Date.now() + ttl
    this.cache.set(key, { data, expires })
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  size(): number {
    return this.cache.size
  }
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = []
  private config: RealDebridConfig

  constructor(config: RealDebridConfig) {
    this.config = config
  }

  async checkLimit(): Promise<void> {
    const now = Date.now()
    const windowStart = now - this.config.rateLimitWindow

    // Remove old requests outside the time window
    this.requests = this.requests.filter((time) => time > windowStart)

    if (this.requests.length >= this.config.rateLimitRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = oldestRequest + this.config.rateLimitWindow - now

      throw new RealDebridRateLimitError(
        `Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds.`,
        Math.ceil(waitTime / 1000)
      )
    }

    this.requests.push(now)
  }

  getRateLimitInfo(): RateLimitInfo {
    const now = Date.now()
    const windowStart = now - this.config.rateLimitWindow
    const recentRequests = this.requests.filter((time) => time > windowStart)

    return {
      limit: this.config.rateLimitRequests,
      remaining: Math.max(
        0,
        this.config.rateLimitRequests - recentRequests.length
      ),
      reset: Math.max(0, windowStart + this.config.rateLimitWindow - now),
    }
  }
}

export class RealDebridClient {
  private config: RealDebridConfig
  private cache: ApiCache
  private rateLimiter: RateLimiter
  private getToken: () => Promise<string | null>
  private onTokenRefresh?: () => Promise<string | null>
  private onError?: (error: ApiError) => void
  private onRateLimit?: (info: RateLimitInfo) => void

  constructor(options: RealDebridClientOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options.config }
    this.cache = new ApiCache()
    this.rateLimiter = new RateLimiter(this.config)
    this.getToken = options.getToken
    this.onTokenRefresh = options.onTokenRefresh
    this.onError = options.onError
    this.onRateLimit = options.onRateLimit
  }

  /**
   * Make an HTTP request to the Real-Debrid API
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint)
    const cacheKey = this.getCacheKey(endpoint, options)

    // Check cache first (only for GET requests)
    if (
      this.config.cacheEnabled &&
      (!options.method || options.method === 'GET')
    ) {
      const cached = this.cache.get<T>(cacheKey)
      if (cached) {
        logger.info('Cache hit', 'realdebrid', { endpoint, cacheKey })
        return cached
      }
    }

    // Check rate limit before making request
    await this.rateLimiter.checkLimit()

    // Prepare request
    const requestInit: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    }

    // Add authentication header
    const token = await this.getAuthToken()
    if (token) {
      requestInit.headers = {
        ...requestInit.headers,
        Authorization: `Bearer ${token}`,
      }
    }

    // Add request body
    if (options.body) {
      requestInit.body =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
    }

    // Add query parameters
    if (options.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url.search = searchParams.toString()
    }

    // Add timeout and abort signal
    const controller = new AbortController()
    requestInit.signal = options.signal || controller.signal

    // Set timeout
    setTimeout(() => controller.abort(), this.config.timeout)

    let lastError: Error | null = null

    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        logger.info('Making API request', 'realdebrid', {
          endpoint,
          method: requestInit.method,
          attempt,
          url: url.toString(),
        })

        const response = await fetch(url.toString(), requestInit)

        // Handle rate limiting from API
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.config.retryDelay * attempt

          logger.info('Rate limit hit, waiting...', 'realdebrid', {
            endpoint,
            retryAfter,
            waitTime,
          })

          if (this.onRateLimit) {
            this.onRateLimit({
              limit: this.config.rateLimitRequests,
              remaining: 0,
              reset: waitTime,
            })
          }

          if (attempt === this.config.retryAttempts) {
            throw new RealDebridRateLimitError(
              `Rate limit exceeded after ${attempt} attempts`,
              Math.ceil(waitTime / 1000)
            )
          }

          await new Promise((resolve) => setTimeout(resolve, waitTime))
          continue
        }

        // Handle authentication errors
        if (response.status === 401) {
          logger.info('Authentication failed', 'realdebrid', { endpoint })

          // Try to refresh token if refresh handler is provided
          if (attempt === 1 && this.onTokenRefresh) {
            const newToken = await this.onTokenRefresh()
            if (newToken) {
              requestInit.headers = {
                ...requestInit.headers,
                Authorization: `Bearer ${newToken}`,
              }
              continue // Retry with new token
            }
          }

          throw new RealDebridAuthError(
            'Invalid or expired authentication token'
          )
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response)
          const apiError = new RealDebridApiError(
            errorData.error_code || `HTTP_${response.status}`,
            errorData.error_message || response.statusText,
            response.status
          )

          logger.info('API request failed', 'realdebrid', {
            endpoint,
            status: response.status,
            errorCode: apiError.error_code,
            errorMessage: apiError.error_message,
          })

          if (this.onError) {
            this.onError(apiError)
          }

          throw apiError
        }

        // Parse successful response
        const data = await response.json()

        // Cache successful GET requests
        if (
          this.config.cacheEnabled &&
          (!options.method || options.method === 'GET')
        ) {
          this.cache.set(cacheKey, data, this.config.cacheTtl)
        }

        logger.info('API request successful', 'realdebrid', {
          endpoint,
          status: response.status,
          cached: false,
        })

        return data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on authentication errors or abort errors
        if (
          error instanceof RealDebridAuthError ||
          error.name === 'AbortError'
        ) {
          throw error
        }

        // Log retry attempt
        if (attempt < this.config.retryAttempts) {
          const waitTime = this.config.retryDelay * Math.pow(2, attempt - 1)
          logger.info('Request failed, retrying...', 'realdebrid', {
            endpoint,
            attempt,
            error: (error as Error).message,
            waitTime,
          })

          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
    }

    // All retries exhausted
    logger.info('Request failed after all retries', 'realdebrid', {
      endpoint,
      totalAttempts: this.config.retryAttempts,
      finalError: lastError?.message,
    })

    if (
      lastError instanceof RealDebridApiError ||
      lastError instanceof RealDebridRateLimitError
    ) {
      throw lastError
    }

    throw new ExternalServiceError(
      `Failed to complete request after ${this.config.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`
    )
  }

  /**
   * Helper methods for HTTP verbs
   */
  async get<T = unknown>(
    endpoint: string,
    params?: RequestOptions['params']
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params })
  }

  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    params?: RequestOptions['params']
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body, params })
  }

  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    params?: RequestOptions['params']
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body, params })
  }

  async delete<T = unknown>(
    endpoint: string,
    params?: RequestOptions['params']
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', params })
  }

  /**
   * Utility methods
   */
  private buildUrl(endpoint: string): URL {
    const baseUrl = endpoint.startsWith('http')
      ? endpoint
      : `${this.config.apiBaseUrl}${endpoint}`

    return new URL(baseUrl)
  }

  private getCacheKey(endpoint: string, options: RequestOptions): string {
    const method = options.method || 'GET'
    if (options.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      const params = searchParams.toString()
      return `${method}:${endpoint}:${params}`
    }
    return `${method}:${endpoint}:`
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await this.getToken()
    } catch (error) {
      logger.error('Failed to get auth token', (error as Error).message)
      return null
    }
  }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const data = await response.json()
      return data as ApiError
    } catch {
      return {
        error_code: `HTTP_${response.status}`,
        error_message: response.statusText || 'Unknown error',
      }
    }
  }

  /**
   * Cache management
   */
  clearCache(): void {
    this.cache.clear()
  }

  deleteCache(endpoint: string, options: RequestOptions = {}): void {
    const cacheKey = this.getCacheKey(endpoint, options)
    this.cache.delete(cacheKey)
  }

  getCacheSize(): number {
    return this.cache.size()
  }

  /**
   * Rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getRateLimitInfo()
  }

  /**
   * Configuration access
   */
  getConfig(): RealDebridConfig {
    return { ...this.config }
  }
}

export default RealDebridClient
