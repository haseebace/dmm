/**
 * FolderContents Component
 *
 * Renders files and folders in the current folder with high performance
 */

import React, { memo, useMemo } from 'react'
import { useFolderContents } from '@/hooks/useFolderContents'
import { FolderGrid } from './FolderGrid'
import { ContentsList } from './ContentsList'
import { EmptyFolder } from './EmptyFolder'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FolderContentsProps {
  folderId: string | null
  className?: string
  viewMode?: 'grid' | 'list'
  showEmptyState?: boolean
}

export const FolderContents = memo(function FolderContents({
  folderId,
  className,
  viewMode,
  showEmptyState = true,
}: FolderContentsProps) {
  const {
    files,
    folders,
    filteredItems,
    searchTerm,
    filters,
    viewMode: currentViewMode,
    isLoading,
    error,
    refetch,
  } = useFolderContents(folderId)

  // Determine which view mode to use
  const finalViewMode = viewMode || currentViewMode

  // Check if we have any items to display
  const hasItems = files.length > 0 || folders.length > 0
  const hasFilteredItems = filteredItems.length > 0

  // Combine folders and files for display
  const displayItems = useMemo(() => {
    if (
      searchTerm ||
      Object.values(filters).some((filter) => filter && filter !== 'all')
    ) {
      return filteredItems
    }

    // Show folders first, then files
    return [...folders, ...files]
  }, [folders, files, filteredItems, searchTerm, filters])

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            Loading folder contents...
          </p>
        </div>
      </div>
    )
  }

  // Handle error state
  if (error) {
    return (
      <div className={cn('py-8', className)}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load folder contents. Please try again.
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="inline-flex items-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Handle empty state
  if (!hasItems) {
    if (showEmptyState) {
      return <EmptyFolder folderId={folderId} className={className} />
    }
    return (
      <div className={cn('text-muted-foreground py-12 text-center', className)}>
        This folder is empty.
      </div>
    )
  }

  // Handle no filtered results
  if (hasItems && !hasFilteredItems) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <div className="mb-4">
          <AlertTriangle className="text-muted-foreground mx-auto h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-medium">No items found</h3>
        <p className="text-muted-foreground mb-4">
          {searchTerm && `No items match "${searchTerm}"`}
          {Object.values(filters).some(
            (filter) => filter && filter !== 'all'
          ) && 'No items match the current filters.'}
        </p>
        <div className="text-muted-foreground text-sm">
          <p>Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  // Render items based on view mode
  return (
    <div className={className}>
      {finalViewMode === 'grid' ? (
        <FolderGrid items={displayItems} folderId={folderId} />
      ) : (
        <ContentsList items={displayItems} folderId={folderId} />
      )}
    </div>
  )
})
