/**
 * File Assignment Store
 *
 * Zustand store for managing file-folder assignment state
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import {
  FileFolderAssignment,
  AssignmentOperation,
  AssignmentResult,
  BulkAssignmentResult,
} from '@/types/file-folders'

// API functions
import {
  assignFilesToFolders,
  removeFilesFromFolders,
} from '@/lib/api/file-folders'

/**
 * File Assignment State Interface
 */
export interface FileAssignmentState {
  // State
  assignments: FileFolderAssignment[]
  loading: boolean
  error: string | null

  // Current operation state
  operationLoading: boolean
  operationError: string | null

  // Optimistic updates
  optimisticAssignments: FileFolderAssignment[]

  // Cache invalidation
  lastFetchTime: number | null
  cacheTimeout: number // 5 minutes

  // Actions
  assignFiles: (
    operations: AssignmentOperation[]
  ) => Promise<BulkAssignmentResult>
  removeFiles: (
    operations: AssignmentOperation[]
  ) => Promise<BulkAssignmentResult>
  updateVirtualFilename: (
    assignmentId: string,
    virtualFilename: string
  ) => Promise<void>

  // Fetch actions
  fetchAssignmentsForFolder: (
    folderId: string
  ) => Promise<FileFolderAssignment[]>
  fetchAssignmentsForFile: (fileId: string) => Promise<FileFolderAssignment[]>
  clearCache: () => void

  // State management
  clearError: () => void
  setLoading: (loading: boolean) => void
}

/**
 * Create File Assignment Store
 */
