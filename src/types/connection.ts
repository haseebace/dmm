/**
 * Connection Status Management Types
 *
 * Comprehensive type definitions for managing Real-Debrid connection status,
 * health checks, notifications, and reconnection logic.
 */

// Core connection status types
export type AuthenticationState =
  | 'unauthenticated'
  | 'authenticated'
  | 'token_expired'
  | 'error'

export type ServiceState =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'rate_limited'

export type NetworkState = 'connected' | 'disconnected' | 'poor_connection'

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'
  | 'limited'
  | 'reconnecting'

// Authentication status interface
export interface AuthenticationStatus {
  state: AuthenticationState
  userId?: string
  username?: string
  expiresAt?: Date
  canRefresh: boolean
  lastValidated: Date
  errorCode?: string
  errorMessage?: string
}

// Service status interface
export interface ServiceStatus {
  state: ServiceState
  responseTime: number
  errorRate: number
  lastHealthCheck: Date
  consecutiveFailures: number
  endpoints: Record<string, EndpointStatus>
  statusCode?: number
  errorMessage?: string
}

// Individual endpoint status
export interface EndpointStatus {
  available: boolean
  responseTime: number
  lastChecked: Date
  statusCode?: number
  error?: string
}

// Network status interface
export interface NetworkStatus {
  state: NetworkState
  online: boolean
  latency: number
  effectiveType: string
  lastChecked: Date
  connectionType?: string
  downlink?: number
  rtt?: number
}

// Health check result interface
export interface HealthCheckResult {
  name: string
  success: boolean
  responseTime: number
  statusCode?: number
  timestamp: Date
  error?: string
  details?: Record<string, unknown>
}

// Network check result
export interface NetworkCheckResult {
  online: boolean
  connectivity: number // 0-1 percentage
  latency: number
  timestamp: Date
  results: Array<{
    url: string
    success: boolean
    responseTime: number
    error?: string
  }>
}

// Main connection status interface
export interface ConnectionStatusData {
  authentication: AuthenticationStatus
  service: ServiceStatus
  network: NetworkStatus
  lastUpdated: Date
  consecutiveErrors: number
  overallStatus: ConnectionStatus

  // Additional metadata
  userAgent?: string
  sessionId?: string
  location?: string
}

// Connection event types
export interface ConnectionEvent {
  id: string
  userId: string
  eventType: string
  previousState?: string
  newState?: string
  eventData: Record<string, unknown>
  createdAt: Date
  severity: 'info' | 'warning' | 'error' | 'critical'
}

// Connection notification interface
export interface ConnectionNotification {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions?: NotificationAction[]
  dismissible: boolean
  dismissed?: boolean
  acknowledged?: boolean
}

// Notification action interface
export interface NotificationAction {
  id: string
  label: string
  action: 'reconnect' | 'retry' | 'settings' | 'support' | 'dismiss'
  primary?: boolean
  destructive?: boolean
}

// Reconnection context
export interface ReconnectionContext {
  userId: string
  reason:
    | 'authentication'
    | 'service_unavailable'
    | 'network_disconnect'
    | 'manual'
  previousStatus: ConnectionStatusData
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
}

// Reconnection result
export interface ReconnectionResult {
  success: boolean
  attempts: number
  duration: number
  newStatus?: ConnectionStatusData
  error?: string
  strategy: 'token_refresh' | 'retry' | 'full_reauth'
}

// Connection diagnostics
export interface ConnectionDiagnostics {
  timestamp: Date
  authentication: {
    tokenValid: boolean
    tokenExpiresAt?: Date
    refreshTokenAvailable: boolean
    lastValidation: Date
  }
  service: {
    apiReachable: boolean
    endpointsStatus: Record<string, EndpointStatus>
    rateLimitStatus: RateLimitInfo
  }
  network: {
    online: boolean
    latency: number
    effectiveType: string
    dnsResolution: boolean
    sslHandshake: boolean
  }
  system: {
    userAgent: string
    language: string
    timezone: string
    screenResolution?: string
  }
}

// Rate limit information (reused from realdebrid types)
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Connection preferences
export interface ConnectionPreferences {
  healthCheckInterval: number // milliseconds
  enableNotifications: boolean
  enableAutoReconnect: boolean
  maxReconnectAttempts: number
  notificationMethods: ('in_app' | 'browser' | 'email')[]
  throttleNotifications: boolean
  enableDiagnostics: boolean
}

