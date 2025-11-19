/**
 * Connection Status Integration Example
 *
 * Complete example showing how to integrate all connection status features
 * in a React application with proper initialization, cleanup, and event handling.
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ConnectionMonitor } from './monitor'
import { RealtimeConnectionStatus } from '../realtime/connection-status'
import { ConnectionNotificationManager } from '../notifications/manager'
import { ConnectionPersistence } from '../storage/connection-persistence'
import { RealDebridClient } from '../realdebrid/client'
import { useConnectionStore } from '../../stores/connection-status'
import {
  ConnectionStatusData,
  ConnectionNotification,
  DEFAULT_CONNECTION_PREFERENCES,
} from '../../types/connection'

/**
 * Connection Status Provider Component
 *
 * This component demonstrates how to set up and manage the complete
 * connection status system in a React application.
 */
export function ConnectionStatusProvider({
  children,
  userId,
  apiClient,
  getToken,
  refreshToken,
  onTokenUpdate,
}: {
  children: React.ReactNode
  userId: string
  apiClient: RealDebridClient
  getToken: () => Promise<string | null>
  refreshToken: () => Promise<string | null>
  onTokenUpdate?: (token: string) => Promise<void>
}) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [connectionMonitor, setConnectionMonitor] =
    useState<ConnectionMonitor | null>(null)
  const [realtimeConnection, setRealtimeConnection] =
    useState<RealtimeConnectionStatus | null>(null)
  const [notificationManager, setNotificationManager] =
    useState<ConnectionNotificationManager | null>(null)
  const [persistence, setPersistence] = useState<ConnectionPersistence | null>(
    null
  )

  const { notifications, markAllAsRead, updatePreferences, addNotification } =
    useConnectionStore()

  // Initialize connection status system
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        console.log('Initializing connection status system...')

        // 1. Initialize persistence layer
        const persistenceInstance = new ConnectionPersistence({
          storageType: 'localStorage',
          encrypt: false,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })

        if (mounted) {
          setPersistence(persistenceInstance)

          // Load persisted data
          const [
            persistedStatus,
            persistedPreferences,
            persistedNotifications,
          ] = await Promise.all([
            persistenceInstance.loadConnectionStatus(),
            persistenceInstance.loadPreferences(),
            persistenceInstance.loadNotifications(),
          ])

          // Update store with persisted data
          if (persistedStatus) {
            useConnectionStore.getState().setStatus(persistedStatus)
            console.log('Restored connection status from storage')
          }

          if (persistedPreferences) {
            useConnectionStore
              .getState()
              .updatePreferences(persistedPreferences)
            console.log('Restored preferences from storage')
          }

          if (persistedNotifications.length > 0) {
            persistedNotifications.forEach((notification) => {
              useConnectionStore.getState().addNotification(notification)
            })
            console.log(
              `Restored ${persistedNotifications.length} notifications from storage`
            )
          }
        }

        // 2. Initialize notification manager
        const notificationManagerInstance = new ConnectionNotificationManager({
          enabled: true,
          methods: {
            inApp: true,
            browser: true,
          },
          throttling: {
            enabled: true,
            window: 30000,
            maxNotifications: 3,
          },
        })

        if (mounted) {
          setNotificationManager(notificationManagerInstance)
          console.log('Notification manager initialized')
        }

        // 3. Initialize connection monitor
        const connectionMonitorInstance = new ConnectionMonitor({
          userId,
          apiClient,
          getToken,
          refreshToken,
          onTokenUpdate,
          preferences: persistedPreferences || DEFAULT_CONNECTION_PREFERENCES,
        })

        if (mounted) {
          setConnectionMonitor(connectionMonitorInstance)
          console.log('Connection monitor initialized')
        }

        // 4. Initialize real-time connection
        const realtimeConnectionInstance = new RealtimeConnectionStatus({
          userId,
          onStatusChange: (status: ConnectionStatusData) => {
            console.log('Real-time status change:', status.overallStatus)

            // Save to persistence
            persistenceInstance?.saveConnectionStatus(status)
          },
          onHealthCheck: (result) => {
            console.log('Real-time health check:', result.name, result.success)
          },
          onNotification: (notification: ConnectionNotification) => {
            console.log('Real-time notification:', notification.title)

            // Show notification using manager
            notificationManagerInstance?.sendNotification(notification)

            // Save to persistence
            persistenceInstance?.saveNotifications(
              useConnectionStore.getState().notifications
            )
          },
          onConnectionEvent: (event) => {
            console.log(
              'Real-time connection event:',
              event.eventType,
              event.severity
            )
          },
          onError: (error) => {
            console.error('Real-time connection error:', error)
          },
        })

        if (mounted) {
          setRealtimeConnection(realtimeConnectionInstance)
          console.log('Real-time connection initialized')
        }

        // 5. Start monitoring and real-time connection
        await Promise.all([
          connectionMonitorInstance.startMonitoring(),
          realtimeConnectionInstance.connect(),
        ])

        if (mounted) {
          setIsInitialized(true)
          console.log('Connection status system fully initialized')
        }

        // 6. Update last seen timestamp
        await persistenceInstance.updateLastSeen()
      } catch (error) {
        console.error('Failed to initialize connection status system:', error)
      }
    }

    initialize()

    // Cleanup function
    return () => {
      mounted = false
      console.log('Cleaning up connection status system...')

      connectionMonitor?.stopMonitoring()
      realtimeConnection?.disconnect()

      setConnectionMonitor(null)
      setRealtimeConnection(null)
      setNotificationManager(null)
      setPersistence(null)
      setIsInitialized(false)
    }
  }, [userId, apiClient, getToken, refreshToken, onTokenUpdate])

  // Handle global notification actions
  useEffect(() => {
    const handleNotificationAction = (event: CustomEvent) => {
      const { notificationId, action } = event.detail

      console.log(
        'Notification action:',
        action,
        'for notification:',
        notificationId
      )

      switch (action) {
        case 'reconnect':
          connectionMonitor?.triggerManualReconnection('manual')
          break
        case 'settings':
          // Navigate to settings page
          window.location.href = '/settings/connection'
          break
        case 'support':
          // Open support page
          window.open('https://support.real-debrid.com', '_blank')
          break
        case 'retry':
          connectionMonitor?.performManualHealthCheck('all')
          break
        default:
          console.log('Unknown notification action:', action)
      }
    }

    const handleConnectionNotificationAction = (event: CustomEvent) => {
      const { action, notification } = event.detail
      handleNotificationAction({
        detail: { notificationId: notification.id, action },
      } as CustomEvent)
    }

    window.addEventListener(
      'notificationAction',
      handleNotificationAction as EventListener
    )
    window.addEventListener(
      'connectionNotificationAction',
      handleConnectionNotificationAction as EventListener
    )

    return () => {
      window.removeEventListener(
        'notificationAction',
        handleNotificationAction as EventListener
      )
      window.removeEventListener(
        'connectionNotificationAction',
        handleConnectionNotificationAction as EventListener
      )
    }
  }, [connectionMonitor])

  // Handle browser visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && persistence) {
        // Page became visible, check if we need to update last seen
        await persistence.updateLastSeen()

        // Optionally trigger a health check if we haven't checked recently
        const lastHealthCheck = useConnectionStore.getState().lastHealthCheck
        if (
          !lastHealthCheck ||
          Date.now() - lastHealthCheck.getTime() > 5 * 60 * 1000
        ) {
          connectionMonitor?.performManualHealthCheck('network')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [connectionMonitor, persistence])

  // Auto-save preferences when they change
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe(
      (state) => state.preferences,
      async (preferences) => {
        if (persistence && isInitialized) {
          await persistence.savePreferences(preferences)
        }
      }
    )

    return unsubscribe
  }, [persistence, isInitialized])

  // Auto-save notifications when they change
  useEffect(() => {
    const unsubscribe = useConnectionStore.subscribe(
      (state) => state.notifications,
      async (notifications) => {
        if (persistence && isInitialized) {
          await persistence.saveNotifications(notifications)
        }
      }
    )

    return unsubscribe
  }, [persistence, isInitialized])

  // Periodic cleanup of old data
  useEffect(() => {
    if (!persistence || !isInitialized) return

    const cleanupInterval = setInterval(
      async () => {
        try {
          await persistence.cleanup()
          console.log('Periodic cleanup completed')
        } catch (error) {
          console.error('Cleanup failed:', error)
        }
      },
      60 * 60 * 1000
    ) // Every hour

    return () => clearInterval(cleanupInterval)
  }, [persistence, isInitialized])

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-muted-foreground">
            Initializing connection monitoring...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* The main application content */}
      {children}

      {/* Connection status indicator (shown in header or sidebar) */}
      {/* <ConnectionStatusIndicator /> */}

      {/* Notification system */}
      {/* <ConnectionNotifications /> */}
    </div>
  )
}

