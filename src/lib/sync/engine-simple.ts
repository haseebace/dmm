/**
 * Simplified Metadata Synchronization Engine
 *
 * Working implementation that integrates with the database schema and Real-Debrid client
 */

import { createRealDebridClient } from '@/lib/realdebrid'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { ContentTypeDetector, ContentType } from '@/lib/content/detector'
import type {
  RealDebridTorrent,
  FileMetadata,
  SyncOperation,
  SyncResult,
  SyncOptions,
  SyncProgress,
  SyncConflict,
  SyncStatus,
  UserMetadata,
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
          const result = await this.syncTorrent(
            userId,
            torrent,
            realDebridClient
          )

          if (result.conflicts.length > 0) {
            conflicts = conflicts.concat(result.conflicts)
          }

          processedCount++

          // Update progress
          await this.updateSyncProgress(syncOp.id, {
            items_processed: processedCount,
            items_total: torrents.length,
            status: 'running',
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
   * Start an incremental metadata synchronization for a user
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
        options,
      })

      // Create sync operation record
      const syncOp = await this.createSyncOperation(userId, 'incremental_sync')

      // Initialize Real-Debrid client with user token
      const realDebridClient = createRealDebridClient(async () => accessToken)

      // Get torrents modified since the specified date
      const torrents = await this.fetchTorrentsSince(
        realDebridClient,
        since,
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
          const result = await this.syncTorrent(
            userId,
            torrent,
            realDebridClient
          )

          if (result.conflicts.length > 0) {
            conflicts = conflicts.concat(result.conflicts)
          }

          processedCount++

          // Update progress
          await this.updateSyncProgress(syncOp.id, {
            items_processed: processedCount,
            items_total: torrents.length,
            status: 'running',
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

      logger.info('Incremental metadata sync completed', 'sync', {
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
      logger.error('Incremental metadata sync failed', 'sync', {
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
    // First get user's real_debrid_id
    const { data: userData } = await this.supabase
      .from('users')
      .select('real_debrid_id')
      .eq('id', userId)
      .single()

    if (!userData) {
      throw new Error('User not found or no Real-Debrid ID')
    }

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
    realDebridClient: ReturnType<typeof createRealDebridClient>,
    signal: AbortSignal
  ): Promise<RealDebridTorrent[]> {
    if (signal.aborted) {
      throw new Error('Fetch cancelled')
    }

    try {
      const response = await realDebridClient.torrents.getTorrents()

      // Transform response to RealDebridTorrent format
      return response.map((torrent) => ({
        id: torrent.id,
        filename: torrent.filename,
        original_filename: torrent.original_filename,
        hash: torrent.hash,
        bytes: torrent.bytes,
        original_bytes: torrent.bytes,
        host: torrent.host,
        host_icon: torrent.host_icon,
        split: torrent.split,
        progress: torrent.progress,
        status: torrent.status as RealDebridTorrent['status'],
        added: torrent.added,
        files: [], // Can be populated later if needed
        links: torrent.links,
        link: torrent.link,
        ended: torrent.ended,
        seeders: undefined, // Can be populated from getTorrentInfo if needed
        speed: undefined, // Can be populated from getTorrentInfo if needed
      }))
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Fetch cancelled')
      }
      throw error
    }
  }

  private async fetchTorrentsSince(
    realDebridClient: ReturnType<typeof createRealDebridClient>,
    since: Date,
    signal: AbortSignal
  ): Promise<RealDebridTorrent[]> {
    if (signal.aborted) {
      throw new Error('Fetch cancelled')
    }

    try {
      const response = await realDebridClient.torrents.getTorrents()

      // Filter torrents modified since the specified date
      const sinceTimestamp = Math.floor(since.getTime() / 1000)

      return response
        .filter((torrent) => {
          const torrentTimestamp = Number(torrent.ended || torrent.added)
          return torrentTimestamp > sinceTimestamp
        })
        .map((torrent) => ({
          id: torrent.id,
          filename: torrent.filename,
          original_filename: torrent.original_filename,
          hash: torrent.hash,
          bytes: torrent.bytes,
          original_bytes: torrent.bytes,
          host: torrent.host,
          host_icon: torrent.host_icon,
          split: torrent.split,
          progress: torrent.progress,
          status: torrent.status as RealDebridTorrent['status'],
          added: torrent.added,
          files: [], // Can be populated later if needed
          links: torrent.links,
          link: torrent.link,
          ended: torrent.ended,
          seeders: undefined, // Can be populated from getTorrentInfo if needed
          speed: undefined, // Can be populated from getTorrentInfo if needed
        }))
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Fetch cancelled')
      }
      throw error
    }
  }

  private async syncTorrent(
    userId: string,
    torrent: RealDebridTorrent,
    realDebridClient: ReturnType<typeof createRealDebridClient>
  ): Promise<{ conflicts: SyncConflict[] }> {
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
        torrent
      )
      conflicts.push(...torrentConflicts)

      // Update existing metadata if no unresolved conflicts
      if (
        conflicts.filter((c) => c.resolution_status === 'pending').length === 0
      ) {
        await this.updateFileMetadata(userId, existingMetadata.id, torrent)
      }
    } else {
      // Insert new metadata
      await this.insertFileMetadata(userId, torrent)
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
    // Detect content type using the content detector
    const contentInfo = ContentTypeDetector.detectContent(torrent.filename, {
      includeQuality: true,
      detectLanguages: true,
      analyzeFilename: true,
    })

    const fileMetadata = {
      real_debrid_id: torrent.id,
      user_id: userId,
      name: torrent.filename,
      type:
        contentInfo.type === ContentType.OTHER ? 'torrent' : contentInfo.type,
      size: torrent.bytes,
      status: torrent.status,
      properties: {
        hash: torrent.hash,
        host: torrent.host,
        split: torrent.split,
        progress: torrent.progress,
        links: torrent.links,
        original_filename: torrent.original_filename,
        host_icon: torrent.host_icon,
        ended: torrent.ended,
        content_info: contentInfo,
      },
      user_metadata: {
        tags: contentInfo.tags,
        content_type: contentInfo.type,
        quality: contentInfo.quality,
        resolution: contentInfo.resolution,
      } as UserMetadata,
      sync_status: {
        last_sync: new Date().toISOString(),
        sync_state: 'synced' as const,
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
    torrent: RealDebridTorrent
  ): Promise<void> {
    // Detect content type using the content detector
    const contentInfo = ContentTypeDetector.detectContent(torrent.filename, {
      includeQuality: true,
      detectLanguages: true,
      analyzeFilename: true,
    })

    const updateData = {
      name: torrent.filename,
      type:
        contentInfo.type === ContentType.OTHER ? 'torrent' : contentInfo.type,
      size: torrent.bytes,
      status: torrent.status,
      properties: {
        hash: torrent.hash,
        host: torrent.host,
        split: torrent.split,
        progress: torrent.progress,
        links: torrent.links,
        original_filename: torrent.original_filename,
        host_icon: torrent.host_icon,
        ended: torrent.ended,
        content_info: contentInfo,
      },
      user_metadata: {
        tags: contentInfo.tags,
        content_type: contentInfo.type,
        quality: contentInfo.quality,
        resolution: contentInfo.resolution,
      } as UserMetadata,
      sync_status: {
        last_sync: new Date().toISOString(),
        sync_state: 'synced' as const,
        retry_count: 0,
        sync_version: Math.floor(Date.now() / 1000),
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
