/**
 * Drag and Drop Utilities
 *
 * Native HTML5 Drag and Drop API utilities for file assignment
 */

import { DragItem, DropZoneData } from '@/types/file-folders'

/**
 * Get drag item from drag event
 */
export function getDragItem(event: DragEvent): DragItem | null {
  try {
    const data = event.dataTransfer?.getData('application/json')
    if (!data) return null

    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed[0] : (parsed as DragItem)
  } catch (error) {
    console.warn('Failed to parse drag data:', error)
    return null
  }
}

/**
 * Set drag item for drag event
 */
export function setDragItem(event: DragEvent, item: DragItem): void {
  if (!event.dataTransfer) return

  event.dataTransfer.setData('application/json', JSON.stringify(item))
  event.dataTransfer.effectAllowed = 'move'
}

/**
 * Create custom drag image
 */
export function createDragImage(
  files: any[],
  draggedCount?: number
): HTMLElement {
  const dragImage = document.createElement('div')
  dragImage.className =
    'fixed top-0 left-0 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg pointer-events-none z-50'
  dragImage.style.transform = 'translate(-50%, -50%)'

  const count = draggedCount || files.length
  dragImage.innerHTML = `
    <div class="flex items-center space-x-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <span class="text-sm font-medium">${count} file${count > 1 ? 's' : ''}</span>
    </div>
  `

  document.body.appendChild(dragImage)

  // Position in top-left corner, will be moved by setDragImage
  dragImage.style.top = '0px'
  dragImage.style.left = '0px'

  return dragImage
}

/**
 * Set custom drag image with proper positioning
 */
export function setDragImage(
  event: DragEvent,
  files: any[],
  draggedCount?: number
): void {
  if (!event.dataTransfer) return

  const dragImage = createDragImage(files, draggedCount)

  // Set the drag image
  event.dataTransfer.setDragImage(dragImage, 50, 20)

  // Remove the drag image after a short delay
  setTimeout(() => {
    if (dragImage.parentNode) {
      dragImage.parentNode.removeChild(dragImage)
    }
  }, 100)
}

/**
 * Check if drag event contains valid file data
 */
export function isValidFileDrag(event: DragEvent): boolean {
  const item = getDragItem(event)
  return item?.type === 'file' && !!item.id
}

/**
 * Get files from multiple selection (files or drag event)
 */
export function extractFilesFromDrag(event: DragEvent): DragItem[] {
  const items: DragItem[] = []

  // Try to get JSON data first (our custom format)
  const customData = getDragItem(event)
  if (customData) {
    items.push(customData)
    return items
  }

  // Fallback to native files if any
  if (event.dataTransfer?.files) {
    Array.from(event.dataTransfer.files).forEach((file) => {
      items.push({
        type: 'file',
        id: crypto.randomUUID(), // Generate temporary ID
        data: {
          name: file.name,
          size: file.size,
          type: file.type,
          file, // Include actual File object
        },
      })
    })
  }

  return items
}

/**
 * Drag and Drop event handlers
 */
