/**
 * FileList Component
 *
 * Displays files with drag functionality and selection
 */

import React, { useState, useCallback } from 'react'
import { useDragDrop } from '@/lib/drag-drop'
import { FileItem } from './FileItem'
import { useFileAssignmentOperations } from '@/stores/fileAssignmentStore'

interface FileListProps {
  files: any[]
  selectedFiles: any[]
  onSelectionChange: (selectedFiles: any[]) => void
  onFilesDrop?: (files: any[], targetFolderId: string) => void
  className?: string
  multiSelect?: boolean
  showAssignmentStatus?: boolean
}

export function FileList({
  files,
  selectedFiles,
  onSelectionChange,
  onFilesDrop,
  className = '',
  multiSelect = true,
  showAssignmentStatus = true,
}: FileListProps) {
  const [draggedFiles, setDraggedFiles] = useState<any[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const { assignFiles, loading } = useFileAssignmentOperations()

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    (file: any, event: React.MouseEvent) => {
      event.preventDefault()

      if (!multiSelect) {
        onSelectionChange([file])
        return
      }

      // Handle multi-select with Ctrl/Cmd and Shift
      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        const isSelected = selectedFiles.some((f) => f.id === file.id)
        if (isSelected) {
          onSelectionChange(selectedFiles.filter((f) => f.id !== file.id))
        } else {
          onSelectionChange([...selectedFiles, file])
        }
      } else if (event.shiftKey && selectedFiles.length > 0) {
        // Range selection
        const lastSelected = selectedFiles[selectedFiles.length - 1]
        const lastSelectedIndex = files.findIndex(
          (f) => f.id === lastSelected.id
        )
        const currentIndex = files.findIndex((f) => f.id === file.id)

        const startIndex = Math.min(lastSelectedIndex, currentIndex)
        const endIndex = Math.max(lastSelectedIndex, currentIndex)

        const rangeFiles = files.slice(startIndex, endIndex + 1)
        onSelectionChange([
          ...selectedFiles,
          ...rangeFiles.filter(
            (f) => !selectedFiles.some((sf) => sf.id === f.id)
          ),
        ])
      } else {
        // Single selection
        onSelectionChange([file])
      }
    },
    [files, selectedFiles, onSelectionChange, multiSelect]
  )

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(
    (file: any, event: React.DragEvent) => {
      const draggedFileList = selectedFiles.includes(file)
        ? selectedFiles
        : [file]
      setDraggedFiles(draggedFileList)

      // Set drag data
      event.dataTransfer?.setData(
        'application/json',
        JSON.stringify({
          type: 'file',
          id: file.id,
          data: draggedFileList,
        })
      )
      event.dataTransfer!.effectAllowed = 'move'

      // Create custom drag image
      const dragImage = createDragImage(draggedFileList)
      event.dataTransfer?.setDragImage(dragImage, 50, 20)

      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage)
        }
      }, 100)
    },
    [selectedFiles]
  )

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
  }, [])

  /**
   * Handle drop
   */
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    setIsDraggingOver(false)

    try {
      const data = event.dataTransfer?.getData('application/json')
      if (!data) return

      const dragData = JSON.parse(data)

      // Only handle drops that target this component as a receiver
      // (i.e., files being dropped FROM other sources, not internal reordering)
      if (dragData.type === 'file' && dragData.targetFolderId) {
        // This is a drop onto a folder that was handled elsewhere
        return
      }

      // Handle external file drops
      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        const externalFiles = Array.from(event.dataTransfer.files)
        // TODO: Handle external file uploads
        console.log('External files dropped:', externalFiles)
      }
    } catch (error) {
      console.error('Error handling drop:', error)
    }
  }, [])

  /**
   * Keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, file: any) => {
      switch (event.key) {
        case ' ':
        case 'Enter':
          event.preventDefault()
          handleFileSelect(file, event as any)
          break
        case 'Delete':
        case 'Backspace':
          // TODO: Handle file deletion
          break
        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            onSelectionChange(files)
          }
          break
      }
    },
    [files, handleFileSelect, onSelectionChange]
  )

  return (
    <div
      className={`bg-background relative rounded-lg border ${isDraggingOver ? 'ring-primary ring-2 ring-offset-2' : ''} ${className} `}
      onDragOver={handleDragOver}
      onDragEnter={() => setIsDraggingOver(true)}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {/* Header with selection info */}
      {selectedFiles.length > 0 && (
        <div className="bg-muted border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}{' '}
              selected
            </span>
            <button
              onClick={() => onSelectionChange([])}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Files list */}
      <div className="max-h-96 divide-y overflow-y-auto">
        {files.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center">
            <div className="flex flex-col items-center space-y-2">
              <svg
                className="h-12 w-12 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>No files found</p>
              <p className="text-sm">
                Drag files here to assign them to folders
              </p>
            </div>
          </div>
        ) : (
          files.map((file, index) => (
            <FileItem
              key={file.id}
              file={file}
              isSelected={selectedFiles.some((f) => f.id === file.id)}
              isDragged={draggedFiles.some((f) => f.id === file.id)}
              onSelect={handleFileSelect}
              onDragStart={handleDragStart}
              onKeyDown={handleKeyDown}
              showAssignmentStatus={showAssignmentStatus}
              tabIndex={0}
              style={{
                // Animation for newly added items
                animation: `slideIn 0.2s ease-out ${index * 0.05}s both`,
              }}
            />
          ))
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
            <span className="text-sm">Assigning files...</span>
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {isDraggingOver && (
        <div className="bg-primary/10 pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 shadow-lg">
            <div className="flex items-center space-x-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm font-medium">Drop files to assign</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Create custom drag image
 */
function createDragImage(files: any[]): HTMLElement {
  const dragImage = document.createElement('div')
  dragImage.className =
    'fixed top-0 left-0 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg pointer-events-none z-50'
  dragImage.style.transform = 'translate(-50%, -50%)'

  dragImage.innerHTML = `
    <div class="flex items-center space-x-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span class="text-sm font-medium">${files.length} file${files.length > 1 ? 's' : ''}</span>
    </div>
  `

  document.body.appendChild(dragImage)
  return dragImage
}
