/**
 * Reconnection Manager Tests
 *
 * Unit tests for the reconnection logic and strategies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReconnectionManager } from '../reconnection/manager'
import { HealthCheckManager } from '../health-checks/manager'
import {
  ReconnectionContext,
  DEFAULT_MONITORING_CONFIG,
} from '../../../types/connection'

// Mock the HealthCheckManager
vi.mock('../health-checks/manager', () => ({
  HealthCheckManager: vi.fn(),
}))

describe('ReconnectionManager', () => {
  let reconnectionManager: ReconnectionManager
  let mockHealthCheckManager: jest.Mocked<HealthCheckManager>
  let mockGetToken: jest.MockedFunction<() => Promise<string | null>>
  let mockRefreshToken: jest.MockedFunction<() => Promise<string | null>>
  let mockOnTokenUpdate: jest.MockedFunction<(token: string) => Promise<void>>
  let mockOnStatusUpdate: jest.MockedFunction<(status: any) => void>

  beforeEach(() => {
    // Create mock instances
    mockHealthCheckManager = {
      performHealthCheck: vi.fn(),
      getStats: vi.fn(),
      isActive: vi.fn(),
      updateConfig: vi.fn(),
      getConfig: vi.fn(),
    } as any

    mockGetToken = vi.fn()
    mockRefreshToken = vi.fn()
    mockOnTokenUpdate = vi.fn()
    mockOnStatusUpdate = vi.fn()

    // Create reconnection manager instance
    reconnectionManager = new ReconnectionManager(
      mockHealthCheckManager,
      mockGetToken,
      mockRefreshToken,
      mockOnTokenUpdate,
      mockOnStatusUpdate,
      DEFAULT_MONITORING_CONFIG.reconnection
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(reconnectionManager).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        ...DEFAULT_MONITORING_CONFIG.reconnection,
        maxAttempts: 5,
        baseDelay: 500,
      }

      const customManager = new ReconnectionManager(
        mockHealthCheckManager,
        mockGetToken,
        mockRefreshToken,
        mockOnTokenUpdate,
        mockOnStatusUpdate,
        customConfig
      )

      expect(customManager).toBeDefined()
    })
  })

  describe('reconnection strategies', () => {
    const mockContext: ReconnectionContext = {
      userId: 'test-user',
      reason: 'service_unavailable',
      previousStatus: {
        authentication: {
          state: 'authenticated',
          canRefresh: false,
          lastValidated: new Date(),
        },
        service: {
          state: 'unavailable',
          responseTime: 0,
          errorRate: 100,
          lastHealthCheck: new Date(),
          consecutiveFailures: 1,
          endpoints: {},
        },
        network: {
          state: 'connected',
          online: true,
          latency: 0,
          effectiveType: '4g',
          lastChecked: new Date(),
        },
        lastUpdated: new Date(),
        consecutiveErrors: 1,
        overallStatus: 'disconnected',
      },
    }

    it('should use token_refresh strategy for authentication errors', () => {
      vi.useFakeTimers()

      // Mock successful token refresh
      mockRefreshToken.mockResolvedValue('new-refresh-token')
      mockHealthCheckManager.performHealthCheck
        .mockResolvedValueOnce({
          name: 'authentication',
          success: true,
          responseTime: 100,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          name: 'realdebrid-api',
          success: true,
          responseTime: 200,
          timestamp: new Date(),
        })

      const context = { ...mockContext, reason: 'authentication' }
      const reconnectionPromise = reconnectionManager.startReconnection(context)

      // Fast forward timers
      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(result.success).toBe(true)
        expect(result.attempts).toBe(1)
        expect(result.strategy).toBe('token_refresh')
      })
    })

    it('should use retry strategy for service unavailability', () => {
      vi.useFakeTimers()

      // Mock successful retry
      mockGetToken.mockResolvedValue('valid-token')
      mockHealthCheckManager.performHealthCheck
        .mockResolvedValueOnce({
          name: 'network-connectivity',
          success: true,
          responseTime: 100,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          name: 'realdebrid-api',
          success: true,
          responseTime: 200,
          timestamp: new Date(),
        })

      const reconnectionPromise =
        reconnectionManager.startReconnection(mockContext)

      // Fast forward timers
      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(result.success).toBe(true)
        expect(result.attempts).toBe(1)
        expect(result.strategy).toBe('retry')
      })
    })

    it('should handle reconnection failure after max attempts', () => {
      vi.useFakeTimers()

      // Mock consistent failure
      mockHealthCheckManager.performHealthCheck.mockResolvedValue({
        name: 'realdebrid-api',
        success: false,
        responseTime: 5000,
        timestamp: new Date(),
        error: 'Service unavailable',
      })

      const reconnectionPromise = reconnectionManager.startReconnection({
        ...mockContext,
        maxAttempts: 2,
      })

      // Fast forward timers
      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(result.success).toBe(false)
        expect(result.attempts).toBe(2)
        expect(result.error).toBeDefined()
      })
    })

    it('should implement exponential backoff', () => {
      vi.useFakeTimers()

      const delays: number[] = []
      const originalSetTimeout = global.setTimeout
      global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
        delays.push(delay)
        return originalSetTimeout(callback, delay)
      })

      // Mock failure for first attempt, success for second
      mockHealthCheckManager.performHealthCheck
        .mockResolvedValueOnce({
          name: 'realdebrid-api',
          success: false,
          responseTime: 5000,
          timestamp: new Date(),
          error: 'Service unavailable',
        })
        .mockResolvedValueOnce({
          name: 'realdebrid-api',
          success: true,
          responseTime: 200,
          timestamp: new Date(),
        })

      const reconnectionPromise = reconnectionManager.startReconnection({
        ...mockContext,
        maxAttempts: 2,
      })

      // Run timers and capture delays
      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(delays.length).toBeGreaterThan(0)
        // Verify exponential backoff (second delay should be longer)
        if (delays.length >= 2) {
          expect(delays[1]).toBeGreaterThan(delays[0])
        }

        // Restore original setTimeout
        global.setTimeout = originalSetTimeout
      })
    })
  })

  describe('status management', () => {
    it('should update status during reconnection', () => {
      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'manual',
        previousStatus: {
          authentication: {
            state: 'authenticated',
            canRefresh: false,
            lastValidated: new Date(),
          },
          service: {
            state: 'unavailable',
            responseTime: 0,
            errorRate: 100,
            lastHealthCheck: new Date(),
            consecutiveFailures: 1,
            endpoints: {},
          },
          network: {
            state: 'connected',
            online: true,
            latency: 0,
            effectiveType: '4g',
            lastChecked: new Date(),
          },
          lastUpdated: new Date(),
          consecutiveErrors: 1,
          overallStatus: 'disconnected',
        },
      }

      reconnectionManager.startReconnection(context)

      expect(mockOnStatusUpdate).toHaveBeenCalledWith({
        overallStatus: 'reconnecting',
      })
    })

    it('should handle concurrent reconnection attempts', async () => {
      vi.useFakeTimers()

      // Mock slow reconnection
      mockHealthCheckManager.performHealthCheck.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              name: 'realdebrid-api',
              success: true,
              responseTime: 200,
              timestamp: new Date(),
            })
          }, 1000)
        })
      })

      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'manual',
        previousStatus: {
          authentication: {
            state: 'authenticated',
            canRefresh: false,
            lastValidated: new Date(),
          },
          service: {
            state: 'unavailable',
            responseTime: 0,
            errorRate: 100,
            lastHealthCheck: new Date(),
            consecutiveFailures: 1,
            endpoints: {},
          },
          network: {
            state: 'connected',
            online: true,
            latency: 0,
            effectiveType: '4g',
            lastChecked: new Date(),
          },
          lastUpdated: new Date(),
          consecutiveErrors: 1,
          overallStatus: 'disconnected',
        },
      }

      const promise1 = reconnectionManager.startReconnection(context)
      const promise2 = reconnectionManager.startReconnection(context)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // One should succeed, one should indicate already in progress
      expect(result1.success || result2.success).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should return reconnection statistics', () => {
      const stats = reconnectionManager.getStats()

      expect(stats).toHaveProperty('isActive')
      expect(stats).toHaveProperty('totalAttempts')
      expect(stats).toHaveProperty('successfulAttempts')
      expect(stats).toHaveProperty('failedAttempts')
      expect(stats).toHaveProperty('successRate')
      expect(stats).toHaveProperty('averageDelay')
      expect(stats).toHaveProperty('strategyCounts')
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxAttempts: 15,
        baseDelay: 2000,
        maxDelay: 120000,
      }

      reconnectionManager.updateConfig(newConfig)

      const config = reconnectionManager.getConfig()
      expect(config.maxAttempts).toBe(15)
      expect(config.baseDelay).toBe(2000)
      expect(config.maxDelay).toBe(120000)
    })
  })

  describe('error handling', () => {
    it('should handle health check manager errors', async () => {
      vi.useFakeTimers()

      mockHealthCheckManager.performHealthCheck.mockRejectedValue(
        new Error('Health check failed')
      )

      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'manual',
        previousStatus: {
          authentication: {
            state: 'authenticated',
            canRefresh: false,
            lastValidated: new Date(),
          },
          service: {
            state: 'unavailable',
            responseTime: 0,
            errorRate: 100,
            lastHealthCheck: new Date(),
            consecutiveFailures: 1,
            endpoints: {},
          },
          network: {
            state: 'connected',
            online: true,
            latency: 0,
            effectiveType: '4g',
            lastChecked: new Date(),
          },
          lastUpdated: new Date(),
          consecutiveErrors: 1,
          overallStatus: 'disconnected',
        },
        maxAttempts: 1,
      }

      const reconnectionPromise = reconnectionManager.startReconnection(context)

      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(result.success).toBe(false)
        expect(result.error).toContain('Health check failed')
      })
    })

    it('should handle token refresh errors', async () => {
      vi.useFakeTimers()

      mockRefreshToken.mockRejectedValue(new Error('Token refresh failed'))

      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'authentication',
        previousStatus: {
          authentication: {
            state: 'token_expired',
            canRefresh: false,
            lastValidated: new Date(),
          },
          service: {
            state: 'unavailable',
            responseTime: 0,
            errorRate: 100,
            lastHealthCheck: new Date(),
            consecutiveFailures: 1,
            endpoints: {},
          },
          network: {
            state: 'connected',
            online: true,
            latency: 0,
            effectiveType: '4g',
            lastChecked: new Date(),
          },
          lastUpdated: new Date(),
          consecutiveErrors: 1,
          overallStatus: 'disconnected',
        },
        maxAttempts: 2,
      }

      const reconnectionPromise = reconnectionManager.startReconnection(context)

      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        expect(result.success).toBe(false)
        expect(result.attempts).toBe(2)
        expect(mockRefreshToken).toHaveBeenCalled()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty context', async () => {
      const result = await reconnectionManager.startReconnection(
        {} as ReconnectionContext
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle missing previous status', async () => {
      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'manual',
        previousStatus: null as any,
      }

      const result = await reconnectionManager.startReconnection(context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle unknown reconnection reason', async () => {
      vi.useFakeTimers()

      mockHealthCheckManager.performHealthCheck.mockResolvedValue({
        name: 'realdebrid-api',
        success: true,
        responseTime: 200,
        timestamp: new Date(),
      })

      const context: ReconnectionContext = {
        userId: 'test-user',
        reason: 'unknown' as any,
        previousStatus: {
          authentication: {
            state: 'authenticated',
            canRefresh: false,
            lastValidated: new Date(),
          },
          service: {
            state: 'unavailable',
            responseTime: 0,
            errorRate: 100,
            lastHealthCheck: new Date(),
            consecutiveFailures: 1,
            endpoints: {},
          },
          network: {
            state: 'connected',
            online: true,
            latency: 0,
            effectiveType: '4g',
            lastChecked: new Date(),
          },
          lastUpdated: new Date(),
          consecutiveErrors: 1,
          overallStatus: 'disconnected',
        },
        maxAttempts: 1,
      }

      const reconnectionPromise = reconnectionManager.startReconnection(context)

      vi.runAllTimers()

      return reconnectionPromise.then((result) => {
        // Should default to retry strategy for unknown reasons
        expect(result.strategy).toBe('retry')
      })
    })
  })
})
