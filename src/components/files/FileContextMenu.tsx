/**
 * FileContextMenu Component
 *
 * Context menu for file operations
 */

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAssignmentsForFile } from '@/stores/fileAssignmentStore'
import { AssignmentDialog } from '@/components/folders/AssignmentDialog'

interface FileContextMenuProps {
  file: any
  position: { x: number; y: number }
  onClose: () => void
  onAssign: (folderId: string) => void
  onRemove?: (folderId: string) => void
}

export function FileContextMenu({
  file,
  position,
  onClose,
  onAssign,
  onRemove,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const fileAssignments = useAssignmentsForFile(file.id)

  /**
   * Handle click outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  /**
   * Adjust position to stay within viewport
   */
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200 // Approximate menu width
    const menuHeight = 300 // Approximate max menu height

    let x = position.x
    let y = position.y

    // Ensure menu doesn't go off right edge
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }

    // Ensure menu doesn't go off bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }

    // Ensure menu doesn't go off left or top edges
    x = Math.max(10, x)
    y = Math.max(10, y)

    return { x, y }
  }, [position])

  /**
   * Handle menu item clicks
   */
  const handleAssignToFolder = () => {
    setAssignmentDialogOpen(true)
    onClose()
  }

  const handleOpen = () => {
    console.log('Open file:', file)
    onClose()
  }

  const handleDownload = () => {
    console.log('Download file:', file)
    onClose()
  }

  const handleCopyLink = () => {
    if (file.download_url) {
      navigator.clipboard.writeText(file.download_url)
      // TODO: Show toast notification
    }
    onClose()
  }

  const handleViewInfo = () => {
    console.log('View file info:', file)
    onClose()
  }

  const menuItems = [
    {
      key: 'assign',
      label: 'Assign to Folder...',
      icon: 'folder-plus',
      onClick: handleAssignToFolder,
      separator: false,
    },
    {
      key: 'open',
      label: 'Open',
      icon: 'external-link',
      onClick: handleOpen,
      separator: true,
    },
    {
      key: 'download',
      label: 'Download',
      icon: 'download',
      onClick: handleDownload,
      separator: false,
    },
    {
      key: 'copy-link',
      label: 'Copy Link',
      icon: 'link',
      onClick: handleCopyLink,
      disabled: !file.download_url,
      separator: false,
    },
    {
      key: 'info',
      label: 'File Info',
      icon: 'info',
      onClick: handleViewInfo,
      separator: true,
    },
  ]

  // Add "Remove from Folder" items if file is assigned to folders
  if (fileAssignments.length > 0) {
    const removeItems = fileAssignments.map((assignment, index) => ({
      key: `remove-${assignment.folder_id}`,
      label: `Remove from ${assignment.folders?.name || 'Folder'}`,
      icon: 'folder-minus',
      onClick: () => onRemove?.(assignment.folder_id),
      separator: index === 0 && fileAssignments.length > 0,
    }))

    // Insert remove items after "Assign to Folder"
    menuItems.splice(1, 0, ...removeItems)
  }

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="bg-background fixed z-50 min-w-[200px] rounded-lg border py-1 shadow-lg"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
        role="menu"
        aria-orientation="vertical"
      >
        {menuItems.map((item) => (
          <React.Fragment key={item.key}>
            {item.separator && <div className="my-1 border-t" />}
            <button
              className={`hover:bg-muted focus:bg-muted flex w-full items-center space-x-2 px-3 py-2 text-left text-sm focus:outline-none ${item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              role="menuitem"
            >
              <MenuIcon type={item.icon} className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Assignment Dialog */}
      {assignmentDialogOpen && (
        <AssignmentDialog
          file={file}
          onClose={() => setAssignmentDialogOpen(false)}
          onAssign={(folderId, virtualFilename) => {
            onAssign(folderId)
            setAssignmentDialogOpen(false)
          }}
        />
      )}
    </>,
    document.body
  )
}

/**
 * Menu Icon Component
 */
interface MenuIconProps {
  type: string
  className?: string
}

function MenuIcon({ type, className = '' }: MenuIconProps) {
  const icons: Record<string, JSX.Element> = {
    'folder-plus': (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
    ),
    'folder-minus': (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 13h6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    'external-link': (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    ),
    download: (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    link: (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    info: (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  }

  return icons[type] || icons.info
}
