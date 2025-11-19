/**
 * FolderItem Component
 *
 * Individual folder component with inline editing capabilities,
 * keyboard shortcuts, and context menu integration.
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderContextMenu } from './FolderContextMenu'
import {
  useFolderActions,
  useSelectedFolderId,
  useSelectedFolder,
} from '@/stores/folderStore'
import { Folder, FolderHierarchy } from '@/types/folders'

interface FolderItemProps {
  folder: Folder | FolderHierarchy
  level?: number
  isExpanded?: boolean
  onToggleExpand?: (folderId: string) => void
  onSelect?: (folderId: string) => void
  onRenameComplete?: () => void
  onDeleteComplete?: () => void
  onSubfolderCreated?: () => void
  className?: string
}

export const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  level = 0,
  isExpanded = false,
  onToggleExpand,
  onSelect,
  onRenameComplete,
  onDeleteComplete,
  onSubfolderCreated,
  className = '',
}) => {
  const [isRenaming, setIsRenaming] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedFolderId = useSelectedFolderId()
  const selectedFolder = useSelectedFolder()
  const { updateFolder, validateFolderName, setSelectedFolder } =
    useFolderActions()

  const isSelected = selectedFolderId === folder.id
  const hasChildren = 'children' in folder && folder.children.length > 0

  // Focus and select input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  // Handle keyboard shortcuts for this folder
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F2 to rename (only if this folder is selected)
      if (event.key === 'F2' && isSelected) {
        event.preventDefault()
        startRenaming()
      }

      // Delete key (only if this folder is selected)
      if (event.key === 'Delete' && isSelected) {
        event.preventDefault()
        // Delete action will be handled by context menu
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSelected])

  const startRenaming = () => {
    setIsRenaming(true)
    setEditName(folder.name)
  }

  const cancelRenaming = () => {
    setIsRenaming(false)
    setEditName(folder.name)
  }

  const saveRename = async () => {
    const trimmedName = editName.trim()

    if (!trimmedName) {
      setEditName(folder.name)
      setIsRenaming(false)
      return
    }

    // Validate folder name
    const validation = validateFolderName(
      trimmedName,
      folder.parentId || undefined,
      folder.id
    )

    if (!validation.valid) {
      // Keep input open for user to fix
      return
    }

    const result = await updateFolder(folder.id, { name: trimmedName })

    if (result.success) {
      setIsRenaming(false)
      onRenameComplete?.()
    }
    // If update fails, keep input open
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelRenaming()
    }
  }

  const handleInputBlur = () => {
    // Small delay to allow button clicks to register
    setTimeout(() => {
      if (isRenaming) {
        saveRename()
      }
    }, 200)
  }

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    onSelect?.(folder.id)
    setSelectedFolder(folder.id)
  }

  const handleExpandToggle = (event: React.MouseEvent) => {
    event.stopPropagation()
    onToggleExpand?.(folder.id)
  }

  const handleRenameStart = () => {
    startRenaming()
  }

  const folderColor = folder.color || undefined

  return (
    <FolderContextMenu
      folderId={folder.id}
      folderName={folder.name}
      onRenameStart={handleRenameStart}
      onRenameComplete={onRenameComplete}
      onDeleteComplete={onDeleteComplete}
      onSubfolderCreated={onSubfolderCreated}
    >
      <div
        className={cn(
          'group hover:bg-accent/50 flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 transition-colors',
          {
            'bg-accent text-accent-foreground': isSelected,
          },
          className
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={isSelected ? 0 : -1}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={handleExpandToggle}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" />
        )}

        {/* Folder icon */}
        <div className="flex h-5 w-5 items-center justify-center">
          {hasChildren && isExpanded ? (
            <FolderOpen className="h-4 w-4" style={{ color: folderColor }} />
          ) : (
            <FolderIcon className="h-4 w-4" style={{ color: folderColor }} />
          )}
        </div>

        {/* Folder name or edit input */}
        {isRenaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="h-6 px-1 py-0 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-green-100"
              onClick={(e) => {
                e.stopPropagation()
                saveRename()
              }}
              aria-label="Save name"
            >
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-red-100"
              onClick={(e) => {
                e.stopPropagation()
                cancelRenaming()
              }}
              aria-label="Cancel rename"
            >
              <X className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        ) : (
          <span className="flex-1 truncate text-sm">{folder.name}</span>
        )}

        {/* Quick rename button on hover */}
        {!isRenaming && (
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-accent/100 h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              startRenaming()
            }}
            aria-label={`Rename ${folder.name}`}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </FolderContextMenu>
  )
}

export default FolderItem
