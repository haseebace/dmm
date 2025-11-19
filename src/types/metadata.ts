/**
 * Metadata Synchronization Types
 *
 * TypeScript interfaces for the Real-Debrid metadata synchronization system
 */

// Import Real-Debrid types from the main types file
import type { Torrent, TorrentInfo, TorrentFile } from '@/types/realdebrid'
export type { Torrent, TorrentInfo } from '@/types/realdebrid'

// Extended Real-Debrid types with additional fields for our use case
export interface RealDebridTorrent extends Torrent {
  original_bytes: number
  files: RealDebridTorrentFile[]
  speed?: number
  seeders?: number
}

export interface RealDebridTorrentFile {
  id: number
  path: string
  bytes: number
  selected: number
}

export interface RealDebridTorrentListItem extends RealDebridTorrent {}

// Local Database Types
export interface FileMetadata {
  id: string
  real_debrid_id?: string
  user_id: string
  name: string
  type: 'torrent' | 'file' | 'streaming'
  size: number
  status: string
  properties: Record<string, any>
  user_metadata: UserMetadata
  sync_status: SyncStatus
  created_at: string
  updated_at: string
  last_sync: string
}

export interface UserMetadata {
  tags?: string[]
  notes?: string
  rating?: number
  watch_status?: 'unwatched' | 'watching' | 'completed'
  custom_fields?: Record<string, any>
}

export interface SyncStatus {
  last_sync: string
  sync_state: 'synced' | 'pending' | 'error' | 'conflict'
  error_message?: string
  retry_count: number
  sync_version: number
}

export interface UserFolder {
  id: string
  user_id: string
  name: string
  parent_id?: string
  properties: Record<string, any>
  created_at: string
  updated_at: string
}

export interface FileFolderAssignment {
  file_id: string
  folder_id: string
  assigned_at: string
}

export interface SyncOperation {
  id: string
  user_id: string
  operation_type:
    | 'full_sync'
    | 'incremental_sync'
    | 'manual_sync'
    | 'conflict_resolution'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  completed_at?: string
  error_message?: string
  items_processed: number
  items_total: number
  properties: Record<string, any>
}

export interface SyncConflict {
  id: string
  user_id: string
  file_id?: string
  conflict_type:
    | 'name_conflict'
    | 'size_conflict'
    | 'status_conflict'
    | 'metadata_conflict'
  local_value: Record<string, any>
  remote_value: Record<string, any>
  resolution_status:
    | 'pending'
    | 'resolved_local'
    | 'resolved_remote'
    | 'resolved_merge'
  created_at: string
  resolved_at?: string
}

// Sync Engine Types
export interface SyncOptions {
  force?: boolean
  incremental?: boolean
  batch_size?: number
  resolve_conflicts?: ConflictResolutionStrategy
  on_progress?: (progress: SyncProgress) => void
}

export interface SyncProgress {
  operation_id: string
  status: 'running' | 'completed' | 'failed'
  items_processed: number
  items_total: number
  current_item?: string
  estimated_time_remaining?: number
}

export interface SyncResult {
  success: boolean
  operation_id: string
  items_processed: number
  items_total: number
  conflicts: SyncConflict[]
  errors: string[]
  duration_ms: number
}

export interface ConflictResolutionStrategy {
  type:
    | 'user_choice'
    | 'last_write_wins'
    | 'size_wins'
    | 'quality_wins'
    | 'merge'
  options?: Record<string, any>
}

// API Request/Response Types
export interface SyncRequest {
  operation_type?: 'full_sync' | 'incremental_sync' | 'manual_sync'
  options?: SyncOptions
}

export interface SyncResponse {
  operation_id: string
  status: string
  message: string
}

export interface MetadataListRequest {
  folder_id?: string
  type?: 'torrent' | 'file' | 'streaming'
  status?: string
  search?: string
  limit?: number
  offset?: number
}

export interface MetadataListResponse {
  items: FileMetadata[]
  total: number
  has_more: boolean
}

export interface ConflictResolutionRequest {
  conflict_id: string
  resolution: 'keep_local' | 'keep_remote' | 'merge'
  merged_data?: Record<string, any>
}

// Real-time Sync Types
export interface MetadataChangeEvent {
  type: 'created' | 'updated' | 'deleted'
  table: 'file_metadata' | 'user_folders' | 'file_folder_assignments'
  record: any
  old_record?: any
}

export interface SyncStatusChangeEvent {
  operation_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: SyncProgress
}

// Utility Types
export type CreateFileMetadataData = Omit<
  FileMetadata,
  'id' | 'created_at' | 'updated_at' | 'last_sync'
>
export type UpdateFileMetadataData = Partial<CreateFileMetadataData>
export type CreateUserFolderData = Omit<
  UserFolder,
  'id' | 'created_at' | 'updated_at'
>
export type UpdateUserFolderData = Partial<CreateUserFolderData>

// Error Types
export interface MetadataSyncError {
  code: string
  message: string
  details?: Record<string, any>
  operation_id?: string
  retry_count?: number
}

// Performance Metrics Types
export interface SyncMetrics {
  operation_id: string
  operation_type: string
  duration_ms: number
  items_processed: number
  bytes_transferred: number
  api_calls_made: number
  cache_hits: number
  cache_misses: number
}

// Configuration Types
export interface SyncConfiguration {
  auto_sync_enabled: boolean
  sync_interval_minutes: number
  max_retries: number
  batch_size: number
  conflict_resolution: ConflictResolutionStrategy
  notifications_enabled: boolean
}

// Type Guards
export function isRealDebridTorrent(obj: any): obj is RealDebridTorrent {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.filename === 'string' &&
    typeof obj.hash === 'string' &&
    typeof obj.bytes === 'number' &&
    typeof obj.progress === 'number' &&
    Array.isArray(obj.files) &&
    Array.isArray(obj.links)
  )
}

export function isFileMetadata(obj: any): obj is FileMetadata {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    ['torrent', 'file', 'streaming'].includes(obj.type) &&
    typeof obj.size === 'number' &&
    typeof obj.properties === 'object' &&
    typeof obj.user_metadata === 'object' &&
    typeof obj.sync_status === 'object'
  )
}

export function isSyncOperation(obj: any): obj is SyncOperation {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.operation_type === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.items_processed === 'number' &&
    typeof obj.items_total === 'number'
  )
}

export function isSyncConflict(obj: any): obj is SyncConflict {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.conflict_type === 'string' &&
    typeof obj.local_value === 'object' &&
    typeof obj.remote_value === 'object' &&
    typeof obj.resolution_status === 'string'
  )
}

// Database Schema Types (for Supabase integration)
export interface Database {
  public: {
    Tables: {
      file_metadata: {
        Row: FileMetadata
        Insert: CreateFileMetadataData
        Update: UpdateFileMetadataData
      }
      user_folders: {
        Row: UserFolder
        Insert: CreateUserFolderData
        Update: UpdateUserFolderData
      }
      file_folder_assignments: {
        Row: FileFolderAssignment
        Insert: Omit<FileFolderAssignment, 'assigned_at'>
        Update: Partial<FileFolderAssignment>
      }
      sync_operations: {
        Row: SyncOperation
        Insert: Omit<SyncOperation, 'id' | 'started_at'>
        Update: Partial<SyncOperation>
      }
      sync_conflicts: {
        Row: SyncConflict
        Insert: Omit<SyncConflict, 'id' | 'created_at'>
        Update: Partial<SyncConflict>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
