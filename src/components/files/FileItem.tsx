/**
 * FileItem Component
 *
 * Individual file with drag handle and context menu
 */

import React, { useRef, useState } from 'react'
import { formatFileSize, formatDate } from '@/lib/utils'
import { useAssignmentsForFile } from '@/stores/fileAssignmentStore'
import { FileContextMenu } from './FileContextMenu'

interface FileItemProps {
  file: any
  isSelected: boolean
  isDragged: boolean
  onSelect: (file: any, event: React.MouseEvent) => void
  onDragStart: (file: any, event: React.DragEvent) => void
  onKeyDown: (event: React.KeyboardEvent, file: any) => void
  showAssignmentStatus?: boolean
  className?: string
  style?: React.CSSProperties
  tabIndex?: number
}

export function FileItem({
  file,
  isSelected,
  isDragged,
  onSelect,
  onDragStart,
  onKeyDown,
  showAssignmentStatus = true,
  className = '',
  style,
  tabIndex = 0,
}: FileItemProps) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const itemRef = useRef<HTMLDivElement>(null)

  const fileAssignments = useAssignmentsForFile(file.id)

  /**
   * Get file icon based on MIME type
   */
  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return 'document'

    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'music'
    if (mimeType.includes('pdf')) return 'file-text'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive'
    if (mimeType.includes('word')) return 'file-text'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
      return 'file-spreadsheet'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
      return 'file-presentation'

    return 'file'
  }

  /**
   * Handle context menu
   */
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenuPosition({ x: event.clientX, y: event.clientY })
    setContextMenuOpen(true)
  }

  /**
   * Handle drag start
   */
  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer?.setData('text/plain', file.id)
    onDragStart(file, event)
  }

  /**
   * Handle keyboard interaction
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'ContextMenu' ||
      (event.shiftKey && event.key === 'F10')
    ) {
      event.preventDefault()
      const rect = itemRef.current?.getBoundingClientRect()
      if (rect) {
        setContextMenuPosition({ x: rect.right, y: rect.top })
        setContextMenuOpen(true)
      }
      return
    }

    onKeyDown(event, file)
  }

  /**
   * Handle click
   */
  const handleClick = (event: React.MouseEvent) => {
    if (event.detail === 2) {
      // Double click - open file
      console.log('Open file:', file)
      return
    }

    onSelect(file, event)
  }

  const iconType = getFileIcon(file.mime_type)
  const assignmentCount = fileAssignments.length

  return (
    <>
      <div
        ref={itemRef}
        className={`hover:bg-muted/50 focus:bg-muted/50 focus:ring-ring relative flex cursor-pointer items-center space-x-3 p-3 transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none ${isSelected ? 'bg-primary/10 border-primary border-l-2' : ''} ${isDragged ? 'scale-95 opacity-50' : ''} ${className} `}
        style={style}
        tabIndex={tabIndex}
        draggable
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        role="option"
        aria-selected={isSelected}
        aria-label={`File: ${file.filename}`}
      >
        {/* Drag handle */}
        <div
          className="cursor-grab opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing"
          draggable
          onDragStart={handleDragStart}
        >
          <svg
            className="text-muted-foreground h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>

        {/* File icon */}
        <div className="flex-shrink-0">
          {iconType === 'image' && (
            <svg
              className="h-8 w-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
          {iconType === 'video' && (
            <svg
              className="h-8 w-8 text-purple-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
          {iconType === 'music' && (
            <svg
              className="h-8 w-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          )}
          {(iconType === 'file' || iconType === 'document') && (
            <svg
              className="h-8 w-8 text-gray-500"
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
          )}
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="truncate text-sm font-medium">{file.filename}</h3>
            {showAssignmentStatus && assignmentCount > 0 && (
              <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                {assignmentCount} folder{assignmentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center space-x-4 text-xs">
            {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
            {file.mime_type && <span>{file.mime_type}</span>}
            {file.created_at && (
              <span>{formatDate(new Date(file.created_at))}</span>
            )}
          </div>
        </div>

        {/* Assignment status indicator */}
        {showAssignmentStatus && assignmentCount > 0 && (
          <div className="text-muted-foreground flex items-center space-x-1 text-xs">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span>{assignmentCount}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-1 opacity-0 transition-opacity hover:opacity-100">
          <button
            className="hover:bg-muted-foreground/10 rounded p-1"
            onClick={(e) => {
              e.stopPropagation()
              console.log('Assign file:', file)
            }}
            title="Assign to folder"
          >
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
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuOpen && (
        <FileContextMenu
          file={file}
          position={contextMenuPosition}
          onClose={() => setContextMenuOpen(false)}
          onAssign={(folderId) => {
            console.log('Assign file to folder:', file.id, folderId)
            setContextMenuOpen(false)
          }}
          onRemove={(folderId) => {
            console.log('Remove file from folder:', file.id, folderId)
            setContextMenuOpen(false)
          }}
        />
      )}
    </>
  )
}

/**
 * Utility functions
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}
