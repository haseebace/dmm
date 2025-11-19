/**
 * Folder Store
 *
 * Zustand store for managing virtual folders, hierarchy,
 * and folder operations with optimistic updates.
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

import { logger } from '@/lib/logger'
import {
  Folder,
  FolderHierarchy,
  FolderStore,
  CreateFolderInput,
  UpdateFolderInput,
  DeleteFolderOptions,
  FolderOperationResult,
  FolderStoreState,
  FolderStoreActions,
} from '@/types/folders'

// Helper function to build folder hierarchy
function buildFolderHierarchy(
  folders: Folder[],
  parentId?: string,
  level = 0
): FolderHierarchy[] {
  const children = folders
    .filter((folder) => folder.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)

  return children.map((folder) => ({
    id: folder.id,
    name: folder.name,
    description: folder.description,
    color: folder.color,
    parentId: folder.parent_id,
    sortOrder: folder.sort_order,
    createdAt: folder.created_at,
    updatedAt: folder.updated_at,
    level,
    children: buildFolderHierarchy(folders, folder.id, level + 1),
    path: [], // Will be populated by buildPathForHierarchy
  }))
}

// Helper function to build paths for hierarchy
function buildPathForHierarchy(
  hierarchy: FolderHierarchy[],
  currentPath: string[] = []
): void {
  hierarchy.forEach((folder) => {
    folder.path = [...currentPath, folder.name]
    buildPathForHierarchy(folder.children, folder.path)
  })
}

// Helper function to validate folder name
function validateFolderName(
  name: string,
  folders: Folder[],
  parentId?: string,
  excludeId?: string
): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Folder name is required' }
  }

  if (name.length > 255) {
    return {
      valid: false,
      error: 'Folder name must be less than 255 characters',
    }
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Folder name contains invalid characters' }
  }

  // Check for duplicate names in the same parent
  const duplicate = folders.find(
    (folder) =>
      folder.name.toLowerCase() === name.toLowerCase() &&
      folder.parent_id === parentId &&
      folder.id !== excludeId
  )

  if (duplicate) {
    return {
      valid: false,
      error: 'A folder with this name already exists in this location',
    }
  }

  return { valid: true }
}

// API helper functions
async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const useFolderStore = create<FolderStore>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // Initial state
        folders: [],
        hierarchy: [],
        selectedFolderId: null,
        isLoading: false,
        error: null,
        lastUpdated: null,

        // Data fetching
        fetchFolders: async (userId: string) => {
          set({ isLoading: true, error: null })

          try {
            const response = await apiCall<{ folders: Folder[] }>(
              '/api/folders',
              {
                method: 'GET',
                headers: { 'X-User-ID': userId },
              }
            )

            const hierarchy = buildFolderHierarchy(response.folders)
            buildPathForHierarchy(hierarchy)

            set({
              folders: response.folders,
              hierarchy,
              isLoading: false,
              lastUpdated: new Date(),
            })

            logger.info('Folders fetched successfully', 'folder-store', {
              userId,
              folderCount: response.folders.length,
            })
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to fetch folders'
            set({ error: errorMessage, isLoading: false })

            logger.error('Failed to fetch folders', 'folder-store', {
              userId,
              error: errorMessage,
            })
          }
        },

        fetchFolderHierarchy: async (userId: string) => {
          // Similar to fetchFolders but focuses on hierarchy structure
          await get().fetchFolders(userId)
        },

        // Folder operations
        createFolder: async (userId: string, input: CreateFolderInput) => {
          set({ isLoading: true, error: null })

          try {
            // Validate folder name
            const validation = get().validateFolderName(
              input.name,
              input.parentId
            )
            if (!validation.valid) {
              set({ error: validation.error, isLoading: false })
              return { success: false, error: validation.error }
            }

            // Optimistic update
            const tempFolder: Folder = {
              id: uuidv4(),
              user_id: userId,
              name: input.name,
              description: input.description,
              color: input.color,
              parent_id: input.parentId,
              sort_order: get().folders.length, // Temporary sort order
              created_at: new Date(),
              updated_at: new Date(),
            }

            set((state) => ({
              folders: [...state.folders, tempFolder],
              hierarchy: buildFolderHierarchy([...state.folders, tempFolder]),
            }))

            // API call
            const response = await apiCall<{ folder: Folder }>('/api/folders', {
              method: 'POST',
              headers: { 'X-User-ID': userId },
              body: JSON.stringify(input),
            })

            // Replace optimistic folder with real one
            set((state) => ({
              folders: state.folders.map((f) =>
                f.id === tempFolder.id ? response.folder : f
              ),
              hierarchy: buildFolderHierarchy(
                state.folders.map((f) =>
                  f.id === tempFolder.id ? response.folder : f
                )
              ),
              isLoading: false,
              lastUpdated: new Date(),
            }))

            logger.info('Folder created successfully', 'folder-store', {
              userId,
              folderId: response.folder.id,
              folderName: response.folder.name,
            })

            return { success: true, folder: response.folder }
          } catch (error) {
            // Revert optimistic update
            set((state) => ({
              folders: state.folders.filter(
                (f) => !f.id.startsWith(uuidv4().split('-')[0])
              ),
              hierarchy: buildFolderHierarchy(
                state.folders.filter(
                  (f) => !f.id.startsWith(uuidv4().split('-')[0])
                )
              ),
              isLoading: false,
            }))

            const errorMessage =
              error instanceof Error ? error.message : 'Failed to create folder'
            set({ error: errorMessage })

            logger.error('Failed to create folder', 'folder-store', {
              userId,
              input,
              error: errorMessage,
            })

            return { success: false, error: errorMessage }
          }
        },

        updateFolder: async (folderId: string, input: UpdateFolderInput) => {
          set({ isLoading: true, error: null })

          try {
            const currentFolder = get().folders.find((f) => f.id === folderId)
            if (!currentFolder) {
              throw new Error('Folder not found')
            }

            // Validate folder name if being updated
            if (input.name) {
              const validation = get().validateFolderName(
                input.name,
                input.parentId || currentFolder.parent_id,
                folderId
              )
              if (!validation.valid) {
                set({ error: validation.error, isLoading: false })
                return { success: false, error: validation.error }
              }
            }

            // Optimistic update
            const updatedFolder = {
              ...currentFolder,
              ...input,
              updated_at: new Date(),
            }
            set((state) => ({
              folders: state.folders.map((f) =>
                f.id === folderId ? updatedFolder : f
              ),
              hierarchy: buildFolderHierarchy(
                state.folders.map((f) =>
                  f.id === folderId ? updatedFolder : f
                )
              ),
            }))

            // API call
            const response = await apiCall<{ folder: Folder }>(
              `/api/folders/${folderId}`,
              {
                method: 'PUT',
                body: JSON.stringify(input),
              }
            )

            // Update with server response
            set((state) => ({
              folders: state.folders.map((f) =>
                f.id === folderId ? response.folder : f
              ),
              hierarchy: buildFolderHierarchy(
                state.folders.map((f) =>
                  f.id === folderId ? response.folder : f
                )
              ),
              isLoading: false,
              lastUpdated: new Date(),
            }))

            logger.info('Folder updated successfully', 'folder-store', {
              folderId,
              updates: input,
            })

            return { success: true, folder: response.folder }
          } catch (error) {
            // Revert optimistic update by refetching
            const userId = get().folders.find((f) => f.id === folderId)?.user_id
            if (userId) {
              await get().fetchFolders(userId)
            }

            const errorMessage =
              error instanceof Error ? error.message : 'Failed to update folder'
            set({ error: errorMessage, isLoading: false })

            logger.error('Failed to update folder', 'folder-store', {
              folderId,
              input,
              error: errorMessage,
            })

            return { success: false, error: errorMessage }
          }
        },

        deleteFolder: async (
          folderId: string,
          options: DeleteFolderOptions = {}
        ) => {
          set({ isLoading: true, error: null })

          try {
            const folder = get().folders.find((f) => f.id === folderId)
            if (!folder) {
              throw new Error('Folder not found')
            }

            // Check if folder has contents
            const hasContents =
              get().folders.some((f) => f.parent_id === folderId) ||
              get().hierarchy.some((f) => f.parentId === folderId)

            if (hasContents && !options.force) {
              set({
                error: 'Folder contains items. Use force option to delete.',
                isLoading: false,
              })
              return {
                success: false,
                error: 'Folder contains items. Use force option to delete.',
              }
            }

            // Optimistic update
            const originalFolders = get().folders
            set((state) => ({
              folders: state.folders.filter((f) => f.id !== folderId),
              hierarchy: buildFolderHierarchy(
                state.folders.filter((f) => f.id !== folderId)
              ),
            }))

            // API call
            const response = await apiCall<{ affectedItems?: number }>(
              `/api/folders/${folderId}?force=${options.force}&moveToParent=${options.moveToParent || false}`,
              {
                method: 'DELETE',
              }
            )

            set({
              isLoading: false,
              lastUpdated: new Date(),
            })

            logger.info('Folder deleted successfully', 'folder-store', {
              folderId,
              options,
              affectedItems: response.affectedItems,
            })

            return {
              success: true,
              affectedItems: response.affectedItems,
            }
          } catch (error) {
            // Revert optimistic update
            set((state) => ({
              folders: get().folders,
              hierarchy: buildFolderHierarchy(get().folders),
              isLoading: false,
            }))

            const errorMessage =
              error instanceof Error ? error.message : 'Failed to delete folder'
            set({ error: errorMessage })

            logger.error('Failed to delete folder', 'folder-store', {
              folderId,
              options,
              error: errorMessage,
            })

            return { success: false, error: errorMessage }
          }
        },

        moveFolder: async (folderId: string, newParentId?: string) => {
          return get().updateFolder(folderId, { parentId: newParentId })
        },

        // State management
        setSelectedFolder: (folderId: string | null) => {
          set({ selectedFolderId: folderId })

          logger.debug('Folder selection changed', 'folder-store', {
            folderId,
          })
        },

        clearError: () => {
          set({ error: null })
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading })
        },

        // Utility methods
        getFolderById: (folderId: string) => {
          return get().folders.find((f) => f.id === folderId)
        },

        getFolderChildren: (parentId: string) => {
          return get().folders.filter((f) => f.parent_id === parentId)
        },

        getFolderPath: (folderId: string): string[] => {
          const path: string[] = []
          let currentFolder = get().folders.find((f) => f.id === folderId)

          while (currentFolder) {
            path.unshift(currentFolder.name)
            currentFolder = currentFolder.parent_id
              ? get().folders.find((f) => f.id === currentFolder!.parent_id)
              : undefined
          }

          return path
        },

        buildHierarchy: (folders: Folder[]) => {
          const hierarchy = buildFolderHierarchy(folders)
          buildPathForHierarchy(hierarchy)
          return hierarchy
        },

        validateFolderName: (
          name: string,
          parentId?: string,
          excludeId?: string
        ) => {
          return validateFolderName(name, get().folders, parentId, excludeId)
        },
      }),
      {
        name: 'folder-store',
      }
    ),
    {
      name: 'folder-store',
    }
  )
)

// Selectors for commonly used state
export const useFolders = () => useFolderStore((state) => state.folders)
export const useFolderHierarchy = () =>
  useFolderStore((state) => state.hierarchy)
export const useSelectedFolderId = () =>
  useFolderStore((state) => state.selectedFolderId)
export const useSelectedFolder = () =>
  useFolderStore((state) =>
    state.selectedFolderId
      ? state.folders.find((f) => f.id === state.selectedFolderId)
      : undefined
  )
export const useFolderLoading = () => useFolderStore((state) => state.isLoading)
export const useFolderError = () => useFolderStore((state) => state.error)

// Action selectors
export const useFolderActions = () =>
  useFolderStore((state) => ({
    fetchFolders: state.fetchFolders,
    fetchFolderHierarchy: state.fetchFolderHierarchy,
    createFolder: state.createFolder,
    updateFolder: state.updateFolder,
    deleteFolder: state.deleteFolder,
    moveFolder: state.moveFolder,
    setSelectedFolder: state.setSelectedFolder,
    clearError: state.clearError,
    setLoading: state.setLoading,
    getFolderById: state.getFolderById,
    getFolderChildren: state.getFolderChildren,
    getFolderPath: state.getFolderPath,
    buildHierarchy: state.buildHierarchy,
    validateFolderName: state.validateFolderName,
  }))
