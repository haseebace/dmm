/**
 * Reconnection Manager
 *
 * Handles automatic reconnection logic with exponential backoff,
 * token refresh, and recovery strategies for Real-Debrid connections.
 */

import { logger } from '@/lib/logger'
import { oauth2Client } from '@/lib/oauth2/client'
import { HealthCheckManager } from '@/lib/health-checks/manager'
import {
  ReconnectionContext,
  ReconnectionResult,
  ConnectionStatusData,
  DEFAULT_MONITORING_CONFIG,
  ReconnectionError,
} from '@/types/connection'

// Reconnection strategy types
export type ReconnectionStrategy =
  | 'token_refresh'
  | 'retry'
  | 'full_reauth'
  | 'network_wait'

// Reconnection attempt configuration
interface ReconnectionAttempt {
  attempt: number
  strategy: ReconnectionStrategy
  delay: number
  timestamp: Date
  success: boolean
  error?: string
}

export class ReconnectionManager {
  private config: (typeof DEFAULT_MONITORING_CONFIG)['reconnection']
  private healthCheckManager: HealthCheckManager
  private getToken: () => Promise<string | null>
  private refreshToken: () => Promise<string | null>
  private onTokenUpdate?: (token: string) => Promise<void>
  private onStatusUpdate?: (status: Partial<ConnectionStatusData>) => void

  // Reconnection state
  private isActive = false
  private currentContext: ReconnectionContext | null = null
  private attempts: ReconnectionAttempt[] = []
  private timeoutHandle: NodeJS.Timeout | null = null

  constructor(
    healthCheckManager: HealthCheckManager,
    getToken: () => Promise<string | null>,
    refreshToken: () => Promise<string | null>,
    onTokenUpdate?: (token: string) => Promise<void>,
    onStatusUpdate?: (status: Partial<ConnectionStatusData>) => void,
    config = DEFAULT_MONITORING_CONFIG.reconnection
  ) {
    this.healthCheckManager = healthCheckManager
    this.getToken = getToken
    this.refreshToken = refreshToken
    this.onTokenUpdate = onTokenUpdate
    this.onStatusUpdate = onStatusUpdate
    this.config = { ...config }

    logger.info('Reconnection Manager initialized', 'reconnection', {
      maxAttempts: this.config.maxAttempts,
      baseDelay: this.config.baseDelay,
      maxDelay: this.config.maxDelay,
      backoffMultiplier: this.config.backoffMultiplier,
    })
  }

  /**
   * Start reconnection process
   */
  async startReconnection(
    context: ReconnectionContext
  ): Promise<ReconnectionResult> {
    if (this.isActive) {
      logger.warn('Reconnection already in progress', 'reconnection')
      return {
        success: false,
        attempts: this.attempts.length,
        duration: 0,
        error: 'Reconnection already in progress',
        strategy: 'retry',
      }
    }

    this.isActive = true
    this.currentContext = context
    this.attempts = []

    const startTime = Date.now()
    const maxAttempts = context.maxAttempts || this.config.maxAttempts

    logger.info('Starting reconnection process', 'reconnection', {
      userId: context.userId,
      reason: context.reason,
      maxAttempts,
    })

    // Update connection status to reconnecting
    if (this.onStatusUpdate) {
      this.onStatusUpdate({
        overallStatus: 'reconnecting',
      })
    }

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const strategy = this.determineStrategy(attempt, context)
        const delay = this.calculateDelay(attempt)

        // Add jitter if enabled
        const finalDelay = this.config.jitter ? this.addJitter(delay) : delay

        logger.info('Reconnection attempt planned', 'reconnection', {
          attempt,
          maxAttempts,
          strategy,
          delay: finalDelay,
        })

        // Wait before attempting (except for first attempt)
        if (attempt > 1) {
          await this.sleep(finalDelay)
        }

        const result = await this.performReconnectionAttempt(
          attempt,
          strategy,
          context
        )
        this.attempts.push(result)

        if (result.success) {
          const duration = Date.now() - startTime

          logger.info('Reconnection successful', 'reconnection', {
            userId: context.userId,
            attempts: attempt,
            duration,
            strategy,
          })

          // Update connection status to connected
          if (this.onStatusUpdate) {
            this.onStatusUpdate({
              overallStatus: 'connected',
              service: {
                state: 'available',
                responseTime: 0,
                errorRate: 0,
                lastHealthCheck: new Date(),
                consecutiveFailures: 0,
                endpoints: {},
              },
            })
          }

          this.isActive = false
          this.currentContext = null

          return {
            success: true,
            attempts: attempt,
            duration,
            newStatus: await this.getCurrentStatus(),
            strategy,
          }
        }

        // If this was the last attempt, break
        if (attempt === maxAttempts) {
          break
        }

        logger.warn('Reconnection attempt failed', 'reconnection', {
          attempt,
          strategy,
          error: result.error,
          nextDelay: this.calculateDelay(attempt + 1),
        })
      }

