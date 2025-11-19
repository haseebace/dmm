/**
 * Connection Notification Manager
 *
 * Handles in-app and browser notifications for connection status changes,
 * with support for throttling, priority levels, and user preferences.
 */

import { logger } from '@/lib/logger'
import { useConnectionStore } from '@/stores/connection-status'
import {
  ConnectionNotification,
  NotificationAction,
  ConnectionPreferences,
  ConnectionStatusData,
} from '@/types/connection'

// Notification system configuration
export interface NotificationConfig {
  enabled: boolean
  methods: {
    inApp: boolean
    browser: boolean
    email?: boolean
  }
  throttling: {
    enabled: boolean
    window: number // milliseconds
    maxNotifications: number
  }
  persistence: {
    enabled: boolean
    maxAge: number // milliseconds
    maxCount: number
  }
  sounds: {
    enabled: boolean
    volume: number // 0-1
  }
}

// Default notification configuration
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  methods: {
    inApp: true,
    browser: true,
    email: false,
  },
  throttling: {
    enabled: true,
    window: 30000, // 30 seconds
    maxNotifications: 3,
  },
  persistence: {
    enabled: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxCount: 100,
  },
  sounds: {
    enabled: false,
    volume: 0.5,
  },
}

// Notification template for common events
interface NotificationTemplate {
  title: string
  message: string
  type: ConnectionNotification['type']
  severity: ConnectionNotification['severity']
  actions?: NotificationAction[]
  autoDismiss?: boolean
  dismissDelay?: number
}

export class ConnectionNotificationManager {
  private config: NotificationConfig
  private preferences: ConnectionPreferences
  private store = useConnectionStore.getState()

  // Browser notification permission status
  private browserNotificationPermission: NotificationPermission = 'default'

  // Notification history for throttling
  private recentNotifications: Array<{
    id: string
    type: ConnectionNotification['type']
    timestamp: number
  }> = []

