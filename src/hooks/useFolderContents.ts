/**
 * Folder Contents Hook
 *
 * Folder contents data fetching and caching with React Query
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import {
  UseFolderContentsReturn,
  FolderContentsItem,
  FilterOptions,
  SortField,
  SortOrder,
  ViewMode,
} from '@/types/navigation'
import { useFolderURLParams } from './useFolderNavigation'
import { getFolderFiles, getFileFolders } from '@/lib/api/file-folders'

// Query keys
const folderContentsKeys = {
  all: ['folderContents'] as const,
  files: (folderId: string, params: any) =>
    ['folderContents', 'files', folderId, params] as const,
  folders: (folderId: string) =>
    ['folderContents', 'folders', folderId] as const,
}

const folderHierarchyKeys = {
  files: (folderId: string) => ['folderHierarchy', 'files', folderId] as const,
}

/**
 * Helper function to apply filters to files
 */
function applyFilters(
  files: any[],
  searchTerm: string,
  filters: FilterOptions,
  sortBy: SortField,
  sortOrder: SortOrder
): any[] {
  let filteredFiles = [...files]

  // Search filter
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase()
    filteredFiles = filteredFiles.filter(
      (file) =>
        file.filename.toLowerCase().includes(searchLower) ||
        file.virtual_filename?.toLowerCase().includes(searchLower)
    )
  }

  // File type filter
  if (filters.fileType && filters.fileType !== 'all') {
    filteredFiles = filteredFiles.filter((file) => {
      const mimeType = file.mime_type || file.type || ''

      switch (filters.fileType) {
        case 'images':
          return mimeType.startsWith('image/')
        case 'videos':
          return mimeType.startsWith('video/')
        case 'documents':
          return (
            mimeType.includes('pdf') ||
            mimeType.includes('document') ||
            mimeType.includes('text')
          )
        case 'audio':
          return mimeType.startsWith('audio/')
        case 'archives':
          return (
            mimeType.includes('zip') ||
            mimeType.includes('rar') ||
            mimeType.includes('7z')
          )
        default:
          return true
      }
    })
  }

  // Date range filter
  if (filters.dateRange && filters.dateRange !== 'all') {
    const now = new Date()
    const filterDate = new Date()

    switch (filters.dateRange) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        filterDate.setDate(now.getDate() - 7)
        break
      case 'month':
        filterDate.setMonth(now.getMonth() - 1)
        break
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1)
        break
    }

    filteredFiles = filteredFiles.filter((file) => {
      const fileDate = new Date(
        file.created_at || file.modified || file.assigned_at
      )
      return fileDate >= filterDate
    })
  }

  // Size range filter
  if (filters.sizeRange && filters.sizeRange !== 'all') {
    filteredFiles = filteredFiles.filter((file) => {
      const size = file.file_size || file.size || 0

      switch (filters.sizeRange) {
        case 'small':
          return size < 1024 * 1024 // < 1MB
        case 'medium':
          return size >= 1024 * 1024 && size < 10 * 1024 * 1024 // 1MB - 10MB
        case 'large':
          return size >= 10 * 1024 * 1024 // > 10MB
        default:
          return true
      }
    })
  }

  // Assigned status filter
  if (filters.assignedStatus && filters.assignedStatus !== 'all') {
    filteredFiles = filteredFiles.filter((file) => {
      // This would need to be implemented based on your assignment tracking
      // For now, assuming all files are assigned
      return filters.assignedStatus === 'assigned'
    })
  }

  // Sort
  filteredFiles.sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortBy) {
      case 'name':
        aValue = (a.virtual_filename || a.filename || '').toLowerCase()
        bValue = (b.virtual_filename || b.filename || '').toLowerCase()
        break
      case 'size':
        aValue = a.file_size || a.size || 0
        bValue = b.file_size || b.size || 0
        break
      case 'modified':
        aValue = new Date(a.modified || a.created_at || a.updated_at).getTime()
        bValue = new Date(b.modified || b.created_at || b.updated_at).getTime()
        break
      case 'type':
        aValue = a.mime_type || a.type || ''
        bValue = b.mime_type || b.type || ''
        break
      case 'assigned':
        aValue = new Date(a.assigned_at || 0).getTime()
        bValue = new Date(b.assigned_at || 0).getTime()
        break
      default:
        aValue = (a.virtual_filename || a.filename || '').toLowerCase()
        bValue = (b.virtual_filename || b.filename || '').toLowerCase()
    }

    if (sortOrder === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    }
  })

  return filteredFiles
}

/**
 * Main folder contents hook
 */
