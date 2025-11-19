/**
 * FolderManagerDemo Component
 *
 * Example implementation showing how to use the folder system.
 * This can be used as a reference or for testing purposes.
 */

'use client'

import React, { useState } from 'react'
import { FolderList } from './FolderList'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

interface FolderManagerDemoProps {
  userId: string
  className?: string
}

export const FolderManagerDemo: React.FC<FolderManagerDemoProps> = ({
  userId,
  className = '',
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId)
    console.log('Selected folder:', folderId)
  }

  const handleFolderCreated = (folderId: string) => {
    console.log('Folder created:', folderId)
  }

  const handleFolderRenamed = () => {
    console.log('Folder renamed')
  }

  const handleFolderDeleted = () => {
    console.log('Folder deleted')
  }

  return (
    <TooltipProvider>
      <Card className={`h-[600px] ${className}`}>
        <CardHeader>
          <CardTitle>Virtual Folder System</CardTitle>
          <CardDescription>
            Organize your files with custom folders. Right-click for more
            options.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px] p-0">
          <FolderList
            userId={userId}
            onFolderSelect={handleFolderSelect}
            onFolderCreated={handleFolderCreated}
            onFolderRenamed={handleFolderRenamed}
            onFolderDeleted={handleFolderDeleted}
            emptyMessage="Create folders to organize your files"
          />
        </CardContent>
        {selectedFolderId && (
          <div className="bg-muted/50 border-t px-6 py-4">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm">
                Selected folder ID:
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedFolderId}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy folder ID</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  )
}

export default FolderManagerDemo
