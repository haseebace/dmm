/**
 * FolderContextMenu Component
 *
 * Context menu component for folder operations with keyboard shortcuts support.
 * Provides right-click actions for folders.
 */

'use client'

import React, { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Folder,
  FolderRename,
  FolderPlus,
  Trash2,
  FolderMove,
} from 'lucide-react'
import { useFolderActions } from '@/stores/folderStore'
import { DeleteFolderOptions } from '@/types/folders'

interface FolderContextMenuProps {
  folderId: string
  folderName: string
  children: React.ReactNode
  onRenameStart?: () => void
  onRenameComplete?: () => void
  onDeleteComplete?: () => void
  onSubfolderCreated?: () => void
}

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  folderId,
  folderName,
  children,
  onRenameStart,
  onRenameComplete,
  onDeleteComplete,
  onSubfolderCreated,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showForceDeleteDialog, setShowForceDeleteDialog] = useState(false)

  const { deleteFolder, updateFolder, getFolderChildren } = useFolderActions()

  const handleRename = () => {
    onRenameStart?.()
    // The actual rename logic should be handled by the parent component
    // This just triggers the rename mode
  }

  const handleCreateSubfolder = () => {
    onSubfolderCreated?.()
    // The actual subfolder creation should be handled by the parent component
    // This just indicates the user wants to create a subfolder
  }

  const handleDelete = async () => {
    const children = getFolderChildren(folderId)
    const hasContents = children.length > 0

    if (hasContents) {
      setShowForceDeleteDialog(true)
    } else {
      performDelete()
    }
  }

  const performDelete = async (options?: DeleteFolderOptions) => {
    const result = await deleteFolder(folderId, options)

    if (result.success) {
      setShowDeleteDialog(false)
      setShowForceDeleteDialog(false)
      onDeleteComplete?.()
    }
    // Error handling is done in the store
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={handleRename}
            className="flex items-center gap-2"
          >
            <FolderRename className="h-4 w-4" />
            Rename
            <span className="text-muted-foreground ml-auto text-xs">F2</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleCreateSubfolder}
            className="flex items-center gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Create Subfolder
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
            <span className="text-muted-foreground ml-auto text-xs">Del</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderName}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => performDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force delete confirmation dialog */}
      <AlertDialog
        open={showForceDeleteDialog}
        onOpenChange={setShowForceDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder with Contents</AlertDialogTitle>
            <AlertDialogDescription>
              "{folderName}" contains items. Deleting it will also delete all
              subfolders and move files to the parent folder. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogAction
                onClick={() =>
                  performDelete({ force: true, moveToParent: true })
                }
                variant="outline"
              >
                Move Contents to Parent
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => performDelete({ force: true })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Everything
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default FolderContextMenu
