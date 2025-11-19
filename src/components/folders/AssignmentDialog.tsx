/**
 * AssignmentDialog Component
 *
 * Dialog for assigning files to folders
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFolderStore } from '@/stores/folderStore'

interface AssignmentDialogProps {
  file: any
  onClose: () => void
  onAssign: (folderId: string, virtualFilename?: string) => void
}

export function AssignmentDialog({
  file,
  onClose,
  onAssign,
}: AssignmentDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [virtualFilename, setVirtualFilename] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filteredFolders, setFilteredFolders] = useState<any[]>([])

  const { folders } = useFolderStore()

  /**
   * Filter folders based on search term
   */
  useEffect(() => {
    if (!folders) return

    const filtered = folders.filter(
      (folder) =>
        folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (folder.description &&
          folder.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    setFilteredFolders(filtered)
  }, [folders, searchTerm])

  /**
   * Handle folder selection
   */
  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId)
    // Reset virtual filename when folder changes
    setVirtualFilename('')
  }

  /**
   * Handle assignment
   */
  const handleAssign = () => {
    if (!selectedFolderId) return

    onAssign(selectedFolderId, virtualFilename || undefined)
    onClose()
  }

  /**
   * Handle keyboard events
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        handleAssign()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedFolderId, virtualFilename])

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="bg-background fixed top-1/2 left-1/2 z-50 max-h-[80vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-lg border shadow-lg">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Assign File to Folder</h2>
            <button
              onClick={onClose}
              className="hover:bg-muted-foreground/10 rounded-md p-1"
              aria-label="Close dialog"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* File info */}
          <div className="bg-muted/30 border-b p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {file.mime_type?.startsWith('image/') ? (
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
                ) : (
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
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{file.filename}</h3>
                <p className="text-muted-foreground text-sm">
                  {file.file_size && formatFileSize(file.file_size)}
                </p>
              </div>
            </div>
          </div>

          {/* Folder selection */}
          <div className="flex-1 overflow-y-auto">
            {/* Search */}
            <div className="border-b p-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="focus:ring-ring w-full rounded-md border py-2 pr-3 pl-9 focus:ring-2 focus:outline-none"
                  autoFocus
                />
                <svg
                  className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Folder list */}
            <div className="p-2">
              {filteredFolders.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  {searchTerm ? 'No folders found' : 'No folders available'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder.id)}
                      className={`flex w-full items-center space-x-3 rounded-md p-3 text-left transition-colors ${
                        selectedFolderId === folder.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      } `}
                    >
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {folder.name}
                        </div>
                        {folder.description && (
                          <div className="truncate text-sm opacity-75">
                            {folder.description}
                          </div>
                        )}
                      </div>
                      {folder.color && (
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: folder.color }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Virtual filename */}
          {selectedFolderId && (
            <div className="bg-muted/30 border-t p-4">
              <label className="mb-2 block text-sm font-medium">
                Virtual Filename (optional)
              </label>
              <input
                type="text"
                placeholder={file.filename}
                value={virtualFilename}
                onChange={(e) => setVirtualFilename(e.target.value)}
                className="focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Leave empty to use original filename
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 border-t p-4">
            <button
              onClick={onClose}
              className="hover:bg-muted rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedFolderId}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Assign to Folder
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

/**
 * Format file size utility
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
