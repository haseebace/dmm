/**
 * Drag and Drop Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getDragItem,
  setDragItem,
  isValidFileDrag,
  createDropZoneHandlers,
  createFileDragHandlers,
  extractFilesFromDrag,
} from '../drag-drop'

describe('drag-drop utilities', () => {
  let mockDragEvent: DragEvent
  let mockDataTransfer: DataTransfer

  beforeEach(() => {
    // Create mock DataTransfer
    mockDataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
      files: null,
      items: null,
      types: [],
    } as any

    // Create mock DragEvent
    mockDragEvent = {
      dataTransfer: mockDataTransfer,
      preventDefault: vi.fn(),
    } as any
  })

  describe('getDragItem', () => {
    it('should parse valid drag item from JSON data', () => {
      const item = { type: 'file', id: 'test-id', data: { name: 'test.txt' } }
      mockDataTransfer.getData.mockReturnValue(JSON.stringify(item))

      const result = getDragItem(mockDragEvent)
      expect(result).toEqual(item)
    })

    it('should return null for invalid JSON', () => {
      mockDataTransfer.getData.mockReturnValue('invalid json')

      const result = getDragItem(mockDragEvent)
      expect(result).toBeNull()
    })

    it('should return null for empty data', () => {
      mockDataTransfer.getData.mockReturnValue('')

      const result = getDragItem(mockDragEvent)
      expect(result).toBeNull()
    })
  })

  describe('setDragItem', () => {
    it('should set drag item as JSON', () => {
      const item = { type: 'file', id: 'test-id', data: { name: 'test.txt' } }

      setDragItem(mockDragEvent, item)

      expect(mockDataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify(item)
      )
      expect(mockDataTransfer.effectAllowed).toBe('move')
    })

    it('should handle null dataTransfer gracefully', () => {
      const eventWithoutDataTransfer = {} as DragEvent

      expect(() =>
        setDragItem(eventWithoutDataTransfer, {} as any)
      ).not.toThrow()
    })
  })

  describe('isValidFileDrag', () => {
    it('should return true for valid file drag item', () => {
      const item = { type: 'file', id: 'test-id', data: {} }
      mockDataTransfer.getData.mockReturnValue(JSON.stringify(item))

      const result = isValidFileDrag(mockDragEvent)
      expect(result).toBe(true)
    })

    it('should return false for non-file drag item', () => {
      const item = { type: 'folder', id: 'test-id', data: {} }
      mockDataTransfer.getData.mockReturnValue(JSON.stringify(item))

      const result = isValidFileDrag(mockDragEvent)
      expect(result).toBe(false)
    })

    it('should return false for invalid data', () => {
      mockDataTransfer.getData.mockReturnValue('invalid')

      const result = isValidFileDrag(mockDragEvent)
      expect(result).toBe(false)
    })
  })

  describe('extractFilesFromDrag', () => {
    it('should extract files from custom drag data', () => {
      const item = { type: 'file', id: 'test-id', data: { name: 'test.txt' } }
      mockDataTransfer.getData.mockReturnValue(JSON.stringify(item))

      const result = extractFilesFromDrag(mockDragEvent)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(item)
    })

    it('should extract native files when no custom data', () => {
      // Mock native files
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      mockDataTransfer.getData.mockReturnValue('')
      mockDataTransfer.files = [mockFile] as any

      const result = extractFilesFromDrag(mockDragEvent)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('file')
      expect(result[0].data.name).toBe('test.txt')
    })

    it('should return empty array when no files found', () => {
      mockDataTransfer.getData.mockReturnValue('')
      mockDataTransfer.files = [] as any

      const result = extractFilesFromDrag(mockDragEvent)
      expect(result).toHaveLength(0)
    })
  })

  describe('createDropZoneHandlers', () => {
    it('should create handlers with required methods', () => {
      const onFilesDrop = vi.fn()
      const handlers = createDropZoneHandlers({ onFilesDrop })

      expect(typeof handlers.onDragOver).toBe('function')
      expect(typeof handlers.onDragEnter).toBe('function')
      expect(typeof handlers.onDragLeave).toBe('function')
      expect(typeof handlers.onDrop).toBe('function')
    })

    it('should prevent default and set drop effect on drag over', () => {
      const onFilesDrop = vi.fn()
      const handlers = createDropZoneHandlers({ onFilesDrop })

      handlers.onDragOver?.(mockDragEvent)

      expect(mockDragEvent.preventDefault).toHaveBeenCalled()
      expect(mockDataTransfer.dropEffect).toBe('move')
    })

    it('should call onFilesDrop with valid items', () => {
      const onFilesDrop = vi.fn()
      const handlers = createDropZoneHandlers({ onFilesDrop })

      const items = [{ type: 'file', id: 'test-id', data: {} }]
      handlers.onDrop?.(mockDragEvent, items)

      expect(onFilesDrop).toHaveBeenCalledWith(items)
    })

    it('should filter by accepted file types', () => {
      const onFilesDrop = vi.fn()
      const acceptedFileTypes = ['image/jpeg', 'image/png']
      const handlers = createDropZoneHandlers({
        onFilesDrop,
        acceptedFileTypes,
      })

      const items = [
        { type: 'file', id: 'test-1', data: { type: 'image/jpeg' } },
        { type: 'file', id: 'test-2', data: { type: 'application/pdf' } },
      ]

      handlers.onDrop?.(mockDragEvent, items)

      expect(onFilesDrop).toHaveBeenCalledWith([items[0]]) // Only image/jpeg should pass
    })
  })

  describe('createFileDragHandlers', () => {
    it('should create handlers for file elements', () => {
      const file = { id: 'test-id', name: 'test.txt' }
      const onDragStart = vi.fn()
      const handlers = createFileDragHandlers(file, {})

      expect(typeof handlers.onDragStart).toBe('function')
      expect(typeof handlers.onDragEnd).toBe('function')
      expect(typeof handlers.onDragOver).toBe('function')
      expect(typeof handlers.onDragEnter).toBe('function')
      expect(typeof handlers.onDragLeave).toBe('function')
      expect(typeof handlers.onDrop).toBe('function')
    })

    it('should set drag data on drag start', () => {
      const file = { id: 'test-id', name: 'test.txt' }
      const handlers = createFileDragHandlers(file, {})

      handlers.onDragStart?.(mockDragEvent)

      expect(mockDataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ type: 'file', id: file.id, data: file })
      )
      expect(mockDataTransfer.effectAllowed).toBe('move')
    })

    it('should use selected files when provided', () => {
      const file = { id: 'test-id', name: 'test.txt' }
      const selectedFiles = [
        { id: 'selected-1', name: 'file1.txt' },
        file,
        { id: 'selected-2', name: 'file2.txt' },
      ]
      const handlers = createFileDragHandlers(file, {}, selectedFiles)

      handlers.onDragStart?.(mockDragEvent)

      // Should indicate multiple files being dragged
      expect(mockDataTransfer.setData).toHaveBeenCalledWith(
        'text/plain',
        expect.stringContaining('selected-1')
      )
    })
  })
})