export interface DragHandlers {
  onDragStart?: (event: DragEvent, item: DragItem) => void
  onDragEnd?: (event: DragEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDragEnter?: (event: DragEvent) => void
  onDragLeave?: (event: DragEvent) => void
  onDrop?: (event: DragEvent, items: DragItem[]) => void
}

/**
 * Create drag event handlers for file elements
 */
export function createFileDragHandlers(
  file: any,
  handlers: DragHandlers,
  selectedFiles: any[] = []
): Partial<DragHandlers> {
  return {
    onDragStart: (event: DragEvent) => {
      // Handle single or multiple file drag
      const draggedFiles = selectedFiles.includes(file) ? selectedFiles : [file]
      const items: DragItem[] = draggedFiles.map((f) => ({
        type: 'file',
        id: f.id,
        data: f,
      }))

      setDragItem(event, items[0]) // Primary item
      setDragImage(event, draggedFiles, draggedFiles.length)

      // Store all selected files for drop handling
      event.dataTransfer?.setData('text/plain', JSON.stringify(items))
      event.dataTransfer!.effectAllowed = 'move'

      handlers.onDragStart?.(event, items[0])
    },

    onDragEnd: handlers.onDragEnd,

    onDragOver: (event: DragEvent) => {
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'move'
      handlers.onDragOver?.(event)
    },

    onDragEnter: (event: DragEvent) => {
      event.preventDefault()
      handlers.onDragEnter?.(event)
    },

    onDragLeave: handlers.onDragLeave,

    onDrop: (event: DragEvent) => {
      event.preventDefault()

      let items: DragItem[] = []

      // Try to get all dragged files
      try {
        const customData = event.dataTransfer?.getData('text/plain')
        if (customData) {
          items = JSON.parse(customData)
        }
      } catch (error) {
        console.warn('Failed to parse drop data:', error)
      }

      // Fallback to single item
      if (items.length === 0) {
        const singleItem = getDragItem(event)
        if (singleItem) {
          items = [singleItem]
        }
      }

      handlers.onDrop?.(event, items)
    },
  }
}

/**
 * Drop zone utilities
 */
export interface DropZoneOptions {
  onFilesDrop?: (files: DragItem[]) => void
  onDragOver?: (event: DragEvent, isValid: boolean) => void
  onDragEnter?: (event: DragEvent, isValid: boolean) => void
  onDragLeave?: (event: DragEvent) => void
  acceptedFileTypes?: string[]
  maxFiles?: number
}

/**
 * Create drop zone handlers
 */
export function createDropZoneHandlers(
  options: DropZoneOptions
): Partial<DragHandlers> {
  return {
    onDragOver: (event: DragEvent) => {
      event.preventDefault()

      const isValid =
        isValidFileDrag(event) || (event.dataTransfer?.files?.length ?? 0) > 0
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = isValid ? 'move' : 'none'
      }

      options.onDragOver?.(event, isValid)
    },

    onDragEnter: (event: DragEvent) => {
      event.preventDefault()

      const isValid =
        isValidFileDrag(event) || (event.dataTransfer?.files?.length ?? 0) > 0

      options.onDragEnter?.(event, isValid)
    },

    onDragLeave: options.onDragLeave,

    onDrop: (event: DragEvent) => {
      event.preventDefault()

      const items = extractFilesFromDrag(event)

      // Filter by accepted file types if specified
      let validItems = items
      if (options.acceptedFileTypes && options.acceptedFileTypes.length > 0) {
        validItems = items.filter((item) => {
          const fileType = item.data?.type || item.data?.mime_type
          return fileType && options.acceptedFileTypes!.includes(fileType)
        })
      }

      // Limit by max files if specified
      if (options.maxFiles && validItems.length > options.maxFiles) {
        validItems = validItems.slice(0, options.maxFiles)
      }

      if (validItems.length > 0) {
        options.onFilesDrop?.(validItems)
      }
    },
  }
}

/**
 * Touch support utilities
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Create touch-friendly drag handlers
 */
export function createTouchDragHandlers(
  element: HTMLElement,
  handlers: DragHandlers
): void {
  const touchItem: DragItem | null = null
  let touchStartY = 0
  let touchStartX = 0

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    touchStartY = touch.clientY
    touchStartX = touch.clientX

    // Store drag item data on element
    element.setAttribute('data-dragging', 'true')
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!element.hasAttribute('data-dragging')) return

    const touch = event.touches[0]
    const deltaY = Math.abs(touch.clientY - touchStartY)
    const deltaX = Math.abs(touch.clientX - touchStartX)

    // Start drag after moving minimum distance
    if (deltaY > 10 || deltaX > 10) {
      element.style.opacity = '0.5'
      element.style.transform = 'scale(0.95)'
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    element.removeAttribute('data-dragging')
    element.style.opacity = ''
    element.style.transform = ''

    // Simulate drop on the element below
    const touch = event.changedTouches[0]
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)

    if (elementBelow && elementBelow !== element) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      })

      elementBelow.dispatchEvent(dropEvent)
    }
  }

  element.addEventListener('touchstart', handleTouchStart, { passive: true })
  element.addEventListener('touchmove', handleTouchMove, { passive: true })
  element.addEventListener('touchend', handleTouchEnd, { passive: true })
}
