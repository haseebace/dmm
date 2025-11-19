/**
 * FileIcon Component
 *
 * Displays appropriate icon for files and folders
 */

import React from 'react'
import { FolderContentsItem } from '@/types/navigation'
import { getFileIconProps } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileIconProps {
  item: FolderContentsItem
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function FileIcon({ item, size, className }: FileIconProps) {
  const iconProps = getFileIconProps(item, { size, className })

  if ('paths' in iconProps) {
    // For icons with multiple paths (like archives)
    return (
      <svg
        className={iconProps.className}
        viewBox={iconProps.viewBox}
        fill={iconProps.fill}
        stroke={iconProps.stroke}
        strokeWidth={iconProps.strokeWidth}
      >
        {iconProps.paths.map((path, index) => (
          <path
            key={index}
            strokeLinecap="round"
            strokeLinejoin="round"
            d={path}
          />
        ))}
      </svg>
    )
  }

  // For icons with single path
  return (
    <svg
      className={iconProps.className}
      viewBox={iconProps.viewBox}
      fill={iconProps.fill}
      stroke={iconProps.stroke}
      strokeWidth={iconProps.strokeWidth}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={iconProps.d} />
    </svg>
  )
}
