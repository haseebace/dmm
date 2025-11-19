/**
 * BreadcrumbNavigation Component
 *
 * Display hierarchical navigation path with clickable segments
 */

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BreadcrumbItem } from '@/types/navigation'

interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[]
  className?: string
  maxVisible?: number
  showHome?: boolean
  variant?: 'default' | 'minimal'
}

export function BreadcrumbNavigation({
  items,
  className,
  maxVisible = 5,
  showHome = true,
  variant = 'default',
}: BreadcrumbNavigationProps) {
  const router = useRouter()

  const { visibleItems, hasOverflow, overflowCount } = useMemo(() => {
    let visible = [...items] as (BreadcrumbItem & { isOverflow?: boolean })[]
    let overflow = false
    let overflowItems = 0

    // Always show home if enabled
    if (showHome && visible.length > 0 && visible[0].isRoot) {
      visible = visible.filter((item) => !item.isRoot)
      visible.unshift({
        id: 'home',
        name: 'Home',
        path: '/folders',
        isRoot: true,
      })
    }

    // Check if we need to truncate
    if (visible.length > maxVisible) {
      const keepStart = Math.ceil(maxVisible / 2)
      const keepEnd = Math.floor(maxVisible / 2)

      overflow = true
      overflowItems = visible.length - maxVisible

      visible = [
        ...visible.slice(0, keepStart),
        {
          id: 'overflow',
          name: '...',
          path: '#',
          isOverflow: true,
        },
        ...visible.slice(visible.length - keepEnd),
      ]
    }

    return {
      visibleItems: visible,
      hasOverflow: overflow,
      overflowCount,
    }
  }, [items, maxVisible, showHome])

  const handleBreadcrumbClick = (
    item: BreadcrumbItem & { isOverflow?: boolean }
  ) => {
    if (item.isOverflow) return

    if (item.isRoot && item.path === '/folders') {
      router.push(item.path)
    } else if (item.id && item.path) {
      router.push(item.path)
    }
  }

  const handleHomeClick = () => {
    router.push('/folders')
  }

  if (variant === 'minimal') {
    return (
      <div
        className={cn(
          'text-muted-foreground flex items-center text-sm',
          className
        )}
      >
        {visibleItems.slice(0, -1).map((item, index) => (
          <React.Fragment key={item.id}>
            <button
              onClick={() => handleBreadcrumbClick(item)}
              className="hover:text-foreground max-w-[150px] truncate transition-colors"
              title={item.name}
            >
              {item.name}
            </button>
            {index < visibleItems.length - 2 && (
              <ChevronRight className="mx-1 h-3 w-3 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
        <span className="text-foreground font-medium">
          {visibleItems[visibleItems.length - 1]?.name}
        </span>
      </div>
    )
  }

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn('flex items-center space-x-1', className)}
    >
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1
        const isHome = item.isRoot || item.id === 'home'
        const isOverflow = item.isOverflow

        return (
          <React.Fragment key={item.id}>
            {/* Home button */}
            {isHome && !isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleHomeClick()}
                className={cn(
                  'flex h-7 items-center space-x-1 px-2',
                  'hover:bg-accent'
                )}
              >
                <Home className="h-3 w-3" />
                <span className="text-xs">Home</span>
              </Button>
            )}

            {/* Regular breadcrumb item */}
            {!isHome && !isOverflow && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBreadcrumbClick(item)}
                className={cn(
                  'h-7 px-3',
                  'hover:bg-accent',
                  isLast
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground',
                  'transition-colors'
                )}
                disabled={isLast}
              >
                <span className="max-w-[200px] truncate text-sm">
                  {item.name}
                </span>
              </Button>
            )}

            {/* Overflow indicator */}
            {isOverflow && (
              <div className="group relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  title={`${overflowCount} more items`}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
                {/* Dropdown with overflow items */}
                <div className="bg-popover absolute top-full left-0 z-50 hidden min-w-[200px] rounded-md border p-1 shadow-lg group-hover:block">
                  <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                    More folders
                  </div>
                  {items
                    .slice(
                      Math.ceil(maxVisible / 2),
                      Math.ceil(maxVisible / 2) * -1 || undefined
                    )
                    .map((overflowItem) => (
                      <button
                        key={overflowItem.id}
                        onClick={() => handleBreadcrumbClick(overflowItem)}
                        className="hover:bg-accent block w-full rounded px-2 py-1 text-left text-sm transition-colors"
                      >
                        {overflowItem.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Separator */}
            {!isLast && (
              <ChevronRight className="text-muted-foreground h-3 w-3 flex-shrink-0" />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

/**
 * Compact breadcrumb for mobile
 */
export function CompactBreadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  const { shortenedPath } = useMemo(() => {
    if (items.length <= 3) {
      return items.map((item) => item.name).join(' / ')
    }

    return `${items[0].name} / ... / ${items[items.length - 1].name}`
  }, [items])

  return (
    <div className={cn('text-muted-foreground truncate text-sm', className)}>
      {shortenedPath}
    </div>
  )
}

/**
 * Breadcrumb with keyboard navigation support
 */
export function AccessibleBreadcrumbNavigation(
  props: BreadcrumbNavigationProps
) {
  return (
    <BreadcrumbNavigation
      {...props}
      className={cn(
        'focus-within:ring-ring focus-within:ring-2 focus-within:outline-none',
        props.className
      )}
    />
  )
}
