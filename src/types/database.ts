/**
 * Database Type Definitions
 *
 * Generated TypeScript types for Supabase database schema
 * Based on schema implementation for Story 1.2 Database Schema Setup
 */

import type {
  FileMetadata,
  UserFolder,
  FileFolderAssignment,
  SyncOperation,
  SyncConflict,
} from './metadata'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          real_debrid_id: string
          username: string
          email: string | null
          avatar: string | null
          premium: boolean
          expiration: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          real_debrid_id: string
          username: string
          email?: string | null
          avatar?: string | null
          premium?: boolean
          expiration?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          real_debrid_id?: string
          username?: string
          email?: string | null
          avatar?: string | null
          premium?: boolean
          expiration?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          path: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          path: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          path?: string
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          user_id: string
          real_debrid_id: string
          filename: string
          size: number
          download_url: string
          hoster: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          real_debrid_id: string
          filename: string
          size: number
          download_url: string
          hoster: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          real_debrid_id?: string
          filename?: string
          size?: number
          download_url?: string
          hoster?: string
          created_at?: string
          updated_at?: string
        }
      }
      file_folders: {
        Row: {
          id: string
          file_id: string
          folder_id: string
          created_at: string
        }
        Insert: {
          id?: string
          file_id: string
          folder_id: string
          created_at?: string
        }
        Update: {
          id?: string
          file_id?: string
          folder_id?: string
          created_at?: string
        }
      }
      oauth_tokens: {
        Row: {
          id: string
          user_id: string
          real_debrid_id: string
          access_token: string
          refresh_token: string | null
          token_type: string
          expires_in: number
          scope: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          real_debrid_id: string
          access_token: string
          refresh_token?: string | null
          token_type: string
          expires_in: number
          scope: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          real_debrid_id?: string
          access_token?: string
          refresh_token?: string | null
          token_type?: string
          expires_in?: number
          scope?: string
          created_at?: string
          updated_at?: string
        }
      }
      file_metadata: {
        Row: FileMetadata
        Insert: Omit<
          FileMetadata,
          'id' | 'created_at' | 'updated_at' | 'last_sync'
        >
        Update: Partial<
          Omit<FileMetadata, 'id' | 'created_at' | 'updated_at' | 'last_sync'>
        >
      }
      user_folders: {
        Row: UserFolder
        Insert: Omit<UserFolder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserFolder, 'id' | 'created_at' | 'updated_at'>>
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

/**
 * Union type of all table row types
 */
export type DatabaseRow =
  | Database['public']['Tables']['users']['Row']
  | Database['public']['Tables']['folders']['Row']
  | Database['public']['Tables']['files']['Row']
  | Database['public']['Tables']['file_folders']['Row']
  | Database['public']['Tables']['oauth_tokens']['Row']

/**
 * Table names for type-safe operations
 */
export type TableName = keyof Database['public']['Tables']

/**
 * User-specific types for application logic
 */
export interface User {
  id: string
  real_debrid_id: string
  username: string
  email?: string | null
  avatar?: string | null
  premium: boolean
  expiration?: string | null
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id?: string | null
  path: string
  created_at: string
  updated_at: string
}

export interface File {
  id: string
  user_id: string
  real_debrid_id: string
  filename: string
  size: number
  download_url: string
  hoster: string
  created_at: string
  updated_at: string
}

export interface FileFolder {
  id: string
  file_id: string
  folder_id: string
  created_at: string
}

export interface OAuthToken {
  id: string
  user_id: string
  real_debrid_id: string
  access_token: string
  refresh_token?: string | null
  token_type: string
  expires_in: number
  scope: string
  created_at: string
  updated_at: string
}

/**
 * Join types for common queries
 */
export interface FileWithFolders extends File {
  file_folders: Array<{
    folder: Folder
  }>
}

export interface FolderWithFiles extends Folder {
  file_folders: Array<{
    file: File
  }>
}

export interface UserWithOAuth extends User {
  oauth_tokens: OAuthToken[]
}

/**
 * Utility types for database operations
 */
export type CreateUserData = Omit<User, 'id' | 'created_at' | 'updated_at'>
export type UpdateUserData = Partial<
  Omit<User, 'id' | 'created_at' | 'updated_at'>
>

export type CreateFolderData = Omit<Folder, 'id' | 'created_at' | 'updated_at'>
export type UpdateFolderData = Partial<
  Omit<Folder, 'id' | 'created_at' | 'updated_at'>
>

export type CreateFileData = Omit<File, 'id' | 'created_at' | 'updated_at'>
export type UpdateFileData = Partial<
  Omit<File, 'id' | 'created_at' | 'updated_at'>
>

export type CreateFileFolderData = Omit<FileFolder, 'id' | 'created_at'>
export type UpdateFileFolderData = Partial<
  Omit<FileFolder, 'id' | 'created_at'>
>

export type CreateOAuthTokenData = Omit<
  OAuthToken,
  'id' | 'created_at' | 'updated_at'
>
export type UpdateOAuthTokenData = Partial<
  Omit<OAuthToken, 'id' | 'created_at' | 'updated_at'>
>

/**
 * Performance-related types for query optimization
 */
export interface UserFilesCount {
  user_id: string
  file_count: number
}

export interface FolderHierarchy {
  id: string
  name: string
  parent_id: string | null
  path: string
  level: number
  children_count: number
  files_count: number
}

/**
 * Error types for database operations
 */
export interface DatabaseError {
  code: string
  message: string
  details?: Json
  hint?: string
}

/**
 * Supabase client return types with error handling
 */
export interface DatabaseResponse<T> {
  data: T | null
  error: DatabaseError | null
}

export interface DatabaseResponseWithCount<T> extends DatabaseResponse<T> {
  count: number | null
}

/**
 * Type guards for runtime type checking
 */
export function isUser(obj: Record<string, any>): obj is User {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.real_debrid_id === 'string' &&
    typeof obj.username === 'string' &&
    typeof obj.premium === 'boolean'
  )
}

export function isFolder(obj: Record<string, any>): obj is Folder {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.path === 'string'
  )
}

export function isFile(obj: Record<string, any>): obj is File {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.real_debrid_id === 'string' &&
    typeof obj.filename === 'string' &&
    typeof obj.size === 'number'
  )
}
