/**
 * Folder Navigation Hook
 *
 * Navigation state management and URL synchronization
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  BreadcrumbItem,
  UseFolderNavigationReturn,
  NavigationAction,
  FolderQueryParams,
} from '@/types/navigation'
import { useFolderStore } from '@/stores/folderStore'

/**
 * Navigation store
 */
interface NavigationStore {
  history: string[][]
  historyIndex: number
  currentFolderId: string | null
  folderIds: string[]
}

export const useNavigationStore = create<NavigationStore>()(
  devtools(
    persist(
      (set, get) => ({
        history: [['/']],
        historyIndex: 0,
        currentFolderId: null,
        folderIds: [],
      }),
      {
        name: 'navigation-store',
        partialize: (state) => ({
          history: state.history,
          historyIndex: state.historyIndex,
          currentFolderId: state.currentFolderId,
          folderIds: state.folderIds,
        }),
      }
    )
  )
)

/**
 * Build breadcrumb path from folder hierarchy
 */
function buildBreadcrumbPath(
  folders: any[],
  currentFolderId: string | null
): BreadcrumbItem[] {
  if (!currentFolderId) {
    return [
      {
        id: 'root',
        name: 'Home',
        path: '/folders',
        isRoot: true,
      },
    ]
  }

  const path: BreadcrumbItem[] = [
    {
      id: 'root',
      name: 'Home',
      path: '/folders',
      isRoot: true,
    },
  ]

  // Build hierarchy from current folder up to root
  const buildPath = (
    folderId: string,
    visited = new Set()
  ): BreadcrumbItem[] => {
    if (visited.has(folderId)) return [] // Prevent cycles

    const folder = folders.find((f) => f.id === folderId)
    if (!folder || !folder.parent_id) return []

    visited.add(folderId)

    const parentPath = buildPath(folder.parent_id, visited)
    const currentBreadcrumb: BreadcrumbItem = {
      id: folder.id,
      name: folder.name,
      path: `/folders/${folder.id}`,
    }

    return [...parentPath, currentBreadcrumb]
  }

  const folderPath = buildPath(currentFolderId)
  return [...path, ...folderPath]
}

/**
 * Extract folder IDs from URL path
 */
function extractFolderIdsFromPath(pathname: string): string[] {
  const parts = pathname.split('/')

  if (parts[1] === 'folders') {
    // Handle /folders/[...folderIds] pattern
    if (parts.length > 2) {
      return parts.slice(2) // Skip ['/', 'folders']
    }
  }

  return []
}

/**
 * Main folder navigation hook
 */
