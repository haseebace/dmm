/**
 * Health Check Manager
 *
 * Comprehensive health monitoring system for Real-Debrid API,
 * network connectivity, and authentication status.
 */

import { logger } from '@/lib/logger'
import { RealDebridClient } from '@/lib/realdebrid/client'
import { oauth2Client } from '@/lib/oauth2/client'
import {
  HealthCheckResult,
  NetworkCheckResult,
  AuthenticationStatus,
  ServiceStatus,
  NetworkStatus,
  EndpointStatus,
  HealthCheckError,
  DEFAULT_MONITORING_CONFIG,
} from '@/types/connection'

// Health check configuration
interface HealthCheckConfig {
  name: string
  url?: string
  method?: 'GET' | 'HEAD' | 'POST'
  timeout: number
  interval: number
  retries: number
  enabled: boolean
  critical: boolean // Whether this check is critical for overall health
}

export class HealthCheckManager {
  private config: typeof DEFAULT_MONITORING_CONFIG
  private apiClient: RealDebridClient
  private getToken: () => Promise<string | null>
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false
  private lastResults: Map<string, HealthCheckResult> = new Map()

  constructor(
    apiClient: RealDebridClient,
    getToken: () => Promise<string | null>,
    config = DEFAULT_MONITORING_CONFIG
  ) {
    this.apiClient = apiClient
    this.getToken = getToken
    this.config = { ...config }

    logger.info('Health Check Manager initialized', 'health-checks', {
      enabled: this.config.enabled,
      apiInterval: this.config.healthChecks.apiInterval,
      networkInterval: this.config.healthChecks.networkInterval,
    })
  }

  /**
   * Start all health check monitoring
   */
  startMonitoring(): void {
    if (this.isRunning) {
      logger.warn('Health monitoring already running', 'health-checks')
      return
    }

    if (!this.config.enabled) {
      logger.info('Health monitoring disabled in config', 'health-checks')
      return
    }

    this.isRunning = true

    // Start API health checks
    this.startApiHealthCheck()

    // Start network connectivity checks
    this.startNetworkHealthCheck()

    logger.info('Health monitoring started', 'health-checks')
  }

