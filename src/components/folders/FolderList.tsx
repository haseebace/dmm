/**
 * FolderList Component
 *
 * Main folder navigation component with hierarchical display,
 * drag-drop support, and integrated create/rename/delete operations.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Folder, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateFolderButton } from './CreateFolderButton'
import { FolderItem } from './FolderItem'
import {
  useFolders,
  useSelectedFolderId,
  useFolderLoading,
  useFolderActions,
} from '@/stores/folderStore'
import { FolderHierarchy } from '@/types/folders'

interface FolderListProps {
  userId: string
  className?: string
  onFolderSelect?: (folderId: string) => void
  onFolderCreated?: (folderId: string) => void
  onFolderRenamed?: () => void
  onFolderDeleted?: () => void
  showCreateButton?: boolean
  emptyMessage?: string
}

export const FolderList: React.FC<FolderListProps> = ({
  userId,
  className = '',
  onFolderSelect,
  onFolderCreated,
  onFolderRenamed,
  onFolderDeleted,
  showCreateButton = true,
  emptyMessage = 'No folders created yet',
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingSubfolder, setCreatingSubfolder] = useState<string | null>(
    null
  )

  const folders = useFolders()
  const selectedFolderId = useSelectedFolderId()
  const isLoading = useFolderLoading()
  const { fetchFolders, setSelectedFolder } = useFolderActions()

  // Fetch folders on mount
  useEffect(() => {
    if (userId) {
      fetchFolders(userId)
    }
  }, [userId, fetchFolders])

  // Auto-expand parent folders when a folder is selected
  useEffect(() => {
    if (selectedFolderId) {
      const folder = folders.find((f) => f.id === selectedFolderId)
      if (folder) {
        expandToFolder(selectedFolderId)
      }
    }
  }, [selectedFolderId, folders])

  const expandToFolder = useCallback(
    (folderId: string) => {
      const expandPath = (hierarchy: FolderHierarchy[]) => {
        for (const folder of hierarchy) {
          if (folder.id === folderId) {
            setExpandedFolders((prev) => new Set([...prev, folderId]))
            return true
          }
          if (folder.children.length > 0) {
            if (expandPath(folder.children)) {
              setExpandedFolders((prev) => new Set([...prev, folder.id]))
              return true
            }
          }
        }
        return false
      }

      const buildHierarchy = (folders: any[]): FolderHierarchy[] => {
        const map = new Map()
        folders.forEach((folder) =>
          map.set(folder.id, { ...folder, children: [] })
        )

        const root: FolderHierarchy[] = []
        folders.forEach((folder) => {
          const folderNode = map.get(folder.id)
          if (folder.parent_id) {
            const parent = map.get(folder.parent_id)
            if (parent) {
              parent.children.push(folderNode)
            }
          } else {
            root.push(folderNode)
          }
        })

        return root
      }

      const hierarchy = buildHierarchy(folders)
      expandPath(hierarchy)
    },
    [folders]
  )

  const toggleFolderExpanded = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolder(folderId)
      onFolderSelect?.(folderId)
    },
    [setSelectedFolder, onFolderSelect]
  )

  const handleFolderCreated = useCallback(
    (folderId: string) => {
      onFolderCreated?.(folderId)
    },
    [onFolderCreated]
  )

  const handleFolderRenamed = useCallback(() => {
    onFolderRenamed?.()
  }, [onFolderRenamed])

  const handleFolderDeleted = useCallback(() => {
    onFolderDeleted?.()
  }, [onFolderDeleted])

  const handleSubfolderCreated = useCallback((parentId: string) => {
    setCreatingSubfolder(parentId)
    // Auto-expand the parent folder
    setExpandedFolders((prev) => new Set([...prev, parentId]))
  }, [])

  const buildHierarchy = useCallback((folders: any[]): FolderHierarchy[] => {
    const map = new Map()
    folders.forEach((folder) => map.set(folder.id, { ...folder, children: [] }))

    const root: FolderHierarchy[] = []
    folders.forEach((folder) => {
      const folderNode = map.get(folder.id)
      if (folder.parent_id) {
        const parent = map.get(folder.parent_id)
        if (parent) {
          parent.children.push(folderNode)
        }
      } else {
        root.push(folderNode)
      }
    })

    // Sort by sort_order
    const sortFolders = (items: FolderHierarchy[]) => {
      items.sort((a, b) => a.sortOrder - b.sortOrder)
      items.forEach((folder) => {
        if (folder.children.length > 0) {
          sortFolders(folder.children)
        }
      })
    }

    sortFolders(root)
    return root
  }, [])

  const renderFolderHierarchy = useCallback(
    (hierarchy: FolderHierarchy[], level = 0) => {
      return hierarchy.map((folder) => (
        <div key={folder.id}>
          <FolderItem
            folder={folder}
            level={level}
            isExpanded={expandedFolders.has(folder.id)}
            onToggleExpand={toggleFolderExpanded}
            onSelect={handleFolderSelect}
            onRenameComplete={handleFolderRenamed}
            onDeleteComplete={handleFolderDeleted}
            onSubfolderCreated={() => handleSubfolderCreated(folder.id)}
          />

          {/* Subfolder creation UI */}
          {creatingSubfolder === folder.id && (
            <div style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
              <CreateFolderButton
                userId={userId}
                parentId={folder.id}
                size="sm"
                variant="ghost"
                onCreateComplete={() => {
                  setCreatingSubfolder(null)
                  handleFolderCreated(folder.id)
                }}
                onCreateCancel={() => setCreatingSubfolder(null)}
              />
            </div>
          )}

          {/* Expanded children */}
          {expandedFolders.has(folder.id) && folder.children.length > 0 && (
            <div>{renderFolderHierarchy(folder.children, level + 1)}</div>
          )}
        </div>
      ))
    },
    [
      expandedFolders,
      toggleFolderExpanded,
      handleFolderSelect,
      handleFolderRenamed,
      handleFolderDeleted,
      creatingSubfolder,
      userId,
      handleSubfolderCreated,
      handleFolderCreated,
    ]
  )

  const hierarchy = buildHierarchy(folders)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Folders</h2>
        </div>

        {showCreateButton && (
          <CreateFolderButton
            userId={userId}
            onCreateComplete={handleFolderCreated}
            disabled={isLoading}
          />
        )}
      </div>

      {/* Folder list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
            </div>
          ) : hierarchy.length > 0 ? (
            <div className="space-y-0.5" role="tree">
              {renderFolderHierarchy(hierarchy)}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <Folder className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-sm">{emptyMessage}</p>
              {showCreateButton && (
                <p className="mt-2 text-xs">
                  Press{' '}
                  <kbd className="bg-muted rounded px-1 py-0.5 text-xs">
                    Ctrl+N
                  </kbd>{' '}
                  to create your first folder
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Status bar */}
      <div className="text-muted-foreground flex items-center justify-between border-t p-2 text-xs">
        <span>
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
        </span>
        {selectedFolderId && (
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Selected
          </span>
        )}
      </div>
    </div>
  )
}

export default FolderList
