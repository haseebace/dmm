/**
 * Connection Status Monitor
 *
 * Main service that coordinates health checks, reconnection logic,
 * status updates, and notifications for Real-Debrid connections.
 */

import { logger } from '@/lib/logger'
import { RealDebridClient } from '@/lib/realdebrid/client'
import { useConnectionStore } from '@/stores/connection-status'
import { HealthCheckManager } from '@/lib/health-checks/manager'
import { ReconnectionManager } from '@/lib/reconnection/manager'
import {
  ConnectionStatusData,
  ConnectionPreferences,
  MonitoringConfig,
  DEFAULT_CONNECTION_PREFERENCES,
  DEFAULT_MONITORING_CONFIG,
  ReconnectionContext,
  ConnectionEvent,
} from '@/types/connection'

// Monitor configuration options
export interface ConnectionMonitorOptions {
  userId: string
  apiClient: RealDebridClient
  getToken: () => Promise<string | null>
  refreshToken: () => Promise<string | null>
  onTokenUpdate?: (token: string) => Promise<void>
  preferences?: Partial<ConnectionPreferences>
  config?: Partial<MonitoringConfig>
}

// Event type for status changes
export interface StatusChangeEvent {
  previousStatus: ConnectionStatusData | null
  currentStatus: ConnectionStatusData
  changeType: 'initial' | 'improvement' | 'degradation' | 'critical'
  timestamp: Date
}

export class ConnectionMonitor {
  private options: Required<ConnectionMonitorOptions>
  private healthCheckManager: HealthCheckManager
  private reconnectionManager: ReconnectionManager
  private store = useConnectionStore.getState()

  // Monitoring state
  private isActive = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private eventListeners: Map<string, (event: any) => void> = new Map()

  // Last known status for change detection
  private lastStatus: ConnectionStatusData | null = null

  constructor(options: ConnectionMonitorOptions) {
    this.options = {
      ...options,
      preferences: {
        ...DEFAULT_CONNECTION_PREFERENCES,
        ...options.preferences,
      },
      config: { ...DEFAULT_MONITORING_CONFIG, ...options.config },
    }

    // Initialize managers
    this.healthCheckManager = new HealthCheckManager(
      this.options.apiClient,
      this.options.getToken,
      this.options.config.healthChecks
    )

    this.reconnectionManager = new ReconnectionManager(
      this.healthCheckManager,
      this.options.getToken,
      this.options.refreshToken,
      this.options.onTokenUpdate,
      this.handleStatusUpdate.bind(this),
      this.options.config.reconnection
    )

    logger.info('Connection Monitor initialized', 'connection-monitor', {
      userId: this.options.userId,
      enabled: this.options.config.enabled,
    })
  }

  /**
   * Start connection monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isActive) {
      logger.warn('Connection monitoring already active', 'connection-monitor')
      return
    }

    if (!this.options.config.enabled) {
      logger.info(
        'Connection monitoring disabled in config',
        'connection-monitor'
      )
      return
    }

    this.isActive = true

    // Initialize store
    this.store.initialize(this.options.userId)
    this.store.updatePreferences(this.options.preferences)

    // Set up store subscriptions
    this.setupStoreSubscriptions()

    // Perform initial health check
    await this.performInitialHealthCheck()

    // Start health check monitoring
    this.healthCheckManager.startMonitoring()

    // Start periodic status updates
    this.startPeriodicStatusUpdates()

    logger.info('Connection monitoring started', 'connection-monitor', {
      userId: this.options.userId,
      healthCheckInterval: this.options.config.healthChecks.apiInterval,
      statusUpdateInterval: this.options.config.healthChecks.networkInterval,
    })
  }

  /**
   * Stop connection monitoring
   */
  stopMonitoring(): void {
    if (!this.isActive) {
      return
    }

    this.isActive = false

    // Stop health check monitoring
    this.healthCheckManager.stopMonitoring()

    // Stop reconnection if active
    this.reconnectionManager.stopReconnection()

    // Clear periodic status updates
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    // Clear event listeners
    for (const [event, listener] of this.eventListeners) {
      // Remove listeners (implementation depends on event system)
    }
    this.eventListeners.clear()

    // Cleanup store
    this.store.cleanup()

    logger.info('Connection monitoring stopped', 'connection-monitor', {
      userId: this.options.userId,
    })
  }

