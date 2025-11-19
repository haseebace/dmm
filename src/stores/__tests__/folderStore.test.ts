/**
 * Folder Store Tests
 *
 * Unit tests for folder store functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useFolderStore } from '../folderStore'
import { CreateFolderInput, UpdateFolderInput, Folder } from '@/types/folders'

// Mock fetch
global.fetch = vi.fn()

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockFolder: Folder = {
  id: 'folder-1',
  user_id: 'user-1',
  name: 'Test Folder',
  description: 'Test Description',
  color: '#ff0000',
  parent_id: null,
  sort_order: 0,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
}

describe('Folder Store', () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useFolderStore())
    act(() => {
      result.current.clearError()
      result.current.setSelectedFolder(null)
    })

    // Reset fetch mock
    vi.clearAllMocks()
  })

  describe('fetchFolders', () => {
    it('should fetch folders successfully', async () => {
      const mockResponse = {
        folders: [mockFolder],
        hierarchy: [mockFolder],
        total: 1,
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        await result.current.fetchFolders('user-1')
      })

      expect(result.current.folders).toEqual([mockFolder])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle fetch errors', async () => {
      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        await result.current.fetchFolders('user-1')
      })

      expect(result.current.folders).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Network error')
    })
  })

  describe('createFolder', () => {
    it('should create folder successfully', async () => {
      const newFolderInput: CreateFolderInput = {
        name: 'New Folder',
        description: 'New Description',
        color: '#00ff00',
      }

      const createdFolder = {
        ...mockFolder,
        id: 'folder-new',
        name: 'New Folder',
        description: 'New Description',
        color: '#00ff00',
      }

      // Mock API calls
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ folder: createdFolder }),
      })

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        const result_create = await result.current.createFolder(
          'user-1',
          newFolderInput
        )
        expect(result_create.success).toBe(true)
        expect(result_create.folder).toEqual(createdFolder)
      })

      expect(result.current.folders).toContainEqual(createdFolder)
      expect(result.current.isLoading).toBe(false)
    })

    it('should validate folder names', async () => {
      const { result } = renderHook(() => useFolderStore())

      // Test empty name
      const validation = result.current.validateFolderName('')
      expect(validation.valid).toBe(false)

      // Test invalid characters
      const validation2 = result.current.validateFolderName('Folder<>')
      expect(validation2.valid).toBe(false)

      // Test valid name
      const validation3 = result.current.validateFolderName('Valid Folder')
      expect(validation3.valid).toBe(true)
    })
  })

  describe('updateFolder', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useFolderStore())
      act(() => {
        // Start with a folder in the store
        result.current.folders = [mockFolder]
      })
    })

    it('should update folder successfully', async () => {
      const updateInput: UpdateFolderInput = {
        name: 'Updated Folder',
        description: 'Updated Description',
      }

      const updatedFolder = {
        ...mockFolder,
        name: 'Updated Folder',
        description: 'Updated Description',
        updated_at: new Date(),
      }

      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ folder: updatedFolder }),
      })

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        const result_update = await result.current.updateFolder(
          'folder-1',
          updateInput
        )
        expect(result_update.success).toBe(true)
        expect(result_update.folder).toEqual(updatedFolder)
      })

      expect(result.current.folders[0].name).toBe('Updated Folder')
      expect(result.current.folders[0].description).toBe('Updated Description')
    })

    it('should handle folder not found error', async () => {
      ;(fetch as any).mockRejectedValueOnce(new Error('Folder not found'))

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        const result_update = await result.current.updateFolder(
          'non-existent',
          { name: 'New Name' }
        )
        expect(result_update.success).toBe(false)
        expect(result_update.error).toBe('Folder not found')
      })
    })
  })

  describe('deleteFolder', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useFolderStore())
      act(() => {
        result.current.folders = [mockFolder]
      })
    })

    it('should delete empty folder successfully', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        const result_delete = await result.current.deleteFolder('folder-1')
        expect(result_delete.success).toBe(true)
      })

      expect(result.current.folders).toHaveLength(0)
    })

    it('should prevent deletion of folders with contents without force', async () => {
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: 'Folder contains items. Use force=true to delete.',
            hasContents: true,
            itemCount: 2,
          }),
      })

      const { result } = renderHook(() => useFolderStore())

      await act(async () => {
        const result_delete = await result.current.deleteFolder('folder-1', {
          force: false,
        })
        expect(result_delete.success).toBe(false)
        expect(result_delete.error).toContain('contains items')
      })

      // Folder should still be in the store
      expect(result.current.folders).toHaveLength(1)
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useFolderStore())
      act(() => {
        result.current.folders = [
          mockFolder,
          {
            ...mockFolder,
            id: 'folder-2',
            name: 'Child Folder',
            parent_id: 'folder-1',
            sort_order: 0,
          },
        ]
      })
    })

    it('should get folder by ID', () => {
      const { result } = renderHook(() => useFolderStore())

      const folder = result.current.getFolderById('folder-1')
      expect(folder).toEqual(mockFolder)

      const notFound = result.current.getFolderById('non-existent')
      expect(notFound).toBeUndefined()
    })

    it('should get folder children', () => {
      const { result } = renderHook(() => useFolderStore())

      const children = result.current.getFolderChildren('folder-1')
      expect(children).toHaveLength(1)
      expect(children[0].name).toBe('Child Folder')

      const noChildren = result.current.getFolderChildren('folder-2')
      expect(noChildren).toHaveLength(0)
    })

    it('should build folder path', () => {
      const { result } = renderHook(() => useFolderStore())

      const rootPath = result.current.getFolderPath('folder-1')
      expect(rootPath).toEqual(['Test Folder'])

      const childPath = result.current.getFolderPath('folder-2')
      expect(childPath).toEqual(['Test Folder', 'Child Folder'])
    })

    it('should build hierarchy correctly', () => {
      const { result } = renderHook(() => useFolderStore())

      const hierarchy = result.current.buildHierarchy(result.current.folders)
      expect(hierarchy).toHaveLength(1) // One root folder
      expect(hierarchy[0].children).toHaveLength(1) // One child
      expect(hierarchy[0].children[0].name).toBe('Child Folder')
    })
  })

  describe('state management', () => {
    it('should manage selected folder', () => {
      const { result } = renderHook(() => useFolderStore())

      act(() => {
        result.current.setSelectedFolder('folder-1')
      })

      expect(result.current.selectedFolderId).toBe('folder-1')

      act(() => {
        result.current.setSelectedFolder(null)
      })

      expect(result.current.selectedFolderId).toBe(null)
    })

    it('should manage error state', () => {
      const { result } = renderHook(() => useFolderStore())

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)
    })
  })
})
