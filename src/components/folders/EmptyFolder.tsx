/**
 * EmptyFolder Component
 *
 * Displayed when a folder has no contents
 */

import React from 'react'
import Link from 'next/link'
import { FolderOpen, Plus, ArrowLeft, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyFolderProps {
  folderId: string | null
  className?: string
  showActions?: boolean
}

export function EmptyFolder({
  folderId,
  className,
  showActions = true,
}: EmptyFolderProps) {
  const isRootFolder = folderId === null

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
    >
      {/* Empty folder icon */}
      <div className="mb-6">
        <div className="relative">
          <FolderOpen className="text-muted-foreground/50 h-16 w-16" />
          {isRootFolder && (
            <div className="bg-primary absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full">
              <span className="text-primary-foreground text-xs font-bold">
                0
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="mb-8 max-w-md">
        <h3 className="mb-2 text-lg font-medium">
          {isRootFolder ? 'Your library is empty' : 'This folder is empty'}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isRootFolder
            ? 'Start by adding some folders to organize your files, or check your Real-Debrid connection to sync existing files.'
            : 'Drag and drop files here, or use the actions below to add content to this folder.'}
        </p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {isRootFolder ? (
            <>
              {/* Root folder specific actions */}
              <Link href="/folders/create">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Folder
                </Button>
              </Link>

              <Link href="/settings/connections">
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Sync Files
                </Button>
              </Link>
            </>
          ) : (
            <>
              {/* Subfolder actions */}
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Files
              </Button>

              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </Button>

              <Button variant="ghost" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
            </>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="text-muted-foreground mt-8 max-w-sm text-xs">
        <p className="mb-2">
          💡 <strong>Tips:</strong>
        </p>
        <ul className="space-y-1 text-left">
          <li>• Drag and drop files to quickly add them to folders</li>
          <li>
            • Use keyboard shortcuts (F2 to rename, Ctrl+N for new folder)
          </li>
          <li>• Right-click on folders for more options</li>
          {isRootFolder && (
            <li>• Connect to Real-Debrid to sync your cloud files</li>
          )}
        </ul>
      </div>

      {/* Status indicator for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-muted/50 mt-6 rounded-md p-3 text-xs">
          <p className="text-muted-foreground">
            <strong>Debug Info:</strong>
            <br />
            Folder ID: {folderId || 'null (root)'}
            <br />
            Component: EmptyFolder
          </p>
        </div>
      )}
    </div>
  )
}