  /**
   * Perform manual health check
   */
  async performManualHealthCheck(
    checkType?: 'api' | 'network' | 'authentication' | 'all'
  ): Promise<void> {
    const checkName = checkType === 'all' ? 'all checks' : `${checkType} check`

    logger.info('Performing manual health check', 'connection-monitor', {
      userId: this.options.userId,
      checkType,
    })

    try {
      let results

      if (checkType === 'all') {
        results = await this.healthCheckManager.performAllHealthChecks()
      } else {
        const checkMap = {
          api: 'realdebrid-api',
          network: 'network-connectivity',
          authentication: 'authentication',
        }
        const healthCheckName = checkMap[checkType]
        if (healthCheckName) {
          const result =
            await this.healthCheckManager.performHealthCheck(healthCheckName)
          results = [result]
        }
      }

      // Add results to store
      if (results) {
        results.forEach((result) => {
          this.store.addHealthCheck(result)
        })
      }

      // Update status
      await this.updateStatusFromHealthChecks()

      logger.info('Manual health check completed', 'connection-monitor', {
        userId: this.options.userId,
        checkType,
        resultsCount: results?.length || 0,
      })
    } catch (error) {
      logger.error('Manual health check failed', 'connection-monitor', {
        userId: this.options.userId,
        checkType,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Trigger manual reconnection
   */
  async triggerManualReconnection(
    reason: ReconnectionContext['reason'] = 'manual'
  ): Promise<boolean> {
    if (!this.lastStatus) {
      logger.warn(
        'Cannot trigger reconnection: no current status',
        'connection-monitor'
      )
      return false
    }

    const context: ReconnectionContext = {
      userId: this.options.userId,
      reason,
      previousStatus: this.lastStatus,
      maxAttempts: this.options.config.reconnection.maxAttempts,
      baseDelay: this.options.config.reconnection.baseDelay,
      maxDelay: this.options.config.reconnection.maxDelay,
    }

    logger.info('Triggering manual reconnection', 'connection-monitor', {
      userId: this.options.userId,
      reason,
      maxAttempts: context.maxAttempts,
    })

    // Start reconnection
    this.store.startReconnection()
    const result = await this.reconnectionManager.startReconnection(context)
    this.store.stopReconnection()

    return result.success
  }

  /**
   * Get current connection status
   */
  getCurrentStatus(): ConnectionStatusData | null {
    return this.lastStatus
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    return {
      isActive: this.isActive,
      userId: this.options.userId,
      healthChecks: this.healthCheckManager.getStats(),
      reconnection: this.reconnectionManager.getStats(),
      store: {
        notifications: this.store.notifications.length,
        unreadNotifications: this.store.unreadCount,
        lastUpdated: this.store.lastUpdated,
      },
      config: this.options.config,
    }
  }

  /**
   * Update monitoring preferences
   */
  updatePreferences(preferences: Partial<ConnectionPreferences>): void {
    this.options.preferences = { ...this.options.preferences, ...preferences }
    this.store.updatePreferences(preferences)

    logger.info('Connection preferences updated', 'connection-monitor', {
      userId: this.options.userId,
      preferences,
    })
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.options.config = { ...this.options.config, ...config }

    // Update manager configurations
    this.healthCheckManager.updateConfig(this.options.config)
    this.reconnectionManager.updateConfig(this.options.config.reconnection)

    // Update store
    this.store.updateMonitoringConfig(this.options.config)

    // Restart monitoring if currently active and config changed significantly
    if (this.isActive && config.enabled !== undefined) {
      if (!config.enabled) {
        this.stopMonitoring()
      } else {
        // Restart with new config
        this.stopMonitoring()
        this.startMonitoring()
      }
    }

    logger.info('Monitoring config updated', 'connection-monitor', {
      userId: this.options.userId,
      config,
    })
  }

  /**
   * Set up store subscriptions
   */
  private setupStoreSubscriptions(): void {
    // Subscribe to status changes for logging and analytics
    // This would typically use Zustand subscribe method
  }

  /**
   * Perform initial health check
   */
  private async performInitialHealthCheck(): Promise<void> {
    logger.info('Performing initial health check', 'connection-monitor', {
      userId: this.options.userId,
    })

    try {
      const results = await this.healthCheckManager.performAllHealthChecks()

      // Add results to store
      results.forEach((result) => {
        this.store.addHealthCheck(result)
      })

      // Update status
      await this.updateStatusFromHealthChecks()

      logger.info('Initial health check completed', 'connection-monitor', {
        userId: this.options.userId,
        resultsCount: results.length,
        status: this.lastStatus?.overallStatus,
      })
    } catch (error) {
      logger.error('Initial health check failed', 'connection-monitor', {
        userId: this.options.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Start periodic status updates
   */
  private startPeriodicStatusUpdates(): void {
    // Update status based on health check results at longer intervals
    this.monitoringInterval = setInterval(async () => {
      if (this.isActive) {
        await this.updateStatusFromHealthChecks()
      }
    }, this.options.config.healthChecks.networkInterval)

    logger.info('Periodic status updates started', 'connection-monitor', {
      interval: this.options.config.healthChecks.networkInterval,
    })
  }

  /**
   * Update connection status from health check results
   */
  private async updateStatusFromHealthChecks(): Promise<void> {
    try {
      const authStatus = this.healthCheckManager.getAuthenticationStatus()
      const serviceStatus = this.healthCheckManager.getServiceStatus()
      const networkStatus = this.healthCheckManager.getNetworkStatus()

      const currentStatus: ConnectionStatusData = {
        authentication: authStatus,
        service: serviceStatus,
        network: networkStatus,
        lastUpdated: new Date(),
        consecutiveErrors: this.calculateConsecutiveErrors(serviceStatus),
        overallStatus: this.calculateOverallStatus(
          authStatus,
          serviceStatus,
          networkStatus
        ),
      }

      // Detect if status changed significantly
      const statusChange = this.detectStatusChange(
        this.lastStatus,
        currentStatus
      )

      // Update store
      this.store.updateStatus(currentStatus)

      // Store current status
      this.lastStatus = currentStatus

      // Handle status change
      if (statusChange) {
        await this.handleStatusChange(statusChange)
      }

      // Check if reconnection is needed
      if (this.shouldStartReconnection(currentStatus)) {
        await this.startAutomaticReconnection(currentStatus)
      }
    } catch (error) {
      logger.error(
        'Failed to update status from health checks',
        'connection-monitor',
        {
          userId: this.options.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Calculate overall connection status
   */
  private calculateOverallStatus(
    authentication: any,
    service: any,
    network: any
  ): ConnectionStatusData['overallStatus'] {
    // If network is disconnected, overall status is disconnected
    if (network.state === 'disconnected') {
      return 'disconnected'
    }

    // If authentication has errors, overall status reflects that
    if (
      authentication.state === 'error' ||
      authentication.state === 'unauthenticated'
    ) {
      return 'error'
    }

    // If service is unavailable, overall status is error
    if (service.state === 'unavailable') {
      return 'error'
    }

    // If service is rate limited, overall status is limited
    if (service.state === 'rate_limited') {
      return 'limited'
    }

    // If any component has issues but still functional, show as limited
    if (
      authentication.state === 'token_expired' ||
      network.state === 'poor_connection' ||
      service.state === 'degraded'
    ) {
      return 'limited'
    }

    // If all components are good, status is connected
    if (
      authentication.state === 'authenticated' &&
      service.state === 'available' &&
      network.state === 'connected'
    ) {
      return 'connected'
    }

    // Default to connecting for unknown states
    return 'connecting'
  }

  /**
   * Calculate consecutive errors
   */
  private calculateConsecutiveErrors(serviceStatus: any): number {
    // This is simplified - in real implementation, track history
    return serviceStatus.state === 'unavailable' ? 1 : 0
  }

  /**
   * Detect significant status changes
   */
  private detectStatusChange(
    previous: ConnectionStatusData | null,
    current: ConnectionStatusData
  ): StatusChangeEvent | null {
    if (!previous) {
      return {
        previousStatus: null,
        currentStatus: current,
        changeType: 'initial',
        timestamp: new Date(),
      }
    }

    let changeType: StatusChangeEvent['changeType'] = 'improvement'

    if (previous.overallStatus !== current.overallStatus) {
      // Determine if it's an improvement or degradation
      const statusPriority = {
        connected: 4,
        limited: 3,
        connecting: 2,
        disconnected: 1,
        error: 0,
      }

      const previousPriority = statusPriority[previous.overallStatus] || 0
      const currentPriority = statusPriority[current.overallStatus] || 0

      if (currentPriority < previousPriority) {
        changeType = 'degradation'
        if (currentPriority <= 1) {
          changeType = 'critical'
        }
      }
    } else {
      // Check for degradation within same status (e.g., increasing response times)
      if (
        current.service.responseTime > previous.service.responseTime * 1.5 ||
        current.consecutiveErrors > previous.consecutiveErrors
      ) {
        changeType = 'degradation'
      }
    }

    if (
      changeType !== 'improvement' ||
      previous.overallStatus !== current.overallStatus
    ) {
      return {
        previousStatus: previous,
        currentStatus: current,
        changeType,
        timestamp: new Date(),
      }
    }

    return null
  }

  /**
   * Handle status change
   */
  private async handleStatusChange(
    statusChange: StatusChangeEvent
  ): Promise<void> {
    logger.info('Connection status changed', 'connection-monitor', {
      userId: this.options.userId,
      previousStatus: statusChange.previousStatus?.overallStatus,
      currentStatus: statusChange.currentStatus.overallStatus,
      changeType: statusChange.changeType,
    })

    // Store status change event for analytics/monitoring
    const event: ConnectionEvent = {
      id: `status-change-${Date.now()}`,
      userId: this.options.userId,
      eventType: 'status_change',
      previousState: statusChange.previousStatus?.overallStatus,
      newState: statusChange.currentStatus.overallStatus,
      eventData: {
        changeType: statusChange.changeType,
        timestamp: statusChange.timestamp,
        authentication: statusChange.currentStatus.authentication.state,
        service: statusChange.currentStatus.service.state,
        network: statusChange.currentStatus.network.state,
        responseTime: statusChange.currentStatus.service.responseTime,
        consecutiveErrors: statusChange.currentStatus.consecutiveErrors,
      },
      createdAt: statusChange.timestamp,
      severity: statusChange.changeType === 'critical' ? 'critical' : 'info',
    }

    // Here you would send the event to your analytics/logging system
    // await this.sendConnectionEvent(event)
  }

  /**
   * Check if automatic reconnection should be started
   */
  private shouldStartReconnection(status: ConnectionStatusData): boolean {
    if (!this.options.preferences.enableAutoReconnect) {
      return false
    }

    // Don't start if already reconnecting
    if (this.reconnectionManager.getStatus().isActive) {
      return false
    }

    // Start reconnection for certain conditions
    return (
      status.overallStatus === 'error' ||
      status.overallStatus === 'disconnected' ||
      (status.overallStatus === 'limited' &&
        status.service.state === 'unavailable')
    )
  }

  /**
   * Start automatic reconnection
   */
  private async startAutomaticReconnection(
    status: ConnectionStatusData
  ): Promise<void> {
    // Determine reconnection reason based on status
    let reason: ReconnectionContext['reason'] = 'service_unavailable'

    if (
      status.authentication.state === 'error' ||
      status.authentication.state === 'token_expired'
    ) {
      reason = 'authentication'
    } else if (status.network.state === 'disconnected') {
      reason = 'network_disconnect'
    } else if (status.service.state === 'unavailable') {
      reason = 'service_unavailable'
    }

    const context: ReconnectionContext = {
      userId: this.options.userId,
      reason,
      previousStatus: status,
    }

    logger.info('Starting automatic reconnection', 'connection-monitor', {
      userId: this.options.userId,
      reason,
      status: status.overallStatus,
    })

    // Start reconnection
    this.store.startReconnection()
    const result = await this.reconnectionManager.startReconnection(context)
    this.store.stopReconnection()

    if (result.success) {
      logger.info('Automatic reconnection successful', 'connection-monitor', {
        userId: this.options.userId,
        attempts: result.attempts,
        duration: result.duration,
      })
    } else {
      logger.error('Automatic reconnection failed', 'connection-monitor', {
        userId: this.options.userId,
        attempts: result.attempts,
        duration: result.duration,
        error: result.error,
      })
    }
  }

  /**
   * Handle status update from reconnection manager
   */
  private handleStatusUpdate(
    statusUpdate: Partial<ConnectionStatusData>
  ): void {
    if (this.isActive) {
      this.store.updateStatus(statusUpdate)
    }
  }
}

export default ConnectionMonitor