export const useFileAssignmentStore = create<FileAssignmentState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      assignments: [],
      loading: false,
      error: null,
      operationLoading: false,
      operationError: null,
      optimisticAssignments: [],
      lastFetchTime: null,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes

      /**
       * Assign files to folders
       */
      assignFiles: async (operations: AssignmentOperation[]) => {
        set((state) => {
          state.operationLoading = true
          state.operationError = null
        })

        try {
          // Create optimistic assignments
          const optimisticAssignments = operations.map((op) => ({
            id: crypto.randomUUID(), // Temporary ID
            file_id: op.file_id,
            folder_id: op.folder_id,
            user_id: '', // Will be set by API
            virtual_filename: op.virtual_filename,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))

          // Add optimistic assignments to state
          set((state) => {
            state.optimisticAssignments.push(...optimisticAssignments)
          })

          // Make API call
          const result = await assignFilesToFolders(operations)

          if (result.successful.length === operations.length) {
            // All successful - update real assignments
            set((state) => {
              state.assignments.push(
                ...result.successful.map((r) => r.assignment!)
              )
              state.optimisticAssignments = []
            })
          } else {
            // Some failed - remove optimistic assignments and show errors
            set((state) => {
              state.optimisticAssignments = state.optimisticAssignments.filter(
                (oa) => !optimisticAssignments.find((oa2) => oa2.id === oa.id)
              )

              if (result.failed.length > 0) {
                state.operationError = result.failed
                  .map((f) => f.error)
                  .join('; ')
              }
            })
          }

          return result
        } catch (error) {
          // Remove optimistic assignments on error
          set((state) => {
            state.optimisticAssignments = []
            state.operationError =
              error instanceof Error ? error.message : 'Assignment failed'
          })

          throw error
        } finally {
          set((state) => {
            state.operationLoading = false
          })
        }
      },

      /**
       * Remove files from folders
       */
      removeFiles: async (operations: AssignmentOperation[]) => {
        set((state) => {
          state.operationLoading = true
          state.operationError = null
        })

        try {
          // Optimistic removal - mark for removal
          const toRemove = new Set(
            operations.map((op) => `${op.file_id}-${op.folder_id}`)
          )

          const originalAssignments = [...get().assignments]

          set((state) => {
            state.assignments = state.assignments.filter(
              (assignment) =>
                !toRemove.has(`${assignment.file_id}-${assignment.folder_id}`)
            )
          })

          // Make API call
          const result = await removeFilesFromFolders(operations)

          if (result.failed.length > 0) {
            // Some failed - restore assignments
            set((state) => {
              state.assignments = originalAssignments
              state.operationError = result.failed
                .map((f) => f.error)
                .join('; ')
            })
          }

          return result
        } catch (error) {
          // Restore assignments on error
          set((state) => {
            state.operationError =
              error instanceof Error ? error.message : 'Removal failed'
          })

          throw error
        } finally {
          set((state) => {
            state.operationLoading = false
          })
        }
      },

      /**
       * Update virtual filename for assignment
       */
      updateVirtualFilename: async (
        assignmentId: string,
        virtualFilename: string
      ) => {
        set((state) => {
          state.operationLoading = true
          state.operationError = null
        })

        try {
          // Optimistic update
          const assignments = get().assignments
          const originalAssignment = assignments.find(
            (a) => a.id === assignmentId
          )

          if (originalAssignment) {
            set((state) => {
              const assignment = state.assignments.find(
                (a) => a.id === assignmentId
              )
              if (assignment) {
                assignment.virtual_filename = virtualFilename
                assignment.updated_at = new Date().toISOString()
              }
            })
          }

          // API call would go here
          // await updateAssignmentVirtualFilename(assignmentId, virtualFilename)
        } catch (error) {
          // Restore original value on error
          const assignments = get().assignments
          const originalAssignment = assignments.find(
            (a) => a.id === assignmentId
          )

          if (originalAssignment) {
            set((state) => {
              const assignment = state.assignments.find(
                (a) => a.id === assignmentId
              )
              if (assignment) {
                assignment.virtual_filename =
                  originalAssignment.virtual_filename
                assignment.updated_at = originalAssignment.updated_at
              }
            })
          }

          set((state) => {
            state.operationError =
              error instanceof Error ? error.message : 'Update failed'
          })

          throw error
        } finally {
          set((state) => {
            state.operationLoading = false
          })
        }
      },

      /**
       * Fetch assignments for a folder
       */
      fetchAssignmentsForFolder: async (folderId: string) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          // Check cache
          const now = Date.now()
          const { lastFetchTime, cacheTimeout, assignments } = get()

          if (lastFetchTime && now - lastFetchTime < cacheTimeout) {
            const cachedAssignments = assignments.filter(
              (a) => a.folder_id === folderId
            )
            if (cachedAssignments.length > 0) {
              return cachedAssignments
            }
          }

          // API call would go here
          // const folderAssignments = await getFolderFiles(folderId)

          // Mock data for now
          const folderAssignments: FileFolderAssignment[] = []

          set((state) => {
            // Update assignments for this folder
            state.assignments = state.assignments.filter(
              (a) => a.folder_id !== folderId
            )
            state.assignments.push(...folderAssignments)
            state.lastFetchTime = now
          })

          return folderAssignments
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : 'Failed to fetch assignments'
          })
          throw error
        } finally {
          set((state) => {
            state.loading = false
          })
        }
      },

      /**
       * Fetch assignments for a file
       */
      fetchAssignmentsForFile: async (fileId: string) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          // API call would go here
          // const fileAssignments = await getFileFolders(fileId)

          // Mock data for now
          const fileAssignments: FileFolderAssignment[] = []

          set((state) => {
            // Update assignments for this file
            state.assignments = state.assignments.filter(
              (a) => a.file_id !== fileId
            )
            state.assignments.push(...fileAssignments)
          })

          return fileAssignments
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : 'Failed to fetch assignments'
          })
          throw error
        } finally {
          set((state) => {
            state.loading = false
          })
        }
      },

      /**
       * Clear cache
       */
      clearCache: () => {
        set((state) => {
          state.lastFetchTime = null
        })
      },

      /**
       * Clear error
       */
      clearError: () => {
        set((state) => {
          state.error = null
          state.operationError = null
        })
      },

      /**
       * Set loading state
       */
      setLoading: (loading: boolean) => {
        set((state) => {
          state.loading = loading
        })
      },
    })),
    {
      name: 'file-assignment-store',
    }
  )
)

/**
 * Selectors
 */
export const useAssignmentsForFolder = (folderId: string) =>
  useFileAssignmentStore((state) =>
    state.assignments.filter((assignment) => assignment.folder_id === folderId)
  )

export const useAssignmentsForFile = (fileId: string) =>
  useFileAssignmentStore((state) =>
    state.assignments.filter((assignment) => assignment.file_id === fileId)
  )

export const useFileAssignmentOperations = () =>
  useFileAssignmentStore((state) => ({
    assignFiles: state.assignFiles,
    removeFiles: state.removeFiles,
    updateVirtualFilename: state.updateVirtualFilename,
    loading: state.operationLoading,
    error: state.operationError,
    clearError: state.clearError,
  }))

/**
 * Check if file is assigned to folder
 */
export const useIsFileInFolder = (fileId: string, folderId: string) =>
  useFileAssignmentStore((state) =>
    state.assignments.some(
      (assignment) =>
        assignment.file_id === fileId && assignment.folder_id === folderId
    )
  )