export function useFolderNavigation(
  folderId?: string
): UseFolderNavigationReturn {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { folders } = useFolderStore()
  const {
    history,
    historyIndex,
    currentFolderId: storeFolderId,
    setNavigation,
  } = useNavigationStore()

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    folderId || null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get breadcrumb path
  const breadcrumbPath = useMemo(() => {
    return buildBreadcrumbPath(folders, currentFolderId)
  }, [folders, currentFolderId])

  // Navigation state
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < history.length - 1

  /**
   * Update navigation store
   */
  const updateNavigationState = useCallback(
    (folderId: string | null, folderIds: string[] = []) => {
      setNavigation({
        currentFolderId: folderId,
        folderIds,
      })
    },
    [setNavigation]
  )

  /**
   * Navigate to folder by ID
   */
  const navigateToFolder = useCallback(
    (folderId: string) => {
      const url = getFolderURL(folderId)
      router.push(url)
      updateNavigationState(folderId, [folderId])
    },
    [router, updateNavigationState]
  )

  /**
   * Navigate to folder path
   */
  const navigateToFolderPath = useCallback(
    (folderIds: string[]) => {
      const url = `/folders/${folderIds.join('/')}`
      router.push(url)
      updateNavigationState(folderIds[folderIds.length - 1] || null, folderIds)
    },
    [router, updateNavigationState]
  )

  /**
   * Navigate to parent folder
   */
  const navigateToParent = useCallback(() => {
    if (!currentFolderId) return

    const currentFolder = folders.find((f) => f.id === currentFolderId)
    if (currentFolder?.parent_id) {
      navigateToFolder(currentFolder.parent_id)
    } else {
      goHome()
    }
  }, [currentFolderId, folders, navigateToFolder, goHome])

  /**
   * Navigate back in history
   */
  const goBack = useCallback(() => {
    if (canGoBack) {
      const previousIndex = historyIndex - 1
      const previousPath = history[previousIndex]

      setNavigation({
        historyIndex: previousIndex,
      })

      router.replace(previousPath)
    }
  }, [canGoBack, historyIndex, history, router, setNavigation])

  /**
   * Navigate forward in history
   */
  const goForward = useCallback(() => {
    if (canGoForward) {
      const nextIndex = historyIndex + 1
      const nextPath = history[nextIndex]

      setNavigation({
        historyIndex: nextIndex,
      })

      router.replace(nextPath)
    }
  }, [canGoForward, historyIndex, history, router, setNavigation])

  /**
   * Navigate to home/root
   */
  const goHome = useCallback(() => {
    router.push('/folders')
    updateNavigationState(null, [])
  }, [router, updateNavigationState])

  /**
   * Update URL with search parameters
   */
  const updateURL = useCallback(
    (params: Partial<FolderQueryParams>) => {
      if (!currentFolderId) return

      const newSearchParams = new URLSearchParams(searchParams)

      // Update parameters
      if (params.sort) newSearchParams.set('sort', params.sort)
      if (params.order) newSearchParams.set('order', params.order)
      if (params.view) newSearchParams.set('view', params.view)
      if (params.search) newSearchParams.set('search', params.search)

      // Update filters
      if (params.filter) {
        Object.entries(params.filter).forEach(([key, value]) => {
          if (value && value !== 'all') {
            newSearchParams.set(`filter.${key}`, value)
          } else {
            newSearchParams.delete(`filter.${key}`)
          }
        })
      }

      const url = getFolderURL(currentFolderId, newSearchParams)
      router.replace(url)
    },
    [currentFolderId, searchParams, router]
  )

  /**
   * Get URL for folder
   */
  const getURL = useCallback(
    (folderId?: string, params?: Partial<FolderQueryParams>): string => {
      const targetFolderId = folderId || currentFolderId
      if (!targetFolderId) return '/folders'

      const searchParams = new URLSearchParams()

      if (params) {
        if (params.sort) searchParams.set('sort', params.sort)
        if (params.order) searchParams.set('order', params.order)
        if (params.view) searchParams.set('view', params.view)
        if (params.search) searchParams.set('search', params.search)

        if (params.filter) {
          Object.entries(params.filter).forEach(([key, value]) => {
            if (value && value !== 'all') {
              searchParams.set(`filter.${key}`, value)
            }
          })
        }
      }

      const queryString = searchParams.toString()
      return `/folders/${targetFolderId}${queryString ? `?${queryString}` : ''}`
    },
    [currentFolderId]
  )

  /**
   * Sync with URL changes
   */
  useEffect(() => {
    const folderIds = extractFolderIdsFromPath(pathname)
    const newFolderId =
      folderIds.length > 0 ? folderIds[folderIds.length - 1] : null

    if (newFolderId !== currentFolderId) {
      setCurrentFolderId(newFolderId)
      updateNavigationState(newFolderId, folderIds)
    }
  }, [pathname, currentFolderId, updateNavigationState])

  return {
    // Navigation state
    currentFolder: currentFolderId
      ? folders.find((f) => f.id === currentFolderId)
      : null,
    breadcrumbPath,
    canGoBack,
    canGoForward,
    isLoading,
    error,

    // Navigation actions
    navigateToFolder,
    navigateToFolderPath,
    navigateToParent,
    goBack,
    goForward,
    goHome,

    // URL management
    updateURL,
    getURL,
  }
}

/**
 * Helper function to get folder URL
 */
function getFolderURL(folderId: string, params?: URLSearchParams): string {
  const baseUrl = `/folders/${folderId}`
  const queryString = params?.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

/**
 * Hook for managing navigation URL parameters
 */
export function useFolderURLParams() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const params = useMemo(() => {
    const sort = searchParams.get('sort') as any
    const order = searchParams.get('order') as any
    const view = searchParams.get('view') as any
    const search = searchParams.get('search')

    const filters = {
      fileType: searchParams.get('filter.fileType') as any,
      dateRange: searchParams.get('filter.dateRange') as any,
      sizeRange: searchParams.get('filter.sizeRange') as any,
      assignedStatus: searchParams.get('filter.assignedStatus') as any,
    }

    return {
      sort,
      order,
      view,
      search,
      filters,
    }
  }, [searchParams])

  const updateParams = useCallback(
    (newParams: Partial<typeof params>) => {
      const newSearchParams = new URLSearchParams(searchParams)

      Object.entries(newParams).forEach(([key, value]) => {
        if (key === 'filters' && value) {
          Object.entries(value).forEach(([filterKey, filterValue]) => {
            if (filterValue && filterValue !== 'all') {
              newSearchParams.set(`filter.${filterKey}`, filterValue)
            } else {
              newSearchParams.delete(`filter.${filterKey}`)
            }
          })
        } else if (value !== undefined && value !== null) {
          newSearchParams.set(key, value.toString())
        } else {
          newSearchParams.delete(key)
        }
      })

      const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`
      router.replace(newUrl)
    },
    [searchParams, router]
  )

  return { params, updateParams }
}