      // All attempts failed
      const duration = Date.now() - startTime
      const lastAttempt = this.attempts[this.attempts.length - 1]

      logger.error('Reconnection failed after all attempts', 'reconnection', {
        userId: context.userId,
        totalAttempts: this.attempts.length,
        duration,
        finalError: lastAttempt?.error,
      })

      // Update connection status to error
      if (this.onStatusUpdate) {
        this.onStatusUpdate({
          overallStatus: 'error',
        })
      }

      this.isActive = false
      this.currentContext = null

      return {
        success: false,
        attempts: this.attempts.length,
        duration,
        error: lastAttempt?.error || 'All reconnection attempts failed',
        strategy: 'retry',
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error(
        'Reconnection process failed with exception',
        'reconnection',
        {
          userId: context.userId,
          error: errorMessage,
          duration,
        }
      )

      this.isActive = false
      this.currentContext = null

      return {
        success: false,
        attempts: this.attempts.length,
        duration,
        error: errorMessage,
        strategy: 'retry',
      }
    }
  }

  /**
   * Stop current reconnection process
   */
  stopReconnection(): void {
    if (!this.isActive) {
      return
    }

    logger.info('Reconnection stopped', 'reconnection', {
      userId: this.currentContext?.userId,
      attempts: this.attempts.length,
    })

    this.isActive = false
    this.currentContext = null

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  /**
   * Get current reconnection status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      context: this.currentContext,
      attempts: [...this.attempts],
      currentAttempt: this.attempts.length,
    }
  }

  /**
   * Determine reconnection strategy based on attempt number and context
   */
  private determineStrategy(
    attempt: number,
    context: ReconnectionContext
  ): ReconnectionStrategy {
    switch (context.reason) {
      case 'authentication':
        if (attempt === 1) {
          return 'token_refresh'
        } else if (attempt === 2) {
          return 'full_reauth'
        } else {
          return 'retry'
        }

      case 'service_unavailable':
        if (attempt <= 3) {
          return 'retry'
        } else if (attempt === 4) {
          return 'token_refresh'
        } else {
          return 'retry'
        }

      case 'network_disconnect':
        return 'network_wait'

      case 'manual':
        if (attempt === 1) {
          return 'token_refresh'
        } else {
          return 'retry'
        }

      default:
        return 'retry'
    }
  }

  /**
   * Calculate delay for exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay =
      this.config.baseDelay *
      Math.pow(this.config.backoffMultiplier, attempt - 1)
    return Math.min(delay, this.config.maxDelay)
  }

  /**
   * Add jitter to delay to prevent thundering herd
   */
  private addJitter(delay: number): number {
    const jitter = Math.random() * delay * 0.1 // 10% jitter
    return delay + jitter
  }

  /**
   * Perform a single reconnection attempt
   */
  private async performReconnectionAttempt(
    attempt: number,
    strategy: ReconnectionStrategy,
    context: ReconnectionContext
  ): Promise<ReconnectionAttempt> {
    const startTime = Date.now()

    try {
      let success = false
      let error: string | undefined

      switch (strategy) {
        case 'token_refresh':
          success = await this.tryTokenRefresh()
          if (!success) error = 'Token refresh failed'
          break

        case 'full_reauth':
          success = await this.tryFullReauthentication()
          if (!success) error = 'Full re-authentication required'
          break

        case 'retry':
          success = await this.trySimpleRetry()
          if (!success) error = 'Retry failed'
          break

        case 'network_wait':
          success = await this.waitForNetwork()
          if (!success) error = 'Network still unavailable'
          break

        default:
          error = `Unknown strategy: ${strategy}`
      }

      return {
        attempt,
        strategy,
        delay: Date.now() - startTime,
        timestamp: new Date(),
        success,
        error,
      }
    } catch (err) {
      return {
        attempt,
        strategy,
        delay: Date.now() - startTime,
        timestamp: new Date(),
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  /**
   * Try to refresh the authentication token
   */
  private async tryTokenRefresh(): Promise<boolean> {
    try {
      logger.info('Attempting token refresh', 'reconnection')

      const refreshTokenValue = await this.refreshToken()
      if (!refreshTokenValue) {
        logger.warn('No refresh token available', 'reconnection')
        return false
      }

      // Test the new token with a health check
      const healthResult =
        await this.healthCheckManager.performHealthCheck('authentication')
      const apiResult =
        await this.healthCheckManager.performHealthCheck('realdebrid-api')

      return healthResult.success && apiResult.success
    } catch (error) {
      logger.error('Token refresh failed', 'reconnection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Try full re-authentication (requires user intervention)
   */
  private async tryFullReauthentication(): Promise<boolean> {
    try {
      logger.info('Attempting full re-authentication', 'reconnection')

      // Check if current token works
      const currentToken = await this.getToken()
      if (!currentToken) {
        return false
      }

      // Test with user endpoint
      const healthResult =
        await this.healthCheckManager.performHealthCheck('authentication')
      return healthResult.success
    } catch (error) {
      logger.error('Full re-authentication failed', 'reconnection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Try a simple retry of the API connection
   */
  private async trySimpleRetry(): Promise<boolean> {
    try {
      logger.info('Attempting simple retry', 'reconnection')

      // Perform both API and network health checks
      const [networkResult, apiResult] = await Promise.all([
        this.healthCheckManager.performHealthCheck('network-connectivity'),
        this.healthCheckManager.performHealthCheck('realdebrid-api'),
      ])

      return networkResult.success && apiResult.success
    } catch (error) {
      logger.error('Simple retry failed', 'reconnection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Wait for network connectivity to be restored
   */
  private async waitForNetwork(): Promise<boolean> {
    try {
      logger.info('Waiting for network connectivity', 'reconnection')

      const networkResult = await this.healthCheckManager.performHealthCheck(
        'network-connectivity'
      )
      return networkResult.success
    } catch (error) {
      logger.error('Network wait failed', 'reconnection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Get current connection status
   */
  private async getCurrentStatus(): Promise<ConnectionStatusData> {
    const authStatus = this.healthCheckManager.getAuthenticationStatus()
    const serviceStatus = this.healthCheckManager.getServiceStatus()
    const networkStatus = this.healthCheckManager.getNetworkStatus()

    let overallStatus: ConnectionStatusData['overallStatus']
    if (
      authStatus.state === 'authenticated' &&
      serviceStatus.state === 'available' &&
      networkStatus.state === 'connected'
    ) {
      overallStatus = 'connected'
    } else {
      overallStatus = 'limited'
    }

    return {
      authentication: authStatus,
      service: serviceStatus,
      network: networkStatus,
      lastUpdated: new Date(),
      consecutiveErrors: 0,
      overallStatus,
    }
  }

  /**
   * Sleep helper function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Update configuration
   */
  updateConfig(
    config: Partial<(typeof DEFAULT_MONITORING_CONFIG)['reconnection']>
  ): void {
    this.config = { ...this.config, ...config }

    logger.info('Reconnection config updated', 'reconnection', {
      newConfig: config,
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): (typeof DEFAULT_MONITORING_CONFIG)['reconnection'] {
    return { ...this.config }
  }

  /**
   * Get reconnection statistics
   */
  getStats() {
    const successfulAttempts = this.attempts.filter((a) => a.success).length
    const failedAttempts = this.attempts.length - successfulAttempts

    const totalDelay = this.attempts.reduce((sum, a) => sum + a.delay, 0)
    const averageDelay =
      this.attempts.length > 0 ? totalDelay / this.attempts.length : 0

    const strategyCounts = this.attempts.reduce(
      (counts, attempt) => {
        counts[attempt.strategy] = (counts[attempt.strategy] || 0) + 1
        return counts
      },
      {} as Record<ReconnectionStrategy, number>
    )

    return {
      isActive: this.isActive,
      totalAttempts: this.attempts.length,
      successfulAttempts,
      failedAttempts,
      successRate:
        this.attempts.length > 0
          ? (successfulAttempts / this.attempts.length) * 100
          : 0,
      averageDelay: Math.round(averageDelay),
      totalDelay,
      strategyCounts,
      lastAttempt:
        this.attempts.length > 0
          ? this.attempts[this.attempts.length - 1]
          : null,
    }
  }
}

export default ReconnectionManager
