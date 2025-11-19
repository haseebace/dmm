/**
 * FolderGrid Component
 *
 * Grid view for files and folders with high-performance rendering
 */

import React, { memo, useMemo, useState } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { FolderContentsItem } from '@/types/navigation'
import { formatFileSize } from '@/lib/utils'
import { FileIcon } from '@/components/ui/file-icon'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FolderGridProps {
  items: FolderContentsItem[]
  folderId: string | null
  className?: string
  itemHeight?: number
  columns?: number
  gap?: number
  selectable?: boolean
  onItemSelect?: (item: FolderContentsItem, selected: boolean) => void
  onItemDoubleClick?: (item: FolderContentsItem) => void
}

interface GridItemProps {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: {
    items: FolderContentsItem[]
    columns: number
    itemHeight: number
    gap: number
    selectable: boolean
    selectedItems: Set<string>
    onItemSelect: (item: FolderContentsItem, selected: boolean) => void
    onItemDoubleClick: (item: FolderContentsItem) => void
  }
}

const GridItem = memo(
  ({ columnIndex, rowIndex, style, data }: GridItemProps) => {
    const {
      items,
      columns,
      selectable,
      selectedItems,
      onItemSelect,
      onItemDoubleClick,
    } = data

    const itemIndex = rowIndex * columns + columnIndex
    const item = items[itemIndex]

    if (!item || itemIndex >= items.length) {
      return <div style={style} />
    }

    const isSelected = selectedItems.has(item.id)
    const isFolder = item.type === 'file'

    const handleSelect = (checked: boolean) => {
      onItemSelect?.(item, checked)
    }

    const handleDoubleClick = () => {
      onItemDoubleClick?.(item)
    }

    const handleClick = (e: React.MouseEvent) => {
      // Handle navigation for folders
      if (item.type === 'folder') {
        // Navigate to folder
        window.location.href = `/folders/${item.id}`
      }
    }

    return (
      <div style={style} className="p-1">
        <Card
          className={cn(
            'group cursor-pointer transition-all duration-200 hover:shadow-md',
            'hover:border-primary/20 border-2',
            isSelected && 'border-primary bg-primary/5'
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          <CardContent className="relative p-3">
            {/* Selection checkbox */}
            {selectable && (
              <div className="absolute top-2 left-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={handleSelect}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-background/80 backdrop-blur-sm"
                />
              </div>
            )}

            {/* File/Folder icon */}
            <div className="mb-2 flex flex-col items-center text-center">
              <div className="relative mb-2">
                <FileIcon
                  item={item}
                  size="lg"
                  className="text-muted-foreground group-hover:text-primary transition-colors"
                />

                {/* Thumbnail for images */}
                {item.hasThumbnail && (
                  <div className="bg-muted absolute inset-0 overflow-hidden rounded-lg">
                    <img
                      src={`/api/thumbnails/${item.id}`}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Name */}
              <h4
                className="mb-1 w-full truncate text-sm leading-tight font-medium"
                title={item.name}
              >
                {item.virtualFilename || item.name}
              </h4>

              {/* Original filename (if different) */}
              {item.virtualFilename && item.virtualFilename !== item.name && (
                <p
                  className="text-muted-foreground mb-1 w-full truncate text-xs"
                  title={item.name}
                >
                  {item.name}
                </p>
              )}

              {/* Metadata */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-1 text-xs">
                {item.size && (
                  <span className="whitespace-nowrap">
                    {formatFileSize(item.size)}
                  </span>
                )}

                {/* File type badge */}
                {item.mimeType && (
                  <Badge variant="secondary" className="h-4 px-1 py-0 text-xs">
                    {item.mimeType.split('/')[0]?.toUpperCase() || 'FILE'}
                  </Badge>
                )}
              </div>

              {/* Modification date */}
              {item.modified && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {new Date(item.modified).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Action buttons overlay */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                className="bg-background/80 hover:bg-background rounded-md border p-1 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle download or preview
                }}
                title="Preview"
              >
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>

              <button
                className="bg-background/80 hover:bg-background rounded-md border p-1 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle menu
                }}
                title="More options"
              >
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
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
)

GridItem.displayName = 'GridItem'

export const FolderGrid = memo(function FolderGrid({
  items,
  folderId,
  className,
  itemHeight = 200,
  columns = 6,
  gap = 4,
  selectable = false,
  onItemSelect,
  onItemDoubleClick,
}: FolderGridProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Calculate responsive columns
  const responsiveColumns = useMemo(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth
      if (width < 640) return 2 // Mobile
      if (width < 1024) return 4 // Tablet
      if (width < 1280) return 6 // Desktop
      return 8 // Large desktop
    }
    return columns
  }, [columns])

  const finalColumns = responsiveColumns
  const finalItemHeight = itemHeight + gap // Account for gap

  // Calculate grid dimensions
  const rowCount = Math.ceil(items.length / finalColumns)

  const handleItemSelect = (item: FolderContentsItem, selected: boolean) => {
    const newSelectedItems = new Set(selectedItems)

    if (selected) {
      newSelectedItems.add(item.id)
    } else {
      newSelectedItems.delete(item.id)
    }

    setSelectedItems(newSelectedItems)
    onItemSelect?.(item, selected)
  }

  const handleItemDoubleClick = (item: FolderContentsItem) => {
    onItemDoubleClick?.(item)

    // Default behavior: navigate to folder or open file
    if (item.type === 'folder') {
      window.location.href = `/folders/${item.id}`
    }
  }

  // For small item counts, render without virtualization
  if (items.length < 50) {
    return (
      <div
        className={cn(
          'grid gap-2',
          `grid-cols-${Math.min(finalColumns, 6)}`, // Limit to 6 for CSS
          className
        )}
      >
        {items.map((item) => (
          <GridItem
            key={item.id}
            columnIndex={0}
            rowIndex={0}
            style={{}}
            data={{
              items: [item],
              columns: 1,
              itemHeight,
              gap,
              selectable,
              selectedItems,
              onItemSelect: handleItemSelect,
              onItemDoubleClick: handleItemDoubleClick,
            }}
          />
        ))}
      </div>
    )
  }

  // Use virtualization for large item counts
  return (
    <div className={cn('w-full', className)}>
      <Grid
        columnCount={finalColumns}
        columnWidth={
          (typeof window !== 'undefined' ? window.innerWidth : 1200) /
            finalColumns -
          gap
        }
        height={600} // Fixed height for container
        rowCount={rowCount}
        rowHeight={finalItemHeight}
        itemData={{
          items,
          columns: finalColumns,
          itemHeight,
          gap,
          selectable,
          selectedItems,
          onItemSelect: handleItemSelect,
          onItemDoubleClick: handleItemDoubleClick,
        }}
        className="scrollbar-thin scrollbar-thumb-border"
      >
        {GridItem}
      </Grid>
    </div>
  )
})
