/**
 * Connection Status Store
 *
 * Zustand store for managing Real-Debrid connection status,
 * health checks, notifications, and reconnection state.
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

import { logger } from '@/lib/logger'
import {
  ConnectionStoreState,
  ConnectionStoreActions,
  ConnectionStatusData,
  HealthCheckResult,
  ConnectionNotification,
  ConnectionDiagnostics,
  ConnectionPreferences,
  MonitoringConfig,
  DEFAULT_CONNECTION_PREFERENCES,
  DEFAULT_MONITORING_CONFIG,
  ConnectionStatus,
  AuthenticationState,
  ServiceState,
  NetworkState,
} from '@/types/connection'

type ConnectionStore = ConnectionStoreState & ConnectionStoreActions

// Calculate overall connection status from individual components
function calculateOverallStatus(
  authentication: AuthenticationState,
  service: ServiceState,
  network: NetworkState
): ConnectionStatus {
  // If network is disconnected, overall status is disconnected
  if (network === 'disconnected') {
    return 'disconnected'
  }

  // If authentication has errors, overall status reflects that
  if (authentication === 'error' || authentication === 'unauthenticated') {
    return 'error'
  }

  // If service is unavailable, overall status is error
  if (service === 'unavailable') {
    return 'error'
  }

  // If service is rate limited, overall status is limited
  if (service === 'rate_limited') {
    return 'limited'
  }

  // If service is degraded, overall status is limited
  if (service === 'degraded') {
    return 'limited'
  }

  // If any component has issues but still functional, show as limited
  if (
    authentication === 'token_expired' ||
    network === 'poor_connection' ||
    service === 'degraded'
  ) {
    return 'limited'
  }

  // If all components are good, status is connected
  if (
    authentication === 'authenticated' &&
    service === 'available' &&
    network === 'connected'
  ) {
    return 'connected'
  }

  // Default to connecting for unknown states
  return 'connecting'
}

// Helper function to create initial connection status
function createInitialConnectionStatus(): ConnectionStatusData {
  const now = new Date()

  return {
    authentication: {
      state: 'unauthenticated',
      canRefresh: false,
      lastValidated: now,
    },
    service: {
      state: 'unavailable',
      responseTime: 0,
      errorRate: 100,
      lastHealthCheck: now,
      consecutiveFailures: 0,
      endpoints: {},
    },
    network: {
      state: 'disconnected',
      online: false,
      latency: 0,
      effectiveType: 'unknown',
      lastChecked: now,
    },
    lastUpdated: now,
    consecutiveErrors: 0,
    overallStatus: 'disconnected',
  }
}

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          status: null,
          isLoading: false,
          lastUpdated: null,

          healthChecks: [],
          lastHealthCheck: null,

          notifications: [],
          unreadCount: 0,

          isReconnecting: false,
          reconnectionAttempts: 0,
          lastReconnection: null,

          diagnostics: null,
          showDiagnostics: false,

          preferences: DEFAULT_CONNECTION_PREFERENCES,
          monitoringConfig: DEFAULT_MONITORING_CONFIG,

          // Status management actions
          updateStatus: (statusUpdate) => {
            const currentState = get().status
            const currentStatus =
              currentState || createInitialConnectionStatus()

            const newStatus: ConnectionStatusData = {
              ...currentStatus,
              ...statusUpdate,
              // If authentication, service, or network are updated, recalculate overall status
              overallStatus: calculateOverallStatus(
                statusUpdate.authentication?.state ||
                  currentStatus.authentication.state,
                statusUpdate.service?.state || currentStatus.service.state,
                statusUpdate.network?.state || currentStatus.network.state
              ),
              lastUpdated: new Date(),
            }

            set((state) => ({
              status: newStatus,
              lastUpdated: new Date(),
              // Update consecutive errors based on status
              consecutiveErrors:
                newStatus.overallStatus === 'connected'
                  ? 0
                  : newStatus.overallStatus === 'error'
                    ? state.consecutiveErrors + 1
                    : state.consecutiveErrors,
            }))

            logger.info('Connection status updated', 'connection-store', {
              previousStatus: currentStatus.overallStatus,
              newStatus: newStatus.overallStatus,
              authentication: newStatus.authentication.state,
              service: newStatus.service.state,
              network: newStatus.network.state,
            })

            // Trigger notifications for significant status changes
            const previousOverallStatus = currentStatus.overallStatus
            if (previousOverallStatus !== newStatus.overallStatus) {
              get().handleStatusChange(
                previousOverallStatus,
                newStatus.overallStatus
              )
            }
          },

          setStatus: (status) => {
            set({
              status,
              lastUpdated: new Date(),
              consecutiveErrors:
                status.overallStatus === 'connected'
                  ? 0
                  : get().consecutiveErrors,
            })

            logger.info('Connection status set', 'connection-store', {
              status: status.overallStatus,
            })
          },

          clearStatus: () => {
            set({
              status: null,
              lastUpdated: null,
              isReconnecting: false,
              reconnectionAttempts: 0,
              lastReconnection: null,
            })
          },

          // Health check actions
          addHealthCheck: (result) => {
            set((state) => ({
              healthChecks: [result, ...state.healthChecks].slice(0, 100), // Keep last 100 checks
              lastHealthCheck: result.timestamp,
            }))

            logger.info('Health check result added', 'connection-store', {
              name: result.name,
              success: result.success,
              responseTime: result.responseTime,
            })
          },

          clearHealthChecks: () => {
            set({ healthChecks: [], lastHealthCheck: null })
          },

          // Notification actions
          addNotification: (notification) => {
            const id = uuidv4()
            const fullNotification: ConnectionNotification = {
              ...notification,
              id,
              timestamp: new Date(),
            }

            set((state) => {
              const notifications = [fullNotification, ...state.notifications]

              // Apply throttling if enabled
              let filteredNotifications = notifications
              if (
                state.preferences.throttleNotifications &&
                notifications.length > 1
              ) {
                // Remove similar notifications within throttle window
                const throttleTime = state.preferences.healthCheckInterval
                const now = Date.now()

                filteredNotifications = notifications.filter((notif, index) => {
                  if (index === 0) return true // Keep the newest

                  const timeDiff = now - notif.timestamp.getTime()
                  const isSimilarType = notif.type === notifications[0].type

                  return !isSimilarType || timeDiff > throttleTime
                })
              }

              // Keep only last 50 notifications
              const limitedNotifications = filteredNotifications.slice(0, 50)

              return {
                notifications: limitedNotifications,
                unreadCount: limitedNotifications.filter(
                  (n) => !n.dismissed && !n.acknowledged
                ).length,
              }
            })

            logger.info('Notification added', 'connection-store', {
              id,
              type: notification.type,
              title: notification.title,
            })
          },

          dismissNotification: (id) => {
            set((state) => ({
              notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, dismissed: true } : n
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            }))
          },

          acknowledgeNotification: (id) => {
            set((state) => ({
              notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, acknowledged: true } : n
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            }))
          },

          clearNotifications: () => {
            set({ notifications: [], unreadCount: 0 })
          },

          markAllAsRead: () => {
            set((state) => ({
              notifications: state.notifications.map((n) => ({
                ...n,
                acknowledged: true,
              })),
              unreadCount: 0,
            }))
          },

          // Reconnection actions
          startReconnection: () => {
            set({
              isReconnecting: true,
              reconnectionAttempts: 0,
              lastReconnection: new Date(),
            })

            logger.info('Reconnection started', 'connection-store')
          },

          stopReconnection: () => {
            set({
              isReconnecting: false,
              reconnectionAttempts: 0,
            })

            logger.info('Reconnection stopped', 'connection-store')
          },

          incrementReconnectionAttempts: () => {
            set((state) => ({
              reconnectionAttempts: state.reconnectionAttempts + 1,
            }))

            logger.info(
              'Reconnection attempt incremented',
              'connection-store',
              {
                attempts: get().reconnectionAttempts,
              }
            )
          },

          // Diagnostics actions
          setDiagnostics: (diagnostics) => {
            set({ diagnostics })
          },

          toggleDiagnostics: () => {
            set((state) => ({ showDiagnostics: !state.showDiagnostics }))
          },

          // Preferences actions
          updatePreferences: (preferences) => {
            set((state) => ({
              preferences: { ...state.preferences, ...preferences },
            }))

            logger.info('Connection preferences updated', 'connection-store', {
              preferences,
            })
          },

          updateMonitoringConfig: (config) => {
            set((state) => ({
              monitoringConfig: { ...state.monitoringConfig, ...config },
            }))

            logger.info('Monitoring config updated', 'connection-store', {
              config,
            })
          },

          // Initialization and cleanup
          initialize: (userId: string) => {
            logger.info('Connection store initialized', 'connection-store', {
              userId,
              currentStatus: get().status?.overallStatus,
            })

            // Set initial status if not present
            if (!get().status) {
              get().setStatus(createInitialConnectionStatus())
            }
          },

          cleanup: () => {
            logger.info('Connection store cleaned up', 'connection-store')
            get().clearStatus()
            get().clearNotifications()
            get().clearHealthChecks()
          },

          // Private method to handle status changes
          handleStatusChange: (
            previousStatus: ConnectionStatus,
            newStatus: ConnectionStatus
          ) => {
            const state = get()

            if (!state.preferences.enableNotifications) return

            // Generate appropriate notifications for status changes
            switch (newStatus) {
              case 'connected':
                if (previousStatus !== 'connected') {
                  get().addNotification({
                    type: 'success',
                    title: 'Connection Restored',
                    message: 'Successfully connected to Real-Debrid services.',
                    severity: 'medium',
                    dismissible: true,
                    actions: [
                      {
                        id: 'dismiss',
                        label: 'Dismiss',
                        action: 'dismiss',
                        primary: true,
                      },
                    ],
                  })
                }
                break

              case 'disconnected':
                get().addNotification({
                  type: 'error',
                  title: 'Connection Lost',
                  message: 'Lost connection to Real-Debrid services.',
                  severity: 'high',
                  dismissible: true,
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
                })
                break

              case 'limited':
                if (previousStatus === 'connected') {
                  get().addNotification({
                    type: 'warning',
                    title: 'Limited Connection',
                    message:
                      'Real-Debrid services are experiencing some limitations.',
                    severity: 'medium',
                    dismissible: true,
                  })
                }
                break

              case 'error':
                get().addNotification({
                  type: 'error',
                  title: 'Connection Error',
                  message:
                    'An error occurred with your Real-Debrid connection.',
                  severity: 'high',
                  dismissible: true,
                  actions: [
                    {
                      id: 'retry',
                      label: 'Retry',
                      action: 'retry',
                      primary: true,
                    },
                    {
                      id: 'support',
                      label: 'Get Help',
                      action: 'support',
                    },
                  ],
                })
                break

              case 'reconnecting':
                get().addNotification({
                  type: 'info',
                  title: 'Reconnecting',
                  message: 'Attempting to reconnect to Real-Debrid services...',
                  severity: 'low',
                  dismissible: false,
                })
                break
            }
          },
        }),
        {
          name: 'connection-status-store',
          // Only persist preferences and config, not dynamic state
          partialize: (state) => ({
            preferences: state.preferences,
            monitoringConfig: state.monitoringConfig,
            diagnostics: state.diagnostics,
            showDiagnostics: state.showDiagnostics,
          }),
          version: 1,
          onRehydrateStorage: () => (state) => {
            if (state) {
              logger.info('Connection store rehydrated', 'connection-store', {
                hasPreferences: !!state.preferences,
                hasConfig: !!state.monitoringConfig,
              })
            }
          },
        }
      )
    ),
    {
      name: 'connection-status-store',
    }
  )
)

// Selectors for commonly used state combinations
export const useConnectionStatus = () =>
  useConnectionStore((state) => state.status)
export const useConnectionLoading = () =>
  useConnectionStore((state) => state.isLoading)
export const useConnectionNotifications = () =>
  useConnectionStore((state) => state.notifications)
export const useUnreadNotifications = () =>
  useConnectionStore((state) => state.unreadCount)
export const useReconnectionState = () =>
  useConnectionStore((state) => ({
    isReconnecting: state.isReconnecting,
    attempts: state.reconnectionAttempts,
    lastReconnection: state.lastReconnection,
  }))
export const useConnectionPreferences = () =>
  useConnectionStore((state) => state.preferences)
export const useConnectionDiagnostics = () =>
  useConnectionStore((state) => state.diagnostics)
export const useHealthChecks = () =>
  useConnectionStore((state) => state.healthChecks)

// Combined selectors for specific use cases
export const useConnectionHealth = () =>
  useConnectionStore((state) => {
    const status = state.status
    if (!status) return null

    return {
      overallStatus: status.overallStatus,
      authentication: status.authentication.state,
      service: status.service.state,
      network: status.network.state,
      lastUpdated: status.lastUpdated,
      consecutiveErrors: status.consecutiveErrors,
    }
  })

export const useConnectionActions = () =>
  useConnectionStore((state) => ({
    updateStatus: state.updateStatus,
    setStatus: state.setStatus,
    clearStatus: state.clearStatus,
    addHealthCheck: state.addHealthCheck,
    addNotification: state.addNotification,
    dismissNotification: state.dismissNotification,
    startReconnection: state.startReconnection,
    stopReconnection: state.stopReconnection,
    toggleDiagnostics: state.toggleDiagnostics,
    updatePreferences: state.updatePreferences,
    initialize: state.initialize,
    cleanup: state.cleanup,
  }))

// Export the store instance for direct usage
export { useConnectionStore as connectionStore }