/**
 * Hook for easy access to connection status functionality
 */
export function useConnectionStatus() {
  const store = useConnectionStore()

  const triggerManualHealthCheck = useCallback(
    async (type?: 'api' | 'network' | 'authentication' | 'all') => {
      // This would be implemented using the API or directly calling the monitor
      console.log('Triggering manual health check:', type)
    },
    []
  )

  const triggerManualReconnection = useCallback(
    async (
      reason?:
        | 'manual'
        | 'authentication'
        | 'service_unavailable'
        | 'network_disconnect'
    ) => {
      // This would be implemented using the API or directly calling the monitor
      console.log('Triggering manual reconnection:', reason)
    },
    []
  )

  const clearAllNotifications = useCallback(() => {
    store.clearNotifications()
  }, [store])

  const updatePreferences = useCallback(
    (preferences: Partial<typeof DEFAULT_CONNECTION_PREFERENCES>) => {
      store.updatePreferences(preferences)
    },
    [store]
  )

  const exportDiagnostics = useCallback(async () => {
    // Export diagnostics data
    const diagnostics = {
      timestamp: new Date(),
      status: store.status,
      healthChecks: store.healthChecks,
      notifications: store.notifications,
      preferences: store.preferences,
    }

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `connection-diagnostics-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [store])

  return {
    // State
    status: store.status,
    isLoading: store.isLoading,
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    isReconnecting: store.isReconnecting,
    healthChecks: store.healthChecks,

    // Actions
    triggerManualHealthCheck,
    triggerManualReconnection,
    clearAllNotifications,
    markAllAsRead: store.markAllAsRead,
    updatePreferences,
    exportDiagnostics,

    // Store actions
    dismissNotification: store.dismissNotification,
    acknowledgeNotification: store.acknowledgeNotification,
    addNotification: store.addNotification,
    updateStatus: store.updateStatus,
  }
}

/**
 * Example usage in a page component
 */
export function ExamplePage() {
  const {
    status,
    notifications,
    unreadCount,
    triggerManualHealthCheck,
    triggerManualReconnection,
    clearAllNotifications,
  } = useConnectionStatus()

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold">Dashboard</h1>

        {/* Connection Status Display */}
        <div className="bg-card mb-6 rounded-lg p-6">
          <h2 className="mb-4 text-xl font-semibold">Connection Status</h2>
          {status ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <span className="text-muted-foreground text-sm">
                  Overall Status:
                </span>
                <div className="font-medium capitalize">
                  {status.overallStatus}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">
                  Authentication:
                </span>
                <div className="font-medium capitalize">
                  {status.authentication.state}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Service:</span>
                <div className="font-medium capitalize">
                  {status.service.state}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              Loading connection status...
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => triggerManualHealthCheck('all')}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Run Health Check
          </button>
          <button
            onClick={() => triggerManualReconnection('manual')}
            className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            Reconnect
          </button>
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
            >
              Clear Notifications ({unreadCount})
            </button>
          )}
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="bg-card rounded-lg p-6">
            <h2 className="mb-4 text-xl font-semibold">Recent Notifications</h2>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded border p-3 ${
                    notification.type === 'error'
                      ? 'border-red-200 bg-red-50'
                      : notification.type === 'warning'
                        ? 'border-yellow-200 bg-yellow-50'
                        : notification.type === 'success'
                          ? 'border-green-200 bg-green-50'
                          : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-muted-foreground text-sm">
                        {notification.message}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {notification.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionStatusProvider
