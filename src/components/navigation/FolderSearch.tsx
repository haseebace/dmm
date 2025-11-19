/**
 * FolderSearch Component
 *
 * Search and filter within current folder with real-time search
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { Search, Filter, X, MoreHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
  FilterOptions,
  SortField,
  SortOrder,
  ViewMode,
} from '@/types/navigation'
import { cn } from '@/lib/utils'

interface FolderSearchProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  filters: FilterOptions
  onFiltersChange: (filters: Partial<FilterOptions>) => void
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField, order: SortOrder) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  className?: string
  showAdvancedFilters?: boolean
  disabled?: boolean
}

export function FolderSearch({
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  className,
  showAdvancedFilters = true,
  disabled = false,
}: FolderSearchProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [activeFilterCount, setActiveFilterCount] = useState(0)

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Update search when debounced value changes
  useEffect(() => {
    onSearchChange(debouncedSearchTerm)
  }, [debouncedSearchTerm, onSearchChange])

  // Count active filters
  useEffect(() => {
    const count = Object.entries(filters).filter(([_, value]) => {
      return value && value !== 'all'
    }).length
    setActiveFilterCount(count)
  }, [filters])

  const handleClearSearch = useCallback(() => {
    onSearchChange('')
  }, [onSearchChange])

  const handleSortChange = useCallback(
    (value: string) => {
      const [field, order] = value.split('-') as [SortField, SortOrder]
      onSortChange(field, order)
    },
    [onSortChange]
  )

  const handleFilterChange = useCallback(
    (key: keyof FilterOptions, value: string) => {
      onFiltersChange({
        [key]: value === 'all' ? undefined : value,
      })
    },
    [onFiltersChange]
  )

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      fileType: 'all',
      dateRange: 'all',
      sizeRange: 'all',
      assignedStatus: 'all',
    })
  }, [onFiltersChange])

  const hasSearchTerm = searchTerm.length > 0
  const hasActiveFilters = activeFilterCount > 0

  const sortValue = `${sortBy}-${sortOrder}`

  return (
    <div className={cn('flex flex-col space-y-4', className)}>
      {/* Search bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
        <Input
          placeholder="Search files and folders..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-9 pl-9"
          disabled={disabled}
        />
        {hasSearchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 transform p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <Select
          value={sortValue}
          onValueChange={handleSortChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="size-asc">Size (Smallest)</SelectItem>
            <SelectItem value="size-desc">Size (Largest)</SelectItem>
            <SelectItem value="modified-desc">Recently Modified</SelectItem>
            <SelectItem value="modified-asc">Oldest Modified</SelectItem>
            <SelectItem value="type-asc">Type (A-Z)</SelectItem>
            <SelectItem value="type-desc">Type (Z-A)</SelectItem>
          </SelectContent>
        </Select>

        {/* Quick filters */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleFilterChange(
              'fileType',
              filters.fileType === 'all' ? 'images' : 'all'
            )
          }
          className={cn(
            filters.fileType !== 'all' &&
              'border-primary bg-primary/10 text-primary'
          )}
          disabled={disabled}
        >
          Images
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleFilterChange(
              'fileType',
              filters.fileType === 'all' ? 'videos' : 'all'
            )
          }
          className={cn(
            filters.fileType === 'videos' &&
              'border-primary bg-primary/10 text-primary'
          )}
          disabled={disabled}
        >
          Videos
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleFilterChange(
              'fileType',
              filters.fileType === 'all' ? 'documents' : 'all'
            )
          }
          className={cn(
            filters.fileType === 'documents' &&
              'border-primary bg-primary/10 text-primary'
          )}
          disabled={disabled}
        >
          Documents
        </Button>

        {/* Advanced filters */}
        {showAdvancedFilters && (
          <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'relative',
                  hasActiveFilters > 0 &&
                    'border-primary bg-primary/10 text-primary'
                )}
                disabled={disabled}
              >
                <Filter className="mr-1 h-4 w-4" />
                Filters
                {hasActiveFilters > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-[20px] px-1"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Advanced Filters</h3>
                  {hasActiveFilters > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                {/* File Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Type</label>
                  <Select
                    value={filters.fileType || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('fileType', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Files</SelectItem>
                      <SelectItem value="images">Images</SelectItem>
                      <SelectItem value="videos">Videos</SelectItem>
                      <SelectItem value="documents">Documents</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="archives">Archives</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <Select
                    value={filters.dateRange || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('dateRange', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Size Range Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Size Range</label>
                  <Select
                    value={filters.sizeRange || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('sizeRange', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sizes</SelectItem>
                      <SelectItem value="small">Small (&lt;1MB)</SelectItem>
                      <SelectItem value="medium">Medium (1-10MB)</SelectItem>
                      <SelectItem value="large">Large (&gt;10MB)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={filters.assignedStatus || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('assignedStatus', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* View mode toggle */}
        <div className="flex items-center rounded-md border">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="rounded-r-none border-r-0"
            disabled={disabled}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="rounded-l-none border-l-0"
            disabled={disabled}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Active filters summary */}
      {(hasSearchTerm || hasActiveFilters) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {hasSearchTerm && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{searchTerm}"
              <button
                onClick={handleClearSearch}
                className="hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.fileType && filters.fileType !== 'all' && (
            <Badge variant="secondary">Type: {filters.fileType}</Badge>
          )}

          {filters.dateRange && filters.dateRange !== 'all' && (
            <Badge variant="secondary">Date: {filters.dateRange}</Badge>
          )}

          {filters.sizeRange && filters.sizeRange !== 'all' && (
            <Badge variant="secondary">Size: {filters.sizeRange}</Badge>
          )}

          {filters.assignedStatus && filters.assignedStatus !== 'all' && (
            <Badge variant="secondary">Status: {filters.assignedStatus}</Badge>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Mobile search component
 */
export function MobileFolderSearch(props: FolderSearchProps) {
  return (
    <div className={cn('flex flex-col space-y-3', props.className)}>
      {/* Compact search bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
        <Input
          placeholder="Search..."
          value={props.searchTerm}
          onChange={(e) => props.onSearchChange(e.target.value)}
          className="pr-9 pl-9"
          disabled={props.disabled}
        />
        {props.searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onSearchChange('')}
            className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 transform p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Mobile-friendly filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Select
          value={`${props.sortBy}-${props.sortOrder}`}
          onValueChange={(value) => {
            const [field, order] = value.split('-')
            props.onSortChange(field as SortField, order as SortOrder)
          }}
          disabled={props.disabled}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name</SelectItem>
            <SelectItem value="size-asc">Size</SelectItem>
            <SelectItem value="modified-desc">Modified</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            props.onViewModeChange(props.viewMode === 'grid' ? 'list' : 'grid')
          }
          disabled={props.disabled}
        >
          {props.viewMode === 'grid' ? 'List' : 'Grid'}
        </Button>
      </div>
    </div>
  )
}