  // Throttling timers
  private throttlingTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config }
    this.preferences = this.store.preferences

    // Initialize browser notification permission
    this.initializeBrowserNotifications()

    logger.info(
      'Connection Notification Manager initialized',
      'notifications',
      {
        enabled: this.config.enabled,
        inApp: this.config.methods.inApp,
        browser: this.config.methods.browser,
      }
    )
  }

  /**
   * Create and send a notification
   */
  async sendNotification(
    notification: Omit<
      ConnectionNotification,
      'id' | 'timestamp' | 'dismissed' | 'acknowledged'
    >
  ): Promise<string | null> {
    if (!this.config.enabled) {
      logger.debug('Notifications disabled, skipping', 'notifications')
      return null
    }

    // Check throttling
    if (this.config.throttling.enabled && this.isThrottled(notification.type)) {
      logger.debug('Notification throttled', 'notifications', {
        type: notification.type,
        title: notification.title,
      })
      return null
    }

    // Generate notification ID
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const fullNotification: ConnectionNotification = {
      ...notification,
      id,
      timestamp: new Date(),
      dismissed: false,
      acknowledged: false,
    }

    // Add to recent notifications for throttling
    this.addToRecentNotifications(fullNotification)

    // Send to enabled methods
    await Promise.all([
      this.sendInAppNotification(fullNotification),
      this.sendBrowserNotification(fullNotification),
    ])

    logger.info('Notification sent', 'notifications', {
      id,
      type: notification.type,
      title: notification.title,
      severity: notification.severity,
    })

    return id
  }

  /**
   * Send notification based on connection status change
   */
  async sendConnectionStatusNotification(
    previousStatus: ConnectionStatusData | null,
    currentStatus: ConnectionStatusData
  ): Promise<string | null> {
    const template = this.getNotificationTemplate(previousStatus, currentStatus)
    if (!template) {
      return null
    }

    return this.sendNotification({
      type: template.type,
      title: template.title,
      message: template.message,
      severity: template.severity,
      actions: template.actions,
      dismissible: true,
    })
  }

  /**
   * Send reconnection progress notification
   */
  async sendReconnectionNotification(
    attempt: number,
    maxAttempts: number,
    strategy: string
  ): Promise<string | null> {
    if (attempt === 1) {
      return this.sendNotification({
        type: 'info',
        title: 'Reconnection Started',
        message: `Attempting to reconnect to Real-Debrid services... (1/${maxAttempts})`,
        severity: 'low',
        dismissible: false,
        actions: [
          {
            id: 'cancel',
            label: 'Cancel',
            action: 'dismiss',
            destructive: true,
          },
        ],
      })
    } else if (attempt === maxAttempts) {
      return this.sendNotification({
        type: 'error',
        title: 'Reconnection Failed',
        message: `Failed to reconnect after ${maxAttempts} attempts. Please check your connection and try manually.`,
        severity: 'high',
        dismissible: true,
        actions: [
          {
            id: 'retry',
            label: 'Try Again',
            action: 'reconnect',
            primary: true,
          },
          {
            id: 'support',
            label: 'Get Help',
            action: 'support',
          },
        ],
      })
    } else {
      return this.sendNotification({
        type: 'info',
        title: 'Reconnecting...',
        message: `Reconnection attempt ${attempt} of ${maxAttempts} using ${strategy} strategy.`,
        severity: 'low',
        dismissible: false,
      })
    }
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(id: string): void {
    this.store.dismissNotification(id)

    // Close browser notification if it exists
    if (this.config.methods.browser && 'Notification' in window) {
      // Browser notifications don't have a direct way to close by ID
      // This would require keeping track of notification instances
    }

    logger.info('Notification dismissed', 'notifications', { id })
  }

  /**
   * Acknowledge a notification
   */
  acknowledgeNotification(id: string): void {
    this.store.acknowledgeNotification(id)
    logger.info('Notification acknowledged', 'notifications', { id })
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    this.store.clearNotifications()
    logger.info('All notifications cleared', 'notifications')
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.store.markAllAsRead()
    logger.info('All notifications marked as read', 'notifications')
  }

  /**
   * Request browser notification permission
   */
  async requestBrowserNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('Browser notifications not supported', 'notifications')
      return false
    }

    if (this.browserNotificationPermission === 'granted') {
      return true
    }

    try {
      const permission = await Notification.requestPermission()
      this.browserNotificationPermission = permission

      logger.info(
        'Browser notification permission requested',
        'notifications',
        {
          permission,
        }
      )

      return permission === 'granted'
    } catch (error) {
      logger.error(
        'Failed to request browser notification permission',
        'notifications',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
      return false
    }
  }

  /**
   * Update notification configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Notification config updated', 'notifications', { config })
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: ConnectionPreferences): void {
    this.preferences = preferences
    logger.info('Notification preferences updated', 'notifications', {
      preferences,
    })
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const notifications = this.store.notifications
    const unread = notifications.filter((n) => !n.dismissed && !n.acknowledged)
    const byType = notifications.reduce(
      (counts, n) => {
        counts[n.type] = (counts[n.type] || 0) + 1
        return counts
      },
      {} as Record<string, number>
    )

    const bySeverity = notifications.reduce(
      (counts, n) => {
        counts[n.severity] = (counts[n.severity] || 0) + 1
        return counts
      },
      {} as Record<string, number>
    )

    return {
      total: notifications.length,
      unread: unread.length,
      byType,
      bySeverity,
      browserPermission: this.browserNotificationPermission,
      throttledCount: this.recentNotifications.length,
      config: this.config,
    }
  }

  /**
   * Initialize browser notifications
   */
  private initializeBrowserNotifications(): void {
    if ('Notification' in window) {
      this.browserNotificationPermission = Notification.permission

      if (this.browserNotificationPermission === 'default') {
        // Don't request permission immediately, wait for user interaction
        logger.info(
          'Browser notifications available but not requested',
          'notifications'
        )
      } else if (this.browserNotificationPermission === 'granted') {
        logger.info('Browser notifications already granted', 'notifications')
      } else {
        logger.warn('Browser notifications denied', 'notifications')
      }
    } else {
      logger.warn('Browser notifications not supported', 'notifications')
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    notification: ConnectionNotification
  ): Promise<void> {
    if (!this.config.methods.inApp) {
      return
    }

    // Add to store (this will trigger UI updates)
    this.store.addNotification(notification)

    // Auto-dismiss if configured
    if (notification.autoDismiss && notification.dismissDelay) {
      setTimeout(() => {
        this.dismissNotification(notification.id)
      }, notification.dismissDelay)
    }

    // Play sound if configured
    if (this.config.sounds.enabled) {
      this.playNotificationSound(notification.severity)
    }
  }

  /**
   * Send browser notification
   */
  private async sendBrowserNotification(
    notification: ConnectionNotification
  ): Promise<void> {
    if (!this.config.methods.browser || !('Notification' in window)) {
      return
    }

    if (this.browserNotificationPermission !== 'granted') {
      return
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.type),
        badge: '/favicon.ico',
        tag: notification.id, // Group similar notifications
        requireInteraction: !notification.autoDismiss,
        silent: !this.config.sounds.enabled,
      })

      // Handle click events
      browserNotification.onclick = (event) => {
        event.preventDefault()
        window.focus()

        // Handle actions if any
        if (notification.actions && notification.actions.length > 0) {
          const primaryAction = notification.actions.find((a) => a.primary)
          if (primaryAction) {
            this.handleNotificationAction(notification.id, primaryAction.action)
          }
        }

        browserNotification.close()
      }

      // Auto-close if configured
      if (notification.autoDismiss && notification.dismissDelay) {
        setTimeout(() => {
          browserNotification.close()
        }, notification.dismissDelay)
      }

      logger.info('Browser notification sent', 'notifications', {
        id: notification.id,
        title: notification.title,
      })
    } catch (error) {
      logger.error('Failed to send browser notification', 'notifications', {
        id: notification.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get notification icon based on type
   */
  private getNotificationIcon(type: ConnectionNotification['type']): string {
    const icons = {
      success: '/icons/success.png',
      warning: '/icons/warning.png',
      error: '/icons/error.png',
      info: '/icons/info.png',
    }

    return icons[type] || icons.info
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(
    severity: ConnectionNotification['severity']
  ): void {
    if (!this.config.sounds.enabled) {
      return
    }

    try {
      const audio = new Audio()
      audio.volume = this.config.sounds.volume

      // Different sounds for different severity levels
      switch (severity) {
        case 'critical':
          audio.src = '/sounds/critical.mp3'
          break
        case 'high':
          audio.src = '/sounds/high.mp3'
          break
        case 'medium':
          audio.src = '/sounds/medium.mp3'
          break
        case 'low':
          audio.src = '/sounds/low.mp3'
          break
        default:
          audio.src = '/sounds/default.mp3'
      }

      audio.play().catch((error) => {
        logger.warn('Failed to play notification sound', 'notifications', {
          error,
          severity,
        })
      })
    } catch (error) {
      logger.warn('Failed to create notification sound', 'notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        severity,
      })
    }
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(
    notificationId: string,
    action: NotificationAction['action']
  ): void {
    logger.info('Notification action triggered', 'notifications', {
      notificationId,
      action,
    })

    // Dispatch custom event for the application to handle
    const event = new CustomEvent('notificationAction', {
      detail: {
        notificationId,
        action,
      },
    })

    window.dispatchEvent(event)

    // Dismiss notification after action
    this.dismissNotification(notificationId)
  }

  /**
   * Get notification template based on status change
   */
  private getNotificationTemplate(
    previousStatus: ConnectionStatusData | null,
    currentStatus: ConnectionStatusData
  ): NotificationTemplate | null {
    const { overallStatus } = currentStatus

    // Status transition notifications
    if (previousStatus && previousStatus.overallStatus !== overallStatus) {
      switch (overallStatus) {
        case 'connected':
          return {
            title: 'Connection Restored',
            message: 'Successfully connected to Real-Debrid services.',
            type: 'success',
            severity: 'medium',
            actions: [
              {
                id: 'dismiss',
                label: 'Dismiss',
                action: 'dismiss',
                primary: true,
              },
            ],
            autoDismiss: true,
            dismissDelay: 5000,
          }

        case 'disconnected':
          return {
            title: 'Connection Lost',
            message: 'Lost connection to Real-Debrid services.',
            type: 'error',
            severity: 'high',
            actions: [
              {
                id: 'reconnect',
                label: 'Reconnect',
                action: 'reconnect',
                primary: true,
              },
              {
                id: 'settings',
                label: 'Settings',
                action: 'settings',
              },
            ],
          }

        case 'limited':
          if (currentStatus.service.state === 'rate_limited') {
            return {
              title: 'Rate Limited',
              message:
                'Real-Debrid API rate limit reached. Requests will be throttled.',
              type: 'warning',
              severity: 'medium',
              autoDismiss: true,
              dismissDelay: 8000,
            }
          } else {
            return {
              title: 'Limited Connection',
              message:
                'Real-Debrid services are experiencing some limitations.',
              type: 'warning',
              severity: 'medium',
              autoDismiss: true,
              dismissDelay: 6000,
            }
          }

        case 'error':
          if (currentStatus.authentication.state === 'error') {
            return {
              title: 'Authentication Error',
              message:
                'There was an error with your Real-Debrid authentication.',
              type: 'error',
              severity: 'high',
              actions: [
                {
                  id: 'reauth',
                  label: 'Re-authenticate',
                  action: 'settings',
                  primary: true,
                },
                {
                  id: 'support',
                  label: 'Get Help',
                  action: 'support',
                },
              ],
            }
          } else {
            return {
              title: 'Connection Error',
              message: 'An error occurred with your Real-Debrid connection.',
              type: 'error',
              severity: 'high',
              actions: [
                {
                  id: 'retry',
                  label: 'Retry',
                  action: 'reconnect',
                  primary: true,
                },
                {
                  id: 'support',
                  label: 'Get Help',
                  action: 'support',
                },
              ],
            }
          }
      }
    }

    // Degradation notifications (same status but worse conditions)
    if (previousStatus) {
      // High latency
      if (
        currentStatus.service.responseTime > 3000 &&
        previousStatus.service.responseTime <= 3000
      ) {
        return {
          title: 'High Latency',
          message: `Real-Debrid API response time is high (${currentStatus.service.responseTime}ms).`,
          type: 'warning',
          severity: 'medium',
          autoDismiss: true,
          dismissDelay: 8000,
        }
      }

      // Increasing error rate
      if (
        currentStatus.service.errorRate > 50 &&
        previousStatus.service.errorRate <= 50
      ) {
        return {
          title: 'High Error Rate',
          message: `Real-Debrid services are experiencing a high error rate (${currentStatus.service.errorRate}%).`,
          type: 'warning',
          severity: 'high',
          actions: [
            {
              id: 'retry',
              label: 'Retry',
              action: 'reconnect',
              primary: true,
            },
          ],
        }
      }
    }

    return null
  }

  /**
   * Check if notification should be throttled
   */
  private isThrottled(type: ConnectionNotification['type']): boolean {
    if (!this.config.throttling.enabled) {
      return false
    }

    const now = Date.now()
    const windowStart = now - this.config.throttling.window

    // Count recent notifications of the same type
    const recentOfType = this.recentNotifications.filter(
      (n) => n.type === type && n.timestamp > windowStart
    )

    return recentOfType.length >= this.config.throttling.maxNotifications
  }

  /**
   * Add notification to recent list for throttling
   */
  private addToRecentNotifications(notification: ConnectionNotification): void {
    this.recentNotifications.push({
      id: notification.id,
      type: notification.type,
      timestamp: Date.now(),
    })

    // Clean up old entries
    const now = Date.now()
    const windowStart = now - this.config.throttling.window

    this.recentNotifications = this.recentNotifications.filter(
      (n) => n.timestamp > windowStart
    )

    // Limit total size
    if (this.recentNotifications.length > 100) {
      this.recentNotifications = this.recentNotifications.slice(-50)
    }
  }
}

export default ConnectionNotificationManager
