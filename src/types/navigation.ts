/**
 * Navigation Types
 *
 * Types for folder navigation and browsing functionality
 */

import { z } from 'zod'

/**
 * Folder hierarchy item for breadcrumbs
 */
export interface BreadcrumbItem {
  id: string
  name: string
  path: string
  isRoot?: boolean
}

/**
 * View modes for folder contents
 */
export const ViewModeSchema = z.enum(['grid', 'list'])
export type ViewMode = z.infer<typeof ViewModeSchema>

/**
 * Sort options for folder contents
 */
export const SortFieldSchema = z.enum([
  'name',
  'size',
  'modified',
  'type',
  'assigned',
])
export type SortField = z.infer<typeof SortFieldSchema>

export const SortOrderSchema = z.enum(['asc', 'desc'])
export type SortOrder = z.infer<typeof SortOrderSchema>

/**
 * Filter options
 */
export interface FilterOptions {
  fileType?: 'all' | 'images' | 'videos' | 'documents' | 'audio' | 'archives'
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'year'
  sizeRange?: 'all' | 'small' | 'medium' | 'large'
  assignedStatus?: 'all' | 'assigned' | 'unassigned'
}

/**
 * Folder contents item
 */
export interface FolderContentsItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size?: number
  modified?: string
  mimeType?: string
  path?: string
  parentPath?: string
  virtualFilename?: string
  hasThumbnail?: boolean
  isSelected?: boolean
  [key: string]: any
}

/**
 * Navigation state
 */
export interface NavigationState {
  currentFolderId: string | null
  folderIds: string[]
  breadcrumbPath: BreadcrumbItem[]
  canGoBack: boolean
  canGoForward: boolean
  viewMode: ViewMode
  sortBy: SortField
  sortOrder: SortOrder
  filters: FilterOptions
  searchTerm: string
  isLoading: boolean
  error: string | null
}

/**
 * Virtual scrolling item
 */
export interface VirtualScrollItem {
  index: number
  style: React.CSSProperties
  data: FolderContentsItem
}

/**
 * Navigation action types
 */
export interface NavigationAction {
  type: 'NAVIGATE_TO_FOLDER' | 'GO_BACK' | 'GO_FORWARD' | 'GO_HOME'
  folderId?: string
  folderIds?: string[]
}

/**
 * Search and filter state schema
 */
export const SearchFilterSchema = z.object({
  search: z.string().optional(),
  sort: SortFieldSchema.optional(),
  order: SortOrderSchema.optional(),
  view: ViewModeSchema.optional(),
  filter: z
    .object({
      fileType: z.string().optional(),
      dateRange: z.string().optional(),
      sizeRange: z.string().optional(),
      assignedStatus: z.string().optional(),
    })
    .optional(),
})

export type SearchFilterState = z.infer<typeof SearchFilterSchema>

/**
 * URL query parameters
 */
export interface FolderQueryParams {
  sort?: SortField
  order?: SortOrder
  view?: ViewMode
  search?: string
  filter?: Partial<FilterOptions>
}

/**
 * Folder navigation hook return type
 */
export interface UseFolderNavigationReturn {
  // Navigation state
  currentFolder: any | null
  breadcrumbPath: BreadcrumbItem[]
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  error: string | null

  // Navigation actions
  navigateToFolder: (folderId: string) => void
  navigateToFolderPath: (folderIds: string[]) => void
  navigateToParent: () => void
  goBack: () => void
  goForward: () => void
  goHome: () => void

  // URL management
  updateURL: (params: Partial<FolderQueryParams>) => void
  getURL: (folderId?: string, params?: Partial<FolderQueryParams>) => string
}

/**
 * Folder contents hook return type
 */
export interface UseFolderContentsReturn {
  // Data
  files: any[]
  folders: any[]
  allItems: FolderContentsItem[]
  filteredItems: FolderContentsItem[]
  totalFiles: number
  totalFolders: number

  // State
  isLoading: boolean
  error: string | null
  hasNextPage: boolean
  isFetchingNextPage: boolean

  // Search and filter
  searchTerm: string
  setSearchTerm: (term: string) => void
  filters: FilterOptions
  setFilters: (filters: Partial<FilterOptions>) => void
  sortBy: SortField
  sortOrder: SortOrder
  setSorting: (field: SortField, order: SortOrder) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Actions
  refetch: () => void
  fetchNextPage: () => void
  clearSearch: () => void
}

/**
 * Performance metrics
 */
export interface NavigationMetrics {
  folderLoadTime: number
  navigationResponseTime: number
  virtualScrollFPS: number
  searchResponseTime: number
  itemsRendered: number
  totalItems: number
}
