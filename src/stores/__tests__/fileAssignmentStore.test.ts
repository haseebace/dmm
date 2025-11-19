/**
 * File Assignment Store Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useFileAssignmentStore,
  useAssignmentsForFolder,
  useAssignmentsForFile,
} from '../fileAssignmentStore'
import * as apiModule from '@/lib/api/file-folders'

// Mock API functions
vi.mock('@/lib/api/file-folders', () => ({
  assignFilesToFolders: vi.fn(),
  removeFilesFromFolders: vi.fn(),
  getFolderFiles: vi.fn(),
  getFileFolders: vi.fn(),
}))

const mockAssignFilesToFolders = vi.mocked(apiModule.assignFilesToFolders)
const mockRemoveFilesFromFolders = vi.mocked(apiModule.removeFilesFromFolders)

describe('fileAssignmentStore', () => {
  beforeEach(() => {
    // Reset store state
    useFileAssignmentStore.setState({
      assignments: [],
      loading: false,
      error: null,
      operationLoading: false,
      operationError: null,
      optimisticAssignments: [],
      lastFetchTime: null,
      cacheTimeout: 5 * 60 * 1000,
    })

    vi.clearAllMocks()
  })

  describe('assignFiles', () => {
    it('should assign files successfully', async () => {
      const operations = [
        { file_id: 'file-1', folder_id: 'folder-1' },
        { file_id: 'file-2', folder_id: 'folder-1' },
      ]

      const mockResult = {
        successful: [
          {
            success: true,
            assignment: {
              id: 'assign-1',
              file_id: 'file-1',
              folder_id: 'folder-1',
            },
          },
          {
            success: true,
            assignment: {
              id: 'assign-2',
              file_id: 'file-2',
              folder_id: 'folder-1',
            },
          },
        ],
        failed: [],
        total: 2,
      }

      mockAssignFilesToFolders.mockResolvedValue(mockResult)

      const { result } = renderHook(() => useFileAssignmentStore())

      await act(async () => {
        const result2 = await result.current.assignFiles(operations)
        expect(result2).toEqual(mockResult)
      })

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(2)
        expect(result.current.assignments[0]).toEqual(
          mockResult.successful[0].assignment
        )
        expect(result.current.operationLoading).toBe(false)
        expect(result.current.operationError).toBeNull()
      })
    })

    it('should handle partial failures', async () => {
      const operations = [
        { file_id: 'file-1', folder_id: 'folder-1' },
        { file_id: 'file-2', folder_id: 'folder-1' },
      ]

      const mockResult = {
        successful: [
          {
            success: true,
            assignment: {
              id: 'assign-1',
              file_id: 'file-1',
              folder_id: 'folder-1',
            },
          },
        ],
        failed: [
          {
            success: false,
            error: 'File not found',
            assignment: operations[1],
          },
        ],
        total: 2,
      }

      mockAssignFilesToFolders.mockResolvedValue(mockResult)

      const { result } = renderHook(() => useFileAssignmentStore())

      await act(async () => {
        await result.current.assignFiles(operations)
      })

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(1)
        expect(result.current.operationError).toBe('File not found')
        expect(result.current.operationLoading).toBe(false)
      })
    })

    it('should handle API errors gracefully', async () => {
      const operations = [{ file_id: 'file-1', folder_id: 'folder-1' }]

      mockAssignFilesToFolders.mockResolvedValue({
        successful: [],
        failed: [
          { success: false, error: 'Network error', assignment: operations[0] },
        ],
        total: 1,
      })

      const { result } = renderHook(() => useFileAssignmentStore())

      await act(async () => {
        await result.current.assignFiles(operations)
      })

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(0)
        expect(result.current.operationError).toBe('Network error')
        expect(result.current.operationLoading).toBe(false)
      })
    })
  })

  describe('removeFiles', () => {
    it('should remove files successfully', async () => {
      // Add some initial assignments
      const initialAssignments = [
        { id: 'assign-1', file_id: 'file-1', folder_id: 'folder-1' },
        { id: 'assign-2', file_id: 'file-2', folder_id: 'folder-1' },
      ]

      useFileAssignmentStore.setState({ assignments: initialAssignments })

      const operations = [{ file_id: 'file-1', folder_id: 'folder-1' }]

      const mockResult = {
        successful: [{ success: true, assignment: operations[0] }],
        failed: [],
        total: 1,
      }

      mockRemoveFilesFromFolders.mockResolvedValue(mockResult)

      const { result } = renderHook(() => useFileAssignmentStore())

      await act(async () => {
        await result.current.removeFiles(operations)
      })

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(1)
        expect(result.current.assignments[0].file_id).toBe('file-2')
        expect(result.current.operationLoading).toBe(false)
      })
    })

    it('should restore assignments on failure', async () => {
      const initialAssignments = [
        { id: 'assign-1', file_id: 'file-1', folder_id: 'folder-1' },
      ]

      useFileAssignmentStore.setState({ assignments: initialAssignments })

      const operations = [{ file_id: 'file-1', folder_id: 'folder-1' }]

      mockRemoveFilesFromFolders.mockResolvedValue({
        successful: [],
        failed: [
          {
            success: false,
            error: 'Permission denied',
            assignment: operations[0],
          },
        ],
        total: 1,
      })

      const { result } = renderHook(() => useFileAssignmentStore())

      await act(async () => {
        await result.current.removeFiles(operations)
      })

      await waitFor(() => {
        expect(result.current.assignments).toHaveLength(1) // Should be restored
        expect(result.current.operationError).toBe('Permission denied')
      })
    })
  })

  describe('selectors', () => {
    beforeEach(() => {
      // Set up initial assignments
      const assignments = [
        { id: 'assign-1', file_id: 'file-1', folder_id: 'folder-1' },
        { id: 'assign-2', file_id: 'file-2', folder_id: 'folder-1' },
        { id: 'assign-3', file_id: 'file-1', folder_id: 'folder-2' },
      ]

      useFileAssignmentStore.setState({ assignments })
    })

    it('useAssignmentsForFolder should filter by folder ID', () => {
      const { result } = renderHook(() => useAssignmentsForFolder('folder-1'))

      expect(result.current).toHaveLength(2)
      expect(result.current.every((a) => a.folder_id === 'folder-1')).toBe(true)
    })

    it('useAssignmentsForFile should filter by file ID', () => {
      const { result } = renderHook(() => useAssignmentsForFile('file-1'))

      expect(result.current).toHaveLength(2)
      expect(result.current.every((a) => a.file_id === 'file-1')).toBe(true)
    })

    it('useAssignmentsForFile should return empty for non-existent file', () => {
      const { result } = renderHook(() => useAssignmentsForFile('non-existent'))

      expect(result.current).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    it('should clear error when clearError is called', () => {
      useFileAssignmentStore.setState({
        error: 'Some error',
        operationError: 'Operation error',
      })

      const { result } = renderHook(() => useFileAssignmentStore())

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.operationError).toBeNull()
    })

    it('should set loading state', () => {
      const { result } = renderHook(() => useFileAssignmentStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('caching', () => {
    it('should clear cache when clearCache is called', () => {
      useFileAssignmentStore.setState({
        lastFetchTime: Date.now(),
        assignments: [{ id: 'test', file_id: 'file-1', folder_id: 'folder-1' }],
      })

      const { result } = renderHook(() => useFileAssignmentStore())

      act(() => {
        result.current.clearCache()
      })

      expect(result.current.lastFetchTime).toBeNull()
      // Assignments should remain
      expect(result.current.assignments).toHaveLength(1)
    })
  })
})
