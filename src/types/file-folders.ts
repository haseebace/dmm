/**
 * File-Folder Assignment Types
 *
 * Types for file-to-folder assignment operations and API responses
 */

import { z } from 'zod'

/**
 * File-Folder Assignment schema
 */
export const FileFolderAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  file_id: z.string().uuid(),
  folder_id: z.string().uuid(),
  user_id: z.string().uuid(),
  virtual_filename: z.string().min(1).max(255).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type FileFolderAssignment = z.infer<typeof FileFolderAssignmentSchema>

/**
 * Bulk assignment schema
 */
export const BulkAssignmentSchema = z.object({
  assignments: z.array(
    z.object({
      file_id: z.string().uuid(),
      folder_id: z.string().uuid(),
      virtual_filename: z.string().min(1).max(255).optional(),
    })
  ),
})

export type BulkAssignment = z.infer<typeof BulkAssignmentSchema>

/**
 * API Response types
 */
export interface AssignmentApiResponse {
  success: boolean
  data?: FileFolderAssignment | FileFolderAssignment[]
  message: string
  error?: string
}

export interface AssignmentListResponse {
  assignments: FileFolderAssignment[]
  total: number
  page?: number
  limit?: number
}

export interface FolderFilesResponse {
  files: any[] // File objects with assignment metadata
  total: number
  folder_id: string
  page?: number
  limit?: number
}

export interface FileFoldersResponse {
  folders: any[] // Folder objects
  total: number
  file_id: string
}

/**
 * Drag and Drop types
 */
export interface DragItem {
  type: 'file'
  id: string
  data: any // File data
}

export interface DropZoneData {
  folderId: string
  folderName: string
}

/**
 * Assignment operations
 */
export interface AssignmentOperation {
  file_id: string
  folder_id: string
  virtual_filename?: string
}

export interface AssignmentResult {
  success: boolean
  assignment?: FileFolderAssignment
  error?: string
}

export interface BulkAssignmentResult {
  successful: AssignmentResult[]
  failed: AssignmentResult[]
  total: number
}
