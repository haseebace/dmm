/**
 * ContentsList Component
 *
 * List view for files and folders with virtual scrolling
 */

import React, { memo, useMemo, useState } from 'react'
import { FixedSizeList as List } from 'react-window'
import { FolderContentsItem } from '@/types/navigation'
import { formatFileSize, formatDate } from '@/lib/utils'
import { FileIcon } from '@/components/ui/file-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Download, Eye, Trash2, Edit } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ContentsListProps {
  items: FolderContentsItem[]
  folderId: string | null
  className?: string
  itemHeight?: number
  height?: number
  selectable?: boolean
  showHeader?: boolean
  onItemSelect?: (item: FolderContentsItem, selected: boolean) => void
  onItemDoubleClick?: (item: FolderContentsItem) => void
}

interface ListItemProps {
  index: number
  style: React.CSSProperties
  data: {
    items: FolderContentsItem[]
    selectable: boolean
    selectedItems: Set<string>
    onItemSelect: (item: FolderContentsItem, selected: boolean) => void
    onItemDoubleClick: (item: FolderContentsItem) => void
  }
}

const ListItem = memo(({ index, style, data }: ListItemProps) => {
  const { items, selectable, selectedItems, onItemSelect, onItemDoubleClick } =
    data

  const item = items[index]
  const isSelected = selectedItems.has(item.id)

  const handleSelect = (checked: boolean) => {
    onItemSelect?.(item, checked)
  }

  const handleDoubleClick = () => {
    onItemDoubleClick?.(item)
  }

  const handleClick = () => {
    if (item.type === 'folder') {
      // Navigate to folder
      window.location.href = `/folders/${item.id}`
    }
  }

  return (
    <div style={style}>
      <div
        className={cn(
          'group hover:bg-muted/50 flex cursor-pointer items-center border-b px-4 py-2 transition-colors',
          'last:border-b-0',
          isSelected && 'bg-primary/5 border-primary/20'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div className="mr-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleSelect}
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        )}

        {/* File/Folder icon */}
        <div className="mr-3 flex-shrink-0">
          <FileIcon item={item} size="sm" />
        </div>

        {/* Name and details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium" title={item.name}>
              {item.virtualFilename || item.name}
            </span>

            {/* Original filename badge */}
            {item.virtualFilename && item.virtualFilename !== item.name && (
              <Badge variant="outline" className="text-xs">
                Original: {item.name}
              </Badge>
            )}

            {/* File type indicator */}
            {item.mimeType && (
              <Badge variant="secondary" className="h-5 px-1 py-0 text-xs">
                {item.mimeType.split('/')[0]?.toUpperCase() || 'FILE'}
              </Badge>
            )}
          </div>
        </div>

        {/* Size */}
        <div className="text-muted-foreground mr-4 w-20 text-right text-sm">
          {item.size ? formatFileSize(item.size) : '-'}
        </div>

        {/* Modified date */}
        <div className="text-muted-foreground mr-4 w-32 text-right text-sm">
          {item.modified ? formatDate(new Date(item.modified)) : '-'}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              // Handle preview
            }}
            title="Preview"
          >
            <Eye className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              // Handle download
            }}
            title="Download"
          >
            <Download className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle rename
                }}
              >
                <Edit className="mr-2 h-3 w-3" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle move
                }}
              >
                <svg
                  className="mr-2 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Move
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  // Handle delete
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
})

ListItem.displayName = 'ListItem'

export const ContentsList = memo(function ContentsList({
  items,
  folderId,
  className,
  itemHeight = 60,
  height = 600,
  selectable = false,
  showHeader = true,
  onItemSelect,
  onItemDoubleClick,
}: ContentsListProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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
  if (items.length < 25) {
    return (
      <div className={cn('overflow-hidden rounded-md border', className)}>
        {showHeader && (
          <div className="bg-muted/50 text-muted-foreground flex items-center border-b px-4 py-2 text-sm font-medium">
            {selectable && <div className="mr-3 w-5" />}
            <div className="mr-3 w-6" />
            <div className="flex-1">Name</div>
            <div className="mr-4 w-20 text-right">Size</div>
            <div className="mr-4 w-32 text-right">Modified</div>
            <div className="w-32">Actions</div>
          </div>
        )}

        <div>
          {items.map((item, index) => (
            <ListItem
              key={item.id}
              index={index}
              style={{}}
              data={{
                items: [item],
                selectable,
                selectedItems,
                onItemSelect: handleItemSelect,
                onItemDoubleClick: handleItemDoubleClick,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Use virtualization for large item counts
  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      {showHeader && (
        <div className="bg-muted/50 text-muted-foreground flex items-center border-b px-4 py-2 text-sm font-medium">
          {selectable && <div className="mr-3 w-5" />}
          <div className="mr-3 w-6" />
          <div className="flex-1">Name</div>
          <div className="mr-4 w-20 text-right">Size</div>
          <div className="mr-4 w-32 text-right">Modified</div>
          <div className="w-32">Actions</div>
        </div>
      )}

      <List
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={{
          items,
          selectable,
          selectedItems,
          onItemSelect: handleItemSelect,
          onItemDoubleClick: handleItemDoubleClick,
        }}
        className="scrollbar-thin scrollbar-thumb-border"
      >
        {ListItem}
      </List>
    </div>
  )
})