  /**
   * Stop all health check monitoring
   */
  stopMonitoring(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval)
      logger.info(`Stopped health check: ${name}`, 'health-checks')
    }

    this.intervals.clear()
    logger.info('Health monitoring stopped', 'health-checks')
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(name: string): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      let result: HealthCheckResult

      switch (name) {
        case 'realdebrid-api':
          result = await this.checkApiHealth()
          break
        case 'network-connectivity':
          result = await this.checkNetworkConnectivity()
          break
        case 'authentication':
          result = await this.checkAuthenticationHealth()
          break
        default:
          throw new HealthCheckError(`Unknown health check: ${name}`, name)
      }

      // Add metadata
      result.responseTime = Date.now() - startTime
      this.lastResults.set(name, result)

      logger.info('Health check completed', 'health-checks', {
        name,
        success: result.success,
        responseTime: result.responseTime,
      })

      return result
    } catch (error) {
      const result: HealthCheckResult = {
        name,
        success: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      this.lastResults.set(name, result)
      logger.error('Health check failed', 'health-checks', {
        name,
        error: result.error,
        responseTime: result.responseTime,
      })

      return result
    }
  }

  /**
   * Perform all health checks
   */
  async performAllHealthChecks(): Promise<HealthCheckResult[]> {
    const checks = ['realdebrid-api', 'network-connectivity', 'authentication']
    const results = await Promise.allSettled(
      checks.map((check) => this.performHealthCheck(check))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          name: checks[index],
          success: false,
          responseTime: 0,
          timestamp: new Date(),
          error:
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error',
        }
      }
    })
  }

  /**
   * Get the last result for a specific health check
   */
  getLastResult(name: string): HealthCheckResult | null {
    return this.lastResults.get(name) || null
  }

  /**
   * Get all last results
   */
  getAllLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults)
  }

  /**
   * Start Real-Debrid API health check
   */
  private startApiHealthCheck(): void {
    const interval = setInterval(async () => {
      try {
        await this.checkApiHealth()
      } catch (error) {
        logger.error('API health check failed', 'health-checks', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }, this.config.healthChecks.apiInterval)

    this.intervals.set('realdebrid-api', interval)
    logger.info('API health check started', 'health-checks', {
      interval: this.config.healthChecks.apiInterval,
    })
  }

  /**
   * Start network connectivity health check
   */
  private startNetworkHealthCheck(): void {
    const interval = setInterval(async () => {
      try {
        await this.checkNetworkConnectivity()
      } catch (error) {
        logger.error('Network health check failed', 'health-checks', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }, this.config.healthChecks.networkInterval)

    this.intervals.set('network-connectivity', interval)
    logger.info('Network health check started', 'health-checks', {
      interval: this.config.healthChecks.networkInterval,
    })
  }

  /**
   * Check Real-Debrid API health
   */
  private async checkApiHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      // Use the user endpoint as a health check
      const response = await this.apiClient.get('/user', undefined, {
        signal: AbortSignal.timeout(this.config.healthChecks.timeout),
      })

      const responseTime = Date.now() - startTime

      return {
        name: 'realdebrid-api',
        success: true,
        responseTime,
        timestamp: new Date(),
        details: {
          endpoint: '/user',
          statusCode: 200,
        },
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Extract status code if available
      let statusCode: number | undefined
      if (errorMessage.includes('401')) {
        statusCode = 401
      } else if (errorMessage.includes('429')) {
        statusCode = 429
      } else if (errorMessage.includes('500')) {
        statusCode = 500
      } else if (errorMessage.includes('502')) {
        statusCode = 502
      } else if (errorMessage.includes('503')) {
        statusCode = 503
      }

      return {
        name: 'realdebrid-api',
        success: false,
        responseTime,
        statusCode,
        timestamp: new Date(),
        error: errorMessage,
        details: {
          endpoint: '/user',
          statusCode,
        },
      }
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://api.real-debrid.com/rest/1.0/version',
    ]

    try {
      const results = await Promise.allSettled(
        testUrls.map(async (url) => {
          const responseStartTime = Date.now()
          try {
            const response = await fetch(url, {
              method: 'HEAD',
              signal: AbortSignal.timeout(5000),
            })

            return {
              url,
              success: response.ok,
              responseTime: Date.now() - responseStartTime,
              statusCode: response.status,
            }
          } catch (error) {
            return {
              url,
              success: false,
              responseTime: Date.now() - responseStartTime,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          }
        })
      )

      const successfulChecks = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length

      const connectivity = successfulChecks / testUrls.length
      const responseTime = Date.now() - startTime

      const testResults = results.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return {
            url: 'unknown',
            success: false,
            responseTime: 0,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          }
        }
      })

      return {
        name: 'network-connectivity',
        success: connectivity > 0,
        responseTime,
        timestamp: new Date(),
        details: {
          connectivity,
          successfulChecks,
          totalChecks: testUrls.length,
          testResults,
        },
      }
    } catch (error) {
      return {
        name: 'network-connectivity',
        success: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check authentication health
   */
  private async checkAuthenticationHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now()

    try {
      const token = await this.getToken()
      if (!token) {
        return {
          name: 'authentication',
          success: false,
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: 'No authentication token available',
          details: {
            hasToken: false,
          },
        }
      }

      // Validate token by making a user info request
      const userInfo = await oauth2Client.getUserInfo(token)
      const responseTime = Date.now() - startTime

      return {
        name: 'authentication',
        success: true,
        responseTime,
        timestamp: new Date(),
        details: {
          hasToken: true,
          userId: userInfo.id,
          username: userInfo.username,
          premium: userInfo.premium,
          expiresAt: userInfo.expiration,
        },
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      let authError: string
      if (errorMessage.includes('401')) {
        authError = 'Token expired or invalid'
      } else if (errorMessage.includes('403')) {
        authError = 'Access forbidden'
      } else {
        authError = 'Authentication validation failed'
      }

      return {
        name: 'authentication',
        success: false,
        responseTime,
        timestamp: new Date(),
        error: authError,
        details: {
          errorMessage,
        },
      }
    }
  }

  /**
   * Get detailed service status based on health check results
   */
  getServiceStatus(): ServiceStatus {
    const apiResult = this.getLastResult('realdebrid-api')
    const networkResult = this.getLastResult('network-connectivity')

    if (!apiResult || !networkResult) {
      return {
        state: 'unavailable',
        responseTime: 0,
        errorRate: 100,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
        endpoints: {},
      }
    }

    const consecutiveFailures =
      this.calculateConsecutiveFailures('realdebrid-api')
    const errorRate = apiResult.success ? 0 : 100

    let state: ServiceStatus['state'] = 'available'
    if (networkResult.success && !apiResult.success) {
      if (apiResult.statusCode === 429) {
        state = 'rate_limited'
      } else if (apiResult.statusCode && apiResult.statusCode >= 500) {
        state = 'unavailable'
      } else {
        state = 'degraded'
      }
    } else if (!networkResult.success) {
      state = 'unavailable'
    } else if (apiResult.responseTime > 5000) {
      state = 'degraded'
    }

    return {
      state,
      responseTime: apiResult.responseTime,
      errorRate,
      lastHealthCheck: apiResult.timestamp,
      consecutiveFailures,
      endpoints: {
        user: {
          available: apiResult.success,
          responseTime: apiResult.responseTime,
          lastChecked: apiResult.timestamp,
          statusCode: apiResult.statusCode,
          error: apiResult.error,
        },
      },
      statusCode: apiResult.statusCode,
      errorMessage: apiResult.error,
    }
  }

  /**
   * Get detailed network status based on health check results
   */
  getNetworkStatus(): NetworkStatus {
    const networkResult = this.getLastResult('network-connectivity')

    if (!networkResult) {
      return {
        state: 'disconnected',
        online: false,
        latency: 0,
        effectiveType: 'unknown',
        lastChecked: new Date(),
      }
    }

    const details = networkResult.details as any
    const connectivity = details?.connectivity || 0
    const testResults = details?.testResults || []

    // Calculate average latency from successful tests
    const successfulTests = testResults.filter((r: any) => r.success)
    const avgLatency =
      successfulTests.length > 0
        ? successfulTests.reduce(
            (sum: number, r: any) => sum + r.responseTime,
            0
          ) / successfulTests.length
        : 0

    let state: NetworkState
    if (!networkResult.success || connectivity === 0) {
      state = 'disconnected'
    } else if (connectivity < 0.5 || avgLatency > 2000) {
      state = 'poor_connection'
    } else {
      state = 'connected'
    }

    // Try to get effective connection type from navigator if available
    let effectiveType = 'unknown'
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      effectiveType = connection?.effectiveType || 'unknown'
    }

    return {
      state,
      online: networkResult.success,
      latency: Math.round(avgLatency),
      effectiveType,
      lastChecked: networkResult.timestamp,
      connectionType: details?.connectionType,
    }
  }

  /**
   * Get authentication status based on health check results
   */
  getAuthenticationStatus(): AuthenticationStatus {
    const authResult = this.getLastResult('authentication')

    if (!authResult) {
      return {
        state: 'unauthenticated',
        canRefresh: false,
        lastValidated: new Date(),
      }
    }

    const details = authResult.details as any

    let state: AuthenticationState
    if (authResult.success) {
      state = 'authenticated'
    } else if (authResult.error?.includes('expired')) {
      state = 'token_expired'
    } else {
      state = 'error'
    }

    return {
      state,
      userId: details?.userId,
      username: details?.username,
      canRefresh: details?.userId !== undefined, // Assume refresh is possible if we have a user ID
      lastValidated: authResult.timestamp,
      errorCode: authResult.statusCode?.toString(),
      errorMessage: authResult.error,
    }
  }

  /**
   * Calculate consecutive failures for a health check
   */
  private calculateConsecutiveFailures(name: string): number {
    let failures = 0
    // This is a simplified implementation
    // In a real implementation, you'd track a history of results
    const result = this.getLastResult(name)
    if (result && !result.success) {
      failures = 1
    }
    return failures
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<typeof DEFAULT_MONITORING_CONFIG>): void {
    this.config = { ...this.config, ...config }

    // Restart monitoring with new config if currently running
    if (this.isRunning) {
      this.stopMonitoring()
      this.startMonitoring()
    }

    logger.info('Health check config updated', 'health-checks', {
      newConfig: config,
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof DEFAULT_MONITORING_CONFIG {
    return { ...this.config }
  }

  /**
   * Check if monitoring is currently running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const results = Array.from(this.lastResults.values())
    const successful = results.filter((r) => r.success).length
    const failed = results.length - successful

    const avgResponseTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
        : 0

    return {
      isRunning: this.isRunning,
      totalChecks: results.length,
      successful,
      failed,
      successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      lastCheck:
        results.length > 0
          ? Math.max(...results.map((r) => r.timestamp.getTime()))
          : null,
      activeIntervals: this.intervals.size,
    }
  }
}

export default HealthCheckManager
