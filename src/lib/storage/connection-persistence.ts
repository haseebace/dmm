/**
 * Connection Status Persistence
 *
 * Manages browser storage persistence for connection status,
 * notifications, and user preferences across browser sessions.
 */

import { logger } from '@/lib/logger'
import {
  ConnectionStatusData,
  ConnectionNotification,
  ConnectionPreferences,
  HealthCheckResult,
  MonitoringConfig,
} from '@/types/connection'

// Storage configuration
export interface StorageConfig {
  storageType: 'localStorage' | 'sessionStorage' | 'indexedDB'
  encrypt: boolean
  maxAge: number // milliseconds
  maxItems: number
  keyPrefix: string
}

// Default configuration
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  storageType: 'localStorage',
  encrypt: false,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxItems: 100,
  keyPrefix: 'realdebrid-connection-',
}

// Storage keys
const STORAGE_KEYS = {
  CONNECTION_STATUS: 'connection-status',
  NOTIFICATIONS: 'notifications',
  HEALTH_CHECKS: 'health-checks',
  PREFERENCES: 'preferences',
  MONITORING_CONFIG: 'monitoring-config',
  LAST_SEEN: 'last-seen',
} as const

export class ConnectionPersistence {
  private config: StorageConfig
  private storage: Storage

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config }
    this.storage = this.getStorage()
  }

  /**
   * Save connection status to storage
   */
  async saveConnectionStatus(status: ConnectionStatusData): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.CONNECTION_STATUS)
      const data = {
        status,
        timestamp: Date.now(),
        version: '1.0',
      }

      await this.set(key, data)

      logger.debug(
        'Connection status saved to storage',
        'connection-persistence',
        {
          status: status.overallStatus,
          storageType: this.config.storageType,
        }
      )
    } catch (error) {
      logger.error(
        'Failed to save connection status',
        'connection-persistence',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Load connection status from storage
   */
  async loadConnectionStatus(): Promise<ConnectionStatusData | null> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.CONNECTION_STATUS)
      const data = await this.get(key)

      if (!data || !data.status) {
        return null
      }

      // Check if data is too old
      if (this.isDataTooOld(data.timestamp)) {
        await this.remove(key)
        return null
      }

      logger.debug(
        'Connection status loaded from storage',
        'connection-persistence',
        {
          status: data.status.overallStatus,
          age: Date.now() - data.timestamp,
        }
      )

      return data.status
    } catch (error) {
      logger.error(
        'Failed to load connection status',
        'connection-persistence',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
      return null
    }
  }

  /**
   * Save notifications to storage
   */
  async saveNotifications(
    notifications: ConnectionNotification[]
  ): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.NOTIFICATIONS)
      const data = {
        notifications: notifications.slice(0, this.config.maxItems),
        timestamp: Date.now(),
        version: '1.0',
      }

      await this.set(key, data)

      logger.debug('Notifications saved to storage', 'connection-persistence', {
        count: notifications.length,
        storageType: this.config.storageType,
      })
    } catch (error) {
      logger.error('Failed to save notifications', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Load notifications from storage
   */
  async loadNotifications(): Promise<ConnectionNotification[]> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.NOTIFICATIONS)
      const data = await this.get(key)

      if (!data || !data.notifications) {
        return []
      }

      // Filter out expired notifications
      const now = Date.now()
      const validNotifications = data.notifications.filter(
        (notification: ConnectionNotification) => {
          if (notification.expiresAt) {
            return new Date(notification.expiresAt).getTime() > now
          }
          return true
        }
      )

      logger.debug(
        'Notifications loaded from storage',
        'connection-persistence',
        {
          total: data.notifications.length,
          valid: validNotifications.length,
        }
      )

      return validNotifications
    } catch (error) {
      logger.error('Failed to load notifications', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return []
    }
  }

  /**
   * Save health check results to storage
   */
  async saveHealthChecks(healthChecks: HealthCheckResult[]): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.HEALTH_CHECKS)
      const data = {
        healthChecks: healthChecks.slice(0, this.config.maxItems),
        timestamp: Date.now(),
        version: '1.0',
      }

      await this.set(key, data)

      logger.debug('Health checks saved to storage', 'connection-persistence', {
        count: healthChecks.length,
        storageType: this.config.storageType,
      })
    } catch (error) {
      logger.error('Failed to save health checks', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Load health checks from storage
   */
  async loadHealthChecks(): Promise<HealthCheckResult[]> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.HEALTH_CHECKS)
      const data = await this.get(key)

      if (!data || !data.healthChecks) {
        return []
      }

      // Check if data is too old
      if (this.isDataTooOld(data.timestamp)) {
        await this.remove(key)
        return []
      }

      logger.debug(
        'Health checks loaded from storage',
        'connection-persistence',
        {
          count: data.healthChecks.length,
          age: Date.now() - data.timestamp,
        }
      )

      return data.healthChecks
    } catch (error) {
      logger.error('Failed to load health checks', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return []
    }
  }

  /**
   * Save user preferences to storage
   */
  async savePreferences(preferences: ConnectionPreferences): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.PREFERENCES)
      const data = {
        preferences,
        timestamp: Date.now(),
        version: '1.0',
      }

      await this.set(key, data)

      logger.debug('Preferences saved to storage', 'connection-persistence', {
        storageType: this.config.storageType,
      })
    } catch (error) {
      logger.error('Failed to save preferences', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Load user preferences from storage
   */
  async loadPreferences(): Promise<ConnectionPreferences | null> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.PREFERENCES)
      const data = await this.get(key)

      if (!data || !data.preferences) {
        return null
      }

      logger.debug(
        'Preferences loaded from storage',
        'connection-persistence',
        {
          age: Date.now() - data.timestamp,
        }
      )

      return data.preferences
    } catch (error) {
      logger.error('Failed to load preferences', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Save monitoring configuration to storage
   */
  async saveMonitoringConfig(config: MonitoringConfig): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.MONITORING_CONFIG)
      const data = {
        config,
        timestamp: Date.now(),
        version: '1.0',
      }

      await this.set(key, data)

      logger.debug(
        'Monitoring config saved to storage',
        'connection-persistence',
        {
          storageType: this.config.storageType,
        }
      )
    } catch (error) {
      logger.error(
        'Failed to save monitoring config',
        'connection-persistence',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Load monitoring configuration from storage
   */
  async loadMonitoringConfig(): Promise<MonitoringConfig | null> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.MONITORING_CONFIG)
      const data = await this.get(key)

      if (!data || !data.config) {
        return null
      }

      logger.debug(
        'Monitoring config loaded from storage',
        'connection-persistence',
        {
          age: Date.now() - data.timestamp,
        }
      )

      return data.config
    } catch (error) {
      logger.error(
        'Failed to load monitoring config',
        'connection-persistence',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
      return null
    }
  }

  /**
   * Record last seen timestamp
   */
  async updateLastSeen(): Promise<void> {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.LAST_SEEN)
      await this.set(key, {
        timestamp: Date.now(),
      })

      logger.debug('Last seen updated', 'connection-persistence')
    } catch (error) {
      logger.error('Failed to update last seen', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get last seen timestamp
   */
  async getLastSeen(): Date | null {
    try {
      const key = this.getStorageKey(STORAGE_KEYS.LAST_SEEN)
      const data = await this.get(key)

      if (!data || !data.timestamp) {
        return null
      }

      return new Date(data.timestamp)
    } catch (error) {
      logger.error('Failed to get last seen', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS).map((key) =>
        this.getStorageKey(key)
      )

      for (const key of keys) {
        await this.remove(key)
      }

      logger.info('All stored data cleared', 'connection-persistence', {
        storageType: this.config.storageType,
      })
    } catch (error) {
      logger.error('Failed to clear stored data', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<{
    totalSize: number
    itemCount: number
    details: Record<string, { size: number; count: number }>
  }> {
    try {
      const details: Record<string, { size: number; count: number }> = {}
      let totalSize = 0
      let itemCount = 0

      for (const [name, key] of Object.entries(STORAGE_KEYS)) {
        const storageKey = this.getStorageKey(key)
        const data = await this.getRaw(storageKey)

        if (data !== null) {
          const size = this.calculateSize(data)
          details[name] = { size, count: 1 }
          totalSize += size
          itemCount += 1
        }
      }

      return {
        totalSize,
        itemCount,
        details,
      }
    } catch (error) {
      logger.error('Failed to get storage usage', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return { totalSize: 0, itemCount: 0, details: {} }
    }
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    try {
      const keys = Object.entries(STORAGE_KEYS)

      for (const [name, key] of keys) {
        const storageKey = this.getStorageKey(key)
        const data = await this.get(storageKey)

        if (data && this.isDataTooOld(data.timestamp)) {
          await this.remove(storageKey)
          logger.debug('Cleaned up expired data', 'connection-persistence', {
            key: name,
          })
        }
      }

      logger.info('Storage cleanup completed', 'connection-persistence')
    } catch (error) {
      logger.error('Failed to cleanup storage', 'connection-persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get the appropriate storage interface
   */
  private getStorage(): Storage {
    switch (this.config.storageType) {
      case 'sessionStorage':
        if (typeof window !== 'undefined' && window.sessionStorage) {
          return window.sessionStorage
        }
        throw new Error('SessionStorage not available')

      case 'localStorage':
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage
        }
        throw new Error('LocalStorage not available')

      case 'indexedDB':
        // For now, fallback to localStorage as IndexedDB implementation is more complex
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage
        }
        throw new Error(
          'IndexedDB not implemented, falling back to LocalStorage'
        )

      default:
        throw new Error(`Unknown storage type: ${this.config.storageType}`)
    }
  }

  /**
   * Get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }

  /**
   * Set data to storage with optional encryption
   */
  private async set(key: string, data: any): Promise<void> {
    let serializedData = JSON.stringify(data)

    if (this.config.encrypt) {
      serializedData = await this.encrypt(serializedData)
    }

    this.storage.setItem(key, serializedData)
  }

  /**
   * Get data from storage with optional decryption
   */
  private async get(key: string): Promise<any> {
    const serializedData = this.storage.getItem(key)

    if (!serializedData) {
      return null
    }

    try {
      let data = serializedData

      if (this.config.encrypt) {
        data = await this.decrypt(data)
      }

      return JSON.parse(data)
    } catch (error) {
      logger.error('Failed to parse stored data', 'connection-persistence', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Get raw data from storage
   */
  private async getRaw(key: string): Promise<string | null> {
    return this.storage.getItem(key)
  }

  /**
   * Remove data from storage
   */
  private async remove(key: string): Promise<void> {
    this.storage.removeItem(key)
  }

  /**
   * Check if data is too old
   */
  private isDataTooOld(timestamp: number): boolean {
    return Date.now() - timestamp > this.config.maxAge
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: string): number {
    return new Blob([data]).size
  }

  /**
   * Encrypt data (placeholder implementation)
   */
  private async encrypt(data: string): Promise<string> {
    // In a real implementation, you would use a proper encryption library
    // For now, just return the data as-is
    return data
  }

  /**
   * Decrypt data (placeholder implementation)
   */
  private async decrypt(data: string): Promise<string> {
    // In a real implementation, you would use a proper decryption library
    // For now, just return the data as-is
    return data
  }
}

export default ConnectionPersistence
