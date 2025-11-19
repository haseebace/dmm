/**
 * Real-time Subscription Service
 *
 * Handles Supabase realtime subscriptions for live metadata updates
 */

import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'

export interface SubscriptionCallbacks {
  onSyncStart?: (payload: RealtimePostgresChangesPayload<any>) => void
  onSyncProgress?: (payload: RealtimePostgresChangesPayload<any>) => void
  onSyncComplete?: (payload: RealtimePostgresChangesPayload<any>) => void
  onConflictDetected?: (payload: RealtimePostgresChangesPayload<any>) => void
  onMetadataUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void
  onError?: (error: Error) => void
}

export class RealtimeService {
  private supabase: ReturnType<typeof createClient>
  private channels: Map<string, RealtimeChannel> = new Map()
  private userId: string | null = null

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Set the current user ID for filtering subscriptions
   */
  setUserId(userId: string): void {
    this.userId = userId
  }

  /**
   * Subscribe to sync operations for the current user
   */
  subscribeToSyncOperations(callbacks: SubscriptionCallbacks): string {
    if (!this.userId) {
      throw new Error(
        'User ID must be set before subscribing to sync operations'
      )
    }

    const channelName = `sync_operations_${this.userId}`

    // Remove existing channel if it exists
    if (this.channels.has(channelName)) {
      this.supabase.removeChannel(this.channels.get(channelName)!)
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_operations',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          try {
            logger.info('Sync operation update received', 'realtime', {
              userId: this.userId,
              event: payload.eventType,
              operationId: payload.new?.id || payload.old?.id,
            })

            switch (payload.eventType) {
              case 'INSERT':
                callbacks.onSyncStart?.(payload)
                break
              case 'UPDATE':
                const status = payload.new?.status
                if (status === 'running') {
                  callbacks.onSyncProgress?.(payload)
                } else if (status === 'completed' || status === 'failed') {
                  callbacks.onSyncComplete?.(payload)
                }
                break
              default:
                break
            }
          } catch (error) {
            const err =
              error instanceof Error
                ? error
                : new Error('Unknown error in sync operation callback')
            logger.error('Sync operation callback error', 'realtime', {
              userId: this.userId,
              error: err.message,
            })
            callbacks.onError?.(err)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to sync operations', 'realtime', {
            userId: this.userId,
            channel: channelName,
          })
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error(
            `Failed to subscribe to sync operations: ${status}`
          )
          logger.error('Sync operations subscription error', 'realtime', {
            userId: this.userId,
            status,
          })
          callbacks.onError?.(error)
        }
      })

    this.channels.set(channelName, channel)
    return channelName
  }

  /**
   * Subscribe to sync conflicts for the current user
   */
  subscribeToConflicts(callbacks: SubscriptionCallbacks): string {
    if (!this.userId) {
      throw new Error('User ID must be set before subscribing to conflicts')
    }

    const channelName = `sync_conflicts_${this.userId}`

    // Remove existing channel if it exists
    if (this.channels.has(channelName)) {
      this.supabase.removeChannel(this.channels.get(channelName)!)
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_conflicts',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          try {
            logger.info('Sync conflict update received', 'realtime', {
              userId: this.userId,
              event: payload.eventType,
              conflictId: payload.new?.id || payload.old?.id,
            })

            if (payload.eventType === 'INSERT') {
              callbacks.onConflictDetected?.(payload)
            }
          } catch (error) {
            const err =
              error instanceof Error
                ? error
                : new Error('Unknown error in conflict callback')
            logger.error('Conflict callback error', 'realtime', {
              userId: this.userId,
              error: err.message,
            })
            callbacks.onError?.(err)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to sync conflicts', 'realtime', {
            userId: this.userId,
            channel: channelName,
          })
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error(
            `Failed to subscribe to sync conflicts: ${status}`
          )
          logger.error('Sync conflicts subscription error', 'realtime', {
            userId: this.userId,
            status,
          })
          callbacks.onError?.(error)
        }
      })

    this.channels.set(channelName, channel)
    return channelName
  }

  /**
   * Subscribe to file metadata updates for the current user
   */
  subscribeToMetadataUpdates(callbacks: SubscriptionCallbacks): string {
    if (!this.userId) {
      throw new Error(
        'User ID must be set before subscribing to metadata updates'
      )
    }

    const channelName = `file_metadata_${this.userId}`

    // Remove existing channel if it exists
    if (this.channels.has(channelName)) {
      this.supabase.removeChannel(this.channels.get(channelName)!)
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_metadata',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          try {
            logger.info('Metadata update received', 'realtime', {
              userId: this.userId,
              event: payload.eventType,
              metadataId: payload.new?.id || payload.old?.id,
            })

            callbacks.onMetadataUpdate?.(payload)
          } catch (error) {
            const err =
              error instanceof Error
                ? error
                : new Error('Unknown error in metadata callback')
            logger.error('Metadata callback error', 'realtime', {
              userId: this.userId,
              error: err.message,
            })
            callbacks.onError?.(err)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to metadata updates', 'realtime', {
            userId: this.userId,
            channel: channelName,
          })
        } else if (status === 'CHANNEL_ERROR') {
          const error = new Error(
            `Failed to subscribe to metadata updates: ${status}`
          )
          logger.error('Metadata updates subscription error', 'realtime', {
            userId: this.userId,
            status,
          })
          callbacks.onError?.(error)
        }
      })

    this.channels.set(channelName, channel)
    return channelName
  }

  /**
   * Subscribe to all relevant tables for comprehensive sync updates
   */
  subscribeToAllUpdates(callbacks: SubscriptionCallbacks): string[] {
    const subscriptions = [
      this.subscribeToSyncOperations(callbacks),
      this.subscribeToConflicts(callbacks),
      this.subscribeToMetadataUpdates(callbacks),
    ]

    logger.info('Subscribed to all sync updates', 'realtime', {
      userId: this.userId,
      subscriptionCount: subscriptions.length,
    })

    return subscriptions
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(channelName)

      logger.info('Unsubscribed from channel', 'realtime', {
        userId: this.userId,
        channel: channelName,
      })
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    const channelNames = Array.from(this.channels.keys())

    channelNames.forEach((channelName) => {
      this.unsubscribe(channelName)
    })

    logger.info('Unsubscribed from all channels', 'realtime', {
      userId: this.userId,
      channelsCount: channelNames.length,
    })
  }

  /**
   * Get subscription status for all channels
   */
  getSubscriptionStatus(): Record<string, string> {
    const status: Record<string, string> = {}

    this.channels.forEach((channel, name) => {
      status[name] = channel.subscribe ? 'subscribed' : 'unsubscribed'
    })

    return status
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    this.unsubscribeAll()
    this.userId = null

    logger.info('Realtime service cleaned up', 'realtime')
  }
}

// Singleton instance
export const realtimeService = new RealtimeService()
