/**
 * Folder Types
 *
 * Type definitions for the virtual folder system
 */

import { z } from 'zod'

// Folder database schema
export interface Folder {
  id: string
  user_id: string
  name: string
  description?: string
  color?: string
  parent_id?: string
  sort_order: number
  created_at: Date
  updated_at: Date
}

// Folder hierarchy structure for frontend
export interface FolderHierarchy {
  id: string
  name: string
  description?: string
  color?: string
  parentId?: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  children: FolderHierarchy[]
  level: number
  path: string[]
}

// Folder creation input
export interface CreateFolderInput {
  name: string
  parentId?: string
  description?: string
  color?: string
}

// Folder update input
export interface UpdateFolderInput {
  name?: string
  parentId?: string
  description?: string
  color?: string
  sortOrder?: number
}

// Folder deletion options
export interface DeleteFolderOptions {
  force?: boolean // Delete even if contains files/subfolders
  moveToParent?: boolean // Move contents to parent folder before deletion
}

// Folder operations result
export interface FolderOperationResult {
  success: boolean
  folder?: Folder
  error?: string
  affectedItems?: number // Number of files/subfolders affected by deletion
}

// Store state interface
export interface FolderStoreState {
  folders: Folder[]
  hierarchy: FolderHierarchy[]
  selectedFolderId: string | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

// Store actions interface
export interface FolderStoreActions {
  // Data fetching
  fetchFolders: (userId: string) => Promise<void>
  fetchFolderHierarchy: (userId: string) => Promise<void>

  // Folder operations
  createFolder: (
    userId: string,
    input: CreateFolderInput
  ) => Promise<FolderOperationResult>
  updateFolder: (
    folderId: string,
    input: UpdateFolderInput
  ) => Promise<FolderOperationResult>
  deleteFolder: (
    folderId: string,
    options?: DeleteFolderOptions
  ) => Promise<FolderOperationResult>
  moveFolder: (
    folderId: string,
    newParentId?: string
  ) => Promise<FolderOperationResult>

  // State management
  setSelectedFolder: (folderId: string | null) => void
  clearError: () => void
  setLoading: (loading: boolean) => void

  // Utility methods
  getFolderById: (folderId: string) => Folder | undefined
  getFolderChildren: (parentId: string) => Folder[]
  getFolderPath: (folderId: string) => string[]
  buildHierarchy: (folders: Folder[]) => FolderHierarchy[]
  validateFolderName: (
    name: string,
    parentId?: string
  ) => { valid: boolean; error?: string }
}

// Combined store type
export type FolderStore = FolderStoreState & FolderStoreActions

// Zod schemas for validation
const CreateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name must be less than 255 characters')
    .regex(/^[^<>:"/\\|?*]+$/, 'Folder name contains invalid characters'),
  parentId: z.string().uuid().optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .optional(),
})

const UpdateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name must be less than 255 characters')
    .regex(/^[^<>:"/\\|?*]+$/, 'Folder name contains invalid characters')
    .optional(),
  parentId: z.string().uuid().optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .optional(),
  sortOrder: z
    .number()
    .int()
    .min(0, 'Sort order must be non-negative')
    .optional(),
})

const DeleteFolderSchema = z.object({
  force: z.boolean().default(false),
  moveToParent: z.boolean().default(false),
})

// API request/response types
export interface FolderApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

export interface FolderListResponse {
  folders: Folder[]
  hierarchy: FolderHierarchy[]
  total: number
}

// Context menu actions
export interface FolderContextMenuAction {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  danger?: boolean
  action: () => void
}

// Keyboard shortcuts
export interface FolderKeyboardShortcuts {
  create: 'Ctrl+N' | 'Cmd+N'
  rename: 'F2'
  delete: 'Delete'
  moveToParent: 'Backspace'
}

// Export schemas for use in API routes
export { CreateFolderSchema, UpdateFolderSchema, DeleteFolderSchema }