export function useFolderContents(
  folderId: string | null
): UseFolderContentsReturn {
  const { params, updateParams } = useFolderURLParams()
  const [viewMode, setViewMode] = useState<ViewMode>(params.view || 'grid')
  const [sortBy, setSortBy] = useState<SortField>(params.sort || 'name')
  const [sortOrder, setSortOrder] = useState<SortOrder>(params.order || 'asc')

  // Combined filters
  const filters = useMemo<FilterOptions>(
    () => ({
      fileType: params.filters?.fileType || 'all',
      dateRange: params.filters?.dateRange || 'all',
      sizeRange: params.filters?.sizeRange || 'all',
      assignedStatus: params.filters?.assignedStatus || 'all',
    }),
    [params.filters]
  )

  // Files query
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    error: filesError,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: folderContentsKeys.files(folderId, params),
    queryFn: async () => {
      if (!folderId) return []
      const result = await getFolderFiles(folderId, {
        page: 1,
        limit: 50,
        sort: sortBy,
        order: sortOrder,
        search: params.search,
      })
      return result.files || []
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Folders query (subfolders)
  const {
    data: foldersData,
    isLoading: isLoadingFolders,
    error: foldersError,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: folderContentsKeys.folders(folderId),
    queryFn: async () => {
      if (!folderId) return []
      // This would need to be implemented - get subfolders of current folder
      // For now, return empty array
      return []
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000,
  })

  // Combined state
  const isLoading = isLoadingFiles || isLoadingFolders
  const error = filesError || foldersError

  // Process files into FolderContentsItem format
  const files: FolderContentsItem[] = useMemo(() => {
    return (filesData || []).map((file) => ({
      id: file.id,
      name: file.virtual_filename || file.filename,
      type: 'file',
      size: file.file_size,
      modified: file.modified || file.updated_at,
      mimeType: file.mime_type,
      virtualFilename: file.virtual_filename,
      hasThumbnail: file.mime_type?.startsWith('image/'),
    }))
  }, [filesData])

  const folders: FolderContentsItem[] = useMemo(() => {
    return (foldersData || []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      modified: folder.updated_at,
    }))
  }, [foldersData])

  // Combine all items
  const allItems = useMemo(() => {
    return [...folders, ...files]
  }, [folders, files])

  // Apply filters and sorting
  const filteredItems = useMemo(() => {
    return applyFilters(files, params.search || '', filters, sortBy, sortOrder)
  }, [files, params.search, filters, sortBy, sortOrder])

  // Calculate totals
  const totalFiles = files.length
  const totalFolders = folders.length

  // Search term management
  const searchTerm = params.search || ''
  const setSearchTerm = useCallback(
    (term: string) => {
      updateParams({ search: term })
    },
    [updateParams]
  )

  // Filter management
  const setFilters = useCallback(
    (newFilters: Partial<FilterOptions>) => {
      const updatedFilters = { ...filters, ...newFilters }
      updateParams({
        filters: {
          fileType: updatedFilters.fileType,
          dateRange: updatedFilters.dateRange,
          sizeRange: updatedFilters.sizeRange,
          assignedStatus: updatedFilters.assignedStatus,
        },
      })
    },
    [filters, updateParams]
  )

  // Sorting management
  const setSorting = useCallback(
    (field: SortField, order: SortOrder) => {
      setSortBy(field)
      setSortOrder(order)
      updateParams({ sort: field, order })
    },
    [updateParams]
  )

  // Infinite scrolling support (if needed)
  const hasNextPage = false // Implement if pagination is added
  const isFetchingNextPage = false // Implement if pagination is added
  const fetchNextPage = () => {
    // Implement infinite scrolling
  }

  // Clear search
  const clearSearch = useCallback(() => {
    updateParams({ search: '' })
  }, [updateParams])

  return {
    // Data
    files,
    folders,
    allItems,
    filteredItems,
    totalFiles,
    totalFolders,

    // State
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,

    // Search and filter
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    sortBy,
    sortOrder,
    setSorting,
    viewMode,
    setViewMode,

    // Actions
    refetch: () => {
      refetchFiles()
      refetchFolders()
    },
    fetchNextPage,
    clearSearch,
  }
}

/**
 * Hook for getting files in folder hierarchy (parents + current + children)
 */
export function useFolderHierarchy(folderId: string | null) {
  return useQuery({
    queryKey: folderHierarchyKeys.files(folderId || ''),
    queryFn: async () => {
      if (!folderId) return []
      const folderFolders = await getFileFolders(folderId)

      // This would need to be implemented to get parent folders
      // For now, return just the current folder's files
      return folderFolders.folders || []
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook for virtual scrolling (placeholder - would integrate with react-window)
 */
export function useVirtualScroll(items: FolderContentsItem[], itemHeight = 60) {
  const [startIndex, setStartIndex] = useState(0)
  const [endIndex, setEndIndex] = useState(20)

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      index: startIndex + index,
      style: {
        position: 'absolute',
        top: (startIndex + index) * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight,
      },
      data: item,
    }))
  }, [items, startIndex, endIndex, itemHeight])

  const scrollToItem = useCallback((index: number) => {
    setStartIndex(Math.max(0, index - 10))
    setEndIndex(index + 10)
  }, [])

  const scrollToTop = useCallback(() => {
    setStartIndex(0)
    setEndIndex(20)
  }, [])

  return {
    visibleItems,
    totalItems: items.length,
    scrollToItem,
    scrollToTop,
    startIndex,
    endIndex,
    setStartIndex,
    setEndIndex,
  }
}
