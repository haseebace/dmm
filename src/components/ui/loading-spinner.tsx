/**
 * LoadingSpinner Component
 *
 * Animated loading spinner component
 */

import React from 'react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}

const sizeClasses = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function LoadingSpinner({
  size = 'md',
  className,
  children,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
          sizeClasses[size]
        )}
      >
        <span className="sr-only">Loading...</span>
      </div>
      {children && <div className="ml-3">{children}</div>}
    </div>
  )
}
