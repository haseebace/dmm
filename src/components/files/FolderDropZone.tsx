/**
 * FolderDropZone Component
 *
 * Drop zone component for folder targets
 */

import React, { useState, useCallback } from 'react'
import {
  createDropZoneHandlers,
  isValidFileDrag,
  extractFilesFromDrag,
} from '@/lib/drag-drop'
import { useFileAssignmentOperations } from '@/stores/fileAssignmentStore'

interface FolderDropZoneProps {
  folder: any
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onFilesAssigned?: (files: any[], folder: any) => void
  onAssignmentError?: (error: string) => void
}

export function FolderDropZone({
  folder,
  children,
  className = '',
  disabled = false,
  onFilesAssigned,
  onAssignmentError,
}: FolderDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isValidDrop, setIsValidDrop] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const { assignFiles } = useFileAssignmentOperations()

  /**
   * Handle files drop on folder
   */
  const handleFilesDrop = useCallback(
    async (items: any[]) => {
      if (disabled || items.length === 0) return

      setIsAssigning(true)

      try {
        // Extract file data from drag items
        const files = items
          .filter((item) => item.type === 'file')
          .map((item) => item.data)
          .filter(Boolean)

        if (files.length === 0) {
          onAssignmentError?.('No valid files found in drop')
          return
        }

        // Prepare assignment operations
        const operations = files.map((file) => ({
          file_id: file.id,
          folder_id: folder.id,
          virtual_filename: undefined, // Use original filename
        }))

        // Perform assignment
        const result = await assignFiles(operations)

        if (result.successful.length > 0) {
          const assignedFiles = result.successful
            .filter((r) => r.assignment)
            .map((r) => files.find((f) => f.id === r.assignment!.file_id))
            .filter(Boolean)

          onFilesAssigned?.(assignedFiles, folder)

          // Show success notification
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('Files Assigned', {
              body: `${assignedFiles.length} file${assignedFiles.length > 1 ? 's' : ''} assigned to ${folder.name}`,
              icon: '/favicon.ico',
            })
          }
        }

        if (result.failed.length > 0) {
          onAssignmentError?.(result.failed.map((f) => f.error).join('; '))
        }
      } catch (error) {
        console.error('Error assigning files:', error)
        onAssignmentError?.(
          error instanceof Error ? error.message : 'Assignment failed'
        )
      } finally {
        setIsAssigning(false)
      }
    },
    [folder, disabled, assignFiles, onFilesAssigned, onAssignmentError]
  )

  /**
   * Create drop zone handlers
   */
  const dropHandlers = createDropZoneHandlers({
    onFilesDrop: handleFilesDrop,
    onDragOver: (event, isValid) => {
      if (disabled) return
      setIsDragOver(true)
      setIsValidDrop(isValid)
    },
    onDragEnter: (event, isValid) => {
      if (disabled) return
      setIsDragOver(true)
      setIsValidDrop(isValid)
    },
    onDragLeave: () => {
      setIsDragOver(false)
      setIsValidDrop(false)
    },
  })

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return
      dropHandlers.onDragOver?.(event)
    },
    [disabled, dropHandlers]
  )

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return
      dropHandlers.onDragEnter?.(event)
    },
    [disabled, dropHandlers]
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      if (disabled) return
      dropHandlers.onDragLeave?.(event)
    },
    [disabled, dropHandlers]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      if (disabled) return

      setIsDragOver(false)
      setIsValidDrop(false)

      // Extract files from drag event
      const items = extractFilesFromDrag(event.nativeEvent)

      if (items.length > 0) {
        await handleFilesDrop(items)
      }
    },
    [disabled, handleFilesDrop]
  )

  return (
    <div
      className={`relative transition-all duration-200 ${isDragOver ? 'scale-105 transform' : ''} ${className} `}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop overlay */}
      {isDragOver && (
        <div
          className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed ${
            isValidDrop
              ? 'bg-primary/10 border-primary'
              : 'bg-destructive/10 border-destructive'
          } `}
        >
          <div
            className={`flex flex-col items-center space-y-2 rounded-lg p-4 ${isValidDrop ? 'text-primary' : 'text-destructive'} `}
          >
            {isValidDrop ? (
              <>
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="font-medium">Drop files to assign</p>
                <p className="text-sm opacity-75">to "{folder.name}"</p>
              </>
            ) : (
              <>
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="font-medium">Cannot drop here</p>
                <p className="text-sm opacity-75">Invalid files</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assignment loading overlay */}
      {isAssigning && (
        <div className="bg-background/80 absolute inset-0 z-20 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center space-y-2">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
            <span className="text-sm font-medium">Assigning files...</span>
          </div>
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className="bg-muted/50 absolute inset-0 flex items-center justify-center rounded-lg">
          <p className="text-muted-foreground text-sm">Folder is read-only</p>
        </div>
      )}
    </div>
  )
}

/**
 * FolderDropZone for individual folder items
 */
export function FolderItemDropZone({
  folder,
  children,
  className = '',
  disabled = false,
}: {
  folder: any
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const handleFilesAssigned = (files: any[], targetFolder: any) => {
    // Show toast or notification
    console.log(`${files.length} files assigned to ${targetFolder.name}`)
  }

  const handleAssignmentError = (error: string) => {
    // Show error toast
    console.error('Assignment error:', error)
  }

  return (
    <FolderDropZone
      folder={folder}
      disabled={disabled}
      onFilesAssigned={handleFilesAssigned}
      onAssignmentError={handleAssignmentError}
      className={className}
    >
      {children}
    </FolderDropZone>
  )
}
