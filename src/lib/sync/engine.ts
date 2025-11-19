/**
 * Metadata Synchronization Engine
 *
 * Core engine for synchronizing file metadata between Real-Debrid and local database
 */

import { createRealDebridClient } from '@/lib/realdebrid'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type {
  RealDebridTorrent,
  FileMetadata,
  SyncOperation,
  SyncResult,
  SyncOptions,
  SyncProgress,
  SyncConflict,
  ConflictResolutionStrategy,
  SyncStatus,
  UserMetadata,
  MetadataSyncError,
} from '@/types/metadata'

export class MetadataSyncEngine {
  private supabase: ReturnType<typeof createClient>
  private currentOperations: Map<string, AbortController> = new Map()

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Start a full metadata synchronization for a user
   */
  async startFullSync(
    userId: string,
    accessToken: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const operationId = crypto.randomUUID()
    const abortController = new AbortController()
    this.currentOperations.set(operationId, abortController)

    try {
      logger.info('Starting full metadata sync', 'sync', {
        userId,
        operationId,
        options,
      })

      // Create sync operation record
      const syncOp = await this.createSyncOperation(userId, 'full_sync')

      // Initialize Real-Debrid client with user token
      const realDebridClient = createRealDebridClient(async () => accessToken)

      // Get all torrents from Real-Debrid
      const torrents = await this.fetchAllTorrents(
        realDebridClient,
        abortController.signal
      )

      // Update progress
      await this.updateSyncProgress(syncOp.id, {
        items_processed: 0,
        items_total: torrents.length,
        status: 'running',
      })

      let conflicts: SyncConflict[] = []
      const errors: string[] = []
      let processedCount = 0

      // Process each torrent
      for (const torrent of torrents) {
        if (abortController.signal.aborted) {
          throw new Error('Sync operation cancelled')
        }

        try {
          const result = await this.syncTorrent(userId, torrent)

          if (result.conflicts.length > 0) {
            conflicts = conflicts.concat(result.conflicts)
          }

          processedCount++

          // Update progress
          await this.updateSyncProgress(syncOp.id, {
            items_processed: processedCount,
            items_total: torrents.length,
            status: 'running',
            current_item: torrent.filename,
          })

          // Call progress callback if provided
          if (options.on_progress) {
            options.on_progress({
              operation_id: syncOp.id,
              status: 'running',
              items_processed: processedCount,
              items_total: torrents.length,
              current_item: torrent.filename,
              estimated_time_remaining: this.calculateETA(
                processedCount,
                torrents.length,
                Date.now()
              ),
            })
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to sync torrent ${torrent.id}: ${errorMessage}`)
          logger.error('Torrent sync failed', 'sync', {
            torrentId: torrent.id,
            error: errorMessage,
          })
        }
      }

      // Complete the sync operation
      await this.completeSyncOperation(
        syncOp.id,
        'completed',
        processedCount,
        torrents.length
      )

      const result: SyncResult = {
        success: conflicts.length === 0 && errors.length === 0,
        operation_id: syncOp.id,
        items_processed: processedCount,
        items_total: torrents.length,
        conflicts,
        errors,
        duration_ms: 0, // Will be calculated by the caller
      }

      logger.info('Full metadata sync completed', 'sync', {
        userId,
        operationId: syncOp.id,
        success: result.success,
        itemsProcessed: processedCount,
        conflicts: conflicts.length,
        errors: errors.length,
      })

      return result
    } catch (error) {
      // Handle sync failure
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Full metadata sync failed', 'sync', {
        userId,
        operationId,
        error: errorMessage,
      })

      // Update operation status to failed
      if (this.currentOperations.has(operationId)) {
        try {
          await this.updateSyncOperation(operationId, 'failed', errorMessage)
        } catch (updateError) {
          logger.error('Failed to update sync operation status', 'sync', {
            error:
              updateError instanceof Error
                ? updateError.message
                : 'Unknown error',
          })
        }
      }

      throw error
    } finally {
      this.currentOperations.delete(operationId)
    }
  }

  /**
   * Start an incremental synchronization
   */
  async startIncrementalSync(
    userId: string,
    accessToken: string,
    since: Date,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const operationId = crypto.randomUUID()
    const abortController = new AbortController()
    this.currentOperations.set(operationId, abortController)

    try {
      logger.info('Starting incremental metadata sync', 'sync', {
        userId,
        operationId,
        since: since.toISOString(),
      })

      const syncOp = await this.createSyncOperation(userId, 'incremental_sync')
      this.realDebridClient.setAccessToken(accessToken)

      // Get last sync timestamp from database
      const { data: lastSync } = await this.supabase
        .from('file_metadata')
        .select('last_sync')
        .eq('user_id', userId)
        .order('last_sync', { ascending: false })
        .limit(1)
        .single()

      const lastSyncTime = lastSync?.last_sync || since.toISOString()

      // Fetch recent torrents (this is a simplified approach - Real-Debrid doesn't provide a proper "since" endpoint)
      const allTorrents = await this.fetchAllTorrents(abortController.signal)

      // Filter torrents that have been updated since last sync
      const recentTorrents = allTorrents.filter((torrent) => {
        const torrentDate = new Date(torrent.ended || torrent.added)
        return torrentDate > new Date(lastSyncTime)
      })

      if (recentTorrents.length === 0) {
        await this.completeSyncOperation(syncOp.id, 'completed', 0, 0)
        return {
          success: true,
          operation_id: syncOp.id,
          items_processed: 0,
          items_total: 0,
          conflicts: [],
          errors: [],
          duration_ms: 0,
        }
      }

      // Process recent torrents (same logic as full sync)
      let conflicts: SyncConflict[] = []
      const errors: string[] = []
      let processedCount = 0

      for (const torrent of recentTorrents) {
        if (abortController.signal.aborted) {
          throw new Error('Incremental sync operation cancelled')
        }

        try {
          const result = await this.syncTorrent(userId, torrent)
          conflicts = conflicts.concat(result.conflicts)
          processedCount++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to sync torrent ${torrent.id}: ${errorMessage}`)
        }
      }

      await this.completeSyncOperation(
        syncOp.id,
        'completed',
        processedCount,
        recentTorrents.length
      )

      return {
        success: conflicts.length === 0 && errors.length === 0,
        operation_id: syncOp.id,
        items_processed: processedCount,
        items_total: recentTorrents.length,
        conflicts,
        errors,
        duration_ms: 0,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Incremental metadata sync failed', 'sync', {
        userId,
        operationId,
        error: errorMessage,
      })
      throw error
    } finally {
      this.currentOperations.delete(operationId)
    }
  }

  /**
   * Cancel a sync operation
   */
  async cancelSync(operationId: string): Promise<void> {
    const abortController = this.currentOperations.get(operationId)
    if (abortController) {
      abortController.abort()

      // Update operation status in database
      await this.updateSyncOperation(
        operationId,
        'cancelled',
        'Sync cancelled by user'
      )

      logger.info('Sync operation cancelled', 'sync', { operationId })
    }
  }

  /**
   * Get sync operation status
   */
  async getSyncStatus(operationId: string): Promise<SyncOperation | null> {
    const { data, error } = await this.supabase
      .from('sync_operations')
      .select('*')
      .eq('id', operationId)
      .single()

    if (error) {
      logger.error('Failed to get sync status', 'sync', {
        operationId,
        error: error.message,
      })
      return null
    }

    return data as SyncOperation
  }

  /**
   * Get user's recent sync operations
   */
  async getUserSyncHistory(
    userId: string,
    limit = 10
  ): Promise<SyncOperation[]> {
    const { data, error } = await this.supabase
      .from('sync_operations')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Failed to get user sync history', 'sync', {
        userId,
        error: error.message,
      })
      return []
    }

    return data as SyncOperation[]
  }

  /**
   * Private helper methods
   */

  private async createSyncOperation(
    userId: string,
    operationType: string
  ): Promise<SyncOperation> {
    const { data, error } = await this.supabase
      .from('sync_operations')
      .insert({
        user_id: userId,
        operation_type: operationType,
        status: 'pending',
        items_processed: 0,
        items_total: 0,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create sync operation: ${error.message}`)
    }

    return data as SyncOperation
  }

  private async updateSyncOperation(
    operationId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error } = await this.supabase
      .from('sync_operations')
      .update(updateData)
      .eq('id', operationId)

    if (error) {
      throw new Error(`Failed to update sync operation: ${error.message}`)
    }
  }

  private async updateSyncProgress(
    operationId: string,
    progress: Partial<SyncOperation>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_operations')
      .update(progress)
      .eq('id', operationId)

    if (error) {
      logger.error('Failed to update sync progress', 'sync', {
        operationId,
        error: error.message,
      })
    }
  }

  private async completeSyncOperation(
    operationId: string,
    status: string,
    itemsProcessed: number,
    itemsTotal: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_operations')
      .update({
        status,
        completed_at: new Date().toISOString(),
        items_processed: itemsProcessed,
        items_total: itemsTotal,
      })
      .eq('id', operationId)

    if (error) {
      throw new Error(`Failed to complete sync operation: ${error.message}`)
    }
  }

  private async fetchAllTorrents(
    signal: AbortSignal
  ): Promise<RealDebridTorrent[]> {
    const allTorrents: RealDebridTorrent[] = []
    let page = 1
    const limit = 100 // Maximum allowed by API
    let hasMore = true

    while (hasMore) {
      if (signal.aborted) {
        throw new Error('Fetch cancelled')
      }

      try {
        const response = await this.realDebridClient.getTorrents({
          page,
          limit,
        })

        if (response.length > 0) {
          allTorrents.push(...response)
        }

        // If we got less than the limit, we're probably done
        hasMore = response.length === limit
        page++

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        if (signal.aborted) {
          throw new Error('Fetch cancelled')
        }
        throw error
      }
    }

    return allTorrents
  }

  private async syncTorrent(
    userId: string,
    torrent: RealDebridTorrent
  ): Promise<{ conflicts: SyncConflict[] }> {
    // Get detailed torrent information
    const torrentInfo = await this.realDebridClient.getTorrentInfo(torrent.id)

    // Check if metadata already exists
    const { data: existingMetadata } = await this.supabase
      .from('file_metadata')
      .select('*')
      .eq('user_id', userId)
      .eq('real_debrid_id', torrent.id)
      .single()

    const conflicts: SyncConflict[] = []

    if (existingMetadata) {
      // Check for conflicts
      const torrentConflicts = await this.detectConflicts(
        existingMetadata,
        torrentInfo
      )
      conflicts.push(...torrentConflicts)

      // Update existing metadata
      await this.updateFileMetadata(
        userId,
        existingMetadata.id,
        torrentInfo,
        conflicts
      )
    } else {
      // Insert new metadata
      await this.insertFileMetadata(userId, torrentInfo)
    }

    return { conflicts }
  }

  private async detectConflicts(
    existing: FileMetadata,
    torrent: RealDebridTorrent
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    // Check for size conflicts
    if (existing.size !== torrent.bytes) {
      conflicts.push({
        id: crypto.randomUUID(),
        user_id: existing.user_id,
        file_id: existing.id,
        conflict_type: 'size_conflict',
        local_value: { size: existing.size },
        remote_value: { size: torrent.bytes },
        resolution_status: 'pending',
        created_at: new Date().toISOString(),
      })
    }

    // Check for status conflicts
    if (existing.status !== torrent.status) {
      conflicts.push({
        id: crypto.randomUUID(),
        user_id: existing.user_id,
        file_id: existing.id,
        conflict_type: 'status_conflict',
        local_value: { status: existing.status },
        remote_value: { status: torrent.status },
        resolution_status: 'pending',
        created_at: new Date().toISOString(),
      })
    }

    return conflicts
  }

  private async insertFileMetadata(
    userId: string,
    torrent: RealDebridTorrent
  ): Promise<void> {
    const fileMetadata: Omit<FileMetadata, 'id' | 'created_at' | 'updated_at'> =
      {
        real_debrid_id: torrent.id,
        user_id: userId,
        name: torrent.filename,
        type: 'torrent',
        size: torrent.bytes,
        status: torrent.status,
        properties: {
          hash: torrent.hash,
          host: torrent.host,
          split: torrent.split,
          progress: torrent.progress,
          links: torrent.links,
          files: torrent.files,
          added: torrent.added,
          ended: torrent.ended,
          speed: torrent.speed,
          seeders: torrent.seeders,
        },
        user_metadata: {},
        sync_status: {
          last_sync: new Date().toISOString(),
          sync_state: 'synced',
          retry_count: 0,
          sync_version: 1,
        },
        last_sync: new Date().toISOString(),
      }

    const { error } = await this.supabase
      .from('file_metadata')
      .insert(fileMetadata)

    if (error) {
      throw new Error(`Failed to insert file metadata: ${error.message}`)
    }
  }

  private async updateFileMetadata(
    userId: string,
    metadataId: string,
    torrent: RealDebridTorrent,
    conflicts: SyncConflict[]
  ): Promise<void> {
    // Only update if there are no unresolved conflicts
    const unresolvedConflicts = conflicts.filter(
      (c) => c.resolution_status === 'pending'
    )

    if (unresolvedConflicts.length > 0) {
      logger.info('Skipping update due to unresolved conflicts', 'sync', {
        metadataId,
        conflicts: unresolvedConflicts.length,
      })
      return
    }

    const updateData = {
      name: torrent.filename,
      size: torrent.bytes,
      status: torrent.status,
      properties: {
        hash: torrent.hash,
        host: torrent.host,
        split: torrent.split,
        progress: torrent.progress,
        links: torrent.links,
        files: torrent.files,
        added: torrent.added,
        ended: torrent.ended,
        speed: torrent.speed,
        seeders: torrent.seeders,
      },
      sync_status: {
        last_sync: new Date().toISOString(),
        sync_state: 'synced',
        retry_count: 0,
        sync_version: (Date.now() / 1000) | 0, // Simple version using timestamp
      },
      last_sync: new Date().toISOString(),
    }

    const { error } = await this.supabase
      .from('file_metadata')
      .update(updateData)
      .eq('id', metadataId)

    if (error) {
      throw new Error(`Failed to update file metadata: ${error.message}`)
    }
  }

  private calculateETA(
    processed: number,
    total: number,
    startTime: number
  ): number | undefined {
    if (processed === 0 || total === 0) return undefined

    const elapsed = Date.now() - startTime
    const rate = processed / elapsed
    const remaining = total - processed

    return Math.round(remaining / rate)
  }
}

// Singleton instance
export const metadataSyncEngine = new MetadataSyncEngine()
