/**
 * Real-time Connection Status Updates
 *
 * Manages real-time subscriptions to connection status changes,
 * health check results, and notifications using Supabase real-time.
 */

import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/client'
import { useConnectionStore } from '@/stores/connection-status'
import {
  ConnectionStatusData,
  HealthCheckResult,
  ConnectionNotification,
  ConnectionEvent,
} from '@/types/connection'

export interface RealtimeConnectionStatusOptions {
  userId: string
  onStatusChange?: (status: ConnectionStatusData) => void
  onHealthCheck?: (result: HealthCheckResult) => void
  onNotification?: (notification: ConnectionNotification) => void
  onConnectionEvent?: (event: ConnectionEvent) => void
  onError?: (error: Error) => void
}

export class RealtimeConnectionStatus {
  private options: RealtimeConnectionStatusOptions
  private supabase = createClient()
  private subscriptions: Map<string, any> = new Map()
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(options: RealtimeConnectionStatusOptions) {
    this.options = options

    logger.info(
      'Realtime Connection Status initialized',
      'realtime-connection',
      {
        userId: options.userId,
      }
    )
  }

  /**
   * Start all real-time subscriptions
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Realtime connection already active', 'realtime-connection')
      return
    }

    try {
      await this.setupSubscriptions()
      this.isConnected = true
      this.reconnectAttempts = 0

      logger.info('Realtime connection established', 'realtime-connection', {
        userId: this.options.userId,
        subscriptionCount: this.subscriptions.size,
      })
    } catch (error) {
      logger.error(
        'Failed to establish realtime connection',
        'realtime-connection',
        {
          userId: this.options.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )

      this.handleConnectionError(error as Error)
    }
  }

  /**
   * Disconnect all subscriptions
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return
    }

    try {
      // Unsubscribe from all channels
      for (const [name, subscription] of this.subscriptions) {
        await this.supabase.removeChannel(subscription)
        logger.info('Unsubscribed from channel', 'realtime-connection', {
          name,
        })
      }

      this.subscriptions.clear()
      this.isConnected = false

      logger.info('Realtime connection disconnected', 'realtime-connection', {
        userId: this.options.userId,
      })
    } catch (error) {
      logger.error(
        'Error disconnecting realtime connection',
        'realtime-connection',
        {
          userId: this.options.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      subscriptionCount: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    }
  }

  /**
   * Set up all subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    const { userId } = this.options

    // Subscribe to connection status changes
    const statusChannel = this.supabase
      .channel(`connection-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_status',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleConnectionStatusChange(payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(
            'Subscribed to connection status',
            'realtime-connection',
            { userId }
          )
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(
            'Failed to subscribe to connection status',
            'realtime-connection',
            { userId }
          )
        }
      })

    this.subscriptions.set('connection-status', statusChannel)

    // Subscribe to health check results
    const healthCheckChannel = this.supabase
      .channel(`health-checks-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_check_results',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleHealthCheckResult(payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to health checks', 'realtime-connection', {
            userId,
          })
        }
      })

    this.subscriptions.set('health-checks', healthCheckChannel)

    // Subscribe to new notifications
    const notificationsChannel = this.supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleNewNotification(payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to notifications', 'realtime-connection', {
            userId,
          })
        }
      })

    this.subscriptions.set('notifications', notificationsChannel)

    // Subscribe to connection events
    const eventsChannel = this.supabase
      .channel(`connection-events-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => this.handleConnectionEvent(payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(
            'Subscribed to connection events',
            'realtime-connection',
            { userId }
          )
        }
      })

    this.subscriptions.set('connection-events', eventsChannel)

    // Set up connection state monitoring
    this.setupConnectionMonitoring()
  }

  /**
   * Handle connection status changes
   */
  private async handleConnectionStatusChange(payload: any): Promise<void> {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload

      if (eventType === 'UPDATE' || eventType === 'INSERT') {
        const statusData: ConnectionStatusData = {
          authentication: {
            state: newRecord.authentication_state,
            userId: newRecord.user_id_rd,
            username: newRecord.username,
            canRefresh: newRecord.authentication_state !== 'unauthenticated',
            lastValidated: new Date(newRecord.last_health_check),
            errorCode: newRecord.status_code?.toString(),
            errorMessage: newRecord.error_message,
          },
          service: {
            state: newRecord.service_state,
            responseTime: newRecord.response_time,
            errorRate: Number(newRecord.error_rate),
            lastHealthCheck: new Date(newRecord.last_health_check),
            consecutiveFailures: newRecord.consecutive_errors,
            endpoints: newRecord.properties?.endpoints || {},
            statusCode: newRecord.status_code,
            errorMessage: newRecord.error_message,
          },
          network: {
            state: newRecord.network_state,
            online: newRecord.network_state !== 'disconnected',
            latency: newRecord.network_latency,
            effectiveType: newRecord.properties?.network_type || 'unknown',
            lastChecked: new Date(newRecord.last_health_check),
            connectionType: newRecord.properties?.connection_type,
          },
          lastUpdated: new Date(newRecord.updated_at),
          consecutiveErrors: newRecord.consecutive_errors,
          overallStatus: newRecord.overall_status as any,
        }

        // Update store
        useConnectionStore.getState().updateStatus(statusData)

        // Call callback
        this.options.onStatusChange?.(statusData)

        logger.info(
          'Connection status updated via realtime',
          'realtime-connection',
          {
            userId: this.options.userId,
            eventType,
            overallStatus: statusData.overallStatus,
          }
        )
      }
    } catch (error) {
      logger.error(
        'Error handling connection status change',
        'realtime-connection',
        {
          userId: this.options.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )

      this.options.onError?.(error as Error)
    }
  }