// Connection monitoring configuration
export interface MonitoringConfig {
  enabled: boolean
  healthChecks: {
    apiInterval: number
    networkInterval: number
    timeout: number
    maxRetries: number
  }
  reconnection: {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
    jitter: boolean
  }
  notifications: {
    enabled: boolean
    types: string[]
    methods: string[]
    throttle: number
  }
  persistence: {
    enabled: boolean
    storageType: 'localStorage' | 'sessionStorage' | 'indexedDB'
    encrypt: boolean
  }
}

// Store state interface (for Zustand)
export interface ConnectionStoreState {
  // Current status
  status: ConnectionStatusData | null
  isLoading: boolean
  lastUpdated: Date | null

  // Health check results
  healthChecks: HealthCheckResult[]
  lastHealthCheck: Date | null

  // Notifications
  notifications: ConnectionNotification[]
  unreadCount: number

  // Reconnection state
  isReconnecting: boolean
  reconnectionAttempts: number
  lastReconnection: Date | null

  // Diagnostics
  diagnostics: ConnectionDiagnostics | null
  showDiagnostics: boolean

  // Configuration
  preferences: ConnectionPreferences
  monitoringConfig: MonitoringConfig
}

// Store actions interface
export interface ConnectionStoreActions {
  // Status management
  updateStatus: (status: Partial<ConnectionStatusData>) => void
  setStatus: (status: ConnectionStatusData) => void
  clearStatus: () => void

  // Health checks
  addHealthCheck: (result: HealthCheckResult) => void
  clearHealthChecks: () => void

  // Notifications
  addNotification: (
    notification: Omit<ConnectionNotification, 'id' | 'timestamp'>
  ) => void
  dismissNotification: (id: string) => void
  acknowledgeNotification: (id: string) => void
  clearNotifications: () => void
  markAllAsRead: () => void

  // Reconnection
  startReconnection: () => void
  stopReconnection: () => void
  incrementReconnectionAttempts: () => void

  // Diagnostics
  setDiagnostics: (diagnostics: ConnectionDiagnostics) => void
  toggleDiagnostics: () => void

  // Preferences
  updatePreferences: (preferences: Partial<ConnectionPreferences>) => void
  updateMonitoringConfig: (config: Partial<MonitoringConfig>) => void

  // Initialization and cleanup
  initialize: (userId: string) => void
  cleanup: () => void
}

// API request/response types for connection management
export interface ConnectionStatusRequest {
  userId: string
  includeHealthChecks?: boolean
  includeDiagnostics?: boolean
}

export interface ConnectionStatusResponse {
  status: ConnectionStatusData | null
  healthChecks: HealthCheckResult[]
  diagnostics?: ConnectionDiagnostics
  timestamp: Date
}

export interface ReconnectionRequest {
  userId: string
  reason: ReconnectionContext['reason']
  maxAttempts?: number
}

export interface ManualHealthCheckRequest {
  userId: string
  checkType?: 'api' | 'network' | 'authentication' | 'all'
}

export interface NotificationPreferencesRequest {
  userId: string
  preferences: ConnectionPreferences
}

// Error types specific to connection management
export class ConnectionError extends Error {
  constructor(
    message: string,
    public type: 'network' | 'authentication' | 'service' | 'configuration',
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class HealthCheckError extends ConnectionError {
  constructor(
    message: string,
    public checkName: string,
    public lastResult?: HealthCheckResult
  ) {
    super(message, 'service', 'HEALTH_CHECK_FAILED', { checkName })
    this.name = 'HealthCheckError'
  }
}

export class ReconnectionError extends ConnectionError {
  constructor(
    message: string,
    public attempts: number,
    public lastError?: Error
  ) {
    super(message, 'service', 'RECONNECTION_FAILED', { attempts })
    this.name = 'ReconnectionError'
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type EventCallback<T> = (data: T) => void
export type UnsubscribeFunction = () => void

// Default configurations
export const DEFAULT_CONNECTION_PREFERENCES: ConnectionPreferences = {
  healthCheckInterval: 30000, // 30 seconds
  enableNotifications: true,
  enableAutoReconnect: true,
  maxReconnectAttempts: 10,
  notificationMethods: ['in_app', 'browser'],
  throttleNotifications: true,
  enableDiagnostics: false,
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enabled: true,
  healthChecks: {
    apiInterval: 30000,
    networkInterval: 60000,
    timeout: 10000,
    maxRetries: 3,
  },
  reconnection: {
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitter: true,
  },
  notifications: {
    enabled: true,
    types: [
      'connection_lost',
      'connection_restored',
      'service_unavailable',
      'authentication_error',
      'rate_limit_exceeded',
    ],
    methods: ['in_app', 'browser'],
    throttle: 30000,
  },
  persistence: {
    enabled: true,
    storageType: 'localStorage',
    encrypt: false,
  },
}
