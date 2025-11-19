/**
 * Health Check Manager Tests
 *
 * Unit tests for the health check system functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from 'vitest'
import { HealthCheckManager } from '../health-checks/manager'
import { RealDebridClient } from '../../realdebrid/client'
import {
  HealthCheckResult,
  DEFAULT_MONITORING_CONFIG,
} from '../../../types/connection'

// Mock the RealDebridClient
vi.mock('../../realdebrid/client', () => ({
  RealDebridClient: vi.fn(),
}))

// Mock the logger
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('HealthCheckManager', () => {
  let healthCheckManager: HealthCheckManager
  let mockApiClient: jest.Mocked<RealDebridClient>
  let mockGetToken: jest.MockedFunction<() => Promise<string | null>>

  beforeEach(() => {
    // Create mock instances
    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
      clearCache: vi.fn(),
      getCacheSize: vi.fn(),
      deleteCache: vi.fn(),
      getRateLimitInfo: vi.fn(),
      getConfig: vi.fn(),
    } as any

    mockGetToken = vi.fn()

    // Create health check manager instance
    healthCheckManager = new HealthCheckManager(
      mockApiClient,
      mockGetToken,
      DEFAULT_MONITORING_CONFIG.healthChecks
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(healthCheckManager).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        ...DEFAULT_MONITORING_CONFIG.healthChecks,
        apiInterval: 60000,
        timeout: 15000,
      }

      const customManager = new HealthCheckManager(
        mockApiClient,
        mockGetToken,
        customConfig
      )

      expect(customManager).toBeDefined()
    })
  })

  describe('performHealthCheck', () => {
    beforeEach(() => {
      // Mock fetch for network checks
      global.fetch = vi.fn()
    })

    it('should perform API health check successfully', async () => {
      mockApiClient.get.mockResolvedValue({
        id: 'test-user',
        username: 'test',
      } as any)

      const result =
        await healthCheckManager.performHealthCheck('realdebrid-api')

      expect(result).toEqual({
        name: 'realdebrid-api',
        success: true,
        responseTime: expect.any(Number),
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          endpoint: '/user',
          statusCode: 200,
        }),
      })

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/user',
        undefined,
        expect.any(Object)
      )
    })

    it('should handle API health check failure', async () => {
      const apiError = new Error('API Error')
      mockApiClient.get.mockRejectedValue(apiError)

      const result =
        await healthCheckManager.performHealthCheck('realdebrid-api')

      expect(result).toEqual({
        name: 'realdebrid-api',
        success: false,
        responseTime: expect.any(Number),
        timestamp: expect.any(Date),
        error: 'API Error',
        details: expect.objectContaining({
          endpoint: '/user',
        }),
      })
    })

    it('should perform network connectivity check', async () => {
      // Mock successful fetch responses
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('google.com') || url.includes('cloudflare.com')) {
          return Promise.resolve({
            ok: true,
            status: 200,
          } as Response)
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const result = await healthCheckManager.performHealthCheck(
        'network-connectivity'
      )

      expect(result.name).toBe('network-connectivity')
      expect(result.success).toBe(true)
      expect(result.details).toHaveProperty('connectivity')
      expect(result.details).toHaveProperty('testResults')
    })

    it('should handle unknown health check names', async () => {
      await expect(
        healthCheckManager.performHealthCheck('unknown-check' as any)
      ).rejects.toThrow('Unknown health check: unknown-check')
    })
  })

  describe('performAllHealthChecks', () => {
    beforeEach(() => {
      // Mock dependencies
      mockApiClient.get.mockResolvedValue({} as any)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
    })

    it('should perform all health checks', async () => {
      const results = await healthCheckManager.performAllHealthChecks()

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.name)).toBe(true)
      expect(mockApiClient.get).toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle partial failures gracefully', async () => {
      // Mock API failure
      mockApiClient.get.mockRejectedValue(new Error('API Error'))

      const results = await healthCheckManager.performAllHealthChecks()

      expect(results).toHaveLength(3)
      const apiResult = results.find((r) => r.name === 'realdebrid-api')
      expect(apiResult?.success).toBe(false)
      expect(apiResult?.error).toBe('API Error')
    })
  })

  describe('status calculation', () => {
    beforeEach(() => {
      // Set up some test results
      healthCheckManager['lastResults'] = new Map([
        [
          'realdebrid-api',
          {
            name: 'realdebrid-api',
            success: true,
            responseTime: 500,
            statusCode: 200,
            timestamp: new Date(),
          },
        ],
        [
          'network-connectivity',
          {
            name: 'network-connectivity',
            success: true,
            responseTime: 100,
            timestamp: new Date(),
          },
        ],
      ])
    })

    it('should calculate service status as available when API is healthy', () => {
      const status = healthCheckManager.getServiceStatus()

      expect(status.state).toBe('available')
      expect(status.responseTime).toBe(500)
      expect(status.errorRate).toBe(0)
    })

    it('should calculate service status as unavailable when API fails', () => {
      // Update API result to failure
      healthCheckManager['lastResults'].set('realdebrid-api', {
        name: 'realdebrid-api',
        success: false,
        responseTime: 5000,
        statusCode: 500,
        timestamp: new Date(),
        error: 'Server error',
      })

      const status = healthCheckManager.getServiceStatus()

      expect(status.state).toBe('unavailable')
      expect(status.errorRate).toBe(100)
      expect(status.errorMessage).toBe('Server error')
    })

    it('should calculate service status as rate limited when 429', () => {
      // Update API result to rate limited
      healthCheckManager['lastResults'].set('realdebrid-api', {
        name: 'realdebrid-api',
        success: false,
        responseTime: 1000,
        statusCode: 429,
        timestamp: new Date(),
        error: 'Rate limited',
      })

      const status = healthCheckManager.getServiceStatus()

      expect(status.state).toBe('rate_limited')
    })

    it('should calculate network status correctly', () => {
      const status = healthCheckManager.getNetworkStatus()

      expect(status.state).toBe('connected')
      expect(status.online).toBe(true)
      expect(status.latency).toBeGreaterThan(0)
    })

    it('should calculate network status as disconnected when no connectivity', () => {
      // Update network result to failure
      healthCheckManager['lastResults'].set('network-connectivity', {
        name: 'network-connectivity',
        success: false,
        responseTime: 0,
        timestamp: new Date(),
        error: 'No connection',
        details: { connectivity: 0 },
      })

      const status = healthCheckManager.getNetworkStatus()

      expect(status.state).toBe('disconnected')
      expect(status.online).toBe(false)
    })
  })

  describe('monitoring lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should start monitoring when enabled', () => {
      const config = { ...DEFAULT_MONITORING_CONFIG, enabled: true }
      const manager = new HealthCheckManager(
        mockApiClient,
        mockGetToken,
        config.healthChecks
      )

      manager.startMonitoring()
      expect(manager.isActive()).toBe(true)
    })

    it('should not start monitoring when disabled', () => {
      const config = { ...DEFAULT_MONITORING_CONFIG, enabled: false }
      const manager = new HealthCheckManager(
        mockApiClient,
        mockGetToken,
        config.healthChecks
      )

      manager.startMonitoring()
      expect(manager.isActive()).toBe(false)
    })

    it('should stop monitoring', () => {
      healthCheckManager.startMonitoring()
      expect(healthCheckManager.isActive()).toBe(true)

      healthCheckManager.stopMonitoring()
      expect(healthCheckManager.isActive()).toBe(false)
    })
  })

  describe('statistics', () => {
    it('should return monitoring statistics', () => {
      const stats = healthCheckManager.getStats()

      expect(stats).toHaveProperty('isRunning')
      expect(stats).toHaveProperty('totalChecks')
      expect(stats).toHaveProperty('successful')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('successRate')
      expect(stats).toHaveProperty('averageResponseTime')
      expect(stats).toHaveProperty('activeIntervals')
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        timeout: 15000,
        maxRetries: 5,
      }

      healthCheckManager.updateConfig(newConfig)

      const config = healthCheckManager.getConfig()
      expect(config.timeout).toBe(15000)
      expect(config.maxRetries).toBe(5)
    })
  })

  describe('edge cases', () => {
    it('should handle missing fetch in non-browser environment', () => {
      const originalFetch = global.fetch
      delete (global as any).fetch

      expect(async () => {
        await healthCheckManager.performHealthCheck('network-connectivity')
      }).not.toThrow()

      global.fetch = originalFetch
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'AbortError'
      mockApiClient.get.mockRejectedValue(timeoutError)

      const result =
        await healthCheckManager.performHealthCheck('realdebrid-api')

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })

    it('should handle JSON parsing errors', async () => {
      const apiClient = {
        get: vi.fn().mockResolvedValue('invalid json'),
      } as any

      const manager = new HealthCheckManager(apiClient, mockGetToken)

      const result = await manager.performHealthCheck('realdebrid-api')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