  /**
   * Handle new health check results
   */
  private async handleHealthCheckResult(payload: any): Promise<void> {
    try {
      const { new: newRecord } = payload

      const healthCheckResult: HealthCheckResult = {
        name: newRecord.check_name,
        success: newRecord.success,
        responseTime: newRecord.response_time,
        statusCode: newRecord.status_code,
        timestamp: new Date(newRecord.checked_at),
        error: newRecord.error_message,
        details: newRecord.check_details,
      }

      // Add to store
      useConnectionStore.getState().addHealthCheck(healthCheckResult)

      // Call callback
      this.options.onHealthCheck?.(healthCheckResult)

      logger.debug(
        'Health check result received via realtime',
        'realtime-connection',
        {
          userId: this.options.userId,
          checkName: healthCheckResult.name,
          success: healthCheckResult.success,
        }
      )
    } catch (error) {
      logger.error(
        'Error handling health check result',
        'realtime-connection',
        {
          userId: this.options.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Handle new notifications
   */
  private async handleNewNotification(payload: any): Promise<void> {
    try {
      const { new: newRecord } = payload

      const notification: ConnectionNotification = {
        id: newRecord.id,
        type: newRecord.notification_type,
        title: newRecord.title,
        message: newRecord.message,
        timestamp: new Date(newRecord.created_at),
        severity: newRecord.severity,
        dismissible: true, // Default to dismissible
        actions: newRecord.actions,
      }

      // Add to store if not already dismissed
      if (!newRecord.dismissed) {
        useConnectionStore.getState().addNotification(notification)
      }

      // Call callback
      this.options.onNotification?.(notification)

      logger.info(
        'New notification received via realtime',
        'realtime-connection',
        {
          userId: this.options.userId,
          type: notification.type,
          title: notification.title,
        }
      )
    } catch (error) {
      logger.error('Error handling new notification', 'realtime-connection', {
        userId: this.options.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Handle connection events
   */
  private async handleConnectionEvent(payload: any): Promise<void> {
    try {
      const { new: newRecord } = payload

      const event: ConnectionEvent = {
        id: newRecord.id,
        userId: newRecord.user_id,
        eventType: newRecord.event_type,
        previousState: newRecord.previous_state,
        newState: newRecord.new_state,
        eventData: newRecord.event_data,
        createdAt: new Date(newRecord.created_at),
        severity: newRecord.severity,
      }

      // Call callback
      this.options.onConnectionEvent?.(event)

      logger.info(
        'Connection event received via realtime',
        'realtime-connection',
        {
          userId: this.options.userId,
          eventType: event.eventType,
          severity: event.severity,
        }
      )
    } catch (error) {
      logger.error('Error handling connection event', 'realtime-connection', {
        userId: this.options.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Set up connection monitoring
   */
  private setupConnectionMonitoring(): void {
    // Monitor Supabase connection state
    this.supabase.realtime.onOpen(() => {
      logger.info('Realtime connection opened', 'realtime-connection', {
        userId: this.options.userId,
      })
    })

    this.supabase.realtime.onClose(() => {
      logger.warn('Realtime connection closed', 'realtime-connection', {
        userId: this.options.userId,
      })

      this.isConnected = false
      this.scheduleReconnect()
    })

    this.supabase.realtime.onError((error) => {
      logger.error('Realtime connection error', 'realtime-connection', {
        userId: this.options.userId,
        error: error?.message || 'Unknown error',
      })

      this.handleConnectionError(
        new Error(error?.message || 'Connection error')
      )
    })
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.isConnected = false
    this.options.onError?.(error)
    this.scheduleReconnect()
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', 'realtime-connection', {
        userId: this.options.userId,
        attempts: this.reconnectAttempts,
      })
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    const jitter = Math.random() * delay * 0.1

    logger.info('Scheduling reconnection attempt', 'realtime-connection', {
      userId: this.options.userId,
      attempt: this.reconnectAttempts + 1,
      delay: delay + jitter,
    })

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        this.handleConnectionError(error as Error)
      }
    }, delay + jitter)

    this.reconnectAttempts++
  }

  /**
   * Subscribe to status changes (helper method)
   */
  subscribeToStatusChanges(
    callback: (status: ConnectionStatusData) => void
  ): () => void {
    this.options.onStatusChange = callback
    return () => {
      this.options.onStatusChange = undefined
    }
  }

  /**
   * Subscribe to health checks (helper method)
   */
  subscribeToHealthChecks(
    callback: (result: HealthCheckResult) => void
  ): () => void {
    this.options.onHealthCheck = callback
    return () => {
      this.options.onHealthCheck = undefined
    }
  }

  /**
   * Subscribe to notifications (helper method)
   */
  subscribeToNotifications(
    callback: (notification: ConnectionNotification) => void
  ): () => void {
    this.options.onNotification = callback
    return () => {
      this.options.onNotification = undefined
    }
  }

  /**
   * Subscribe to connection events (helper method)
   */
  subscribeToConnectionEvents(
    callback: (event: ConnectionEvent) => void
  ): () => void {
    this.options.onConnectionEvent = callback
    return () => {
      this.options.onConnectionEvent = undefined
    }
  }
}

// React hook for easy usage
export function useRealtimeConnectionStatus(
  userId: string,
  options: Partial<Omit<RealtimeConnectionStatusOptions, 'userId'>> = {}
) {
  const [realtimeConnection, setRealtimeConnection] =
    React.useState<RealtimeConnectionStatus | null>(null)

  React.useEffect(() => {
    const connection = new RealtimeConnectionStatus({
      userId,
      ...options,
    })

    connection.connect()
    setRealtimeConnection(connection)

    return () => {
      connection.disconnect()
    }
  }, [userId])

  return realtimeConnection
}

export default RealtimeConnectionStatus
